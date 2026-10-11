"""Project congestion estimates with explicit model/database/default provenance."""
from datetime import datetime, timezone
import logging
import math
from pathlib import Path
import re
import warnings

from fastapi import APIRouter, HTTPException, Query
import joblib
from sklearn.exceptions import InconsistentVersionWarning

from database import get_supabase_client

router = APIRouter()
logger = logging.getLogger(__name__)
FEATURES = {'hour', 'is_peak', 'day_type_weekday', 'day_type_weekend',
    'corridor_type_access_road', 'corridor_type_industrial_arterial', 'corridor_type_urban_arterial'}
LEVELS = {'low', 'medium', 'high'}


def positive_multiplier(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise ValueError('Invalid multiplier')
    return float(value)


def validate_features(model, columns):
    if not isinstance(columns, list) or len(columns) != len(FEATURES) or not all(isinstance(name, str) for name in columns) or set(columns) != FEATURES:
        raise ValueError('Incompatible model features')
    if not callable(getattr(model, 'predict', None)) or getattr(model, 'n_features_in_', None) != len(columns):
        raise ValueError('Incompatible model')
    names = getattr(model, 'feature_names_in_', None)
    if names is not None and list(names) != columns:
        raise ValueError('Model feature order mismatch')


def validate_package(pkg):
    if not isinstance(pkg, dict) or not {'model', 'feature_columns', 'level_to_multiplier'} <= pkg.keys():
        raise ValueError('Invalid model package')
    model, columns, mapping = pkg['model'], pkg['feature_columns'], pkg['level_to_multiplier']
    validate_features(model, columns)
    if not isinstance(mapping, dict) or set(mapping) != LEVELS or set(getattr(model, 'classes_', [])) != LEVELS:
        raise ValueError('Invalid model labels')
    return model, columns, {label: positive_multiplier(mapping[label]) for label in LEVELS}


# Keep these exports for the existing route service; no source label is renamed.
rf_model = feature_columns = level_to_multiplier = None
MODEL_PATH = Path(__file__).resolve().parents[1] / 'rf_model.joblib'
try:
    with warnings.catch_warnings():
        warnings.simplefilter('error', InconsistentVersionWarning)
        rf_model, feature_columns, level_to_multiplier = validate_package(joblib.load(MODEL_PATH))
except Exception:
    logger.warning('Congestion model unavailable or incompatible; recorded-data fallback enabled')


def is_peak_hour(hour: int) -> int:
    """Exact notebook encoding, including both endpoint hours of the peak buckets."""
    return int(6 <= hour <= 9 or 16 <= hour <= 19)


def model_prediction(corridor, day_type, hour):
    validate_features(rf_model, feature_columns)
    corridor_column = f'corridor_type_{corridor}'
    if corridor_column not in feature_columns:
        raise ValueError('Unknown training category')
    row = {'hour': hour, 'is_peak': is_peak_hour(hour), f'day_type_{day_type}': 1, corridor_column: 1}
    with warnings.catch_warnings():
        # The package order was checked against the fitted feature names above.
        warnings.filterwarnings('ignore', message='X does not have valid feature names', category=UserWarning)
        label = str(rf_model.predict([[row.get(name, 0) for name in feature_columns]])[0]).lower()
    if label not in LEVELS or not isinstance(level_to_multiplier, dict) or label not in level_to_multiplier:
        raise ValueError('Unknown prediction or missing mapping')
    multiplier = round(positive_multiplier(level_to_multiplier[label]), 2)
    return label.upper(), positive_multiplier(multiplier)


def window_matches(row, hour):
    start, end = row['hour_start'], row['hour_end']
    if type(start) is not int or type(end) is not int or not 0 <= start <= 23 or not 0 <= end <= 24:
        raise ValueError('Invalid recorded window')
    label = row['congestion_level']
    if not isinstance(label, str) or label.lower() not in LEVELS:
        raise ValueError('Invalid recorded label')
    positive_multiplier(row['multiplier'])
    if start == end: return True  # Existing full-day convention, including 0 -> 0.
    if end > start: return start <= hour < end
    return hour >= start or hour < end


def response(source, segment_id, day_type, hour, level, multiplier, **extra):
    status, disclaimer = {
        'ml_model': ('synthetic_estimate', 'Model trained on synthetic project data; not observed or real-time traffic.'),
        'database': ('database', 'Recorded project estimate; freshness unverified, not live traffic.'),
        'fallback_default': ('default_fallback', 'No matching recorded estimate; assumed default, not observed traffic.'),
    }[source]
    return {'source': source, 'segment_id': segment_id, 'day_type': day_type, 'hour': hour,
        'congestion_level': level, 'multiplier': multiplier, 'data_status': status, 'disclaimer': disclaimer,
        'observed_at': None, 'calculated_at': datetime.now(timezone.utc).isoformat(), **extra}


@router.get('')
@router.get('/')
def get_congestion(
    segment_id: str = Query(..., description='Road segment ID (SEG001–SEG006)'),
    day_type: str = Query(..., description="'weekday' or 'weekend'"),
    hour: int = Query(..., description='Hour of day (0–23)'),
):
    if not isinstance(segment_id, str) or not re.fullmatch(r'SEG00[1-6]', segment_id):
        raise HTTPException(400, 'segment_id must be SEG001 through SEG006')
    if not isinstance(day_type, str) or day_type.lower() not in ('weekday', 'weekend'):
        raise HTTPException(400, "day_type must be 'weekday' or 'weekend'")
    if type(hour) is not int or not 0 <= hour <= 23:
        raise HTTPException(400, 'hour must be between 0 and 23')
    day_type = day_type.lower()

    # A database outage here cannot be repaired by another query to that database.
    try:
        supabase = get_supabase_client()
        segments = supabase.table('road_segments').select('corridor_type').eq('segment_id', segment_id).execute().data
        if not isinstance(segments, list): raise ValueError('Invalid corridor response')
        if not segments: raise HTTPException(404, 'Road segment not found')
        corridor = segments[0]['corridor_type']
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, 'Congestion reference data is temporarily unavailable') from None

    if rf_model is not None:
        try:
            level, multiplier = model_prediction(corridor, day_type, hour)
            return response('ml_model', segment_id, day_type, hour, level, multiplier)
        except Exception:
            logger.warning('Congestion prediction unavailable; checking recorded estimates')

    try:
        rows = supabase.table('congestion_multipliers').select('*').eq('segment_id', segment_id).eq('day_type', day_type).execute().data
        if not isinstance(rows, list): raise ValueError('Invalid recorded response')
        matches = [row for row in rows if window_matches(row, hour)]
        if len(matches) > 1: raise ValueError('Ambiguous recorded windows')
        if matches:
            row = matches[0]
            return response('database', segment_id, day_type, hour, row['congestion_level'].upper(),
                positive_multiplier(row['multiplier']), description=row.get('description') or '')
        return response('fallback_default', segment_id, day_type, hour, 'LOW', 1.0,
            note='No data found for this segment and day type.' if not rows else 'Hour did not match any recorded window.')
    except Exception:
        raise HTTPException(503, 'Recorded congestion estimates are temporarily unavailable') from None

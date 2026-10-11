"""Read public source rows and reproduce notebook metrics without exporting a model.

Run from the repository root: backend/.venv/Scripts/python.exe
backend/scripts/audit_congestion_model.py --output docs/oracle/evidence/sprint-6/model-audit.json
"""
import argparse
import hashlib
import json
from pathlib import Path
import platform
import warnings

from dotenv import dotenv_values
import httpx
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[2]
LABELS = ['high', 'low', 'medium']


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def expand_hours(start, end):
    start, end = int(start), int(end)
    if end == 24: end = 0
    if start == end: return list(range(24))
    if end < start: return list(range(start, 24)) + list(range(end))
    return list(range(start, end))


def audit():
    env = dotenv_values(ROOT / 'backend/.env')
    with httpx.Client(timeout=15, headers={'apikey': env['SUPABASE_ANON_KEY'], 'Authorization': 'Bearer ' + env['SUPABASE_ANON_KEY']}) as client:
        source = []
        for table, columns in [('road_segments', 'segment_id,corridor_type'),
            ('congestion_multipliers', 'segment_id,day_type,hour_start,hour_end,multiplier,congestion_level')]:
            response = client.get(env['SUPABASE_URL'] + '/rest/v1/' + table, params={'select': columns})
            response.raise_for_status(); source.append(response.json())
    segments, windows = source
    corridors = {row['segment_id']: row['corridor_type'] for row in segments}
    # Exact notebook generation order/seed and 50 repetitions; no source IDs/users.
    rng = np.random.RandomState(42)
    rows = []
    for window in windows:
        for hour in expand_hours(window['hour_start'], window['hour_end']):
            for _ in range(50):
                rows.append({'segment_id': window['segment_id'], 'corridor_type': corridors[window['segment_id']],
                    'day_type': window['day_type'], 'hour': hour, 'is_peak': int(6 <= hour <= 9 or 16 <= hour <= 19),
                    'multiplier': float(window['multiplier']) * (1 + rng.uniform(-0.10, 0.10)),
                    'congestion_level': window['congestion_level'].lower()})
    frame = pd.DataFrame(rows)
    X = pd.get_dummies(frame[['hour', 'day_type', 'corridor_type', 'is_peak']], columns=['day_type', 'corridor_type'])
    y = frame['congestion_level']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    candidate = RandomForestClassifier(n_estimators=50, random_state=42).fit(X_train, y_train)
    artifact = ROOT / 'backend/rf_model.joblib'
    before = hashlib.sha256(artifact.read_bytes()).hexdigest()
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter('always'); package = joblib.load(artifact)
    model = package['model']
    artifact_predictions = model.predict(X_test.reindex(columns=package['feature_columns']))
    reproduced_predictions = candidate.predict(X_test)
    generated_mapping = frame.groupby('congestion_level')['multiplier'].mean().round(3).to_dict()
    train_patterns = {tuple(row) for row in X_train.to_numpy()}
    test_patterns = [tuple(row) for row in X_test.to_numpy()]
    unique_patterns = X.drop_duplicates().shape[0]
    conflicts = frame.groupby(['hour','day_type','corridor_type'])['congestion_level'].nunique()
    coverage = {}
    for segment in corridors:
        for day in ['weekday','weekend']:
            counts = {hour:0 for hour in range(24)}
            for window in windows:
                if window['segment_id']==segment and window['day_type']==day:
                    for hour in expand_hours(window['hour_start'],window['hour_end']): counts[hour]+=1
            coverage[f'{segment}/{day}'] = {'missing_hours':[h for h,n in counts.items() if n==0], 'overlapping_hours':[h for h,n in counts.items() if n>1]}
    assert hashlib.sha256(artifact.read_bytes()).hexdigest() == before
    return {'scope':'Current public project reference data; synthetic notebook reproduction and unchanged stored artifact. No real traffic evaluation.',
        'source':{'road_segments':len(segments),'source_windows':len(windows),'ordered_rows_sha256':digest(source),'coverage':coverage},
        'generation':{'samples_per_hour':50,'noise_range':0.10,'numpy_seed':42,'rows':len(frame),'class_counts':y.value_counts().to_dict(),
            'unique_input_patterns':unique_patterns,'contradictory_label_patterns':int((conflicts>1).sum()),
            'noise_feature_used':False,'segment_id_feature_used':False},
        'split':{'method':'Stratified random row split','test_size':0.2,'random_state':42,'train_rows':len(X_train),'test_rows':len(X_test),
            'test_rows_with_identical_training_inputs':sum(row in train_patterns for row in test_patterns)},
        'artifact':{'sha256':before,'package_keys':list(package),'features':package['feature_columns'],'classes':list(model.classes_),
            'parameters':model.get_params(),'level_to_multiplier':package['level_to_multiplier'],'load_warning_categories':[type(w.message).__name__ for w in caught],
            'unchanged':True,'predictions_equal_reproduction':bool(np.array_equal(artifact_predictions,reproduced_predictions)),
            'feature_order_equal_reproduction':package['feature_columns']==list(X.columns), 'mapping_equal_reproduction':package['level_to_multiplier']==generated_mapping},
        'metrics':{'labels':LABELS,'stored_artifact':{'accuracy':accuracy_score(y_test,artifact_predictions),
            'report':classification_report(y_test,artifact_predictions,labels=LABELS,output_dict=True,zero_division=0),
            'confusion_matrix':confusion_matrix(y_test,artifact_predictions,labels=LABELS).tolist()},
            'temporary_reproduction':{'accuracy':accuracy_score(y_test,reproduced_predictions),
            'confusion_matrix':confusion_matrix(y_test,reproduced_predictions,labels=LABELS).tolist()}},
        'environment':{'python':platform.python_version(),'numpy':np.__version__,'pandas':pd.__version__,'scikit_learn':sklearn.__version__,'joblib':joblib.__version__},
        'limitations':['Synthetic labels derive from 25 reference windows, not independent observed traffic.',
            'Repeated identical feature patterns occur in both training and test rows; row-split accuracy is not unseen-window or field generalization.',
            'Multiplier noise is excluded from model inputs; repeated samples do not add new input information.',
            'Segment ID is excluded; corridors may share identical input patterns with conflicting labels.',
            'Level multipliers use all generated rows, including test rows, per the original notebook; these are project constants, not held-out calibrated travel times.',
            'No grouped evaluation, model export, notebook overwrite, or retraining deployment was performed.']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try: result = audit()
    except Exception: raise SystemExit('Model audit failed; check source availability and runtime without exposing credentials.') from None
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, default=lambda value:value.item() if isinstance(value,np.generic) else str(value))+'\n',encoding='utf-8')
    print(json.dumps({'source_windows':result['source']['source_windows'],'generated_rows':result['generation']['rows'],
        'artifact_accuracy':result['metrics']['stored_artifact']['accuracy'],'artifact_unchanged':True,'output':str(args.output)}))

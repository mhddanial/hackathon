from fastapi import APIRouter, HTTPException, Query
import joblib
import warnings
from database import get_supabase_client
import traceback
import os

router = APIRouter()

# Global variables for model
rf_model = None
feature_columns = None
level_to_multiplier = None

# Attempt to load the model on startup
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'rf_model.joblib')
try:
    if os.path.exists(MODEL_PATH):
        pkg = joblib.load(MODEL_PATH)
        rf_model = pkg.get('model')
        feature_columns = pkg.get('feature_columns')
        level_to_multiplier = pkg.get('level_to_multiplier')
        print(f"[OK] Successfully loaded rf_model.joblib with {len(feature_columns)} features.")
    else:
        print(f"[WARN] Model file not found at {MODEL_PATH}. Will use fallback.")
except Exception as e:
    print(f"[ERROR] Failed to load ML model: {e}")

def is_peak_hour(hour: int) -> int:
    """Helper derived from train_model.ipynb"""
    return 1 if (6 <= hour <= 9) or (16 <= hour <= 19) else 0

@router.get("")
@router.get("/")
def get_congestion(
    segment_id: str = Query(..., description="Road segment ID (e.g. SEG001)"),
    day_type: str = Query(..., description="'weekday' or 'weekend'"),
    hour: int = Query(..., description="Hour of day (0-23)")
):
    day_type = day_type.lower()
    if day_type not in ["weekday", "weekend"]:
        raise HTTPException(status_code=400, detail="day_type must be 'weekday' or 'weekend'")
    if not (0 <= hour <= 23):
        raise HTTPException(status_code=400, detail="hour must be between 0 and 23")

    supabase = get_supabase_client()
    
    # 1. Fetch corridor type for feature engineering
    try:
        resp_seg = supabase.table("road_segments").select("corridor_type").eq("segment_id", segment_id).execute()
        if not resp_seg.data:
            raise HTTPException(status_code=404, detail=f"segment_id {segment_id} not found")
        corridor = resp_seg.data[0]['corridor_type']
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching segment: {e}")
        raise HTTPException(status_code=500, detail="Internal database error while fetching segment")

    # 2. Try ML Prediction
    if rf_model and feature_columns and level_to_multiplier:
        try:
            # Build feature row using feature_columns as the strict order
            row_dict = {
                'hour': hour,
                'is_peak': is_peak_hour(hour),
                f'day_type_{day_type}': 1,
                f'corridor_type_{corridor}': 1
            }
            
            # Construct 2D array for scikit-learn without needing pandas
            row_list = []
            for col in feature_columns:
                row_list.append(row_dict.get(col, 0))
            
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                prediction = rf_model.predict([row_list])[0]
            multiplier = level_to_multiplier.get(prediction, 1.0)
            
            return {
                "source": "ml_model",
                "segment_id": segment_id,
                "day_type": day_type,
                "hour": hour,
                "congestion_level": prediction.upper(),
                "multiplier": round(multiplier, 2)
            }
        except Exception as e:
            print(f"ML prediction error: {e}")
            traceback.print_exc()
            # If ML fails, fall through to database lookup

    # 3. Fallback: Database Lookup
    try:
        # Check window logic: hour_start <= hour < hour_end
        resp_mult = supabase.table("congestion_multipliers") \
            .select("*") \
            .eq("segment_id", segment_id) \
            .eq("day_type", day_type) \
            .execute()
            
        data = resp_mult.data
        if not data:
             return {
                 "source": "fallback_default",
                 "segment_id": segment_id,
                 "congestion_level": "LOW",
                 "multiplier": 1.0,
                 "note": "No data found for this segment and day type."
             }
             
        # Find the matching window
        for row in data:
            start = row['hour_start']
            end = row['hour_end']
            
            match = False
            if end > start:
                if start <= hour < end:
                    match = True
            elif end < start: # Wrap around midnight
                if hour >= start or hour < end:
                    match = True
            elif start == end: # 24h window (0 to 24)
                match = True
                
            if match:
                return {
                    "source": "database",
                    "segment_id": segment_id,
                    "day_type": day_type,
                    "hour": hour,
                    "congestion_level": str(row.get('congestion_level', 'LOW')).upper(),
                    "multiplier": float(row.get('multiplier', 1.0)),
                    "description": row.get('description', '')
                }
                
        # If no window matches exactly (shouldn't happen with full coverage, but just in case)
        return {
            "source": "fallback_default",
            "segment_id": segment_id,
            "congestion_level": "LOW",
            "multiplier": 1.0,
            "note": "Hour did not match any recorded window."
        }
        
    except Exception as e:
        print(f"Database fallback error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during fallback")


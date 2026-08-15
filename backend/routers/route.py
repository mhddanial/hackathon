from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import requests
import math
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from database import get_supabase_client
from routers.congestion import rf_model, feature_columns, level_to_multiplier, is_peak_hour

router = APIRouter()

class Point(BaseModel):
    lat: float
    lng: float

class RouteRequest(BaseModel):
    origin: Point
    destination: Point
    time: str  # Format "HH:MM"
    day_type: str # "weekday" or "weekend"
    vessel_etd: Optional[str] = None # Format "HH:MM"
    cargo_type: Optional[str] = None # "CONTAINER" or "FAST_FREIGHT"

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def find_closest_segment(lat: float, lng: float) -> str:
    # We fetch the 6 segments to find the closest one to the route origin
    supabase = get_supabase_client()
    try:
        resp = supabase.table("road_segments").select("segment_id, start_lat, start_lng, end_lat, end_lng").execute()
        segments = resp.data
        if not segments:
            return "SEG001" # Default fallback
        
        closest_id = segments[0]["segment_id"]
        min_dist = float('inf')
        
        for seg in segments:
            # use midpoint of the segment
            mid_lat = (seg["start_lat"] + seg["end_lat"]) / 2
            mid_lng = (seg["start_lng"] + seg["end_lng"]) / 2
            dist = haversine_distance(lat, lng, mid_lat, mid_lng)
            if dist < min_dist:
                min_dist = dist
                closest_id = seg["segment_id"]
                
        return closest_id
    except Exception as e:
        print(f"Error finding closest segment: {e}")
        return "SEG001"

def get_ml_congestion(segment_id: str, day_type: str, hour: int) -> dict:
    supabase = get_supabase_client()
    try:
        resp = supabase.table("road_segments").select("corridor_type").eq("segment_id", segment_id).execute()
        corridor = resp.data[0]['corridor_type'] if resp.data else "urban_arterial"
    except:
        corridor = "urban_arterial"

    # ML Prediction
    if rf_model and feature_columns and level_to_multiplier:
        try:
            row_dict = {
                'hour': hour,
                'is_peak': is_peak_hour(hour),
                f'day_type_{day_type}': 1,
                f'corridor_type_{corridor}': 1
            }
            
            row_list = [row_dict.get(col, 0) for col in feature_columns]
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                prediction = rf_model.predict([row_list])[0]
            multiplier = level_to_multiplier.get(prediction, 1.0)
            
            return {
                "level": prediction.upper(),
                "multiplier": round(multiplier, 2)
            }
        except Exception as e:
            print(f"ML error inside route calculation: {e}")

    # Fallback default
    return {"level": "LOW", "multiplier": 1.0}

@router.post("")
@router.post("/")
def calculate_route(req: RouteRequest) -> Dict[str, Any]:
    try:
        hour = int(req.time.split(":")[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

    # 1. Fetch from OSRM
    osrm_url = f"http://router.project-osrm.org/route/v1/driving/{req.origin.lng},{req.origin.lat};{req.destination.lng},{req.destination.lat}?overview=full&geometries=geojson"
    
    distance_km = 0.0
    base_duration_min = 0.0
    route_geometry = None
    
    try:
        resp = requests.get(osrm_url, timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            if "routes" in data and len(data["routes"]) > 0:
                route = data["routes"][0]
                distance_km = route.get("distance", 0) / 1000.0
                base_duration_min = route.get("duration", 0) / 60.0
                route_geometry = route.get("geometry")
    except Exception as e:
        print(f"OSRM Error: {e}")
        
    # 2. Haversine Fallback if OSRM failed
    routing_source = "OSRM API"
    if not route_geometry:
        routing_source = "Haversine Fallback"
        straight_dist = haversine_distance(req.origin.lat, req.origin.lng, req.destination.lat, req.destination.lng)
        distance_km = straight_dist * 1.3 # 30% winding factor
        base_duration_min = (distance_km / 40.0) * 60.0 # assume 40 km/h average speed
        
        # Create a simple straight line GeoJSON
        route_geometry = {
            "type": "LineString",
            "coordinates": [
                [req.origin.lng, req.origin.lat],
                [req.destination.lng, req.destination.lat]
            ]
        }

    # 3. Find closest segment to apply congestion model
    closest_seg = find_closest_segment(req.origin.lat, req.origin.lng)
    
    # 4. Get ML congestion prediction
    congestion_data = get_ml_congestion(closest_seg, req.day_type.lower(), hour)
    multiplier = congestion_data["multiplier"]
    
    # 5. Final Calculation
    final_time_min = base_duration_min * multiplier
    
    # Simple emission formula: roughly 0.2 kg CO2 per km for a light truck, increased by congestion
    emission_kg = distance_km * 0.2 * multiplier

    # 6. Backward Calculation for Optimal Departure
    latest_gate_in = None
    optimal_departure = None
    
    if req.vessel_etd and req.cargo_type:
        try:
            # Parse ETD
            etd_obj = datetime.strptime(req.vessel_etd, "%H:%M")
            # Margin rules
            margin_mins = 120 if req.cargo_type.upper() == "CONTAINER" else 60
            
            gate_in_obj = etd_obj - timedelta(minutes=margin_mins)
            dep_obj = gate_in_obj - timedelta(minutes=final_time_min)
            
            latest_gate_in = gate_in_obj.strftime("%H:%M")
            optimal_departure = dep_obj.strftime("%H:%M")
        except Exception as e:
            print(f"Error in backward calculation: {e}")

    return {
        "origin": req.origin.model_dump(),
        "destination": req.destination.model_dump(),
        "routing_source": routing_source,
        "distance_km": round(distance_km, 2),
        "base_time_min": round(base_duration_min, 2),
        "final_time_min": round(final_time_min, 2),
        "congestion_level": congestion_data["level"],
        "congestion_multiplier": multiplier,
        "emission_kg": round(emission_kg, 2),
        "matched_segment_id": closest_seg,
        "latest_gate_in": latest_gate_in,
        "optimal_departure": optimal_departure,
        "route_geometry": route_geometry
    }

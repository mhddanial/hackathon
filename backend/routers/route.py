from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
import requests
import math
from typing import Dict, Any, List, Optional, Literal
from datetime import datetime, timedelta, timezone
from schemas.route import RouteData

from database import get_supabase_client
from road_segments import segment_name
from locations import in_planning_area
from route_geometry import compact_geometry
from route_planning import clock_time, vessel_time, planning_date, planning_context
from routers.congestion import rf_model, feature_columns, level_to_multiplier, is_peak_hour

router = APIRouter()

class Point(BaseModel):
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)

class RouteRequest(BaseModel):
    origin: Point
    destination: Point
    time: str
    day_type: Literal['weekday', 'weekend']
    vessel_etd: Optional[str] = None
    cargo_type: Optional[Literal['CONTAINER', 'FAST_FREIGHT']] = None
    departure_date: Optional[str] = None
    origin_name: Optional[str] = Field(default=None, max_length=256)
    destination_name: Optional[str] = Field(default=None, max_length=256)

    _clock = field_validator('time', mode='before')(clock_time)
    _etd = field_validator('vessel_etd', mode='before')(vessel_time)
    _date = field_validator('departure_date', mode='before')(planning_date)

    @field_validator('day_type', 'cargo_type', mode='before')
    @classmethod
    def normalize_choices(cls, value, info):
        if not isinstance(value, str): return value
        return value.strip().lower() if info.field_name == 'day_type' else value.strip().upper().replace(' ', '_').replace('-', '_')

    @model_validator(mode='after')
    def validate_planning(self):
        if (self.vessel_etd is None) != (self.cargo_type is None):
            raise ValueError('Vessel ETD and cargo type must be provided together')
        if not all(in_planning_area(p.lat, p.lng) for p in [self.origin, self.destination]):
            raise ValueError('Origin and destination must be within the supported Batam planning area')
        planning_context(self.time, self.day_type, self.departure_date, self.vessel_etd)
        return self

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

def find_closest_segment(lat: float, lng: float) -> str | None:
    # We fetch the 6 segments to find the closest one to the route origin
    supabase = get_supabase_client()
    try:
        resp = supabase.table("road_segments").select("segment_id, start_lat, start_lng, end_lat, end_lng").execute()
        segments = resp.data
        if not segments:
            return None
        
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
                
        return closest_id if min_dist <= 10 else None
    except Exception as e:
        print(f"Error finding closest segment: {e}")
        return None

def get_ml_congestion(segment_id: str | None, day_type: str, hour: int) -> dict:
    if segment_id is None:
        return {"level": None, "multiplier": 1.0, "segment_name": None, "status": "unavailable"}
    name = segment_name(segment_id)
    try:
        supabase = get_supabase_client()
        resp = supabase.table("road_segments").select("corridor_type,name").eq("segment_id", segment_id).execute()
        corridor = resp.data[0]['corridor_type'] if resp.data else "urban_arterial"
        if resp.data: name = segment_name(segment_id, resp.data[0].get('name'))
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
                "segment_name": name,
                "status": "synthetic_estimate",
                "level": prediction.upper(),
                "multiplier": round(multiplier, 2)
            }
        except Exception as e:
            print(f"ML error inside route calculation: {e}")

    # Fallback default
    return {"level": None, "multiplier": 1.0, "segment_name": name, "status": "default_fallback"}

@router.post("", response_model=RouteData)
@router.post("/", response_model=RouteData)
def calculate_route(req: RouteRequest) -> Dict[str, Any]:
    plan = planning_context(req.time, req.day_type, req.departure_date, req.vessel_etd)
    hour = int(plan['time'].split(':')[0])

    # 1. Fetch from OSRM
    osrm_url = f"https://router.project-osrm.org/route/v1/driving/{req.origin.lng},{req.origin.lat};{req.destination.lng},{req.destination.lat}?overview=simplified&geometries=geojson"
    
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
                if not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0 for v in [route.get('distance'), route.get('duration')]):
                    raise ValueError('Invalid routing metrics')
                route_geometry = compact_geometry(route.get("geometry"))
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
    gate_in_obj = dep_obj = None
    feasible = None
    arrival = None
    slack = None
    warnings = []
    if plan['date_inferred']: warnings.append('Departure date inferred from the vessel departure date; provide your departure date if different.')
    if congestion_data['status'] != 'synthetic_estimate': warnings.append('Corridor congestion unavailable; travel time assumes a 1.0 multiplier.')
    
    if plan['departure']:
        arrival = plan['departure'] + timedelta(minutes=final_time_min)

    if req.vessel_etd and req.cargo_type:
        try:
            # Parse ETD
            etd_obj = plan['etd'] or datetime.strptime(plan['etd_clock'], "%H:%M")
            # Margin rules
            margin_mins = 120 if req.cargo_type.upper() == "CONTAINER" else 60
            
            gate_in_obj = etd_obj - timedelta(minutes=margin_mins)
            dep_obj = gate_in_obj - timedelta(minutes=final_time_min)
            if plan['etd'] is None and dep_obj.date() != etd_obj.date():
                raise HTTPException(400, 'Provide a departure date and a vessel departure timestamp with a time zone for a cutoff/departure crossing midnight.')
            planned_departure = plan['departure'] or datetime.strptime(req.time, '%H:%M')
            arrival = planned_departure + timedelta(minutes=final_time_min)
            if plan['etd'] is None and arrival.date() != planned_departure.date():
                raise HTTPException(400, 'Provide a departure date and a vessel departure timestamp with a time zone for an arrival crossing midnight.')
            slack = (gate_in_obj - arrival).total_seconds() / 60
            feasible = slack >= 0
            if dep_obj.hour != hour or dep_obj.date() != planned_departure.date():
                warnings.append('Suggested departure uses congestion at the requested departure time; recalculate if you select another traffic period.')
            if not feasible: warnings.append('Requested departure is later than the latest estimated departure for this estimate.')
            
            latest_gate_in = gate_in_obj.strftime("%H:%M")
            optimal_departure = dep_obj.strftime("%H:%M")
        except HTTPException:
            raise
        except (ValueError, OverflowError):
            raise HTTPException(400, 'The vessel/departure planning times cannot be calculated.') from None

    return RouteData.model_validate({
        "origin": req.origin.model_dump(),
        "destination": req.destination.model_dump(),
        "origin_name": req.origin_name,
        "destination_name": req.destination_name,
        "departure_time": req.time,
        "departure_date": plan['date'],
        "planning_timezone": 'Asia/Jakarta',
        "day_type": req.day_type,
        "cargo_type": req.cargo_type,
        "vessel_etd": plan['etd'].isoformat() if plan['etd'] else plan['etd_clock'],
        "departure_datetime": plan['departure'].isoformat() if plan['departure'] else None,
        "latest_gate_in_datetime": gate_in_obj.isoformat() if gate_in_obj and plan['etd'] else None,
        "optimal_departure_datetime": dep_obj.isoformat() if dep_obj and plan['etd'] else None,
        "estimated_arrival_datetime": arrival.isoformat() if arrival and plan['departure'] else None,
        "estimated_arrival_time": arrival.strftime('%H:%M') if arrival else None,
        "cutoff_slack_min": round(slack, 2) if slack is not None else None,
        "calculation_time": datetime.now(timezone.utc).isoformat(),
        "departure_date_inferred": plan['date_inferred'],
        "departure_feasible": feasible,
        "planning_warning": ' '.join(warnings) or None,
        "routing_source": routing_source,
        "distance_km": round(distance_km, 2),
        "base_time_min": round(base_duration_min, 2),
        "final_time_min": round(final_time_min, 2),
        "congestion_level": congestion_data["level"],
        "congestion_multiplier": multiplier,
        "congestion_status": congestion_data['status'],
        "emission_kg": round(emission_kg, 2),
        "matched_segment_id": closest_seg,
        "matched_segment_name": congestion_data['segment_name'],
        "latest_gate_in": latest_gate_in,
        "optimal_departure": optimal_departure,
        "route_geometry": route_geometry
    }).model_dump(mode="json")

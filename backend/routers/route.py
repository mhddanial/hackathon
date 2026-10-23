from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
import requests
import math
from typing import Dict, Any, List, Optional, Literal
from datetime import datetime, timedelta, timezone
from schemas.route import RouteAlternativesData, RouteData

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


def _point_to_segment_distance_km(point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]) -> float:
    lat_p, lng_p = point
    lat1, lng1 = start
    lat2, lng2 = end
    dx = lat2 - lat1
    dy = lng2 - lng1
    if dx == 0 and dy == 0:
        return haversine_distance(lat_p, lng_p, lat1, lng1)
    proj = ((lat_p - lat1) * dx + (lng_p - lng1) * dy) / (dx * dx + dy * dy)
    proj = max(0.0, min(1.0, proj))
    closest_lat = lat1 + proj * dx
    closest_lng = lng1 + proj * dy
    return haversine_distance(lat_p, lng_p, closest_lat, closest_lng)


ROUTE_SEGMENT_MATCH_DISTANCE_KM = 2.5


def match_route_segment(route_geometry: Dict[str, Any] | None) -> Dict[str, Any] | None:
    if not isinstance(route_geometry, dict) or route_geometry.get("type") != "LineString":
        return None

    coordinates = route_geometry.get("coordinates") or []
    if not isinstance(coordinates, list) or len(coordinates) < 2:
        return None

    points = []
    for coordinate in coordinates:
        if not isinstance(coordinate, (list, tuple)) or len(coordinate) != 2:
            return None
        lng, lat = coordinate
        if (
            isinstance(lng, bool)
            or isinstance(lat, bool)
            or not isinstance(lng, (int, float))
            or not isinstance(lat, (int, float))
            or not math.isfinite(lng)
            or not math.isfinite(lat)
            or not -180 <= lng <= 180
            or not -90 <= lat <= 90
        ):
            return None
        points.append((float(lat), float(lng)))
    if len(points) < 2:
        return None

    try:
        supabase = get_supabase_client()
        resp = supabase.table("road_segments").select("segment_id, start_lat, start_lng, end_lat, end_lng").execute()
        segments = resp.data
        if not segments:
            return None
    except Exception as e:
        print(f"Error matching route segment: {e}")
        return None

    best_match = None
    best_key = None
    for seg in segments:
        start = (float(seg["start_lat"]), float(seg["start_lng"]))
        end = (float(seg["end_lat"]), float(seg["end_lng"]))
        min_dist = float('inf')
        near_points = 0
        for point in points:
            dist = _point_to_segment_distance_km(point, start, end)
            if dist < min_dist:
                min_dist = dist
            if dist <= ROUTE_SEGMENT_MATCH_DISTANCE_KM:
                near_points += 1
        coverage_ratio = near_points / len(points)
        if min_dist > ROUTE_SEGMENT_MATCH_DISTANCE_KM:
            continue
        candidate = {
            "segment_id": seg["segment_id"],
            "min_dist_km": min_dist,
            "coverage_ratio": coverage_ratio,
        }
        candidate_key = (min_dist, -coverage_ratio, seg["segment_id"])
        if best_match is None or candidate_key < best_key:
            best_match = candidate
            best_key = candidate_key

    return best_match


def find_closest_segment(lat: float, lng: float, route_geometry: Dict[str, Any] | None = None) -> str | None:
    route_match = match_route_segment(route_geometry) if route_geometry else None
    if route_match:
        return route_match["segment_id"]

    # Fallback for legacy calls and origin-only matching where no route geometry is available.
    try:
        supabase = get_supabase_client()
        resp = supabase.table("road_segments").select("segment_id, start_lat, start_lng, end_lat, end_lng").execute()
        segments = resp.data
        if not segments:
            return None

        closest_id = segments[0]["segment_id"]
        min_dist = float('inf')

        for seg in segments:
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

def _valid_osrm_routes(data: Any) -> list[dict[str, Any]]:
    if not isinstance(data, dict) or not isinstance(data.get("routes"), list):
        return []

    valid_routes = []
    seen = set()
    for route in data["routes"]:
        if not isinstance(route, dict):
            continue
        distance = route.get("distance")
        duration = route.get("duration")
        if not all(
            isinstance(value, (int, float))
            and not isinstance(value, bool)
            and math.isfinite(value)
            and value >= 0
            for value in (distance, duration)
        ):
            continue
        geometry = compact_geometry(route.get("geometry"))
        if geometry is None:
            continue
        full_coordinates = route["geometry"]["coordinates"]
        signature = (
            float(distance),
            float(duration),
            tuple(tuple(float(value) for value in point) for point in full_coordinates),
        )
        if signature in seen:
            continue
        seen.add(signature)
        valid_routes.append({
            "distance_km": distance / 1000.0,
            "base_time_min": duration / 60.0,
            "route_geometry": geometry,
        })
    return valid_routes


def _estimate_route(
    req: RouteRequest,
    plan: Dict[str, Any],
    hour: int,
    route: Dict[str, Any],
    routing_source: str,
    route_id: str | None = None,
) -> Dict[str, Any]:
    distance_km = route["distance_km"]
    base_duration_min = route["base_time_min"]
    route_geometry = route["route_geometry"]

    route_match = match_route_segment(route_geometry)
    closest_seg = route_match["segment_id"] if route_match else find_closest_segment(req.origin.lat, req.origin.lng)
    congestion_data = get_ml_congestion(closest_seg, req.day_type.lower(), hour)
    multiplier = congestion_data["multiplier"]
    final_time_min = base_duration_min * multiplier
    emission_kg = distance_km * 0.2 * multiplier

    latest_gate_in = optimal_departure = None
    gate_in_obj = dep_obj = None
    feasible = None
    arrival = plan['departure'] + timedelta(minutes=final_time_min) if plan['departure'] else None
    slack = None
    warnings = []
    if plan['date_inferred']:
        warnings.append('Departure date inferred from the vessel departure date; provide your departure date if different.')
    if route_match:
        warnings.append('Congestion reference matched to route geometry. It represents one corridor only and does not establish traffic across the full route.')
        if route_match['coverage_ratio'] < 0.35:
            warnings.append('Route geometry matching was limited; the selected corridor may represent only a small portion of the route.')
    elif closest_seg is not None:
        warnings.append('Route geometry matching found no segment; the congestion reference falls back to a corridor near the origin and may not represent the route traveled.')
    else:
        warnings.append('No congestion reference segment was found from route geometry or near the origin; the congestion estimate is unavailable.')
    if congestion_data['status'] != 'synthetic_estimate':
        warnings.append('Corridor congestion unavailable; travel time assumes a 1.0 multiplier.')

    if req.vessel_etd and req.cargo_type:
        try:
            etd_obj = plan['etd'] or datetime.strptime(plan['etd_clock'], "%H:%M")
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
            if not feasible:
                warnings.append('Requested departure is later than the latest estimated departure for this estimate.')
            latest_gate_in = gate_in_obj.strftime("%H:%M")
            optimal_departure = dep_obj.strftime("%H:%M")
        except HTTPException:
            raise
        except (ValueError, OverflowError):
            raise HTTPException(400, 'The vessel/departure planning times cannot be calculated.') from None

    estimate = {
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
        "latest_gate_in_datetime": gate_in_obj.isoformat() if gate_in_obj and plan['etd'] else None,
        "optimal_departure_datetime": dep_obj.isoformat() if dep_obj and plan['etd'] else None,
        "estimated_arrival_datetime": arrival.isoformat() if arrival and plan['departure'] else None,
        "estimated_arrival_time": arrival.strftime('%H:%M') if arrival else None,
        "cutoff_slack_min": round(slack, 2) if slack is not None else None,
        "departure_feasible": feasible,
        "planning_warning": ' '.join(warnings) or None,
        "route_geometry": route_geometry,
    }
    if route_id:
        estimate["route_id"] = route_id
        estimate["display_label"] = f"Route {route_id.removeprefix('route-')}"
    return estimate


def _route_request_context(req: RouteRequest, plan: Dict[str, Any]) -> Dict[str, Any]:
    return {
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
        "calculation_time": datetime.now(timezone.utc).isoformat(),
        "departure_date_inferred": plan['date_inferred'],
    }


def _osrm_url(req: RouteRequest, alternatives: bool) -> str:
    base = (
        f"https://router.project-osrm.org/route/v1/driving/"
        f"{req.origin.lng},{req.origin.lat};{req.destination.lng},{req.destination.lat}"
    )
    return (
        f"{base}?alternatives=3&overview=full&geometries=geojson"
        if alternatives
        else f"{base}?overview=simplified&geometries=geojson"
    )


def _fetch_osrm_candidates(req: RouteRequest, alternatives: bool) -> list[dict[str, Any]]:
    try:
        resp = requests.get(_osrm_url(req, alternatives), timeout=4)
        if resp.status_code != 200:
            return []
        payload = resp.json()
        if not alternatives and isinstance(payload, dict):
            routes = payload.get("routes")
            payload = {"routes": routes[:1]} if isinstance(routes, list) else payload
        return _valid_osrm_routes(payload)
    except Exception as e:
        print(f"OSRM Error: {e}")
        return []


def _haversine_route(req: RouteRequest) -> Dict[str, Any]:
    straight_dist = haversine_distance(req.origin.lat, req.origin.lng, req.destination.lat, req.destination.lng)
    distance = straight_dist * 1.3
    return {
        "distance_km": distance,
        "base_time_min": (distance / 40.0) * 60.0,
        "route_geometry": {
            "type": "LineString",
            "coordinates": [
                [req.origin.lng, req.origin.lat],
                [req.destination.lng, req.destination.lat],
            ],
        },
    }


@router.post("", response_model=RouteData)
@router.post("/", response_model=RouteData)
def calculate_route(req: RouteRequest) -> Dict[str, Any]:
    plan = planning_context(req.time, req.day_type, req.departure_date, req.vessel_etd)
    hour = int(plan['time'].split(':')[0])
    candidates = _fetch_osrm_candidates(req, alternatives=False)
    routing_source = "OSRM API"
    if candidates:
        estimate = _estimate_route(req, plan, hour, candidates[0], routing_source)
    else:
        routing_source = "Haversine Fallback"
        estimate = _estimate_route(req, plan, hour, _haversine_route(req), routing_source)
    result = {**_route_request_context(req, plan), **estimate}
    return RouteData.model_validate(result).model_dump(mode="json")


@router.post("/alternatives", response_model=RouteAlternativesData)
def calculate_route_alternatives(req: RouteRequest) -> Dict[str, Any]:
    plan = planning_context(req.time, req.day_type, req.departure_date, req.vessel_etd)
    hour = int(plan['time'].split(':')[0])
    route_candidates = _fetch_osrm_candidates(req, alternatives=True)

    routing_source = "OSRM API"
    if route_candidates:
        estimates = [
            _estimate_route(req, plan, hour, route_candidates[0], routing_source, "route-1")
        ]
        for index, candidate in enumerate(route_candidates[1:], start=2):
            try:
                estimates.append(
                    _estimate_route(req, plan, hour, candidate, routing_source, f"route-{index}")
                )
            except HTTPException as error:
                print(f"Skipping route alternative route-{index}: {error.detail}")
            except (ValueError, TypeError, KeyError) as error:
                print(f"Skipping invalid route alternative route-{index}: {error}")
    else:
        routing_source = "Haversine Fallback"
        estimates = [_estimate_route(req, plan, hour, _haversine_route(req), routing_source)]

    selected = estimates[0]
    selected_fields = {
        key: value for key, value in selected.items()
        if key not in {"route_id", "display_label"}
    }
    result = {
        **_route_request_context(req, plan),
        **selected_fields,
        "default_route_id": selected.get("route_id"),
        "route_options": estimates if route_candidates else [],
    }
    return RouteAlternativesData.model_validate(result).model_dump(mode="json")

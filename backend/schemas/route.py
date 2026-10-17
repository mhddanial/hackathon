"""Route response shared by the Planner API and Oracle saved results."""
from typing import Annotated, Literal
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, field_validator
from route_planning import planning_date, vessel_time

RoadName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=256)]
ClockTime = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$")]
NonNegative = Annotated[float, Field(ge=0, allow_inf_nan=False)]
Positive = Annotated[float, Field(gt=0, allow_inf_nan=False)]

class LocationPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lat: Annotated[float, Field(strict=True, ge=-90, le=90, allow_inf_nan=False)]
    lng: Annotated[float, Field(strict=True, ge=-180, le=180, allow_inf_nan=False)]


class RouteGeometry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal['LineString']
    coordinates: list[tuple[Annotated[float, Field(strict=True, ge=-180, le=180, allow_inf_nan=False)],
        Annotated[float, Field(strict=True, ge=-90, le=90, allow_inf_nan=False)]]] = Field(min_length=2, max_length=160)


class RouteData(BaseModel):
    model_config = ConfigDict(extra="forbid")
    distance_km: NonNegative
    final_time_min: NonNegative
    routing_source: str
    base_time_min: NonNegative | None = None
    congestion_level: Literal["LOW", "MEDIUM", "HIGH"] | None = None
    congestion_multiplier: Positive | None = None
    emission_kg: NonNegative | None = None
    matched_segment_id: str | None = None
    matched_segment_name: RoadName | None = None
    latest_gate_in: ClockTime | None = None
    optimal_departure: ClockTime | None = None
    origin: LocationPoint | None = None
    destination: LocationPoint | None = None
    origin_name: RoadName | None = None
    destination_name: RoadName | None = None
    route_geometry: RouteGeometry | None = None
    departure_time: ClockTime | None = None
    departure_date: Annotated[str, StringConstraints(pattern=r'^\d{4}-\d{2}-\d{2}$')] | None = None
    planning_timezone: Literal['Asia/Jakarta'] | None = None
    day_type: Literal['weekday', 'weekend'] | None = None
    cargo_type: Literal['CONTAINER', 'FAST_FREIGHT'] | None = None
    vessel_etd: str | None = None
    departure_datetime: AwareDatetime | None = None
    latest_gate_in_datetime: AwareDatetime | None = None
    optimal_departure_datetime: AwareDatetime | None = None
    estimated_arrival_datetime: AwareDatetime | None = None
    estimated_arrival_time: ClockTime | None = None
    cutoff_slack_min: Annotated[float, Field(allow_inf_nan=False)] | None = None
    calculation_time: AwareDatetime | None = None
    departure_date_inferred: bool | None = None
    departure_feasible: bool | None = None
    planning_warning: Annotated[str, StringConstraints(max_length=2000)] | None = None
    congestion_status: Literal['synthetic_estimate', 'default_fallback', 'unavailable'] | None = None

    _date = field_validator('departure_date', mode='before')(planning_date)
    _etd = field_validator('vessel_etd', mode='before')(vessel_time)



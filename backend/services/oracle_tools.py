"""Validate Oracle arguments and normalize existing owner services, without guessing."""

from datetime import datetime, timezone
import json
import math
from typing import Annotated, Literal

from pydantic import Field, StringConstraints, ValidationError, field_validator, model_validator
from fastapi import HTTPException

from database import get_supabase_client
from road_segments import segment_name
from locations import resolve_location, LocationError
from route_planning import clock_time, vessel_time, planning_date, planning_context
from routers.congestion import get_congestion
from routers.route import calculate_route, RouteRequest, Point
from schemas.oracle import Contract, CongestionData, CongestionResult, ScheduleData, ScheduleResult, RouteData, RouteResult

Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Location = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=256)]
PlanningTime = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]


class CongestionArguments(Contract):
    segment_id: Annotated[str, StringConstraints(pattern=r"^SEG00[1-6]$")]
    day_type: Literal["weekday", "weekend"]
    hour: int = Field(strict=True, ge=0, le=23)


class RouteArguments(Contract):
    origin: Location = Field(description='Supported Batam location name/ID or latitude, longitude; never invent coordinates.')
    destination: Location = Field(description='Supported Batam location name/ID or latitude, longitude; clarify ambiguous places.')
    time: PlanningTime
    day_type: Literal["weekday", "weekend"]
    vessel_etd: Annotated[str, StringConstraints(max_length=80)] | None = Field(default=None, description='HH:MM in WIB or ISO timestamp with Z/UTC offset; preserve its date.')
    cargo_type: Literal["CONTAINER", "FAST_FREIGHT"] | None = None
    departure_date: Annotated[str, StringConstraints(pattern=r'^\d{4}-\d{2}-\d{2}$')] | None = Field(default=None, description='Explicit departure date YYYY-MM-DD. If omitted with ISO vessel ETD, its local date is used and disclosed.')

    _clock = field_validator('time', mode='before')(clock_time)
    _etd = field_validator('vessel_etd', mode='before')(vessel_time)
    _date = field_validator('departure_date', mode='before')(planning_date)

    @field_validator('origin', 'destination')
    @classmethod
    def location_input(cls, value):
        if ',' not in value: return value
        try:
            lat, lng = map(float, value.split(','))
        except ValueError:
            raise ValueError('Coordinates require latitude, longitude') from None
        if not math.isfinite(lat) or not math.isfinite(lng) or not -90 <= lat <= 90 or not -180 <= lng <= 180:
            raise ValueError('Coordinates out of bounds')
        return f'{lat}, {lng}'

    @field_validator('cargo_type', mode='before')
    @classmethod
    def cargo(cls, value):
        return value.strip().upper().replace(' ', '_').replace('-', '_') if isinstance(value, str) else value

    @field_validator('day_type', mode='before')
    @classmethod
    def day(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

    @model_validator(mode="after")
    def departure_pair(self):
        if (self.vessel_etd is None) != (self.cargo_type is None):
            raise ValueError("Vessel ETD and cargo type must be provided together")
        planning_context(self.time, self.day_type, self.departure_date, self.vessel_etd)
        return self


class ScheduleArguments(Contract):
    terminal: Literal["batam_center", "sekupang", "batu_ampar", "harbour_bay"]
    destination: Label | None = None

    @field_validator("terminal", mode="before")
    @classmethod
    def normalize_terminal(cls, value):
        if isinstance(value, str):
            return value.strip().lower().replace(" ", "_").replace("-", "_")
        return value


ARGUMENT_MODELS = {
    "get_congestion_level": CongestionArguments,
    "get_optimal_route": RouteArguments,
    "get_ferry_schedule": ScheduleArguments,
}


def validate_arguments(name: str, raw: str) -> dict:
    if name not in ARGUMENT_MODELS or len(raw.encode()) > 8000:
        raise ValueError("Unknown tool or oversized arguments")
    try:
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise ValueError("Tool arguments must be an object")
        return ARGUMENT_MODELS[name].model_validate(value).model_dump(exclude_none=True)
    except (json.JSONDecodeError, ValidationError):
        raise ValueError("Invalid tool arguments") from None


def status_message(name: str) -> str:
    return {
        "get_congestion_level": "Checking the congestion estimate…",
        "get_optimal_route": "Calculating a route estimate…",
        "get_ferry_schedule": "Checking recorded ferry schedules…",
    }[name]


def execute_tool(name: str, args: dict) -> tuple[dict, object | None]:
    """Failures are safe model-visible outcomes, never fabricated result cards."""
    try:
        calculated_at = datetime.now(timezone.utc)
        if name == "get_congestion_level":
            raw = get_congestion(**args)
            source = raw.get("source", "unknown")
            status = {"ml_model": "synthetic_estimate", "database": "database", "fallback_default": "default_fallback"}.get(source, "unknown")
            # Preserve validated planning inputs and the service's readable road label.
            data = CongestionData(**{**args, "segment_name": segment_name(args['segment_id'], raw.get('segment_name')),
                "congestion_level": raw["congestion_level"], "multiplier": raw["multiplier"]})
            disclaimer = "Project-data estimate; not real-time traffic."
            if status == "default_fallback":
                disclaimer = "No matching recorded estimate; assumed default, not observed traffic."
            disclaimer = raw.get("disclaimer") or disclaimer
            result = CongestionResult(type="congestion", title="Congestion estimate", data=data,
                source=source, data_status=status, disclaimer=disclaimer, calculated_at=calculated_at)
        elif name == "get_ferry_schedule":
            query = get_supabase_client().table("ferry_schedules").select(
                "terminal,terminal_name,destination,departure_time,cutoff_time,vessel_type,cargo_capacity_tons"
            ).eq("terminal", args["terminal"])
            if args.get("destination"):
                literal = args["destination"].replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                query = query.ilike("destination", literal)
            rows = query.order("departure_time").limit(20).execute().data
            schedules = []
            for row in rows:
                entry = {k:v for k,v in row.items() if k != "terminal_name"}
                entry["terminal"] = row.get("terminal_name") or row["terminal"]
                schedules.append(entry)
            data = ScheduleData(schedules=schedules)
            result = ScheduleResult(type="schedule", title="Recorded ferry schedules", data=data,
                source="database", data_status="database", disclaimer="Recorded project schedule; freshness unverified. At most 20 departures returned.",
                calculated_at=calculated_at)
        elif name == "get_optimal_route":
            origin, destination = resolve_location(args['origin']), resolve_location(args['destination'])
            raw = calculate_route(RouteRequest(origin=Point(lat=origin['lat'],lng=origin['lng']), destination=Point(lat=destination['lat'],lng=destination['lng']),
                origin_name=origin['name'], destination_name=destination['name'], departure_date=args.get('departure_date'),
                time=args["time"], day_type=args["day_type"], vessel_etd=args.get("vessel_etd"), cargo_type=args.get("cargo_type")))
            data = RouteData(**{k:raw[k] for k in RouteData.model_fields if k in raw})
            result = RouteResult(type="route", title="Route estimate", data=data,
                source=raw.get("routing_source", "unknown"), data_status="estimated",
                disclaimer=f"Planning time {args['time']} ({args['day_type']}, Asia/Jakarta). Named locations use mapped representative points; exact cargo gates are not verified. Map geometry is a simplified preview. Congestion uses a corridor near the origin, not segment-by-segment traffic along the route. Route, congestion and emissions are estimates. Suggested departure is back-calculated using congestion at the requested departure time, not a comparison of alternatives or a safety guarantee. No measured savings claim.",
                calculated_at=calculated_at)
        else:
            return {"error": "Unsupported tool", "code": "unknown_tool"}, None
        output = result.model_dump(mode="json")
        if len(json.dumps(output).encode()) > 16000:
            return {"error": "Tool output exceeded the size limit", "code": "output_limit"}, None
        if name == 'get_optimal_route':
            # Persist full bounded geometry in structured_results, but keep tool/model history concise.
            output['data'].pop('route_geometry', None)
            output['data']['map_available'] = result.data.route_geometry is not None
        return output, result
    except LocationError as error:
        return error.output, None
    except HTTPException as error:
        if error.status_code in (400, 422): return {'code': 'route_parameters', 'error': str(error.detail)}, None
        return {"error": "Tool data is temporarily unavailable", "code": "tool_unavailable"}, None
    except Exception:
        return {"error": "Tool data is temporarily unavailable", "code": "tool_unavailable"}, None

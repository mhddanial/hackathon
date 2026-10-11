"""Validate Oracle arguments and normalize existing owner services, without guessing."""

from datetime import datetime, timezone
import json
import math
from typing import Annotated, Literal

from pydantic import Field, StringConstraints, ValidationError, field_validator, model_validator

from database import get_supabase_client
from routers.congestion import get_congestion
from routers.route import calculate_route, RouteRequest, Point
from schemas.oracle import Contract, CongestionData, CongestionResult, ScheduleData, ScheduleResult, RouteData, RouteResult

Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Coordinate = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
PlanningTime = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]


class CongestionArguments(Contract):
    segment_id: Annotated[str, StringConstraints(pattern=r"^SEG00[1-6]$")]
    day_type: Literal["weekday", "weekend"]
    hour: int = Field(strict=True, ge=0, le=23)


class RouteArguments(Contract):
    origin: Coordinate
    destination: Coordinate
    time: PlanningTime
    day_type: Literal["weekday", "weekend"]
    vessel_etd: PlanningTime | None = None
    cargo_type: Literal["CONTAINER", "FAST_FREIGHT"] | None = None

    @model_validator(mode="after")
    def departure_pair(self):
        if (self.vessel_etd is None) != (self.cargo_type is None):
            raise ValueError("Vessel ETD and cargo type must be provided together")
        return self

    @field_validator("origin", "destination")
    @classmethod
    def coordinates(cls, value):
        parts = value.split(",")
        if len(parts) != 2:
            raise ValueError("Coordinates require latitude, longitude")
        lat, lng = map(float, parts)
        if not math.isfinite(lat) or not math.isfinite(lng) or not -90 <= lat <= 90 or not -180 <= lng <= 180:
            raise ValueError("Coordinates out of bounds")
        return f"{lat}, {lng}"


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
            # The existing default omits planning fields; add only validated request values.
            data = CongestionData(**{**args, "congestion_level": raw["congestion_level"], "multiplier": raw["multiplier"]})
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
            lat, lng = map(float, args["origin"].split(","))
            dlat, dlng = map(float, args["destination"].split(","))
            raw = calculate_route(RouteRequest(origin=Point(lat=lat,lng=lng), destination=Point(lat=dlat,lng=dlng),
                time=args["time"], day_type=args["day_type"], vessel_etd=args.get("vessel_etd"), cargo_type=args.get("cargo_type")))
            data = RouteData(**{k:raw[k] for k in RouteData.model_fields if k in raw})
            result = RouteResult(type="route", title="Route estimate", data=data,
                source=raw.get("routing_source", "unknown"), data_status="estimated",
                disclaimer=f"Planning time {args['time']} ({args['day_type']}, Asia/Jakarta). Route, congestion and emissions are estimates; defaults may be used by the route service. No measured savings claim.",
                calculated_at=calculated_at)
        else:
            return {"error": "Unsupported tool", "code": "unknown_tool"}, None
        output = result.model_dump(mode="json")
        if len(json.dumps(output).encode()) > 16000:
            return {"error": "Tool output exceeded the size limit", "code": "output_limit"}, None
        return output, result
    except Exception:
        return {"error": "Tool data is temporarily unavailable", "code": "tool_unavailable"}, None

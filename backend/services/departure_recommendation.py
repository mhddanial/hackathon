"""Pure occurrence arithmetic, bounded selection and alternatives; no I/O."""
from collections.abc import Mapping
from datetime import datetime, timedelta
import hashlib
import json
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import TypeAdapter, ValidationError

from departure_config import DepartureConfig
from route_planning import PLANNING_ZONE
from schemas.departure_recommendation import (
    Alternative, CandidateBatch, CalculatedStatus, DecisionReason, DepartureRequest, DepartureResult, Exclusion, JakartaDatetime,
    FiniteMinutes, ReasonCode, RouteEstimate, RouteInput, ScheduleAssessment, ScheduleOccurrence,
    ScheduleCandidate, ScheduleView, Selection, Sources, Warning, normalized_label,
)

MESSAGES: dict[ReasonCode, str] = {
    "BUFFER_SUFFICIENT": "The recorded cutoff buffer meets the configured simulation threshold.",
    "BELOW_SAFETY_BUFFER": "Arrival is at or before cutoff with less than the configured safety buffer.",
    "CUTOFF_MISSED": "Estimated arrival is after the recorded cutoff.",
    "NO_SCHEDULES": "No schedules were supplied.",
    "NO_RELEVANT_SCHEDULES": "No schedules match the requested plan.",
    "NO_EVALUABLE_SCHEDULES": "Required schedule identity or metadata cannot be established.",
    "MISSING_SERVICE_DATE": "The sailing's explicit service date is unknown.",
    "MISSING_SOURCE_ZONE": "The schedule source timezone is unknown.",
    "INVALID_SOURCE_ZONE": "A source timezone or timestamp offset is invalid or inconsistent.",
    "MISSING_DEPARTURE": "The sailing departure is unknown.",
    "INVALID_SCHEDULE": "The occurrence dates or calculation range are invalid.",
    "MISSING_CUTOFF": "The recorded cutoff is unknown.",
    "INVALID_CUTOFF": "The recorded cutoff must be valid and strictly before sailing departure.",
    "SERVICE_UNKNOWN": "Allowed service kinds are unknown.",
    "FRESHNESS_UNKNOWN": "Schedule verification time is unknown.",
    "INVALID_FRESHNESS": "Schedule verification time is invalid or in the future.",
    "STALE_SCHEDULE": "Schedule verification exceeds the configured maximum age.",
    "AMBIGUOUS_SCHEDULE": "Conflicting occurrence identity requires review.",
    "ROUTE_FALLBACK": "The route source is insufficient for a departure decision.",
    "CONGESTION_UNAVAILABLE": "Congestion is defaulted or unavailable.",
    "ROUTE_CONTEXT_UNKNOWN": "The route corridor and input context are unverified.",
    "CANDIDATE_LIMIT": "The bounded candidate limit prevents a complete selection.",
}


class PlanMismatch(ValueError):
    """Pure validation failure; the future adapter maps this to the contracted 422."""
    def __init__(self, code: Literal["SCHEDULE_MISMATCH", "SERVICE_MISMATCH"], fields: tuple[str, ...]):
        self.code = code
        self.fields = fields
        super().__init__(code)


def assess_schedule(row: Mapping[str, object]) -> ScheduleAssessment:
    """Validate one injected row without assigning dates, zones, or recurrence.

    Invalid row fields become explicit domain reasons and null view fields. Malformed
    dependency envelopes and dependency exceptions belong to the future I/O adapter.
    """
    values: dict[str, object] = {}
    invalid: set[str] = set()
    for name, field in ScheduleView.model_fields.items():
        try:
            values[name] = TypeAdapter(field.rebuild_annotation()).validate_python(row.get(name))
        except (ValidationError, ValueError, TypeError, OverflowError):
            values[name] = None
            invalid.add(name)
    if values["schedule_id"] is not None and values["service_date"] is not None:
        values["occurrence_id"] = f"{values['schedule_id']}@{values['service_date'].isoformat()}"
    # Derived instants may only come from validated source timestamps and zone.
    values["departure_at"] = values["cutoff_at"] = None

    def outcome(reason: ReasonCode) -> ScheduleAssessment:
        return ScheduleAssessment(schedule=ScheduleView(**values), reason_code=reason)

    if values["schedule_id"] is None:
        return outcome("NO_EVALUABLE_SCHEDULES")
    if values["service_date"] is None:
        return outcome("INVALID_SCHEDULE" if "service_date" in invalid else "MISSING_SERVICE_DATE")
    if values["source_timezone"] is None:
        return outcome("INVALID_SOURCE_ZONE" if "source_timezone" in invalid else "MISSING_SOURCE_ZONE")
    try:
        zone = ZoneInfo(values["source_timezone"])
    except (ZoneInfoNotFoundError, ValueError):
        return outcome("INVALID_SOURCE_ZONE")
    for name in ("source_departure_at", "source_cutoff_at"):
        value = values[name]
        if value is None:
            # A naive timestamp is a source-zone failure, not a missing value.
            raw = row.get(name)
            try:
                parsed = datetime.fromisoformat(raw) if isinstance(raw, str) else raw
                if isinstance(parsed, datetime) and parsed.tzinfo is None:
                    return outcome("INVALID_SOURCE_ZONE")
            except ValueError:
                pass
            continue
        try:
            if value.utcoffset() != value.astimezone(zone).utcoffset():
                return outcome("INVALID_SOURCE_ZONE")
        except (ValueError, OverflowError):
            return outcome("INVALID_SCHEDULE")
    if values["source_departure_at"] is None:
        return outcome("INVALID_SCHEDULE" if "source_departure_at" in invalid else "MISSING_DEPARTURE")
    try:
        values["departure_at"] = values["source_departure_at"].astimezone(PLANNING_ZONE)
        if values["departure_at"].date() != values["service_date"]:
            return outcome("INVALID_SCHEDULE")
        if values["source_cutoff_at"] is None:
            return outcome("INVALID_CUTOFF" if "source_cutoff_at" in invalid else "MISSING_CUTOFF")
        values["cutoff_at"] = values["source_cutoff_at"].astimezone(PLANNING_ZONE)
        if values["cutoff_at"] >= values["departure_at"]:
            return outcome("INVALID_CUTOFF")
    except (ValueError, OverflowError):
        return outcome("INVALID_SCHEDULE")
    if values["allowed_service_kinds"] is None:
        return outcome("SERVICE_UNKNOWN")
    if values["verified_at"] is None:
        return outcome("INVALID_FRESHNESS" if "verified_at" in invalid else "FRESHNESS_UNKNOWN")
    if any(values[name] is None for name in ("terminal", "destination", "source")):
        return outcome("NO_EVALUABLE_SCHEDULES")
    try:
        occurrence = ScheduleOccurrence(**values)
    except (ValidationError, ValueError, OverflowError):
        return outcome("INVALID_SCHEDULE")
    return ScheduleAssessment(schedule=occurrence, reason_code=None)


def classify_buffer(buffer_min: float | None, config: DepartureConfig) -> CalculatedStatus | Literal["UNAVAILABLE"]:
    """Classify the signed, unrounded value. Missing values never imply zero."""
    if buffer_min is None:
        return "UNAVAILABLE"
    # Reuse strict finite validation; reject booleans/strings/nonfinite values.
    buffer_min = TypeAdapter(FiniteMinutes).validate_python(buffer_min)
    if buffer_min < 0:
        return "MISSED"
    return "RISKY" if buffer_min < config.safety_buffer_min else "SAFE"


def validate_schedule_plan(plan: DepartureRequest, selected: ScheduleView) -> None:
    """Known request mismatches precede domain unavailability."""
    mismatches = []
    for field, actual, expected in (
        ("schedule_id", selected.schedule_id, plan.schedule_id),
        ("terminal", selected.terminal, plan.terminal),
        ("service_date", selected.service_date, plan.service_date),
        ("ferry_destination", selected.destination.casefold() if selected.destination else None, plan.ferry_destination.casefold()),
    ):
        if actual is not None and expected is not None and actual != expected:
            mismatches.append(field)
    if mismatches:
        raise PlanMismatch("SCHEDULE_MISMATCH", tuple(mismatches))
    if selected.allowed_service_kinds is not None and plan.service_kind not in selected.allowed_service_kinds:
        raise PlanMismatch("SERVICE_MISMATCH", ("service_kind",))


def calculate_departure(
    plan: DepartureRequest,
    schedule: ScheduleAssessment | ScheduleOccurrence | None,
    route: RouteInput | None,
    config: DepartureConfig,
    *,
    calculated_at: datetime,
) -> DepartureResult:
    """Evaluate exactly one supplied occurrence; the caller owns fetching/selection.

    RouteInput validates dependency duration before any domain decision. A missing
    route is distinct from a known dependency exception, which must propagate at
    the future adapter boundary rather than being passed as None.
    """
    clock = TypeAdapter(JakartaDatetime).validate_python(calculated_at)
    road = plan.planned_departure_at
    assessment = schedule if isinstance(schedule, ScheduleAssessment) else (
        ScheduleAssessment(schedule=schedule, reason_code=None) if schedule is not None else None
    )
    selected = assessment.schedule if assessment else None
    # Known incompatibility is an input error, before unavailable domain classification.
    if selected is not None:
        validate_schedule_plan(plan, selected)

    reason: ReasonCode | None = assessment.reason_code if assessment else "NO_EVALUABLE_SCHEDULES"
    estimate = None
    arithmetic_overflow = False
    if route is not None:
        try:
            estimate = RouteEstimate(**route.model_dump(), estimated_arrival_at=road + timedelta(minutes=route.final_time_min))
        except (OverflowError, ValueError):
            arithmetic_overflow = True
    if reason is None:
        age_min = (clock - selected.verified_at).total_seconds() / 60
        if age_min < 0:
            reason = "INVALID_FRESHNESS"
        elif age_min > config.schedule_max_age_min:
            reason = "STALE_SCHEDULE"
        elif route is None:
            reason = "ROUTE_CONTEXT_UNKNOWN"
        elif route.routing_source != "OSRM API":
            reason = "ROUTE_FALLBACK"
        elif route.congestion_status != "synthetic_estimate":
            reason = "CONGESTION_UNAVAILABLE"
        elif not route.context_verified:
            reason = "ROUTE_CONTEXT_UNKNOWN"
        elif arithmetic_overflow:
            reason = "INVALID_SCHEDULE"

    warnings = []
    if road < clock:
        warnings.append(Warning(code="HISTORICAL_PLAN", message="The road plan precedes calculation time; this is a historical scenario."))
    eta = buffer = latest = duration = None
    status = "UNAVAILABLE"
    if reason is None:
        try:
            duration = route.final_time_min  # Already adjusted: never reapply a multiplier.
            eta = estimate.estimated_arrival_at
            buffer = (selected.cutoff_at - eta).total_seconds() / 60
            latest = selected.cutoff_at - timedelta(minutes=duration) - timedelta(minutes=config.safety_buffer_min)
            status = classify_buffer(buffer, config)
            codes: dict[CalculatedStatus, DecisionReason] = {"SAFE": "BUFFER_SUFFICIENT", "RISKY": "BELOW_SAFETY_BUFFER", "MISSED": "CUTOFF_MISSED"}
            reason = codes[status]
            warnings.append(Warning(code="BACKWARD_ESTIMATE_FIXED_DURATION", message="Latest departure reuses duration for the submitted traffic period; recalculate if adopted. No traffic-window search was performed."))
        except (OverflowError, ValueError):
            reason = "INVALID_SCHEDULE"
            eta = buffer = latest = duration = None
            status = "UNAVAILABLE"
    return DepartureResult(
        contract_version="1.0", status=status, reason_code=reason, reason=MESSAGES[reason], plan=plan,
        planned_departure_at=road, selected_schedule=selected,
        travel_time_min=duration, estimated_arrival_at=eta, buffer_min=buffer,
        latest_departure_estimate_at=latest, safety_buffer_min=config.safety_buffer_min,
        route_estimate=estimate, alternatives=[],
        selection=Selection(mode="selected" if plan.schedule_id else "automatic", service_date=plan.service_date,
                            examined_count=1 if selected else 0, excluded_count=0, candidate_limit=100, truncated=False),
        exclusions=[], sources=Sources(schedule=selected.source if selected else None,
            cutoff=selected.source if selected and selected.source_cutoff_at is not None else None,
            route=route.routing_source if route else None, congestion=route.congestion_status if route else None),
        data_status="unavailable" if status == "UNAVAILABLE" else "simulation",
        assumptions=["Terminal coordinates are project representative points; exact cargo gate is unverified.",
                     "Congestion estimates are synthetic, not observed live traffic.",
                     "Latest departure is a fixed-duration backward estimate for the submitted traffic period; recalculate if adopted."],
        warnings=warnings, calculated_at=clock,
        disclaimer="Project planning simulation; estimates do not guarantee boarding and are not observed live traffic.",
    )


def schedule_candidate(row: Mapping[str, object]) -> ScheduleCandidate:
    """Keep invalid-field differences available for conflict detection, without raw output."""
    assessment = assess_schedule(row)
    fields = ("schedule_id", "terminal", "terminal_id", "destination", "service_date", "allowed_service_kinds",
              "source_timezone", "source_departure_at", "source_cutoff_at", "verified_at", "source")
    fingerprint = hashlib.sha256(json.dumps({key: row.get(key) for key in fields}, sort_keys=True, default=str).encode()).hexdigest()
    return ScheduleCandidate(assessment=assessment, fingerprint=fingerprint)


def collapse_candidates(candidates: list[ScheduleCandidate]) -> tuple[list[ScheduleCandidate], list[Warning]]:
    """Group only evidenced UUID/date identities; unknown identities remain separate."""
    groups: dict[tuple, list[ScheduleCandidate]] = {}
    for index, candidate in enumerate(candidates):
        schedule = candidate.assessment.schedule
        key = (schedule.schedule_id, schedule.service_date) if schedule.schedule_id and schedule.service_date else ("unknown", index)
        groups.setdefault(key, []).append(candidate)
    result = []
    collapsed = False
    for group in groups.values():
        first = group[0]
        conflicts = any(candidate.assessment != first.assessment or (
            not isinstance(first.assessment.schedule, ScheduleOccurrence)
            and first.fingerprint is not None and candidate.fingerprint is not None
            and candidate.fingerprint != first.fingerprint
        ) for candidate in group[1:])
        if conflicts:
            first = ScheduleCandidate(assessment=ScheduleAssessment(schedule=first.assessment.schedule, reason_code="AMBIGUOUS_SCHEDULE"))
        elif len(group) > 1:
            collapsed = True
        result.append(first)
    warnings = [Warning(code="DUPLICATE_RECORD_COLLAPSED", message="Identical records for the same occurrence were collapsed.")] if collapsed else []
    return result, warnings


def recommend_from_candidates(
    plan: DepartureRequest, batch: CandidateBatch, route: RouteInput | None, config: DepartureConfig,
    *, calculated_at: datetime, selected: ScheduleCandidate | None = None, warnings: list[Warning] | None = None,
) -> DepartureResult:
    """Evaluate at most 100 candidates plus an independent selected target, once each."""
    if plan.schedule_id is not None and selected is None:
        raise ValueError("Selected mode requires an independently resolved target")
    if plan.schedule_id is None and selected is not None:
        raise ValueError("Automatic mode cannot inject a selected target")
    if selected is not None:
        validate_schedule_plan(plan, selected.assessment.schedule)
    candidates, duplicate_warnings = collapse_candidates(([selected] if selected else []) + batch.candidates)
    all_warnings = [*(warnings or []), *duplicate_warnings]
    exclusions: list[Exclusion] = []
    results: list[DepartureResult] = []
    main = None
    candidate_plan = DepartureRequest(**{**plan.model_dump(), "schedule_id": None})
    relevant = 0

    # Overflow cannot establish an automatic best choice; the sentinel is never evaluated.
    if not batch.truncated or selected is not None:
        for index, candidate in enumerate(candidates):
            is_target = selected is not None and index == 0
            if batch.truncated and not is_target:
                continue
            schedule = candidate.assessment.schedule
            try:
                validate_schedule_plan(plan if is_target else candidate_plan, schedule)
            except PlanMismatch as error:
                if is_target:
                    raise
                exclusions.append(Exclusion(schedule_id=schedule.schedule_id, reason_code=error.code))
                continue
            relevant += 1
            result = calculate_departure(plan if is_target else candidate_plan, candidate.assessment, route, config, calculated_at=calculated_at)
            if is_target:
                main = result
            elif result.status == "UNAVAILABLE":
                exclusions.append(Exclusion(schedule_id=schedule.schedule_id, reason_code=result.reason_code))
            else:
                results.append(result)

    def order(result: DepartureResult) -> tuple:
        return result.selected_schedule.departure_at, result.selected_schedule.schedule_id

    if selected is None and not batch.truncated:
        for status in ("SAFE", "RISKY"):
            matching = [result for result in results if result.status == status]
            if matching:
                main = min(matching, key=order)
                break
        if main is None and results:
            latest_cutoff = max(result.selected_schedule.cutoff_at for result in results)
            main = min((result for result in results if result.selected_schedule.cutoff_at == latest_cutoff), key=order)
    if main is None:
        reason = ("CANDIDATE_LIMIT" if batch.truncated else "NO_SCHEDULES" if not candidates
                  else "NO_RELEVANT_SCHEDULES" if relevant == 0 else "NO_EVALUABLE_SCHEDULES")
        base = calculate_departure(plan, None, route, config, calculated_at=calculated_at)
        main = DepartureResult(**{**base.model_dump(), "reason_code": reason, "reason": MESSAGES[reason]})
    if exclusions:
        all_warnings.append(Warning(code="EXCLUDED_CANDIDATES", message="Selection uses evaluable matching occurrences only; excluded candidates are listed separately."))
    if batch.truncated and selected is not None:
        all_warnings.append(Warning(code="ALTERNATIVES_TRUNCATED", message="The candidate limit was reached; the selected target is retained and alternatives are omitted."))

    # A matching clock alone does not imply a physical duplicate.
    natural_keys = set()
    for result in ([main] if main.selected_schedule else []) + results:
        schedule = result.selected_schedule
        if not isinstance(schedule, ScheduleOccurrence):
            continue
        key = (schedule.terminal, schedule.destination.casefold(), schedule.departure_at, schedule.cutoff_at,
               tuple(sorted(set(schedule.allowed_service_kinds))))
        identity_key = (key, schedule.schedule_id)
        if key in natural_keys and identity_key not in natural_keys:
            all_warnings.append(Warning(code="POSSIBLE_DUPLICATE_SAILING", message="Distinct UUIDs share the full sailing time/service tuple; physical duplicates require source review."))
        natural_keys.add(key)
        natural_keys.add(identity_key)

    alternatives = []
    if main.status != "UNAVAILABLE" and not batch.truncated:
        for result in sorted(results, key=order):
            if result.status not in ("SAFE", "RISKY") or result.selected_schedule.occurrence_id == main.selected_schedule.occurrence_id:
                continue
            alternatives.append(Alternative(schedule=result.selected_schedule, status=result.status, reason_code=result.reason_code,
                reason=result.reason, estimated_arrival_at=result.estimated_arrival_at, travel_time_min=result.travel_time_min,
                buffer_min=result.buffer_min, latest_departure_estimate_at=result.latest_departure_estimate_at))
            if len(alternatives) == 3:
                break
    unique_warnings = {warning.code: warning for warning in [*main.warnings, *all_warnings]}
    sources = {**main.sources.model_dump(), "schedule": main.sources.schedule or batch.source}
    return DepartureResult(**{**main.model_dump(), "plan": plan, "sources": sources, "alternatives": alternatives,
        "selection": Selection(mode="selected" if plan.schedule_id else "automatic", service_date=plan.service_date,
            examined_count=len(candidates), excluded_count=len(exclusions), candidate_limit=100, truncated=batch.truncated),
        "exclusions": exclusions, "warnings": list(unique_warnings.values())})

"""Validated departure simulation parameters; no dotenv reads or import-time I/O."""
from collections.abc import Mapping
import os
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

PositiveMinutes = Annotated[float, Field(strict=True, gt=0, allow_inf_nan=False)]


class DepartureConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    safety_buffer_min: PositiveMinutes = 15
    schedule_max_age_min: PositiveMinutes = 1440

    @classmethod
    def from_environment(cls, environ: Mapping[str, str] | None = None) -> "DepartureConfig":
        """Call at the future application's startup; invalid config raises ValueError."""
        values = os.environ if environ is None else environ
        names = {
            "safety_buffer_min": "DEPARTURE_SAFETY_BUFFER_MIN",
            "schedule_max_age_min": "DEPARTURE_SCHEDULE_MAX_AGE_MIN",
        }
        return cls(**{field: float(values[name]) for field, name in names.items() if name in values})

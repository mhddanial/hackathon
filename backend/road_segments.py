"""Supported road names shared by service responses and Oracle instructions."""

# Catalog fallback for unavailable labels; internal IDs remain stable.
SEGMENT_NAMES = {
    "SEG001": "Jl. Yos Sudarso (Koridor Utama)",
    "SEG002": "Jl. Jendral Sudirman",
    "SEG003": "Jl. Ahmad Yani",
    "SEG004": "Jl. Brigjen Katamso",
    "SEG005": "Jl. Trans Barelang (Segmen 1)",
    "SEG006": "Jl. Hang Jebat",
}


def segment_name(segment_id: str, stored_name: object = None) -> str | None:
    if isinstance(stored_name, str) and 0 < len(stored_name.strip()) <= 256:
        return stored_name.strip()
    return SEGMENT_NAMES.get(segment_id)

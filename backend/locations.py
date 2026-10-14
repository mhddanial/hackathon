"""Deterministic named locations; no runtime geocoder or invented coordinates."""
import json
import math
from pathlib import Path
import re

LOCATIONS = json.loads((Path(__file__).resolve().parent / 'data' / 'batam-locations.json').read_text(encoding='utf-8'))


class LocationError(ValueError):
    def __init__(self, code, message, choices):
        super().__init__(message)
        self.output = {'code': code, 'error': message, 'choices': [{'id': row['id'], 'name': row['name']} for row in choices]}


def normalize_name(value):
    return re.sub(r'[^\w]+', ' ', value.casefold()).strip()


def in_planning_area(lat, lng):
    # Explicit project envelope around main-island Batam, not a geofence polygon.
    return math.isfinite(lat) and math.isfinite(lng) and 0.7 <= lat <= 1.25 and 103.8 <= lng <= 104.3


def resolve_location(value):
    label = value.strip()
    if ',' in label:
        try:
            lat, lng = map(float, label.split(','))
        except ValueError:
            raise LocationError('location_unknown', 'Provide a supported location name or latitude, longitude.', LOCATIONS) from None
        if not in_planning_area(lat, lng):
            raise LocationError('outside_coverage', 'The coordinates are outside the supported Batam planning area. Check the latitude sign or choose a supported location.', LOCATIONS)
        return {'name': label, 'lat': lat, 'lng': lng, 'point_kind': 'supplied coordinates'}
    key = normalize_name(label)
    exact = [row for row in LOCATIONS if key in [normalize_name(v) for v in [row['id'], row['name'], *row['aliases']]]]
    matches = exact or [row for row in LOCATIONS if key and any(key in normalize_name(v) for v in [row['name'], *row['aliases']])]
    if len(matches) != 1:
        raise LocationError('location_ambiguous' if matches else 'location_unknown',
            'Choose a specific supported location; this name is ambiguous.' if matches else 'This location is not in the supported catalog. Ask the user to choose a supported location or provide coordinates within Batam.', matches or LOCATIONS)
    return dict(matches[0])

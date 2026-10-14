"""Explicit clock/date handling in Asia/Jakarta, including vessel ISO timestamps."""
from datetime import date, datetime
import re
from zoneinfo import ZoneInfo

PLANNING_ZONE = ZoneInfo('Asia/Jakarta')


def clock_time(value):
    if not isinstance(value, str): raise ValueError('Time must be a string')
    value = re.sub(r'\s*(WIB|Asia/Jakarta)\s*$', '', value.strip(), flags=re.I).strip()
    if re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d', value): return value
    match = re.fullmatch(r'(0?[1-9]|1[0-2])(?::([0-5]\d))?\s*(AM|PM)', value, re.I)
    if not match: raise ValueError('Use HH:MM or an explicit AM/PM time in WIB')
    hour = int(match[1]) % 12 + (12 if match[3].upper() == 'PM' else 0)
    return f'{hour:02}:{int(match[2] or 0):02}'


def vessel_time(value):
    if value is None: return None
    if not isinstance(value, str): raise ValueError('ETD must be a string')
    if 'T' not in value: return clock_time(value)
    parsed = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
    if parsed.tzinfo is None: raise ValueError('Vessel timestamps require a UTC offset or Z')
    return parsed.isoformat()


def planning_date(value):
    if value is None: return None
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value): raise ValueError('Use YYYY-MM-DD')
    return date.fromisoformat(value).isoformat()


def planning_context(time, day_type, departure_date=None, vessel_etd=None):
    time = clock_time(time)
    departure_date = planning_date(departure_date)
    etd = vessel_time(vessel_etd)
    absolute_etd = datetime.fromisoformat(etd).astimezone(PLANNING_ZONE) if etd and 'T' in etd else None
    inferred = departure_date is None and absolute_etd is not None
    day = departure_date or (absolute_etd.date().isoformat() if absolute_etd else None)
    if day and ('weekday' if date.fromisoformat(day).weekday() < 5 else 'weekend') != day_type:
        raise ValueError('Departure date conflicts with day type')
    departure = datetime.fromisoformat(f'{day}T{time}').replace(tzinfo=PLANNING_ZONE) if day else None
    if departure and etd and not absolute_etd:
        absolute_etd = datetime.fromisoformat(f'{day}T{etd}').replace(tzinfo=PLANNING_ZONE)
    return {'time': time, 'date': day, 'departure': departure, 'etd': absolute_etd,
        'etd_clock': absolute_etd.strftime('%H:%M') if absolute_etd else etd, 'date_inferred': inferred}

"""Bounded, validated GeoJSON preview with endpoint-preserving simplification."""
import math

MAX_MAP_POINTS = 160


def compact_geometry(value):
    if not isinstance(value, dict) or value.get('type') != 'LineString': return None
    points = value.get('coordinates')
    if not isinstance(points, list) or not 2 <= len(points) <= 20000: return None
    for p in points:
        if not isinstance(p, (list, tuple)) or len(p) != 2 or any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in p): return None
        if not -180 <= p[0] <= 180 or not -90 <= p[1] <= 90: return None
    points = [[round(p[0], 6), round(p[1], 6)] for p in points]
    if len(points) > MAX_MAP_POINTS:
        # Ramer-Douglas-Peucker in local lon/lat space; increase tolerance until bounded.
        def simplify(tolerance):
            keep = {0, len(points)-1}; stack = [(0, len(points)-1)]
            while stack:
                start, end = stack.pop(); a, b = points[start], points[end]
                dx, dy = b[0]-a[0], b[1]-a[1]; length = dx*dx+dy*dy
                maximum, index = 0, start
                for i in range(start+1, end):
                    p = points[i]; t = max(0, min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)) if length else 0
                    distance = (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2
                    if distance > maximum: maximum, index = distance, i
                if maximum > tolerance*tolerance:
                    keep.add(index); stack.extend([(start,index),(index,end)])
            return [points[i] for i in sorted(keep)]
        tolerance = 0.00001
        preview = simplify(tolerance)
        while len(preview) > MAX_MAP_POINTS:
            tolerance *= 2; preview = simplify(tolerance)
        points = preview
    return {'type': 'LineString', 'coordinates': points}

// Legacy saved results have IDs only. Keep this fallback aligned with backend/road_segments.py.
export const segmentNames: Record<string, string> = {
  SEG001: "Jl. Yos Sudarso (Koridor Utama)",
  SEG002: "Jl. Jendral Sudirman",
  SEG003: "Jl. Ahmad Yani",
  SEG004: "Jl. Brigjen Katamso",
  SEG005: "Jl. Trans Barelang (Segmen 1)",
  SEG006: "Jl. Hang Jebat",
};

export function roadName(segmentId?: string, name?: string): string | undefined {
  return name?.trim() || (segmentId && Object.hasOwn(segmentNames, segmentId) ? segmentNames[segmentId] : segmentId);
}

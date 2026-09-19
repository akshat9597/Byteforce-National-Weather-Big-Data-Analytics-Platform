export type TimeRange = { start: number; end: number; valid: boolean };
const DAY = 86400000;
export function analyticsRange(
  period: string,
  startDate: string,
  endDate: string,
  now = Date.now(),
): TimeRange {
  if (period === "Custom Range") {
    const start = startDate ? Date.parse(startDate + "T00:00:00+05:30") : NaN;
    const end = endDate ? Date.parse(endDate + "T00:00:00+05:30") + DAY : NaN;
    return {
      start,
      end,
      valid: Number.isFinite(start) && Number.isFinite(end) && end > start,
    };
  }
  const days: Record<string, number> = {
    "24 Hours": 1,
    "7 Days": 7,
    "30 Days": 30,
  };
  return { start: now - (days[period] || 1) * DAY, end: now, valid: true };
}
export function bucketReports(
  reports: { timestamp: string; created_at?: string }[],
  range: TimeRange,
  field: "timestamp" | "created_at" = "timestamp",
) {
  if (!range.valid) return [];
  const span = range.end - range.start;
  const step =
    span <= DAY + 1 ? 3600000 : Math.max(1, Math.ceil(span / (90 * DAY))) * DAY;
  const count = Math.ceil(span / step);
  const buckets = Array.from({ length: count }, (_, i) => {
    const stamp = range.start + i * step;
    return {
      hour: new Date(stamp).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        ...(step < DAY
          ? { hour: "2-digit", minute: "2-digit", hour12: false }
          : { day: "2-digit", month: "short" }),
      }),
      reports: 0,
      start: stamp,
    };
  });
  for (const report of reports) {
    const t = Date.parse(report[field] || report.timestamp);
    if (t >= range.start && t < range.end) {
      const index = Math.floor((t - range.start) / step);
      buckets[index].reports++;
    }
  }
  return buckets;
}

"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useId } from "react";
import { bucketReports, type TimeRange } from "@/lib/analytics";
import type { Report } from "@/types";
const palette = [
  "#245a92",
  "#429b9a",
  "#9ab9d2",
  "#e4ad4f",
  "#d27b69",
  "#7d8baa",
];
export function Trend({
  reports,
  height = 190,
  range,
  field = "created_at",
}: {
  reports: Report[];
  height?: number;
  range?: TimeRange;
  field?: "timestamp" | "created_at";
}) {
  const id = useId().replaceAll(":", "");
  const now = Date.now();
  const data = bucketReports(
    reports,
    range || { start: now - 12 * 3600000, end: now, valid: true },
    field,
  );
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 15, right: 20, left: -25, bottom: 0 }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3776b6" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#3776b6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 4"
          vertical={false}
          stroke="#e8edf2"
        />
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 11, fill: "#7d8999" }}
          axisLine={false}
          tickLine={false}
          minTickGap={28}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#7d8999" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          labelFormatter={(_, payload) =>
            payload[0]?.payload?.start
              ? new Date(payload[0].payload.start).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })
              : ""
          }
        />
        <Area
          type="monotone"
          dataKey="reports"
          stroke="#3776b6"
          strokeWidth={2}
          fill={`url(#${id})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
export function Distribution({
  reports,
  field = "source_type",
  bars = false,
}: {
  reports: Report[];
  field?: keyof Report;
  bars?: boolean;
}) {
  const counts = reports.reduce(
    (a, r) => {
      const k = String(r[field]);
      a[k] = (a[k] || 0) + 1;
      return a;
    },
    {} as Record<string, number>,
  );
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));
  return bars ? (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart
        data={data}
        margin={{ left: -15, right: 20, bottom: 10, top: 15 }}
      >
        <CartesianGrid vertical={false} stroke="#eef1f5" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  ) : (
    <div className="distribution">
      <ResponsiveContainer width="48%" height={160}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={44}
            outerRadius={63}
            paddingAngle={3}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div>
        {data.map((d, i) => (
          <div className="legend-row" key={d.name}>
            <i style={{ background: palette[i % palette.length] }} />
            <span>{d.name}</span>
            <strong>{d.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

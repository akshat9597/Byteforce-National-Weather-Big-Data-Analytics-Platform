"use client";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  ArrowRight,
  FileText,
  ShieldCheck,
  CloudLightning,
  Clock,
  ShieldAlert,
  TriangleAlert,
  Maximize2,
  Radio,
} from "lucide-react";
import { Panel, Badge, Empty } from "@/components/ui";
import { Trend, Distribution } from "@/components/charts";
import { ReportTable } from "@/components/report-table";
import type { Report, WeatherEvent, Alert } from "@/types";
export const WeatherMap = dynamic(() => import("@/components/weather-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">Loading national weather map…</div>
  ),
});
export function Overview({
  reports,
  events,
  alerts,
  onEvent,
  onReport,
  navigate,
}: {
  reports: Report[];
  events: WeatherEvent[];
  alerts: Alert[];
  onEvent: (e: WeatherEvent) => void;
  onReport: (r: Report) => void;
  navigate: (s: string) => void;
}) {
  const verified = reports.filter(
    (r) => r.verification_status === "Verified",
  ).length;
  const active = alerts
    .filter((a) => !["Resolved", "Archived"].includes(a.status))
    .sort(
      (a, b) =>
        ["Advisory", "Watch", "Warning", "Critical"].indexOf(b.level) -
        ["Advisory", "Watch", "Warning", "Critical"].indexOf(a.level),
    );
  const stats = [
    {
      label: "Total reports today",
      value: reports.filter(
        (r) =>
          new Date(r.created_at).toDateString() === new Date().toDateString(),
      ).length,
      sub: "Across all reporting sources",
      icon: FileText,
      color: "blue",
    },
    {
      label: "Verified reports",
      value: verified,
      sub: `${reports.length ? Math.round((verified / reports.length) * 100) : 0}% of all reports`,
      icon: ShieldCheck,
      color: "green",
    },
    {
      label: "Active weather events",
      value: events.filter((e) => e.status === "Active").length,
      sub: `${new Set(events.map((e) => e.state)).size} states & territories`,
      icon: CloudLightning,
      color: "blue",
    },
    {
      label: "Under review",
      value: reports.filter((r) =>
        ["Pending", "Under Review"].includes(r.verification_status),
      ).length,
      sub: "Awaiting officer assessment",
      icon: Clock,
      color: "amber",
    },
    {
      label: "Suspicious reports",
      value: reports.filter((r) => r.verification_status === "Suspicious")
        .length,
      sub: "Additional evidence required",
      icon: ShieldAlert,
      color: "orange",
    },
    {
      label: "Priority alerts",
      value: active.length,
      sub: `${active.filter((a) => a.level === "Critical").length} critical · action required`,
      icon: TriangleAlert,
      color: "red",
    },
  ];
  return (
    <>
      <div className="kpi-grid">
        {stats.map((s) => (
          <div className={"kpi " + s.color} key={s.label}>
            <div>
              <span>{s.label}</span>
              <s.icon size={17} />
            </div>
            <strong>{s.value.toLocaleString("en-IN")}</strong>
            <small>{s.sub}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-main">
        <Panel
          title="National weather situational map"
          action={
            <button
              className="text-button"
              onClick={() => navigate("National Map")}
            >
              Explore map <Maximize2 size={14} />
            </button>
          }
        >
          <WeatherMap events={events} onSelect={onEvent} />
          <div className="map-footer">
            <Radio size={14} /> Consolidated events from citizen, social and
            official-source simulations <span>INDIA · IST</span>
          </div>
        </Panel>
        <div className="right-stack">
          <Panel
            title="Priority alerts"
            action={<span className="count-label">{active.length} active</span>}
          >
            <div className="alert-list">
              {active.slice(0, 3).map((a) => (
                <button
                  className="alert-item"
                  onClick={() => onEvent(a.event)}
                  key={a.id}
                >
                  <div className="alert-top">
                    <Badge value={a.level} />
                    <span>{a.event.state}</span>
                  </div>
                  <strong>
                    {a.event.event_type} · {a.event.city}
                  </strong>
                  <p>{a.message}</p>
                  <small>
                    {Math.round(a.event.confidence * 100)}% confidence{" "}
                    <ArrowUpRight size={13} />
                  </small>
                </button>
              ))}
              {!active.length && <Empty text="No active priority alerts." />}
            </div>
            <button className="panel-link" onClick={() => navigate("Alerts")}>
              View all alerts <ArrowRight size={14} />
            </button>
          </Panel>
          <Panel
            title="Source distribution"
            action={<span className="muted">All reports</span>}
          >
            <Distribution reports={reports} />
          </Panel>
        </div>
      </div>
      <div className="dashboard-bottom">
        <Panel
          title="Recent weather reports"
          action={
            <button
              className="text-button"
              onClick={() => navigate("Live Monitoring")}
            >
              Live monitoring <ArrowRight size={14} />
            </button>
          }
        >
          <ReportTable
            reports={reports.slice(0, 5)}
            onSelect={onReport}
            compact
          />
        </Panel>
        <Panel
          title="Report activity"
          action={<span className="muted">Last 12 hours</span>}
        >
          <div className="activity-total">
            <strong>{reports.length}</strong>
            <span>reports in the workspace</span>
          </div>
          <Trend reports={reports} />
          <div className="chart-foot">
            <i className="live-dot" /> Incoming reports across all sources
          </div>
        </Panel>
      </div>
    </>
  );
}

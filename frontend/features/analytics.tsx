"use client";
import { useState, useEffect } from "react";
import { analyticsRange } from "@/lib/analytics";
import { api, download } from "@/services/api";
import { Panel, Badge, Empty } from "@/components/ui";
import { Trend, Distribution } from "@/components/charts";
import type { Report, WeatherEvent } from "@/types";
export function AnalyticsPage({
  reports,
  events,
}: {
  reports: Report[];
  events: WeatherEvent[];
}) {
  const [timing, setTiming] = useState<any>(null);
  useEffect(() => {
    api("/analytics/verification-time")
      .then(setTiming)
      .catch(() => {});
  }, [reports]);
  const [period, setPeriod] = useState("24 Hours"),
    [state, setState] = useState(""),
    [district, setDistrict] = useState(""),
    [source, setSource] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const range = analyticsRange(period, start, end);
  const rows = reports.filter(
    (r) =>
      (!state || r.state === state) &&
      (!district || r.district === district) &&
      (!source || r.source_type === source) &&
      range.valid &&
      Date.parse(r.timestamp) >= range.start &&
      Date.parse(r.timestamp) < range.end,
  );
  const verified = rows.filter(
    (r) => r.verification_status === "Verified",
  ).length;
  const districts = Array.from(new Set(rows.map((r) => r.district)))
    .map((d) => {
      const rs = rows.filter((r) => r.district === d);
      return {
        name: d,
        state: rs[0].state,
        reports: rs.length,
        events: new Set(rs.map((r) => r.event_id)).size,
        verified: Math.round(
          (rs.filter((r) => r.verification_status === "Verified").length /
            rs.length) *
            100,
        ),
        category: Object.entries(
          rs.reduce(
            (a, r) => ({ ...a, [r.event_type]: (a[r.event_type] || 0) + 1 }),
            {} as Record<string, number>,
          ),
        ).sort((a, b) => b[1] - a[1])[0][0],
        severity: rs.reduce(
          (a, r) =>
            ["Low", "Moderate", "High", "Critical"].indexOf(r.severity) >
            ["Low", "Moderate", "High", "Critical"].indexOf(a)
              ? r.severity
              : a,
          "Low",
        ),
      };
    })
    .sort((a, b) => b.reports - a.reports);
  return (
    <>
      <div className="analytics-toolbar">
        <div className="segmented">
          {["24 Hours", "7 Days", "30 Days", "Custom Range"].map((p) => (
            <button
              key={p}
              className={period === p ? "selected" : ""}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <select
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setDistrict("");
          }}
          aria-label="Analytics state"
        >
          <option value="">All states</option>
          {Array.from(new Set(reports.map((r) => r.state)))
            .sort()
            .map((s) => (
              <option key={s}>{s}</option>
            ))}
        </select>
        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          aria-label="Analytics district"
        >
          <option value="">All districts</option>
          {Array.from(
            new Set(
              reports
                .filter((r) => !state || r.state === state)
                .map((r) => r.district),
            ),
          )
            .sort()
            .map((s) => (
              <option key={s}>{s}</option>
            ))}
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="Analytics source"
        >
          <option value="">All sources</option>
          {["Citizen", "Social", "Official", "RSS"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {period === "Custom Range" && (
          <>
            <input
              aria-label="Start date"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <input
              aria-label="End date"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </>
        )}
        <button
          disabled={!range.valid || !rows.length}
          onClick={() => download(rows, "csv", "byteforce-analytics")}
        >
          Export selection
        </button>
      </div>
      {!range.valid && (
        <p className="error" role="alert">
          Choose a valid start and end date. Custom dates use India Standard
          Time.
        </p>
      )}
      <div className="analytics-kpis">
        {[
          ["Total reports", rows.length],
          [
            "Active events",
            events.filter(
              (e) =>
                e.status === "Active" && rows.some((r) => r.event_id === e.id),
            ).length,
          ],
          [
            "Verification rate",
            `${rows.length ? Math.round((verified / rows.length) * 100) : 0}%`,
          ],
          [
            "High severity reports",
            rows.filter((r) => ["High", "Critical"].includes(r.severity))
              .length,
          ],
        ].map(([label, value]) => (
          <div className="kpi" key={label}>
            <div>{label}</div>
            <strong>{value}</strong>
            <small>
              {state || "National coverage"} · {period}
            </small>
          </div>
        ))}
      </div>
      <div className="analytics-grid">
        <Panel
          title="Reports over time"
          action={<span className="muted">{period} · IST</span>}
        >
          <Trend reports={rows} height={250} range={range} field="timestamp" />
        </Panel>
        <Panel title="Events by category">
          <Distribution
            reports={Array.from(
              new Map(rows.map((r) => [r.event_id, r])).values(),
            )}
            field="event_type"
            bars
          />
        </Panel>
        <Panel title="Reports by state">
          <Distribution reports={rows} field="state" bars />
        </Panel>
        <Panel title="Source distribution">
          <Distribution reports={rows} />
        </Panel>
        <Panel title="Verification status">
          <Distribution reports={rows} field="verification_status" bars />
        </Panel>
        <Panel title="Severity distribution">
          <Distribution reports={rows} field="severity" bars />
        </Panel>
        <Panel title="Trust score distribution">
          <Distribution
            reports={rows.map((r) => ({
              ...r,
              city:
                r.trust_score < 40
                  ? "0–39"
                  : r.trust_score < 60
                    ? "40–59"
                    : r.trust_score < 80
                      ? "60–79"
                      : "80–100",
            }))}
            field="city"
            bars
          />
        </Panel>
        <Panel title="Verification operations">
          <div className="guidance">
            <h3>{verified} verified reports</h3>
            <p>
              {
                rows.filter((r) =>
                  ["Pending", "Under Review"].includes(r.verification_status),
                ).length
              }{" "}
              reports awaiting a completed review.
            </p>
            <p>
              {timing?.average_minutes != null
                ? `All-time verification time (all reports): ${timing.average_minutes} minutes across ${timing.sample_count} officer verifications.`
                : "Average verification time is available once officer audit records exist. Seeded statuses are excluded."}
            </p>
          </div>
        </Panel>
      </div>
      <Panel
        title={
          state ? state + " · district intelligence" : "Top affected districts"
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>DISTRICT</th>
                <th>STATE</th>
                <th>REPORTS</th>
                <th>EVENTS</th>
                <th>VERIFICATION RATE</th>
                <th>MOST COMMON EVENT</th>
                <th>SEVERITY</th>
              </tr>
            </thead>
            <tbody>
              {districts.map((d) => (
                <tr key={d.name}>
                  <td>
                    <strong>{d.name}</strong>
                  </td>
                  <td>{d.state}</td>
                  <td>{d.reports}</td>
                  <td>{d.events}</td>
                  <td>{d.verified}%</td>
                  <td>{d.category}</td>
                  <td>
                    <Badge value={d.severity} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!districts.length && <Empty />}
        </div>
      </Panel>
    </>
  );
}

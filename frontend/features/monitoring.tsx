"use client";
import { useState, useEffect, useRef } from "react";
import {
  Pause,
  Play,
  Download,
  Search,
  Radio,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { ReportTable } from "@/components/report-table";
import { Panel, Badge, Empty, fmt } from "@/components/ui";
import { download } from "@/services/api";
import type { Report, WeatherEvent, User } from "@/types";
import { ReportDetails } from "./details";
export function ReportsPage({
  reports,
  onReport,
  live = false,
  citizen = false,
}: {
  reports: Report[];
  onReport: (r: Report) => void;
  live?: boolean;
  citizen?: boolean;
}) {
  const [paused, setPaused] = useState(false),
    [snapshot, setSnapshot] = useState<Report[]>([]),
    [status, setStatus] = useState(""),
    [source, setSource] = useState(""),
    [search, setSearch] = useState(""),
    [auto, setAuto] = useState(true),
    [page, setPage] = useState(1);
  const top = useRef<HTMLDivElement>(null);
  const rows = (paused ? snapshot : reports).filter(
    (r) =>
      (!citizen || r.source_type === "Citizen") &&
      (!status || r.verification_status === status) &&
      (!source || r.source_type === source) &&
      (!search ||
        `${r.id} ${r.city} ${r.text}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  useEffect(() => {
    setPage(1);
  }, [status, source, search]);
  useEffect(() => {
    if (live && auto && !paused && top.current && window.scrollY > 500)
      top.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [reports[0]?.id]);
  return (
    <Panel
      title={
        live
          ? "Incoming report stream"
          : citizen
            ? "Citizen submissions"
            : "Weather report registry"
      }
      action={<span className="muted">{rows.length} reports</span>}
    >
      <div className="table-toolbar" ref={top}>
        <div className="input-search">
          <Search size={15} />
          <input
            placeholder="Search reports…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Verification status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All verification statuses</option>
          {[
            "Verified",
            "Pending",
            "Under Review",
            "Suspicious",
            "Rejected",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {!citizen && (
          <select
            aria-label="Source filter"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">All sources</option>
            {["Citizen", "Official", "Social", "RSS"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
        {live && (
          <>
            <button
              onClick={() => {
                if (!paused) setSnapshot(reports);
                setPaused(!paused);
              }}
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}{" "}
              {paused ? "Resume" : "Pause"} feed
            </button>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={auto}
                onChange={(e) => setAuto(e.target.checked)}
              />{" "}
              Auto scroll
            </label>
          </>
        )}
        <button onClick={() => download(rows, "csv")}>
          <Download size={14} /> CSV
        </button>
        <button onClick={() => download(rows, "json")}>JSON</button>
      </div>
      {paused && (
        <div className="notice">
          Feed display paused. Incoming records continue to be stored.
        </div>
      )}
      <ReportTable
        reports={rows.slice((page - 1) * 20, page * 20)}
        onSelect={onReport}
      />
      <div className="pagination">
        <span>
          Showing {rows.length ? (page - 1) * 20 + 1 : 0}–
          {Math.min(page * 20, rows.length)} of {rows.length}
        </span>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>Page {page}</span>
        <button
          disabled={page * 20 >= rows.length}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </Panel>
  );
}
export function EventsPage({
  events,
  reports,
  onEvent,
}: {
  events: WeatherEvent[];
  reports: Report[];
  onEvent: (e: WeatherEvent) => void;
}) {
  const [severity, setSeverity] = useState("");
  const rows = events.filter((e) => !severity || e.severity === severity);
  return (
    <>
      <div className="fusion-banner">
        <div className="fusion-icon">
          <Radio size={22} />
        </div>
        <div>
          <h3>One event. Multiple sources. A consolidated picture.</h3>
          <p>
            Reports are correlated by weather category, proximity within 5 km
            and a 24-hour window.
          </p>
        </div>
        <span>
          {reports.length} reports <ArrowRight size={15} /> {events.length}{" "}
          events
        </span>
      </div>
      <Panel
        title="Consolidated weather events"
        action={
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            aria-label="Event severity"
          >
            <option value="">All severities</option>
            {["Low", "Moderate", "High", "Critical"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>EVENT</th>
                <th>LOCATION</th>
                <th>SEVERITY</th>
                <th>REPORTS</th>
                <th>SOURCES</th>
                <th>CONFIDENCE</th>
                <th>LAST UPDATED</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <strong>{e.event_type}</strong>
                    <small className="mono">{e.id}</small>
                  </td>
                  <td>
                    {e.city}
                    <small>{e.state}</small>
                  </td>
                  <td>
                    <Badge value={e.severity} />
                  </td>
                  <td>{e.report_count}</td>
                  <td>
                    {
                      new Set(
                        reports
                          .filter((r) => r.event_id === e.id)
                          .map((r) => r.source_type),
                      ).size
                    }
                  </td>
                  <td>{Math.round(e.confidence * 100)}%</td>
                  <td>{fmt(e.last_updated)}</td>
                  <td>
                    <Badge value={e.status} />
                  </td>
                  <td>
                    <button className="text-button" onClick={() => onEvent(e)}>
                      View details <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty text="No events match the selected filters." />
          )}
        </div>
      </Panel>
    </>
  );
}
export function SocialPage({
  reports,
  onReport,
}: {
  reports: Report[];
  onReport: (r: Report) => void;
}) {
  const [tag, setTag] = useState("All");
  const rows = reports
    .filter((r) => ["Social", "RSS"].includes(r.source_type))
    .filter(
      (r) =>
        tag === "All" ||
        (tag === "#IMD"
          ? r.source_name.toLowerCase().includes("imd")
          : tag === "#Weather"
            ? true
            : tag === "#MumbaiRains"
              ? r.city === "Mumbai" && r.event_type === "Rainfall"
              : tag === "#DelhiWeather"
                ? r.state === "Delhi"
                : tag === "#VizagRains"
                  ? r.city === "Visakhapatnam"
                  : r.event_type
                      .toLowerCase()
                      .includes(tag.slice(1).toLowerCase())),
    );
  return (
    <>
      <div className="social-status">
        <Radio size={18} />
        <div>
          <strong>Public-source weather intelligence</strong>
          <p>
            Simulated public posts and regional feeds · deterministic event
            extraction
          </p>
        </div>
        <Badge value="Simulated" />
      </div>
      <div className="tag-filter">
        {[
          "All",
          "#Weather",
          "#IMD",
          "#Rain",
          "#Flood",
          "#Heatwave",
          "#Cyclone",
          "#Thunderstorm",
          "#MumbaiRains",
          "#DelhiWeather",
          "#VizagRains",
        ].map((t) => (
          <button
            className={t === tag ? "selected" : ""}
            key={t}
            onClick={() => setTag(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="social-grid">
        {rows.slice(0, 36).map((r) => (
          <article className="social-card" key={r.id}>
            <header>
              <span className="avatar">{r.city.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{r.source_name}</strong>
                <small>
                  {fmt(r.timestamp)} · {r.id}
                </small>
              </div>
              <Badge value={r.source_type} />
            </header>
            <p>{r.text}</p>
            <div className="hashtags">
              #Weather #{r.event_type.replaceAll(" ", "")} #
              {r.city.replaceAll(" ", "")}
            </div>
            <div className="social-extracted">
              <span>
                Extracted location<strong>{r.city}</strong>
              </span>
              <span>
                AI category<strong>{r.event_type}</strong>
              </span>
              <span>
                Confidence<strong>{Math.round(r.ai_confidence * 100)}%</strong>
              </span>
            </div>
            <footer>
              <Badge value={r.verification_status} />
              <button className="text-button" onClick={() => onReport(r)}>
                Review evidence <ArrowRight size={14} />
              </button>
            </footer>
          </article>
        ))}
      </div>
      {!rows.length && <Empty text="No posts match this hashtag." />}
    </>
  );
}
export function VerificationPage({
  reports,
  events,
  user,
  onChanged,
}: {
  reports: Report[];
  events: WeatherEvent[];
  user: User;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState(""),
    [status, setStatus] = useState("Pending");
  const queue = reports.filter(
    (r) => !status || r.verification_status === status,
  );
  const current = reports.find((r) => r.id === selected) || queue[0];
  return (
    <div className="verification-layout">
      <Panel
        title="Review queue"
        action={<span className="count-label">{queue.length}</span>}
      >
        <select
          className="queue-filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setSelected("");
          }}
          aria-label="Review queue status"
        >
          <option value="">All reports</option>
          {[
            "Pending",
            "Under Review",
            "Suspicious",
            "Verified",
            "Rejected",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <div className="queue-list">
          {queue.map((r) => (
            <button
              className={
                r.id === current?.id ? "queue-item selected" : "queue-item"
              }
              key={r.id}
              onClick={() => setSelected(r.id)}
            >
              <div>
                <span className="mono">{r.id}</span>
                <Badge value={r.severity} />
              </div>
              <strong>
                {r.event_type} · {r.city}
              </strong>
              <p>{r.text.slice(0, 85)}…</p>
              <small>
                {r.source_type} · Trust {r.trust_score}% · {fmt(r.timestamp)}
              </small>
            </button>
          ))}
          {!queue.length && <Empty text="The review queue is clear." />}
        </div>
      </Panel>
      <Panel
        title="Report assessment"
        action={current && <Badge value={current.verification_status} />}
      >
        {current ? (
          <ReportDetails
            key={current.id}
            report={current}
            events={events}
            user={user}
            onChanged={onChanged}
          />
        ) : (
          <Empty text="Select a report to begin review." />
        )}
      </Panel>
    </div>
  );
}

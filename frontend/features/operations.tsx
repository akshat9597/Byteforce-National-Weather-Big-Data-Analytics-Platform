"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  Database,
  RefreshCw,
  Check,
  UserPlus,
  Shield,
  Settings,
  Save,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { ProfileEditor, RoleEditor } from "./account-controls";
import { AdminConfig, SystemLogs } from "./admin-config";
import { api, download } from "@/services/api";
import { Panel, Badge, Empty, fmt } from "@/components/ui";
import type { Alert, User } from "@/types";
export function AlertsPage({
  alerts,
  user,
  onChanged,
}: {
  alerts: Alert[];
  user: User;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [assign, setAssign] = useState(""),
    [names, setNames] = useState<Record<string, string>>({});
  const can = ["Administrator", "Verification Officer"].includes(user.role);
  async function act(id: string, next: string) {
    try {
      await api("/alerts/" + id, {
        method: "PATCH",
        body: JSON.stringify({ status: next, assigned_to: names[id] || "" }),
      });
      setAssign("");
      setError("");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const rows = alerts.filter((a) => !status || a.status === status);
  return (
    <>
      <div className="table-toolbar">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Alert status"
        >
          <option value="">All alert statuses</option>
          {["Open", "Acknowledged", "Assigned", "Resolved", "Archived"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
        <button
          onClick={() =>
            download(
              rows.map(({ event, ...r }) => ({ ...r, city: event.city })),
              "csv",
            )
          }
        >
          Export alerts
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="alerts-grid">
        {rows.map((a) => (
          <Panel key={a.id} title={a.id} action={<Badge value={a.level} />}>
            <div className="alert-detail">
              <h3>
                {a.event.event_type} · {a.event.city}
              </h3>
              <p>{a.message}</p>
              <div className="detail-grid">
                <div>
                  <dt>Created</dt>
                  <dd>{fmt(a.created_at)}</dd>
                </div>
                <div>
                  <dt>Event confidence</dt>
                  <dd>{Math.round(a.event.confidence * 100)}%</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <Badge value={a.status} />
                  </dd>
                </div>
                <div>
                  <dt>Assigned to</dt>
                  <dd>{a.assigned_to || "Unassigned"}</dd>
                </div>
              </div>
              {can && a.status !== "Archived" && (
                <div className="alert-actions">
                  <button
                    disabled={a.status === "Acknowledged"}
                    onClick={() => act(a.id, "Acknowledged")}
                  >
                    <Check size={14} /> Acknowledge
                  </button>
                  <button
                    onClick={() => setAssign(assign === a.id ? "" : a.id)}
                  >
                    Assign
                  </button>
                  <button
                    disabled={a.status === "Resolved"}
                    onClick={() => act(a.id, "Resolved")}
                  >
                    Resolve
                  </button>
                  <button onClick={() => act(a.id, "Archived")}>Archive</button>
                </div>
              )}
              {assign === a.id && (
                <form
                  className="assign-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(a.id, "Assigned");
                  }}
                >
                  <input
                    placeholder="Officer or response team"
                    required
                    value={names[a.id] || ""}
                    onChange={(e) =>
                      setNames({ ...names, [a.id]: e.target.value })
                    }
                  />
                  <button className="primary">Assign</button>
                </form>
              )}
            </div>
          </Panel>
        ))}
      </div>
      {!rows.length && <Empty text="No alerts match this status." />}
    </>
  );
}
function useResource(path: string, interval = 0) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  const refresh = () =>
    api(path)
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
    if (interval) {
      const t = setInterval(refresh, interval);
      return () => clearInterval(t);
    }
  }, [path]);
  return { data, error, refresh };
}
export function SourcesPage() {
  const { data, error, refresh } = useResource("/sources/status", 30000);
  return (
    <Panel
      title="Ingestion source registry"
      action={
        <button onClick={refresh}>
          <RefreshCw size={14} /> Refresh status
        </button>
      }
    >
      {error ? (
        <div className="error-state">{error}</div>
      ) : !data ? (
        <Empty text="Loading data sources…" />
      ) : (
        <>
          <div className="notice">
            Official, social and RSS connectors currently use development data.
            Citizen submissions are stored by the local API.
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>DATA SOURCE</th>
                  <th>TYPE</th>
                  <th>CONNECTION</th>
                  <th>RECORDS TODAY</th>
                  <th>LAST ACTIVITY</th>
                  <th>LATENCY</th>
                  <th>ERROR RATE</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s: any) => (
                  <tr key={s.id}>
                    <td>
                      <span className="source-cell">
                        <Database size={16} />
                        <strong>{s.name}</strong>
                      </span>
                      <small>{s.id}</small>
                    </td>
                    <td>{s.type}</td>
                    <td>
                      <Badge value={s.status} />
                    </td>
                    <td>{s.records_today}</td>
                    <td>{fmt(s.last_sync)}</td>
                    <td>Not measured</td>
                    <td>Not measured</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}
export function HealthPage() {
  const { data, error, refresh } = useResource("/health", 10000);
  return (
    <>
      <div className="health-banner">
        <CheckCircle2 size={24} />
        <div>
          <h3>
            {error
              ? "Unable to reach weather service"
              : data
                ? "Core services operational"
                : "Checking service status…"}
          </h3>
          <p>
            API and database checks run every 10 seconds. External and simulated
            services are identified separately.
          </p>
        </div>
        <button onClick={refresh}>
          <RefreshCw size={14} /> Check now
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <div className="analytics-kpis">
            {[
              ["API uptime", Math.floor(data.uptime_seconds / 60) + " min"],
              ["Database latency", data.database_latency_ms + " ms"],
              ["Live connections", data.websocket_clients],
              ["Streaming mode", data.simulation ? "Simulated" : "Manual"],
              ["Host CPU", data.cpu_percent + "%"],
              ["API memory", data.process_memory_mb + " MB"],
              ["Requests / minute", data.requests_per_minute],
              ["API latency", data.api_latency_ms + " ms"],
              ["Ingestion / minute", data.ingestion_per_minute],
              ["Review queue", data.review_queue_length],
            ].map(([l, v]) => (
              <div className="kpi" key={l}>
                <div>{l}</div>
                <strong>{v}</strong>
                <small>Current runtime measurement</small>
              </div>
            ))}
          </div>
          <Panel title="Service availability">
            <div className="service-list">
              {data.services.map((s: any) => (
                <div key={s.name}>
                  <Activity size={18} />
                  <div>
                    <strong>{s.name}</strong>
                    <small>{s.detail || "Health check passed"}</small>
                  </div>
                  <Badge value={s.status} />
                </div>
              ))}
            </div>
          </Panel>
          <div className="notice">
            CPU is host utilisation; memory is API-process resident memory.
            Request metrics cover the last minute in this process. The review
            queue counts pending and under-review records. Distributed telemetry
            requires an external collector.
          </div>
        </>
      )}
    </>
  );
}
const adminTabs = [
  "User Management",
  "Roles",
  "Verification Rules",
  "Trust Score Configuration",
  "Event Categories",
  "Alert Thresholds",
  "API Settings",
  "Audit Logs",
  "System Logs",
  "Data Sources",
];
export function AdminPage() {
  const [tab, setTab] = useState(adminTabs[0]),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const users = useResource("/admin/users"),
    audit = useResource("/admin/audit");
  return (
    <>
      <div className="tag-filter">
        {adminTabs.map((t) => (
          <button
            key={t}
            className={t === tab ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {[
        "Trust Score Configuration",
        "Verification Rules",
        "Alert Thresholds",
      ].includes(tab) ? (
        <AdminConfig section={tab} />
      ) : tab === "System Logs" ? (
        <SystemLogs />
      ) : tab === "Data Sources" ? (
        <SourcesPage />
      ) : tab === "User Management" ? (
        <div className="admin-grid">
          <Panel title="Organisation users">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>USER</th>
                    <th>ROLE</th>
                    <th>ORGANISATION</th>
                    <th>LAST SIGN-IN</th>
                    <th>ACCESS</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data?.map((u: User) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                        <small>{u.email}</small>
                      </td>
                      <td>
                        <Badge value={u.role} />
                      </td>
                      <td>{u.organization}</td>
                      <td>
                        {u.last_login_at
                          ? fmt(u.last_login_at)
                          : "Not recorded"}
                      </td>
                      <td>
                        <RoleEditor user={u} onChanged={users.refresh} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {users.error && <p className="error">{users.error}</p>}
          </Panel>
          <Panel title="Create user">
            <form
              className="settings-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                setError("");
                try {
                  await api("/admin/users", {
                    method: "POST",
                    body: JSON.stringify(
                      Object.fromEntries(new FormData(form)),
                    ),
                  });
                  form.reset();
                  setSuccess(
                    "User created. Share credentials through your secure organisational channel.",
                  );
                  users.refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <label>
                Full name
                <input name="name" required minLength={2} />
              </label>
              <label>
                Email address
                <input name="email" type="email" required />
              </label>
              <label>
                Initial password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={12}
                />
              </label>
              <label>
                Role
                <select name="role">
                  {[
                    "Viewer",
                    "Weather Analyst",
                    "Verification Officer",
                    "Administrator",
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              {error && <p className="error">{error}</p>}
              {success && <p className="success">{success}</p>}
              <button className="primary">
                <UserPlus size={15} /> Create account
              </button>
            </form>
          </Panel>
        </div>
      ) : tab === "Audit Logs" ? (
        <Panel
          title="Verification audit logs"
          action={<button onClick={audit.refresh}>Refresh</button>}
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>REPORT</th>
                  <th>OFFICER</th>
                  <th>CHANGE</th>
                  <th>REASON</th>
                  <th>TIME</th>
                </tr>
              </thead>
              <tbody>
                {audit.data?.map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.report_id}</td>
                    <td>{a.reviewed_by}</td>
                    <td>
                      {a.old_status} → {a.new_status}
                    </td>
                    <td>{a.reason || "—"}</td>
                    <td>{fmt(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!audit.data?.length && (
              <Empty text="No review actions recorded yet." />
            )}
          </div>
        </Panel>
      ) : tab === "Roles" ? (
        <Panel title="Role-based access policy">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ROLE</th>
                  <th>PERMISSIONS</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Administrator",
                    "All operational tools, verification and user management",
                  ],
                  [
                    "Weather Analyst",
                    "Read reports, events, maps and analytics",
                  ],
                  [
                    "Verification Officer",
                    "Read workspace, verify, flag, reject and merge reports; manage alerts",
                  ],
                  ["Viewer", "Read-only workspace access"],
                ].map(([r, p]) => (
                  <tr key={r}>
                    <td>
                      <strong>{r}</strong>
                    </td>
                    <td>{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <Panel title={tab}>
          <div className="guidance">
            <p className="notice">
              Current server policy · changes require a reviewed backend
              configuration update.
            </p>
            {tab === "Trust Score Configuration" ? (
              <table>
                <thead>
                  <tr>
                    <th>EVIDENCE</th>
                    <th>POINTS</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Official correlation", 25],
                    ["Nearby similar reports", 20],
                    ["Coordinates supplied", 15],
                    ["Recent timestamp", 10],
                    ["Duplicate evidence", -15],
                    ["Source reliability (unconfigured)", 0],
                    ["Media verification (unconfigured)", 0],
                  ].map(([l, v]) => (
                    <tr key={l}>
                      <td>{l}</td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : tab === "Verification Rules" ? (
              <>
                <h3>Evidence-led review</h3>
                <p>
                  All citizen submissions enter the Pending queue. Automatic
                  trust scoring does not confer Verified status. An authorised
                  officer must verify each report.
                </p>
                <p>
                  Rejection and suspicious flags require a reason. Every
                  decision is recorded with officer identity, time, previous
                  status and new status.
                </p>
                <p>
                  Fusion uses matching weather category, a 5 km radius and a
                  24-hour active-event window.
                </p>
              </>
            ) : tab === "Event Categories" ? (
              <p>
                Rainfall · Flooding · Thunderstorm · Lightning · Heatwave · Fog
                · Dust Storm · Strong Winds · Hailstorm · Cyclone · Other
              </p>
            ) : tab === "Alert Thresholds" ? (
              <>
                <h3>Critical severity policy</h3>
                <p>
                  A Critical citizen report opens an alert for its associated
                  event. An existing unresolved event alert suppresses repeated
                  alert creation.
                </p>
                <p>
                  Officers may acknowledge, assign, resolve or archive alerts.
                  These are internal operational records, not automatic public
                  warnings.
                </p>
              </>
            ) : (
              <>
                <h3>Secure server configuration</h3>
                <p>
                  API access uses HttpOnly session cookies. Passwords use Argon2
                  hashing. Credentials and source API keys remain on the
                  backend.
                </p>
                <p>
                  Configure database, allowed origins, Redis and JWT signing
                  through server environment variables.
                </p>
                <a
                  className="text-button"
                  href="http://localhost:8000/docs"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open local API documentation <ArrowRight size={14} />
                </a>
              </>
            )}
          </div>
        </Panel>
      )}
    </>
  );
}
export function SettingsPage({
  user,
  onUpdated,
}: {
  user: User;
  onUpdated: (user: User) => void;
}) {
  const [density, setDensity] = useState("Standard"),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    setDensity(localStorage.getItem("byteforce-density") || "Standard");
  }, []);
  return (
    <div className="admin-grid">
      <Panel title="Profile & workspace">
        <ProfileEditor user={user} onUpdated={onUpdated} />
      </Panel>
      <Panel title="Display preferences">
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            localStorage.setItem("byteforce-density", density);
            document.documentElement.dataset.density = density;
            setSaved(true);
          }}
        >
          <label>
            Table density
            <select
              value={density}
              onChange={(e) => {
                setDensity(e.target.value);
                setSaved(false);
              }}
            >
              <option>Standard</option>
              <option>Compact</option>
            </select>
          </label>
          <label>
            Reporting timezone
            <input value="India Standard Time · UTC +05:30" readOnly />
          </label>
          <p className="subtext">
            Display preferences are saved on this device.
          </p>
          <button className="primary">
            <Save size={15} /> Save preferences
          </button>
          {saved && <p className="success">Preferences saved.</p>}
        </form>
      </Panel>
    </div>
  );
}

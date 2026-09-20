"use client";
import { useState, useEffect } from "react";
import {
  ArrowDownToLine,
  Plus,
  ChevronRight,
  SlidersHorizontal,
  CalendarDays,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { Shell, navigation } from "@/components/shell";
import { Login } from "@/features/auth";
import { Overview, WeatherMap } from "@/features/overview";
import { CitizenForm, categories } from "@/features/citizen";
import { ReportDetails, EventDetails } from "@/features/details";
import {
  ReportsPage,
  EventsPage,
  SocialPage,
  VerificationPage,
} from "@/features/monitoring";
import { EventWorkspace } from "@/features/event-workspace";
import { AnalyticsPage } from "@/features/analytics";
import {
  AlertsPage,
  SourcesPage,
  HealthPage,
  AdminPage,
  SettingsPage,
} from "@/features/operations";
import { useWebMCP } from "@/hooks/use-webmcp";
import { usePlatform } from "@/hooks/use-platform";
import { api, download } from "@/services/api";
import type { User, Report, WeatherEvent } from "@/types";
import { Drawer, Panel, Empty } from "@/components/ui";
const titles: Record<string, string> = {
  Overview: "National overview",
  "Live Monitoring": "Live monitoring",
  "Weather Events": "Weather event intelligence",
  "National Map": "National weather map",
  Reports: "Weather report registry",
  "Citizen Reports": "Citizen reports",
  "Social Intelligence": "Social intelligence",
  "Verification Centre": "Verification centre",
  Analytics: "Weather analytics",
  "Data Sources": "Data sources",
  Alerts: "Alerts & response",
  Admin: "Administration",
  "System Health": "System health",
  Settings: "Workspace settings",
  "Submit Report": "Submit a weather report",
};
export default function Platform({
  initialEventId = "",
}: {
  initialEventId?: string;
}) {
  const [detailId, setDetailId] = useState(initialEventId);
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [page, setPage] = useState("Overview"),
    [query, setQuery] = useState(""),
    [state, setState] = useState(""),
    [kind, setKind] = useState(""),
    [severity, setSeverity] = useState(""),
    [event, setEvent] = useState<WeatherEvent | null>(null),
    [report, setReport] = useState<Report | null>(null);
  const [advanced, setAdvanced] = useState(false),
    [district, setDistrict] = useState(""),
    [source, setSource] = useState(""),
    [verification, setVerification] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const data = usePlatform(user);
  useWebMCP(data.reports, data.events, !!user);
  useEffect(() => {
    const expired = () => {
      const next = location.pathname + location.search;
      location.replace(
        "/login?reason=expired&next=" + encodeURIComponent(next),
      );
    };
    window.addEventListener("byteforce-session-expired", expired);
    return () =>
      window.removeEventListener("byteforce-session-expired", expired);
  }, []);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    // Public entry points must remain usable even while the API is waking up.
    if (location.pathname === "/login" || location.pathname === "/submit-report") {
      setReady(true);
    } else {
      api<User>("/auth/me", { signal: controller.signal, timeoutMs: 8000 })
        .then((identity) => { if (!disposed) setUser(identity); })
        .catch(() => {})
        .finally(() => { if (!disposed) setReady(true); });
    }
    const readRoute = () => {
      const slug = location.pathname.slice(1) || location.hash.slice(1);
      const eventMatch = location.pathname.match(/^\/weather-events\/([^/]+)$/);
      if (eventMatch) {
        setDetailId(decodeURIComponent(eventMatch[1]));
        setPage("Weather Events");
        return;
      }
      setDetailId("");
      if (!slug) {
        setPage("Overview");
        return;
      }
      const name = [...navigation.map(([n]) => n), "Submit Report"].find(
        (n) => n.toLowerCase().replaceAll(" ", "-") === slug,
      );
      if (name) setPage(name);
    };
    readRoute();
    window.addEventListener("popstate", readRoute);
    document.documentElement.dataset.density =
      localStorage.getItem("byteforce-density") || "Standard";
    return () => {
      disposed = true;
      controller.abort();
      window.removeEventListener("popstate", readRoute);
    };
  }, []);
  const navigate = (s: string) => {
    setDetailId("");
    setEvent(null);
    setReport(null);
    setPage(s);
    setQuery("");
    history.pushState(
      null,
      "",
      "/" + (s === "Overview" ? "" : s.toLowerCase().replaceAll(" ", "-")),
    );
  };
  const openEvent = (e: WeatherEvent) => {
    setDetailId(e.id);
    setEvent(null);
    setReport(null);
    setQuery("");
    setPage("Weather Events");
    history.pushState(null, "", "/weather-events/" + encodeURIComponent(e.id));
  };
  if (!ready)
    return <div className="boot">Initialising BYTEFORCE workspace…</div>;
  if (!user) {
    if (page === "Submit Report")
      return (
        <main className="public-report">
          <button onClick={() => navigate("Overview")}>
            <ArrowLeft size={15} /> Back to sign in
          </button>
          <h1>BYTEFORCE · Citizen reporting</h1>
          <CitizenForm onSubmitted={() => {}} />
        </main>
      );
    return (
      <Login
        onLogin={(u) => {
          setUser(u);
          if (location.pathname === "/login") {
            const next =
              new URLSearchParams(location.search).get("next") || "/";
            location.replace(
              next.startsWith("/") &&
                !next.startsWith("//") &&
                !next.includes("\\") &&
                !next.startsWith("/login")
                ? next
                : "/",
            );
          }
        }}
        onCitizen={() => navigate("Submit Report")}
      />
    );
  }
  const match = (r: Report | WeatherEvent) =>
    (!state || r.state === state) &&
    (!kind || r.event_type === kind) &&
    (!severity || r.severity === severity) &&
    (!query ||
      `${r.id} ${"event_id" in r ? r.event_id : ""} ${r.event_type} ${r.city} ${r.state} ${r.district}`
        .toLowerCase()
        .includes(query.toLowerCase()));
  const filteredReports = data.reports.filter(
    (r) =>
      match(r) &&
      (!district || r.district === district) &&
      (!source || r.source_type === source) &&
      (!verification || r.verification_status === verification) &&
      (!from || r.timestamp >= from) &&
      (!to || r.timestamp <= to + "T23:59:59"),
  );
  const ids = new Set(filteredReports.map((r) => r.event_id));
  const filteredEvents = data.events.filter(
    (e) =>
      match(e) &&
      (!(district || source || verification || from || to) || ids.has(e.id)),
  );
  const filteredAlerts = data.alerts.filter(
    (a) =>
      match(a.event) ||
      (!!query &&
        `${a.id} ${a.message}`.toLowerCase().includes(query.toLowerCase())),
  );
  const currentReport = data.reports.find((r) => r.id === report?.id) || report;
  const currentEvent = data.events.find((e) => e.id === event?.id) || event;
  const canReview = ["Administrator", "Verification Officer"].includes(
    user.role,
  );
  const showFilters =
    !detailId &&
    [
      "Overview",
      "Live Monitoring",
      "Weather Events",
      "National Map",
      "Reports",
      "Citizen Reports",
      "Social Intelligence",
      "Analytics",
      "Alerts",
    ].includes(page);
  const content = () => {
    if (detailId && !query)
      return (
        <EventWorkspace
          id={detailId}
          user={user}
          sync={data.sync}
          onReport={setReport}
          onChanged={data.refresh}
          onBack={() => navigate("Weather Events")}
        />
      );
    if (query)
      return (
        <>
          <Panel title={`Search results · ${query}`}>
            <div className="search-counts">
              <span>{filteredEvents.length} events</span>
              <span>{filteredReports.length} reports</span>
              <span>{filteredAlerts.length} alerts</span>
            </div>
          </Panel>
          <EventsPage
            events={filteredEvents}
            reports={filteredReports}
            onEvent={openEvent}
          />
          <ReportsPage reports={filteredReports} onReport={setReport} />
          <AlertsPage
            alerts={filteredAlerts}
            user={user}
            onChanged={data.refresh}
          />
        </>
      );
    switch (page) {
      case "Overview":
        return (
          <Overview
            reports={filteredReports}
            events={filteredEvents}
            alerts={filteredAlerts}
            onEvent={setEvent}
            onReport={setReport}
            navigate={navigate}
          />
        );
      case "Live Monitoring":
        return (
          <ReportsPage reports={filteredReports} onReport={setReport} live />
        );
      case "Reports":
        return <ReportsPage reports={filteredReports} onReport={setReport} />;
      case "Citizen Reports":
        return (
          <ReportsPage reports={filteredReports} onReport={setReport} citizen />
        );
      case "Submit Report":
        return <CitizenForm onSubmitted={() => data.refresh()} />;
      case "Weather Events":
        return (
          <EventsPage
            events={filteredEvents}
            reports={filteredReports}
            onEvent={openEvent}
          />
        );
      case "National Map":
        return (
          <Panel
            title="India · Consolidated weather events"
            action={
              <span className="muted">{filteredEvents.length} locations</span>
            }
          >
            <WeatherMap events={filteredEvents} onSelect={setEvent} large />
          </Panel>
        );
      case "Social Intelligence":
        return <SocialPage reports={filteredReports} onReport={setReport} />;
      case "Verification Centre":
        return canReview ? (
          <VerificationPage
            reports={data.reports}
            events={data.events}
            user={user}
            onChanged={data.refresh}
          />
        ) : (
          <Empty text="Your role does not permit verification actions." />
        );
      case "Analytics":
        return (
          <AnalyticsPage reports={filteredReports} events={filteredEvents} />
        );
      case "Data Sources":
        return <SourcesPage />;
      case "Alerts":
        return (
          <AlertsPage
            alerts={filteredAlerts}
            user={user}
            onChanged={data.refresh}
          />
        );
      case "Admin":
        return user.role === "Administrator" ? (
          <AdminPage />
        ) : (
          <Empty text="Administrator access is required." />
        );
      case "System Health":
        return <HealthPage />;
      case "Settings":
        return <SettingsPage user={user} onUpdated={setUser} />;
      default:
        return null;
    }
  };
  return (
    <Shell
      page={page}
      navigate={navigate}
      user={user}
      live={data.live}
      sync={data.sync}
      query={query}
      onSearch={setQuery}
      logout={async () => {
        await api("/auth/logout", { method: "POST" });
        setUser(null);
        setPage("Overview");
        location.replace("/login");
      }}
    >
      {user.is_guest && (
        <div className="guest-banner" role="status">
          <strong>Guest {user.role} preview</strong> · Sample data only. Changes are disabled.
          Sign out to access your own account.
        </div>
      )}
      <div className="breadcrumb">
        Workspace <ChevronRight size={12} /> <span>{page}</span>
      </div>
      <div className="page-heading">
        <div>
          <div className="title-line">
            <h1>
              {query
                ? "Intelligence search"
                : detailId
                  ? "Weather event dossier"
                  : titles[page]}
            </h1>
            {page === "Overview" && (
              <span className="operational">
                <i className="live-dot" /> Operational workspace
              </span>
            )}
          </div>
          <p>
            {page === "Overview"
              ? "Real-time weather intelligence & situational awareness across India."
              : page === "Verification Centre"
                ? "Assess evidence, correlate sources and record accountable decisions."
                : page === "Live Monitoring"
                  ? "A continuous view of incoming observations from every reporting channel."
                  : "National Weather Intelligence & Analytics Platform"}
          </p>
        </div>
        <div className="heading-actions">
          <button onClick={() => download(filteredReports, "csv")}>
            <ArrowDownToLine size={15} /> Export report
          </button>
          <button className="primary" onClick={() => navigate("Submit Report")}>
            <Plus size={16} /> New report
          </button>
        </div>
      </div>
      {showFilters && (
        <div className="filterbar">
          <div className="filter-label">
            <SlidersHorizontal size={15} /> Filters
          </div>
          <select
            aria-label="Filter by state"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="">All states & territories</option>
            {Array.from(new Set(data.reports.map((r) => r.state)))
              .sort()
              .map((s) => (
                <option key={s}>{s}</option>
              ))}
          </select>
          <select
            aria-label="Filter by event"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">All weather events</option>
            {categories.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Filter by severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="">All severities</option>
            {["Low", "Moderate", "High", "Critical"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            className="text-button"
            onClick={() => {
              setState("");
              setQuery("");
              setKind("");
              setSeverity("");
              setDistrict("");
              setSource("");
              setVerification("");
              setFrom("");
              setTo("");
            }}
          >
            Reset
          </button>
          <button
            className="text-button"
            onClick={() => setAdvanced(!advanced)}
          >
            More filters
          </button>
          <div className="filter-live">
            <i className={data.live ? "live-dot" : "amber-dot"} />
            {user.is_guest ? "SAMPLE SNAPSHOT" : data.live ? "LIVE UPDATES" : "RECONNECTING"}
          </div>
        </div>
      )}
      {showFilters && advanced && (
        <div className="filterbar advanced-filters">
          <select
            aria-label="Filter by district"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            <option value="">All districts</option>
            {Array.from(
              new Set(
                data.reports
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
            aria-label="Filter by source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">All sources</option>
            {["Citizen", "Social", "Official", "RSS"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Filter by verification"
            value={verification}
            onChange={(e) => setVerification(e.target.value)}
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
          <input
            type="date"
            aria-label="Reports from date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            aria-label="Reports to date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      )}
      {data.error ? (
        <div className="error-state">
          {data.error}
          <button onClick={data.refresh}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : data.loading ? (
        <div className="loading-grid">Loading weather intelligence…</div>
      ) : (
        content()
      )}
      <Drawer
        open={!!event || !!report}
        onClose={() => {
          setEvent(null);
          setReport(null);
        }}
        title={event?.id || report?.id || ""}
      >
        {currentEvent ? (
          <>
            <div className="drawer-dossier-link">
              <button
                className="primary"
                onClick={() => openEvent(currentEvent)}
              >
                Open full event dossier
              </button>
            </div>
            <EventDetails
              event={currentEvent}
              reports={data.reports}
              onReport={(r) => {
                setEvent(null);
                setReport(r);
              }}
            />
          </>
        ) : currentReport ? (
          <ReportDetails
            report={currentReport}
            events={data.events}
            user={user}
            onChanged={data.refresh}
          />
        ) : null}
      </Drawer>
    </Shell>
  );
}

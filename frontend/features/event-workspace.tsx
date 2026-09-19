"use client";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Link, Download, RefreshCw } from "lucide-react";
import { api, download } from "@/services/api";
import { Panel, Badge, Empty, fmt } from "@/components/ui";
import { ReportTable } from "@/components/report-table";
import { Trend, Distribution } from "@/components/charts";
import type { WeatherEvent, Report, User, Alert } from "@/types";
type Entry = {
  id: string;
  actor: string;
  action: string;
  old_status: string;
  new_status: string;
  reason: string;
  created_at: string;
};
type Detail = WeatherEvent & {
  reports: Report[];
  timeline: Entry[];
  alerts: Alert[];
  fusion_policy: { fusion_radius_km: number; fusion_window_hours: number };
};
export function EventWorkspace({
  id,
  user,
  sync,
  onReport,
  onChanged,
  onBack,
}: {
  id: string;
  user: User;
  sync: Date | null;
  onReport: (r: Report) => void;
  onChanged: () => void;
  onBack: () => void;
}) {
  const [reportPage, setReportPage] = useState(1);
  const [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [reason, setReason] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const value = await api<Detail>("/events/" + encodeURIComponent(id));
      setDetail(value);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    setReportPage(1);
    setDetail(null);
    setReason("");
    setNote("");
    setNotice("");
  }, [id]);
  useEffect(() => {
    let active = true;
    api<Detail>("/events/" + encodeURIComponent(id))
      .then((value) => {
        if (active) {
          setDetail(value);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, sync]);
  const canReview = ["Administrator", "Verification Officer"].includes(
    user.role,
  );
  async function transition(status: string) {
    if (!detail) return;
    setBusy(true);
    setNotice("");
    try {
      await api("/events/" + encodeURIComponent(id) + "/status", {
        method: "PATCH",
        body: JSON.stringify({
          status,
          expected_status: detail.status,
          reason,
        }),
      });
      setReason("");
      setNotice("Event status updated and recorded in the timeline.");
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!detail)
    return (
      <Panel title="Event dossier">
        <button onClick={onBack}>
          <ArrowLeft size={15} /> Back to events
        </button>
        {error ? (
          <div className="error-state">
            {error}
            <button onClick={load}>Retry</button>
          </div>
        ) : (
          <Empty text="Loading event intelligence…" />
        )}
      </Panel>
    );
  return (
    <div className="event-workspace">
      <div className="event-workspace-toolbar">
        <button onClick={onBack}>
          <ArrowLeft size={15} /> All events
        </button>
        <span className="mono">{detail.id}</span>
        <Badge value={detail.status} />
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                location.origin + "/weather-events/" + encodeURIComponent(id),
              );
              setNotice("Event link copied. Recipients need workspace access.");
            } catch {
              setError(
                "Unable to copy the link. Copy the address from your browser.",
              );
            }
          }}
        >
          <Link size={14} /> Copy link
        </button>
        <button
          onClick={() => download(detail.reports, "csv", id + "-reports")}
        >
          <Download size={14} /> Export reports
        </button>
        <button onClick={() => download([detail], "json", id + "-dossier")}>
          Export dossier
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <div className="event-workspace-grid">
        <div>
          <Panel
            title={detail.event_type + " · " + detail.city}
            action={<Badge value={detail.severity} />}
          >
            <div className="event-summary">
              <p>
                {detail.district}, {detail.state} · {detail.latitude.toFixed(4)}
                , {detail.longitude.toFixed(4)}
              </p>
              <div className="event-metrics">
                <div>
                  <strong>{detail.report_count}</strong>
                  <span>Associated reports</span>
                </div>
                <div>
                  <strong>{Math.round(detail.confidence * 100)}%</strong>
                  <span>Evidence confidence</span>
                </div>
                <div>
                  <strong>
                    {new Set(detail.reports.map((r) => r.source_type)).size}
                  </strong>
                  <span>Source types</span>
                </div>
              </div>
              <dl className="detail-grid">
                <div>
                  <dt>First detected</dt>
                  <dd>{fmt(detail.first_detected)}</dd>
                </div>
                <div>
                  <dt>Last update</dt>
                  <dd>{fmt(detail.last_updated)}</dd>
                </div>
                <div>
                  <dt>Verification</dt>
                  <dd>
                    <Badge value={detail.verification_status} />
                  </dd>
                </div>
                <div>
                  <dt>Current fusion policy</dt>
                  <dd>
                    {detail.fusion_policy.fusion_radius_km} km /{" "}
                    {detail.fusion_policy.fusion_window_hours} hours
                  </dd>
                </div>
              </dl>
            </div>
          </Panel>
          <Panel title="Report activity · last 12 hours">
            <Trend reports={detail.reports} height={240} />
          </Panel>
          <Panel title="Associated reports">
            <ReportTable
              reports={[...detail.reports]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .slice((reportPage - 1) * 20, reportPage * 20)}
              onSelect={onReport}
            />
            <div className="pagination">
              <span>{detail.reports.length} associated reports</span>
              <button
                disabled={reportPage === 1}
                onClick={() => setReportPage(reportPage - 1)}
              >
                Previous
              </button>
              <span>Page {reportPage}</span>
              <button
                disabled={reportPage * 20 >= detail.reports.length}
                onClick={() => setReportPage(reportPage + 1)}
              >
                Next
              </button>
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="Source distribution">
            <Distribution reports={detail.reports} />
          </Panel>
          {canReview && (
            <Panel title="Event operations">
              <div className="settings-form">
                <label>
                  Decision reason
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Record the evidence and reason for this decision."
                  />
                </label>
                <p className="subtext">
                  Resolving or archiving also resolves active alerts for this
                  event. Reports and audit history are retained.
                </p>
                <div className="event-actions">
                  {detail.status !== "Active" && (
                    <button
                      disabled={busy || reason.trim().length < 5}
                      onClick={() => transition("Active")}
                    >
                      Reopen event
                    </button>
                  )}
                  {!["Resolved", "Archived"].includes(detail.status) && (
                    <button
                      className="primary"
                      disabled={busy || reason.trim().length < 5}
                      onClick={() => transition("Resolved")}
                    >
                      Resolve event
                    </button>
                  )}
                  {detail.status !== "Archived" && (
                    <button
                      disabled={busy || reason.trim().length < 5}
                      onClick={() => transition("Archived")}
                    >
                      Archive event
                    </button>
                  )}
                </div>
              </div>
            </Panel>
          )}
          <Panel title="Related alerts">
            {detail.alerts.length ? (
              detail.alerts.map((a) => (
                <div className="event-alert" key={a.id}>
                  <div>
                    <span className="mono">{a.id}</span>
                    <Badge value={a.status} />
                  </div>
                  <p>{a.message}</p>
                </div>
              ))
            ) : (
              <Empty text="No alerts associated with this event." />
            )}
          </Panel>
          <Panel title="Event timeline">
            {canReview && (
              <form
                className="settings-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await api("/events/" + encodeURIComponent(id) + "/notes", {
                      method: "POST",
                      body: JSON.stringify({ text: note }),
                    });
                    setNote("");
                    await load();
                    onChanged();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Officer note
                  <textarea
                    required
                    minLength={5}
                    maxLength={4000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                </label>
                <button disabled={busy || note.trim().length < 5}>
                  Add note
                </button>
              </form>
            )}
            <div className="event-timeline">
              {detail.timeline.map((entry) => (
                <article className="audit-entry" key={entry.id}>
                  <strong>{entry.action}</strong>
                  <p>
                    {entry.actor} · {fmt(entry.created_at)}
                  </p>
                  {entry.old_status && (
                    <p>
                      {entry.old_status} → {entry.new_status}
                    </p>
                  )}
                  <p>{entry.reason}</p>
                </article>
              ))}
              <article className="audit-entry">
                <strong>Event first detected</strong>
                <p>{fmt(detail.first_detected)}</p>
              </article>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

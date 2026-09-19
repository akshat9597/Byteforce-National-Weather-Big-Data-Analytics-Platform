"use client";
import { useEffect, useState } from "react";
import {
  Check,
  ShieldAlert,
  Clock,
  X,
  GitMerge,
  MapPin,
  FileText,
} from "lucide-react";
import { api } from "@/services/api";
import { Badge, fmt, Panel } from "@/components/ui";
import { Trend, Distribution } from "@/components/charts";
import type { Report, WeatherEvent, User } from "@/types";
export function ReportDetails({
  report,
  events,
  user,
  onChanged,
}: {
  report: Report;
  events: WeatherEvent[];
  user: User;
  onChanged: () => void;
}) {
  const [evidence, setEvidence] = useState<any>(null),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState(report.event_id),
    [status, setStatus] = useState(report.verification_status);
  const canReview = ["Administrator", "Verification Officer"].includes(
    user.role,
  );
  const reload = () => {
    if (canReview)
      api("/reports/" + report.id + "/evidence")
        .then(setEvidence)
        .catch((e) => setError(e.message));
  };
  useEffect(() => {
    setEvidence(null);
    setError("");
    setStatus(report.verification_status);
    setTarget(report.event_id);
    reload();
  }, [report.id, report.verification_status]);
  async function act(next: string) {
    setBusy(true);
    setError("");
    try {
      await api("/reports/" + report.id + "/verify", {
        method: "POST",
        body: JSON.stringify({ status: next, reason }),
      });
      setStatus(next);
      setReason("");
      reload();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="report-detail">
      <div className="detail-tags">
        <Badge value={status} />
        <Badge value={report.severity} />
        <span className="mono">{report.id}</span>
      </div>
      <h2>{report.event_type}</h2>
      <p className="detail-location">
        <MapPin size={15} />
        {report.city}, {report.state}
      </p>
      <blockquote>{report.text}</blockquote>
      <dl className="detail-grid">
        <div>
          <dt>Source</dt>
          <dd>{report.source_name}</dd>
        </div>
        <div>
          <dt>Observation time</dt>
          <dd>{fmt(report.timestamp)}</dd>
        </div>
        <div>
          <dt>Coordinates</dt>
          <dd>
            {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
          </dd>
        </div>
        <div>
          <dt>AI classification</dt>
          <dd>
            {report.event_type} · {Math.round(report.ai_confidence * 100)}%
          </dd>
        </div>
        <div>
          <dt>Reported district</dt>
          <dd>{report.district}</dd>
        </div>
        <div>
          <dt>Location agreement</dt>
          <dd>Requires manual confirmation</dd>
        </div>
      </dl>
      {report.media_url ? (
        <div className="report-media">
          {report.media_url.endsWith(".mp4") ? (
            <video src={report.media_url} controls />
          ) : (
            <img src={report.media_url} alt="Submitted weather observation" />
          )}
        </div>
      ) : (
        <div className="no-media">
          <FileText size={18} /> No supporting media attached
        </div>
      )}
      <div className="trust-heading">
        <h3>Weather Report Trust Score</h3>
        <strong>
          {report.trust_score}
          <small>/100</small>
        </strong>
      </div>
      <p className="subtext">
        Automated evidence assessment · Human review determines verification.
      </p>
      {evidence && (
        <>
          <div className="evidence-list">
            {evidence.evidence.map((e: any) => (
              <div key={e.label}>
                <div>
                  <strong>{e.label}</strong>
                  <small>{e.detail}</small>
                </div>
                <span className={e.points < 0 ? "negative" : "positive"}>
                  {e.points > 0 ? "+" : ""}
                  {e.points}
                </span>
              </div>
            ))}
          </div>
          <p className="subtext">
            Recomputed evidence score: {evidence.trust_score}/100. The recorded
            intake score above is preserved.
          </p>
          {evidence.duplicates.length > 0 && (
            <div className="duplicate-box">
              <h3>Potential duplicates</h3>
              {evidence.duplicates.slice(0, 3).map((d: any) => (
                <p key={d.id}>
                  <span className="mono">{d.id}</span> · {d.similarity}% lexical
                  similarity
                </p>
              ))}
              <button
                onClick={async () => {
                  try {
                    await api("/reports/" + report.id + "/keep-separate", {
                      method: "POST",
                    });
                    reload();
                    onChanged();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Keep separate
              </button>
            </div>
          )}
        </>
      )}
      {canReview && (
        <div className="review-actions">
          <h3>Officer assessment</h3>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Review notes. A reason is required to reject or flag a report."
            aria-label="Review reason"
          />
          <div>
            <button
              className="primary"
              disabled={busy}
              onClick={() => act("Verified")}
            >
              <Check size={15} /> Verify
            </button>
            <button disabled={busy} onClick={() => act("Under Review")}>
              <Clock size={15} /> Under review
            </button>
            <button disabled={busy} onClick={() => act("Suspicious")}>
              <ShieldAlert size={15} /> Flag
            </button>
            <button
              disabled={busy}
              className="danger"
              onClick={() => act("Rejected")}
            >
              <X size={15} /> Reject
            </button>
          </div>
          <div className="merge-row">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="Merge destination"
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.id} · {e.city} · {e.event_type}
                </option>
              ))}
            </select>
            <button
              disabled={busy || target === report.event_id}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/reports/" + report.id + "/merge", {
                    method: "POST",
                    body: JSON.stringify({ event_id: target }),
                  });
                  reload();
                  onChanged();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <GitMerge size={14} /> Merge
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {evidence && (
        <div className="audit-section">
          <h3>Verification audit trail</h3>
          {evidence.audit.length ? (
            evidence.audit.map((log: any) => (
              <div className="audit-entry" key={log.id}>
                <strong>{log.reviewed_by}</strong>
                <small>{fmt(log.created_at)}</small>
                <p>
                  {log.old_status} → {log.new_status}
                </p>
                <p>
                  {log.reason || "Officer verified the available evidence."}
                </p>
              </div>
            ))
          ) : (
            <p className="muted">No officer actions recorded yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
export function EventDetails({
  event,
  reports,
  onReport,
}: {
  event: WeatherEvent;
  reports: Report[];
  onReport: (r: Report) => void;
}) {
  const associated = reports.filter((r) => r.event_id === event.id);
  return (
    <div className="event-detail">
      <div className="detail-tags">
        <Badge value={event.severity} />
        <Badge value={event.verification_status} />
      </div>
      <h2>
        {event.event_type} · {event.city}
      </h2>
      <p className="muted">
        {event.district}, {event.state} · {event.latitude.toFixed(4)},{" "}
        {event.longitude.toFixed(4)}
      </p>
      <div className="event-metrics">
        <div>
          <strong>{event.report_count}</strong>
          <span>Associated reports</span>
        </div>
        <div>
          <strong>{Math.round(event.confidence * 100)}%</strong>
          <span>Confidence</span>
        </div>
        <div>
          <strong>{new Set(associated.map((r) => r.source_type)).size}</strong>
          <span>Source types</span>
        </div>
      </div>
      <dl className="detail-grid">
        <div>
          <dt>First detected</dt>
          <dd>{fmt(event.first_detected)}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{fmt(event.last_updated)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{event.status}</dd>
        </div>
        <div>
          <dt>Fusion radius</dt>
          <dd>5 km / 24-hour window</dd>
        </div>
        <div>
          <dt>Official correlation</dt>
          <dd>
            {associated.some((r) => r.source_type === "Official")
              ? "Simulated official record present"
              : "No official match"}
          </dd>
        </div>
        <div>
          <dt>Potential duplicate reports</dt>
          <dd>{associated.filter((r) => r.duplicate_group_id).length}</dd>
        </div>
      </dl>
      <Panel title="Report activity">
        <Trend reports={associated} />
      </Panel>
      <Panel title="Source breakdown">
        <Distribution reports={associated} />
      </Panel>
      <h3>Associated reports</h3>
      {associated.map((r) => (
        <button
          className="associated-report"
          key={r.id}
          onClick={() => onReport(r)}
        >
          <div>
            <strong>{r.id}</strong>
            <small>
              {r.source_type} · {fmt(r.timestamp)}
            </small>
          </div>
          <Badge value={r.verification_status} />
        </button>
      ))}
      <div className="notice">
        Affected area estimates and official warnings require a connected
        authoritative weather source. This event uses development evidence.
      </div>
    </div>
  );
}

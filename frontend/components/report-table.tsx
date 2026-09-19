"use client";
import type { Report } from "@/types";
import { Badge, Empty, fmt } from "./ui";
import { ChevronRight, Globe, UserRound, Radio } from "lucide-react";
export function ReportTable({
  reports,
  onSelect,
  compact = false,
}: {
  reports: Report[];
  onSelect: (r: Report) => void;
  compact?: boolean;
}) {
  if (!reports.length) return <Empty />;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>REPORT ID</th>
            <th>EVENT / LOCATION</th>
            <th>SOURCE</th>
            <th>SEVERITY</th>
            <th>TRUST SCORE</th>
            <th>VERIFICATION</th>
            {!compact && <th>RECEIVED</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr
              key={r.id}
              onClick={() => onSelect(r)}
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onSelect(r)}
            >
              <td>
                <span className="mono record-id">{r.id}</span>
                {compact && (
                  <small>
                    {new Date(r.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                )}
              </td>
              <td>
                <strong>{r.event_type}</strong>
                <small>
                  {r.city}, {r.state}
                </small>
              </td>
              <td>
                <span className="source-cell">
                  {r.source_type === "Citizen" ? (
                    <UserRound size={14} />
                  ) : r.source_type === "Official" ? (
                    <Radio size={14} />
                  ) : (
                    <Globe size={14} />
                  )}{" "}
                  {r.source_type}
                </span>
              </td>
              <td>
                <Badge value={r.severity} />
              </td>
              <td>
                <span className="score">
                  {r.trust_score}
                  <span className="score-track">
                    <i style={{ width: r.trust_score + "%" }} />
                  </span>
                </span>
              </td>
              <td>
                <Badge value={r.verification_status} />
              </td>
              {!compact && <td className="muted">{fmt(r.created_at)}</td>}
              <td>
                <button className="icon-button" aria-label={"Open " + r.id}>
                  <ChevronRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

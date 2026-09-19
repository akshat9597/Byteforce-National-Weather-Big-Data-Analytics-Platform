"use client";
import { useState, useEffect } from "react";
import { api } from "@/services/api";
import { Panel, Empty, fmt } from "@/components/ui";
const labels: Record<string, string> = {
  official_weight: "Official source correlation",
  nearby_weight: "Nearby similar reports",
  coordinates_weight: "Coordinates supplied",
  recent_weight: "Recent timestamp",
  duplicate_penalty: "Duplicate evidence penalty",
  fusion_radius_km: "Fusion radius (km)",
  fusion_window_hours: "Fusion window (hours)",
  alert_severity: "Alert creation threshold",
};
export function AdminConfig({ section }: { section: string }) {
  const [config, setConfig] = useState<Record<string, any> | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/admin/configuration")
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);
  const fields =
    section === "Trust Score Configuration"
      ? Object.keys(labels).slice(0, 5)
      : section === "Verification Rules"
        ? ["fusion_radius_km", "fusion_window_hours"]
        : ["alert_severity"];
  return (
    <Panel title={section}>
      {config ? (
        <form
          className="settings-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("/admin/configuration", {
                method: "PATCH",
                body: JSON.stringify(config),
              });
              setSuccess(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="subtext">
            Changes apply to new reports. Existing intake scores remain
            unchanged. All policy updates are audited.
          </p>
          {fields.map((key) => (
            <label key={key}>
              {labels[key]}
              {key === "alert_severity" ? (
                <select
                  value={config[key]}
                  onChange={(e) => {
                    setConfig({ ...config, [key]: e.target.value });
                    setSuccess(false);
                  }}
                >
                  <option>High</option>
                  <option>Critical</option>
                </select>
              ) : (
                <input
                  type="number"
                  step={key === "fusion_radius_km" ? "0.1" : "1"}
                  value={config[key]}
                  required
                  onChange={(e) => {
                    setConfig({ ...config, [key]: Number(e.target.value) });
                    setSuccess(false);
                  }}
                />
              )}
            </label>
          ))}
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save policy"}
          </button>
          {success && (
            <p className="success">Policy saved. Audit record created.</p>
          )}
        </form>
      ) : (
        <Empty text="Loading server policy…" />
      )}
      {error && <p className="error notice">{error}</p>}
    </Panel>
  );
}
export function SystemLogs() {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api("/admin/logs")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Panel title="Administrative system logs">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ACTOR</th>
              <th>ACTION</th>
              <th>DETAIL</th>
              <th>TIME</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.actor}</td>
                <td>{r.action}</td>
                <td>
                  <details>
                    <summary>View changes</summary>
                    <pre>{JSON.stringify(JSON.parse(r.detail), null, 2)}</pre>
                  </details>
                </td>
                <td>{fmt(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <Empty text={error || "No configuration changes recorded."} />
        )}
      </div>
    </Panel>
  );
}

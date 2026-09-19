"use client";
import { useState } from "react";
import {
  LocateFixed,
  Upload,
  ShieldCheck,
  CheckCircle2,
  Send,
} from "lucide-react";
import { api } from "@/services/api";
import { Panel } from "@/components/ui";
import type { Report } from "@/types";
export const categories = [
  "Rainfall",
  "Flooding",
  "Thunderstorm",
  "Lightning",
  "Heatwave",
  "Fog",
  "Dust Storm",
  "Strong Winds",
  "Hailstorm",
  "Cyclone",
  "Other",
];
export function CitizenForm({
  onSubmitted,
}: {
  onSubmitted: (r: Report) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<Report | null>(null),
    [anonymous, setAnonymous] = useState(true),
    [coords, setCoords] = useState({ lat: "", lon: "" }),
    [gps, setGps] = useState(""),
    [files, setFiles] = useState<File[]>([]);
  const locate = () => {
    setGps("Locating…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({
          lat: p.coords.latitude.toFixed(6),
          lon: p.coords.longitude.toFixed(6),
        });
        setGps("Coordinates detected. Please confirm your city and district.");
      },
      () => setGps("Location unavailable. Enter coordinates manually."),
      { timeout: 12000 },
    );
  };
  if (result)
    return (
      <div className="submission-success">
        <CheckCircle2 size={45} />
        <h2>Report submitted successfully</h2>
        <p>Your report is in the verification queue.</p>
        <div>
          <span>REPORT ID</span>
          <strong className="mono">{result.id}</strong>
        </div>
        <dl>
          <dt>Status</dt>
          <dd>Pending Verification</dd>
          <dt>Detected event</dt>
          <dd>{result.event_type}</dd>
          <dt>Associated event</dt>
          <dd>{result.event_id}</dd>
        </dl>
        <button
          className="primary"
          onClick={() => {
            setResult(null);
            setFiles([]);
          }}
        >
          Submit another report
        </button>
      </div>
    );
  return (
    <div className="form-layout">
      <Panel title="Submit a weather observation">
        <form
          className="citizen-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              let media_url = "";
              if (files[0]) {
                const body = new FormData();
                body.append("file", files[0]);
                media_url = (await api("/media", { method: "POST", body })).url;
              }
              const date = String(form.get("date")),
                time = String(form.get("time"));
              const payload = {
                text: form.get("text"),
                event_type: form.get("event_type"),
                latitude: Number(coords.lat),
                longitude: Number(coords.lon),
                city: form.get("city"),
                district: form.get("district"),
                state: form.get("state"),
                timestamp: new Date(date + "T" + time).toISOString(),
                severity: form.get("severity"),
                anonymous,
                reporter_name: form.get("reporter_name") || "",
                reporter_contact: form.get("reporter_contact") || "",
                media_url,
              };
              const r = await api<Report>("/citizen-reports", {
                method: "POST",
                body: JSON.stringify(payload),
              });
              setResult(r);
              onSubmitted(r);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-section-title">
            <span>01</span> Observation details
          </div>
          <div className="form-grid">
            <label>
              Weather event
              <select name="event_type" defaultValue="Flooding">
                {categories.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Perceived severity
              <select name="severity" defaultValue="Moderate">
                {["Low", "Moderate", "High", "Critical"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="full-width">
              Description
              <textarea
                name="text"
                required
                minLength={12}
                maxLength={6000}
                rows={4}
                placeholder="Describe what you observed, nearby landmarks and how the area is affected."
              />
            </label>
          </div>
          <div className="form-section-title">
            <span>02</span> Location & time{" "}
            <button type="button" onClick={locate}>
              <LocateFixed size={14} /> Detect location
            </button>
          </div>
          {gps && <p className="muted">{gps}</p>}
          <div className="form-grid">
            <label>
              Latitude
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                required
                value={coords.lat}
                onChange={(e) => setCoords({ ...coords, lat: e.target.value })}
                placeholder="17.6868"
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                required
                value={coords.lon}
                onChange={(e) => setCoords({ ...coords, lon: e.target.value })}
                placeholder="83.2185"
              />
            </label>
            <label>
              City
              <input
                name="city"
                required
                minLength={2}
                placeholder="Visakhapatnam"
              />
            </label>
            <label>
              District
              <input
                name="district"
                required
                minLength={2}
                placeholder="Visakhapatnam"
              />
            </label>
            <label className="full-width">
              State / Union territory
              <select name="state" required>
                {[
                  "Andhra Pradesh",
                  "Arunachal Pradesh",
                  "Assam",
                  "Bihar",
                  "Chhattisgarh",
                  "Goa",
                  "Gujarat",
                  "Haryana",
                  "Himachal Pradesh",
                  "Jharkhand",
                  "Karnataka",
                  "Kerala",
                  "Madhya Pradesh",
                  "Maharashtra",
                  "Manipur",
                  "Meghalaya",
                  "Mizoram",
                  "Nagaland",
                  "Odisha",
                  "Punjab",
                  "Rajasthan",
                  "Sikkim",
                  "Tamil Nadu",
                  "Telangana",
                  "Tripura",
                  "Uttar Pradesh",
                  "Uttarakhand",
                  "West Bengal",
                  "Andaman and Nicobar Islands",
                  "Chandigarh",
                  "Dadra and Nagar Haveli and Daman and Diu",
                  "Delhi",
                  "Jammu and Kashmir",
                  "Ladakh",
                  "Lakshadweep",
                  "Puducherry",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Observation date
              <input
                name="date"
                type="date"
                required
                defaultValue={new Date(
                  Date.now() - new Date().getTimezoneOffset() * 60000,
                )
                  .toISOString()
                  .slice(0, 10)}
              />
            </label>
            <label>
              Observation time
              <input
                name="time"
                type="time"
                required
                defaultValue={new Date().toTimeString().slice(0, 5)}
              />
            </label>
          </div>
          <div className="form-section-title">
            <span>03</span> Supporting evidence
          </div>
          <label className="upload-box">
            <Upload size={22} />
            <strong>{files[0]?.name || "Attach an image or video"}</strong>
            <small>JPEG, PNG, WebP or MP4 · maximum 20 MB</small>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />{" "}
            Submit anonymously
          </label>
          {!anonymous && (
            <div className="form-grid">
              <label>
                Name (optional)
                <input name="reporter_name" maxLength={100} />
              </label>
              <label>
                Contact (optional)
                <input name="reporter_contact" maxLength={150} />
              </label>
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <span>Reports are reviewed before verification.</span>
            <button className="primary" disabled={busy}>
              <Send size={15} />
              {busy ? "Submitting report…" : "Submit report"}
            </button>
          </div>
        </form>
      </Panel>
      <div>
        <Panel title="Reporting guidance">
          <div className="guidance">
            <ShieldCheck size={25} />
            <h3>Accurate observations matter.</h3>
            <p>
              Include a specific location, observation time and a clear
              description of current conditions.
            </p>
            <p>
              Only upload media you captured or are authorised to share. Avoid
              including faces, identity documents or private information.
            </p>
            <hr />
            <h3>What happens next?</h3>
            <ol>
              <li>Weather category is identified.</li>
              <li>Location and nearby reports are compared.</li>
              <li>Evidence is scored and linked to an event.</li>
              <li>A verification officer reviews the report.</li>
            </ol>
            <p className="notice">
              This development workspace does not dispatch emergency services or
              issue official public warnings.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

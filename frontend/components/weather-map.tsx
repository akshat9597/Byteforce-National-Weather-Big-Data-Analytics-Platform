"use client";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  LayerGroup,
} from "react-leaflet";
import { useState, useEffect } from "react";
import { LocateFixed, Layers } from "lucide-react";
import type { WeatherEvent } from "@/types";
import "leaflet/dist/leaflet.css";
import { MapLayers } from "./map-layers";
const colors: Record<string, string> = {
  Low: "#468fae",
  Moderate: "#e6ab36",
  High: "#e67638",
  Critical: "#d7484b",
};
function Reset() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(
      [
        [6, 67],
        [36, 98],
      ],
      { padding: [20, 65], maxZoom: 5 },
    );
  }, [map]);
  return (
    <button
      className="map-reset"
      aria-label="Reset India map"
      onClick={() =>
        map.fitBounds(
          [
            [6, 67],
            [36, 98],
          ],
          { padding: [20, 65], maxZoom: 5 },
        )
      }
    >
      <LocateFixed size={17} />
    </button>
  );
}
export default function WeatherMap({
  events,
  onSelect,
  large = false,
}: {
  events: WeatherEvent[];
  onSelect: (e: WeatherEvent) => void;
  large?: boolean;
}) {
  const [heat, setHeat] = useState(false),
    [verified, setVerified] = useState(false),
    [markers, setMarkers] = useState(true),
    [mode, setMode] = useState("Report density");
  const filtered = events.filter(
    (e) =>
      e.status === "Active" &&
      (!verified || e.verification_status === "Verified") &&
      (!heat ||
        mode === "Report density" ||
        (mode === "Rainfall intensity" && e.event_type === "Rainfall") ||
        (mode === "Flood reports" && e.event_type === "Flooding") ||
        (mode === "Heatwave reports" && e.event_type === "Heatwave") ||
        (mode === "Thunderstorms" && e.event_type === "Thunderstorm") ||
        (mode === "Unverified reports" &&
          e.verification_status !== "Verified")),
  );
  return (
    <div className={"map-wrap " + (large ? "large-map" : "")}>
      <div className="map-toolbar">
        <span>
          <i className="live-dot" /> {filtered.length} active locations
        </span>
        <div>
          <button
            className={heat ? "selected" : ""}
            onClick={() => setHeat(!heat)}
          >
            <Layers size={14} /> Density
          </button>
          <label>
            <input
              type="checkbox"
              checked={markers}
              onChange={(e) => setMarkers(e.target.checked)}
            />{" "}
            Events
          </label>
          <label>
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />{" "}
            Verified only
          </label>
        </div>
      </div>
      {heat && (
        <select
          className="heat-mode"
          aria-label="Density layer"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          {[
            "Report density",
            "Rainfall intensity",
            "Flood reports",
            "Heatwave reports",
            "Thunderstorms",
            "Unverified reports",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      )}
      <MapContainer
        center={[22.1, 80.5]}
        zoom={4.5}
        zoomSnap={0.5}
        minZoom={3}
        maxZoom={16}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Reset />
        <MapLayers
          events={filtered}
          onSelect={onSelect}
          heat={heat}
          markers={markers}
        />
      </MapContainer>
      <div className="map-legend">
        <strong>{heat ? "Relative report density" : "Event severity"}</strong>
        {Object.entries(colors).map(([label, color]) => (
          <span key={label}>
            <i style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
      <div className="map-note">
        Development dataset · Not for public warning issuance
      </div>
    </div>
  );
}

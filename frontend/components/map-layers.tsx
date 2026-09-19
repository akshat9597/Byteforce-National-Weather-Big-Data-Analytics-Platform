"use client";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.heat";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { WeatherEvent } from "@/types";
const colors: Record<string, string> = {
  Low: "#468fae",
  Moderate: "#e6ab36",
  High: "#e67638",
  Critical: "#d7484b",
};
export function MapLayers({
  events,
  onSelect,
  heat,
  markers,
}: {
  events: WeatherEvent[];
  onSelect: (e: WeatherEvent) => void;
  heat: boolean;
  markers: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 35,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 8,
    });
    if (markers) {
      events.forEach((e) => {
        const icon = L.divIcon({
          className: "weather-marker",
          html: `<span style="background:${colors[e.severity] || colors.Low}"></span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const marker = L.marker([e.latitude, e.longitude], {
          icon,
          title: `${e.event_type} · ${e.city}`,
        });
        marker.on("click", () => onSelect(e));
        group.addLayer(marker);
      });
      map.addLayer(group);
    }
    let heatLayer: L.HeatLayer | undefined;
    if (heat) {
      heatLayer = L.heatLayer(
        events.map(
          (e) =>
            [
              e.latitude,
              e.longitude,
              Math.min(1, e.report_count / 30),
            ] as L.HeatLatLngTuple,
        ),
        {
          radius: 40,
          blur: 28,
          minOpacity: 0.3,
          gradient: {
            0.2: "#6a9eba",
            0.5: "#edc552",
            0.8: "#e47e47",
            1: "#bc4549",
          },
        },
      ).addTo(map);
    }
    return () => {
      map.removeLayer(group);
      if (heatLayer) map.removeLayer(heatLayer);
    };
  }, [map, events, onSelect, heat, markers]);
  return null;
}

"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import { Radar, Wind, CloudRain, ScanLine } from "lucide-react";
const Globe = dynamic(() => import("./globe"), { ssr: false });
class VisualBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function DesktopGlobe() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const desktop = matchMedia("(min-width: 761px)");
    const update = () => setEnabled(desktop.matches);
    update();
    desktop.addEventListener("change", update);
    return () => desktop.removeEventListener("change", update);
  }, []);
  return enabled ? (
    <VisualBoundary>
      <Globe />
    </VisualBoundary>
  ) : null;
}
export function ClimateScene() {
  return (
    <section
      className="climate-scene"
      aria-label="Climate intelligence illustration"
    >
      <div className="climate-brand">
        <Radar size={29} />
        <div>
          BYTEFORCE<span>WEATHER INTELLIGENCE PLATFORM</span>
        </div>
      </div>
      <div className="climate-heading">
        <span className="climate-kicker">A NATIONAL PERSPECTIVE</span>
        <h1>
          Observe. Analyse.
          <br />
          <em>Verify. Respond.</em>
        </h1>
        <p>
          Weather intelligence for a more
          <br />
          prepared and resilient India.
        </p>
      </div>
      <div
        className="climate-earth"
        role="img"
        aria-label="Illustrative Earth with observation stations across India. No live weather measurements."
      >
        <svg
          className="climate-static"
          viewBox="0 0 640 640"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="climate-sphere" cx="32%" cy="25%" r="75%">
              <stop stopColor="#234d59" />
              <stop offset=".6" stopColor="#0e2938" />
              <stop offset="1" stopColor="#030a12" />
            </radialGradient>
          </defs>
          <circle
            cx="320"
            cy="320"
            r="238"
            fill="url(#climate-sphere)"
            stroke="#53848d"
            strokeOpacity=".4"
          />
          <g fill="none" stroke="#82aeb3" opacity=".16">
            <ellipse cx="320" cy="320" rx="130" ry="238" />
            <ellipse cx="320" cy="320" rx="210" ry="238" />
            <ellipse cx="320" cy="320" rx="238" ry="85" />
            <ellipse cx="320" cy="320" rx="238" ry="175" />
          </g>
          <path
            d="M245 212 282 184 310 207 346 222 379 213 410 237 363 262 346 287 323 337 303 304 286 269 258 259Z"
            fill="#468178"
            opacity=".55"
          />
          <g fill="#b7ddcd">
            <circle cx="314" cy="237" r="3" />
            <circle cx="300" cy="276" r="3" />
            <circle cx="329" cy="304" r="3" />
            <circle cx="350" cy="264" r="3" />
          </g>
        </svg>
        <DesktopGlobe />
        <div className="climate-coordinate">
          INDIA / OBSERVATION NETWORK<span>GEOSPATIAL PERSPECTIVE</span>
        </div>
      </div>
      <div
        className="climate-signals"
        aria-label="Weather intelligence disciplines"
      >
        <span>
          <Wind size={15} />
          Atmospheric flow
        </span>
        <span>
          <CloudRain size={15} />
          Precipitation
        </span>
        <span>
          <ScanLine size={15} />
          Observation network
        </span>
      </div>
      <div className="climate-caption">
        Illustrative station network<span>Not a live weather display</span>
      </div>
    </section>
  );
}

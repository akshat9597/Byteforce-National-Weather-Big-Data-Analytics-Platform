"use client";
import {
  Activity,
  LayoutDashboard,
  Radio,
  CloudLightning,
  Map,
  FileText,
  Users,
  Globe,
  ShieldCheck,
  ChartNoAxesCombined,
  Database,
  Bell,
  Settings,
  Shield,
  Search,
  LogOut,
  Radar,
  ChevronDown,
  Menu,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import type { User } from "@/types";
import { useState, useEffect } from "react";
export const navigation = [
  ["Overview", LayoutDashboard],
  ["Live Monitoring", Radio],
  ["Weather Events", CloudLightning],
  ["National Map", Map],
  ["Reports", FileText],
  ["Citizen Reports", Users],
  ["Social Intelligence", Globe],
  ["Verification Centre", ShieldCheck],
  ["Analytics", ChartNoAxesCombined],
  ["Data Sources", Database],
  ["Alerts", Bell],
  ["Admin", Shield],
  ["System Health", Activity],
  ["Settings", Settings],
] as const;
export function Shell({
  page,
  navigate,
  user,
  live,
  sync,
  query,
  onSearch,
  logout,
  children,
}: {
  page: string;
  navigate: (s: string) => void;
  user: User;
  live: boolean;
  sync: Date | null;
  query: string;
  onSearch: (q: string) => void;
  logout: () => void;
  children: React.ReactNode;
}) {
  const [mobile, setMobile] = useState(false),
    [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="app">
      <aside className={mobile ? "sidebar mobile-open" : "sidebar"}>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("Overview");
          }}
        >
          <div className="brand-mark">
            <Radar size={29} />
          </div>
          <div>
            <strong>BYTEFORCE</strong>
            <span>WEATHER INTELLIGENCE</span>
          </div>
        </a>
        <div className="workspace">
          <span className="country-tag">IN</span>
          <div>
            National Operations Centre<small>India · Central workspace</small>
          </div>
          <ChevronDown size={13} />
        </div>
        <div className="nav-label">INTELLIGENCE WORKSPACE</div>
        <nav>
          {navigation
            .filter(
              ([name]) => name !== "Admin" || user.role === "Administrator",
            )
            .filter(
              ([name]) =>
                name !== "Verification Centre" ||
                ["Administrator", "Verification Officer"].includes(user.role),
            )
            .map(([name, Icon], i) => (
              <button
                key={name}
                className={
                  (page === name ? "active " : "") +
                  (i === 11 ? "nav-separated" : "")
                }
                onClick={() => {
                  navigate(name);
                  setMobile(false);
                }}
              >
                <Icon size={18} />
                <span>{name}</span>
                {name === "Live Monitoring" && <i className="nav-live" />}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="environment">
            <span className="live-dot" /> Development environment
            <small>Simulated national data feed</small>
          </div>
          <button className="user-profile" onClick={() => navigate("Settings")}>
            <span className="avatar">
              {user.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
          </button>
          <button className="logout" onClick={logout}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            onClick={() => setMobile(!mobile)}
            aria-label="Toggle navigation"
          >
            <Menu size={20} />
          </button>
          <div className="global-search">
            <Search size={17} />
            <input
              aria-label="Global search"
              placeholder="Search city, state, event, report ID…"
              value={query}
              onChange={(e) => onSearch(e.target.value)}
            />
            <kbd>⌕</kbd>
          </div>
          <div className="header-status">
            <span>
              <i className={live ? "live-dot" : "amber-dot"} />
              {user.is_guest ? "Guest sample data" : live ? "Live feed connected" : "Reconnecting feed"}
            </span>
            <small>
              Last sync:{" "}
              {sync
                ? Math.max(
                    0,
                    Math.floor((time.getTime() - sync.getTime()) / 1000),
                  ) + "s ago"
                : "Connecting…"}
            </small>
          </div>
          <div className="clock">
            <strong>
              {time.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Kolkata",
              })}
            </strong>
            <small>
              {time.toLocaleTimeString("en-IN", {
                hour12: false,
                timeZone: "Asia/Kolkata",
              })}{" "}
              IST
            </small>
          </div>
          <button
            className="notification icon-button"
            aria-label="Open alerts"
            onClick={() => navigate("Alerts")}
          >
            <Bell size={20} />
            <i />
          </button>
          <button
            className="avatar header-avatar"
            onClick={() => navigate("Settings")}
          >
            {user.name
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")}
          </button>
        </header>
        <main>{children}</main>
        <footer className="app-footer">
          <span>
            BYTEFORCE · National Weather Intelligence & Analytics Platform
          </span>
          <span>Development data · v1.0</span>
        </footer>
      </div>
    </div>
  );
}

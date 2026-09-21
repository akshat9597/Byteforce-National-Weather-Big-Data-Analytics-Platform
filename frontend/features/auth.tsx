"use client";
import { Radar, ArrowRight, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import type { User } from "@/types";

export function WorkspaceEntry({
  onEnter,
  onCitizen,
}: {
  onEnter: (user: User) => void;
  onCitizen: () => void;
}) {
  const [opening, setOpening] = useState<"Administrator" | "Viewer" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (new URLSearchParams(location.search).get("reason") === "expired")
      setNotice("Your preview session ended. Choose a view to continue.");
  }, []);

  async function enter(role: "Administrator" | "Viewer") {
    if (opening) return;
    setOpening(role);
    setError("");
    try {
      onEnter(await api<User>("/auth/guest", {
        method: "POST",
        body: JSON.stringify({ role }),
      }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOpening(null);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-context" aria-label="BYTEFORCE platform">
        <Radar size={48} />
        <h1>BYTEFORCE</h1>
        <span>WEATHER INTELLIGENCE PLATFORM</span>
        <h2>A clearer view.<br />A coordinated response.</h2>
        <p>Weather intelligence, report verification and national-scale situational awareness in one operational workspace.</p>
        <div><ShieldCheck size={16} /> Explore the weather intelligence workspace</div>
      </section>
      <section className="login-form" aria-label="Choose your workspace view" aria-busy={!!opening}>
        <span className="eyebrow">YOUR OPERATIONAL WORKSPACE</span>
        <h2>Choose your view</h2>
        <p>Explore BYTEFORCE instantly. No account, email or password required.</p>
        {notice && <p className="login-note" role="status">{notice}</p>}
        <div className="workspace-choices">
          <button type="button" className="workspace-choice" disabled={!!opening} onClick={() => enter("Viewer")}>
            <Users size={22} aria-hidden="true" />
            <span><strong>{opening === "Viewer" ? "Opening guest view…" : "View as Guest"}</strong><small>Explore maps, weather reports and analytics.</small></span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="workspace-choice" disabled={!!opening} onClick={() => enter("Administrator")}>
            <ShieldCheck size={22} aria-hidden="true" />
            <span><strong>{opening === "Administrator" ? "Opening admin view…" : "View as Admin"}</strong><small>Explore verification and administration screens.</small></span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="login-note">Both views use sample data and are read-only. Production accounts and settings are not accessible.</p>
        <button type="button" className="text-button" onClick={onCitizen} disabled={!!opening}>
          Submit a citizen weather report <ArrowRight size={15} />
        </button>
      </section>
    </main>
  );
}

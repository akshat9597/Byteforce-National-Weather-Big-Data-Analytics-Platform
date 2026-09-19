"use client";
import { Radar, ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/services/api";
import { OTPInput } from "@/components/otp-input";
import type { User } from "@/types";
import { ClimateScene } from "@/components/climate/scene";
import "./auth.css";
type Challenge = {
  challenge_id: string;
  message: string;
  expires_in: number;
  resend_after: number;
};
export function Login({
  onLogin,
  onCitizen,
}: {
  onLogin: (u: User) => void;
  onCitizen: () => void;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState("");
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendAt, setResendAt] = useState(0),
    [expiresAt, setExpiresAt] = useState(0),
    [clock, setClock] = useState(Date.now());
  useEffect(() => {
    if (new URLSearchParams(location.search).get("reason") === "expired")
      setError("Your session has expired. Sign in again to continue.");
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const wait = Math.max(0, Math.ceil((resendAt - clock) / 1000));
  const remaining = Math.max(0, Math.ceil((expiresAt - clock) / 1000));
  async function requestCode() {
    setBusy(true);
    setSending(true);
    setError("");
    try {
      const result = await api<Challenge>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setEmail(email.trim().toLowerCase());
      setChallenge(result);
      setCode("");
      setClock(Date.now());
      setResendAt(Date.now() + result.resend_after * 1000);
      setExpiresAt(Date.now() + result.expires_in * 1000);
    } catch (err) {
      setError((err as Error).message);
      if (err instanceof ApiError && err.retryAfter)
        setResendAt(Date.now() + err.retryAfter * 1000);
    } finally {
      setBusy(false);
      setSending(false);
    }
  }
  return (
    <main className="login-screen climate-login">
      <ClimateScene />
      <section className="climate-access" aria-label="Secure sign in">
        <div className="climate-access-label">
          <ShieldCheck size={14} /> SECURE PLATFORM ACCESS
        </div>
        <div className="login-form">
          <div className="auth-brand">
            <Radar size={27} />
            <span>BYTEFORCE</span>
          </div>
          <p className="auth-platform">
            National Weather Intelligence
            <br />
            &amp; Analytics Platform
          </p>
          <div className="auth-divider" />
          <span className="eyebrow">YOUR OPERATIONAL WORKSPACE</span>
          <h2>
            {mode === "otp" && challenge
              ? "Check your inbox"
              : "Welcome to BYTEFORCE"}
          </h2>
          <p>
            {mode === "otp" && challenge
              ? "Enter your verification code to continue securely."
              : "Sign in to access your weather intelligence workspace."}
          </p>
          <div className="auth-methods" aria-label="Sign-in method">
            {(["otp", "password"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                disabled={busy}
                onClick={() => {
                  setMode(value);
                  setChallenge(null);
                  setError("");
                  setCode("");
                }}
              >
                {value === "otp" ? "Email verification code" : "Password"}
              </button>
            ))}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (mode === "otp" && !challenge) {
                await requestCode();
                return;
              }
              setBusy(true);
              setError("");
              try {
                onLogin(
                  await api(
                    mode === "otp" ? "/auth/verify-otp" : "/auth/login",
                    {
                      method: "POST",
                      body: JSON.stringify(
                        mode === "otp"
                          ? { email, otp: code }
                          : { email, password },
                      ),
                    },
                  ),
                );
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {!(mode === "otp" && challenge) && (
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="username"
                  value={email}
                  disabled={busy || (mode === "otp" && !!challenge)}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
            )}
            {mode === "password" ? (
              <label>
                Password
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            ) : (
              challenge && (
                <>
                  <p className="login-note" role="status">
                    Verification code sent to {email[0]}***@
                    {email.split("@")[1]}
                  </p>
                  <OTPInput
                    key={challenge.challenge_id}
                    onChange={setCode}
                    disabled={busy}
                  />
                  <span className="login-note">
                    {remaining
                      ? `Code expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
                      : "Code expired. Request a new code."}
                  </span>
                </>
              )
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary"
              disabled={
                busy ||
                (mode === "otp" &&
                  (challenge ? !remaining || code.length !== 6 : wait > 0))
              }
            >
              {busy
                ? mode === "password"
                  ? "Signing in…"
                  : sending
                    ? "Sending OTP…"
                    : "Verifying…"
                : mode === "password"
                  ? "Sign in securely"
                  : challenge
                    ? "Verify and sign in"
                    : wait
                      ? `Try again in ${wait}s`
                      : "Send verification code"}
              <ArrowRight size={16} />
            </button>
          </form>
          {mode === "otp" && challenge && (
            <div className="auth-methods">
              <button
                type="button"
                disabled={busy || wait > 0}
                onClick={requestCode}
              >
                {wait ? `Resend in ${wait}s` : "Resend code"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setChallenge(null);
                  setCode("");
                  setError("");
                }}
              >
                Change email
              </button>
            </div>
          )}
          <div className="login-note">
            First-time users receive read-only Viewer access after verifying
            their email. Staff permissions are assigned by an administrator.
          </div>
          <button className="text-button" onClick={onCitizen}>
            Submit a citizen weather report <ArrowRight size={15} />
          </button>
        </div>
        <p className="climate-access-footer">
          <ShieldCheck size={13} /> Email verification · Role-based access
        </p>
      </section>
    </main>
  );
}

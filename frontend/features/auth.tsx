"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import type { User } from "@/types";

export function WorkspaceEntry({ onEnter, onCitizen }: {
  onEnter: (user: User) => void;
  onCitizen: () => void;
}) {
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;
  // Reuse the in-flight request during React's development effect replay.
  const request = useRef<Promise<User> | null>(null);
  useEffect(() => {
    let active = true;
    setError("");
    request.current ??= api<User>("/auth/guest", {
      method: "POST",
      body: JSON.stringify({ role: "Administrator" }),
      timeoutMs: 15000,
    });
    request.current.then((user) => {
      if (active) onEnterRef.current(user);
    }).catch((err: Error) => {
      if (active) setError(err.message);
    });
    return () => { active = false; };
  }, [attempt]);

  return <main className="boot" aria-busy={!error}>
    <h1>BYTEFORCE</h1>
    {error ? <>
      <p role="alert">{error}</p>
      <button type="button" onClick={() => {
        request.current = null;
        setAttempt((value) => value + 1);
      }}>Retry opening workspace</button>
      <button type="button" onClick={onCitizen}>Submit a citizen weather report</button>
    </> : <p role="status">Opening Admin preview…</p>}
    <p>Read-only preview · Sample data</p>
  </main>;
}

"use client";
import { useState } from "react";
import { api } from "@/services/api";
import type { User } from "@/types";

export function ProfileEditor({
  user,
  onUpdated,
}: {
  user: User;
  onUpdated: (user: User) => void;
}) {
  const [name, setName] = useState(user.name),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  return (
    <form
      className="settings-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setSaved(false);
        try {
          onUpdated(
            await api<User>("/auth/profile", {
              method: "PATCH",
              body: JSON.stringify({ name: name.trim() }),
            }),
          );
          setSaved(true);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Full name
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          required
          minLength={2}
          maxLength={100}
        />
      </label>
      <label>
        Email
        <input value={user.email} readOnly />
      </label>
      <label>
        Organisation
        <input value={user.organization} readOnly />
      </label>
      <label>
        Assigned role
        <input value={user.role} readOnly />
      </label>
      <p className="subtext">
        Email and access permissions are managed separately from your display
        name.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="success" role="status">
          Profile updated.
        </p>
      )}
      <button className="primary" disabled={busy || name.trim() === user.name}>
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

export function RoleEditor({
  user,
  onChanged,
}: {
  user: User;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false),
    [role, setRole] = useState(user.role),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!open)
    return (
      <button
        onClick={() => {
          setRole(user.role);
          setOpen(true);
        }}
      >
        Change role
      </button>
    );
  return (
    <form
      className="settings-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api(`/admin/users/${user.id}/role`, {
            method: "PATCH",
            body: JSON.stringify({ role, expected_role: user.role, reason }),
          });
          setOpen(false);
          setReason("");
          onChanged();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        New role
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {[
            "Viewer",
            "Weather Analyst",
            "Verification Officer",
            "Administrator",
          ].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label>
        Reason
        <input
          required
          minLength={5}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy || role === user.role}>
        {busy ? "Saving…" : "Save role"}
      </button>
      <button type="button" disabled={busy} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}

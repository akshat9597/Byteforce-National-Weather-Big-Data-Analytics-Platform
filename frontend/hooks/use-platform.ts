"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";
import type { Report, WeatherEvent, Alert, User } from "@/types";
export function usePlatform(user: User | null) {
  const [reports, setReports] = useState<Report[]>([]),
    [events, setEvents] = useState<WeatherEvent[]>([]),
    [alerts, setAlerts] = useState<Alert[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [live, setLive] = useState(false),
    [sync, setSync] = useState<Date | null>(null);
  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [r, e, a] = await Promise.all([
        api<Report[]>("/reports"),
        api<WeatherEvent[]>("/events"),
        api<Alert[]>("/alerts"),
      ]);
      setReports(r);
      setEvents(e);
      setAlerts(a);
      setSync(new Date());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!user || user.is_guest) return;
    let socket: WebSocket;
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;
    const connect = () => {
      const base =
        process.env.NEXT_PUBLIC_WS_URL ||
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:8000/ws`;
      socket = new WebSocket(base);
      socket.onopen = () => setLive(true);
      socket.onmessage = () => refresh();
      socket.onclose = () => {
        setLive(false);
        if (!disposed) timer = setTimeout(connect, 5000);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    const poll = setInterval(refresh, 30000);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearInterval(poll);
      socket?.close();
    };
  }, [user, refresh]);
  return { reports, events, alerts, loading, error, live, sync, refresh };
}

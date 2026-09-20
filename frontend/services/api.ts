export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function api<T = any>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 15000, signal, ...request } = options;
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const r = await fetch("/api" + path, {
      credentials: "include",
      ...request,
      signal: controller.signal,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    });
    if (r.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new Event("byteforce-session-expired"));
    }
    if (!r.ok) {
      const e = await r.json().catch(() => ({
        detail: "The service is temporarily unavailable. Please try again.",
      }));
      if (controller.signal.aborted) throw new Error("Request aborted");
      throw new ApiError(
        typeof e.detail === "string" ? e.detail : "Please check the form fields.",
        r.status,
        Number(r.headers.get("Retry-After")) || 0,
      );
    }
    return await r.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      timedOut
        ? "The server is taking longer than expected. Please try again shortly."
        : signal?.aborted
          ? "Request cancelled."
          : "Unable to connect. Check your connection and try again.",
      0,
      0,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
export function download(
  rows: object[],
  format: "csv" | "json",
  name = "byteforce-reports",
) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@-]/, "'")
      .replaceAll('"', '""') +
    '"';
  const value =
    format === "json"
      ? JSON.stringify(rows, null, 2)
      : [
          keys.join(","),
          ...rows.map((r) =>
            keys.map((k) => cell((r as Record<string, unknown>)[k])).join(","),
          ),
        ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([value], {
      type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name + "." + format;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

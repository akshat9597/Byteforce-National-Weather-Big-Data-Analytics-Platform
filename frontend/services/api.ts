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
  options: RequestInit = {},
): Promise<T> {
  const r = await fetch("/api" + path, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  }).catch(() => {
    throw new ApiError(
      "Unable to connect. Check your connection and try again.",
      0,
      0,
    );
  });
  if (r.status === 401 && !path.startsWith("/auth/")) {
    window.dispatchEvent(new Event("byteforce-session-expired"));
  }
  if (!r.ok) {
    const e = await r.json().catch(() => ({
      detail: "Weather data service temporarily unavailable",
    }));
    throw new ApiError(
      typeof e.detail === "string" ? e.detail : "Please check the form fields.",
      r.status,
      Number(r.headers.get("Retry-After")) || 0,
    );
  }
  return r.json();
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

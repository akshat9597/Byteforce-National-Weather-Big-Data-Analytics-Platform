"use client";
import { useEffect } from "react";
import type { Report, WeatherEvent } from "@/types";
/** Optional browser-native tools. No mutation or privileged API is exposed. */
export function useWebMCP(
  reports: Report[],
  events: WeatherEvent[],
  enabled: boolean,
) {
  useEffect(() => {
    const context = (
      navigator as Navigator & {
        modelContext?: {
          registerTool: (tool: unknown) => void;
          unregisterTool: (name: string) => void;
        };
      }
    ).modelContext;
    if (!context || !enabled) return;
    const name = "search_weather_intelligence";
    context.registerTool({
      name,
      description:
        "Search weather reports and consolidated events already available to the signed-in user.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async ({ query }: { query: string }) => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              reports: reports
                .filter((r) =>
                  `${r.id} ${r.city} ${r.state} ${r.event_type}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .slice(0, 30),
              events: events
                .filter((e) =>
                  `${e.id} ${e.city} ${e.state} ${e.event_type}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .slice(0, 30),
            }),
          },
        ],
      }),
    });
    return () => context.unregisterTool(name);
  }, [reports, events, enabled]);
}

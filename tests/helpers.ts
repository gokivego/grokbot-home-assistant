import type { HaState } from "../src/client.ts";

export type MockCall = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
};

export type MockHandler = {
  method?: string;
  path: string;
  status?: number;
  json?: unknown;
  text?: string;
};

export function state(
  entity_id: string,
  value: string,
  extra: Partial<HaState> = {},
): HaState {
  return {
    entity_id,
    state: value,
    last_changed: extra.last_changed ?? "2026-09-02T12:00:00+00:00",
    attributes: extra.attributes ?? { friendly_name: entity_id },
    ...extra,
  };
}

export function mockFetch(handlers: MockHandler[]): { fetch: typeof fetch; calls: MockCall[] } {
  const calls: MockCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = headersToRecord(init?.headers);
    const body = typeof init?.body === "string" ? init.body : undefined;
    calls.push({ method, url, headers, body });

    const parsed = new URL(url);
    const hit = handlers.find((handler) => {
      const wantMethod = (handler.method ?? "GET").toUpperCase();
      return wantMethod === method && parsed.pathname === handler.path;
    });

    if (!hit) {
      return new Response(JSON.stringify({ message: `no mock for ${method} ${parsed.pathname}` }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (hit.text !== undefined) {
      return new Response(hit.text, { status: hit.status ?? 200 });
    }

    return new Response(JSON.stringify(hit.json ?? {}), {
      status: hit.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { fetch: fetchImpl, calls };
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      out[key] = value;
    }
    return out;
  }
  return { ...headers };
}

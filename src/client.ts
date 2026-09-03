import { loadConfig, type HomeAssistantConfig } from "./config.ts";

export const DEFAULT_STATE_LIMIT = 50;
export const MAX_STATE_LIMIT = 100;

export type FetchLike = typeof fetch;

export type HaState = {
  entity_id: string;
  state: string;
  last_changed?: string;
  last_updated?: string;
  attributes?: Record<string, unknown>;
};

export type StateSummary = {
  entity_id: string;
  state: string;
  last_changed?: string;
  friendly_name?: string;
};

export type ListStatesFilter = {
  domain?: string;
  prefix?: string;
  limit?: number;
};

export type ListStatesResult = {
  filter: { domain?: string; prefix?: string };
  limit: number;
  total_matched: number;
  returned: number;
  truncated: boolean;
  states: StateSummary[];
};

export class HomeAssistantApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string, detail: string) {
    super(redactSecrets(`Home Assistant ${status} on ${path}: ${detail}`));
    this.name = "HomeAssistantApiError";
    this.status = status;
    this.path = path;
  }
}

export class HomeAssistantClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  private readonly token: string;
  private readonly fetchImpl: FetchLike;

  constructor(
    config: HomeAssistantConfig,
    fetchImpl: FetchLike = fetch,
  ) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.timeoutMs = config.timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env, fetchImpl: FetchLike = fetch): HomeAssistantClient {
    return new HomeAssistantClient(loadConfig(env), fetchImpl);
  }

  ping(): Promise<{ message: string }> {
    return this.requestJson("GET", "/api/");
  }

  async listStates(filter: ListStatesFilter): Promise<ListStatesResult> {
    const domain = normalizeOptionalSlug(filter.domain, "domain");
    const prefix = normalizeOptionalPrefix(filter.prefix);
    if (!domain && !prefix) {
      throw new Error("ha_list_states requires domain (for example light) or prefix (for example light.kitchen). Unfiltered dumps are refused.");
    }

    const limit = clampLimit(filter.limit);
    const states = await this.requestJson<HaState[]>("GET", "/api/states");
    if (!Array.isArray(states)) {
      throw new Error("Home Assistant /api/states did not return a list.");
    }

    const matched = states.filter((item) => matchesFilter(item.entity_id, domain, prefix));
    const sliced = matched.slice(0, limit);

    return {
      filter: { ...(domain ? { domain } : {}), ...(prefix ? { prefix } : {}) },
      limit,
      total_matched: matched.length,
      returned: sliced.length,
      truncated: matched.length > sliced.length,
      states: sliced.map(summarizeState),
    };
  }

  async getState(entityId: string): Promise<HaState> {
    const id = requireEntityId(entityId);
    return this.requestJson("GET", `/api/states/${encodeURIComponent(id)}`);
  }

  async callService(
    domain: string,
    service: string,
    data: Record<string, unknown> = {},
  ): Promise<unknown> {
    const d = requireSlug(domain, "domain");
    const s = requireSlug(service, "service");
    return this.requestJson(
      "POST",
      `/api/services/${encodeURIComponent(d)}/${encodeURIComponent(s)}`,
      data,
    );
  }

  async toggle(entityId: string): Promise<unknown> {
    const id = requireEntityId(entityId);
    const domain = id.slice(0, id.indexOf("."));
    return this.callService(domain, "toggle", { entity_id: id });
  }

  private async requestJson<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(redactSecrets(`Home Assistant request to ${path} failed: ${message}`));
    }

    const text = await response.text();
    if (!response.ok) {
      throw new HomeAssistantApiError(response.status, path, summarizeHttpError(response.status, text));
    }

    if (!text) {
      return undefined as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Home Assistant ${path} returned non-JSON.`);
    }
  }
}

export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_STATE_LIMIT;
  }
  const n = Math.floor(limit);
  if (n < 1) {
    return 1;
  }
  return Math.min(n, MAX_STATE_LIMIT);
}

export function requireEntityId(raw: string): string {
  const id = raw.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]*\.[a-z0-9_]+$/.test(id)) {
    throw new Error("entity_id must look like domain.object_id, for example light.kitchen.");
  }
  return id;
}

export function requireSlug(raw: string, label: string): string {
  const value = raw.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new Error(`${label} must be a Home Assistant slug such as light or turn_on.`);
  }
  return value;
}

function normalizeOptionalSlug(raw: string | undefined, label: string): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  return requireSlug(trimmed, label);
}

function normalizeOptionalPrefix(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim().toLowerCase();
  return trimmed || undefined;
}

function matchesFilter(entityId: string, domain?: string, prefix?: string): boolean {
  const id = entityId.toLowerCase();
  if (domain && !id.startsWith(`${domain}.`)) {
    return false;
  }
  if (prefix && !id.startsWith(prefix)) {
    return false;
  }
  return true;
}

function summarizeState(state: HaState): StateSummary {
  const friendly = state.attributes?.friendly_name;
  return {
    entity_id: state.entity_id,
    state: state.state,
    last_changed: state.last_changed,
    ...(typeof friendly === "string" ? { friendly_name: friendly } : {}),
  };
}

function summarizeHttpError(status: number, body: string): string {
  const snippet = redactSecrets(body).replace(/\s+/g, " ").slice(0, 240);
  if (status === 401) {
    return "unauthorized. Check HA_TOKEN.";
  }
  if (status === 404) {
    return snippet || "not found";
  }
  return snippet || responseStatusText(status);
}

function responseStatusText(status: number): string {
  if (status === 400) return "bad request";
  if (status === 405) return "method not allowed";
  return "request failed";
}

export function redactSecrets(text: string): string {
  return text.replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]");
}

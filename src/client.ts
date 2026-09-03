import { loadConfig, type HomeAssistantConfig } from "./config.ts";

export const DEFAULT_STATE_LIMIT = 50;
export const MAX_STATE_LIMIT = 100;
export const MAX_SERVICES = 80;
export const MAX_SERVICE_FIELDS = 40;

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
  q?: string;
  limit?: number;
  offset?: number;
};

export type ListStatesResult = {
  filter: { domain?: string; prefix?: string; q?: string };
  limit: number;
  offset: number;
  total_matched: number;
  returned: number;
  truncated: boolean;
  states: StateSummary[];
};

export type ServiceFieldSummary = {
  name: string;
  description?: string;
};

export type ServiceSummary = {
  service: string;
  name?: string;
  description?: string;
  fields: ServiceFieldSummary[];
};

export type ListServicesResult = {
  domain: string;
  returned: number;
  truncated: boolean;
  services: ServiceSummary[];
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
    const q = normalizeOptionalQuery(filter.q);
    if (!domain && !prefix && !q) {
      throw new Error(
        "ha_list_states requires domain (for example light), prefix (for example light.kitchen), or q (substring of entity_id or friendly_name). Unfiltered dumps are refused.",
      );
    }

    const limit = clampLimit(filter.limit);
    const offset = clampOffset(filter.offset);
    const states = await this.requestJson<HaState[]>("GET", "/api/states");
    if (!Array.isArray(states)) {
      throw new Error("Home Assistant /api/states did not return a list.");
    }

    const matched = states.filter((item) => matchesFilter(item, domain, prefix, q));
    const sliced = matched.slice(offset, offset + limit);

    return {
      filter: {
        ...(domain ? { domain } : {}),
        ...(prefix ? { prefix } : {}),
        ...(q ? { q } : {}),
      },
      limit,
      offset,
      total_matched: matched.length,
      returned: sliced.length,
      truncated: offset + sliced.length < matched.length || offset > 0,
      states: sliced.map(summarizeState),
    };
  }

  async listServices(domainRaw: string): Promise<ListServicesResult> {
    const domain = requireSlug(domainRaw, "domain");
    const payload = await this.requestJson<unknown>("GET", "/api/services");
    const servicesMap = extractDomainServices(payload, domain);
    const entries = Object.entries(servicesMap);
    const truncated = entries.length > MAX_SERVICES;
    const services = entries.slice(0, MAX_SERVICES).map(([service, spec]) => summarizeService(service, spec));
    return {
      domain,
      returned: services.length,
      truncated,
      services,
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

export function clampOffset(offset: number | undefined): number {
  if (offset === undefined || Number.isNaN(offset)) {
    return 0;
  }
  const n = Math.floor(offset);
  return n < 0 ? 0 : n;
}

export function requireEntityId(raw: string): string {
  const id = raw.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]*\.[a-z0-9_]+$/.test(id)) {
    throw new Error("entity_id must look like domain.object_id, for example light.kitchen.");
  }
  return id;
}

export function requireSlug(raw: string, label: string): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error(`${label} is required (for example light or climate).`);
  }
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

function normalizeOptionalQuery(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed || undefined;
}

function matchesFilter(item: HaState, domain?: string, prefix?: string, q?: string): boolean {
  const id = item.entity_id.toLowerCase();
  if (domain && !id.startsWith(`${domain}.`)) {
    return false;
  }
  if (prefix && !id.startsWith(prefix)) {
    return false;
  }
  if (q) {
    const needle = q.toLowerCase();
    const friendly =
      typeof item.attributes?.friendly_name === "string" ? item.attributes.friendly_name.toLowerCase() : "";
    if (!id.includes(needle) && !friendly.includes(needle)) {
      return false;
    }
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

function extractDomainServices(payload: unknown, domain: string): Record<string, unknown> {
  if (Array.isArray(payload)) {
    const hit = payload.find((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return false;
      }
      return String((item as Record<string, unknown>).domain ?? "").toLowerCase() === domain;
    }) as Record<string, unknown> | undefined;
    return asServiceMap(hit?.services);
  }

  if (payload && typeof payload === "object") {
    const rec = payload as Record<string, unknown>;
    const direct = rec[domain];
    if (direct && typeof direct === "object" && !Array.isArray(direct)) {
      const maybe = direct as Record<string, unknown>;
      const nested = asServiceMap(maybe.services);
      return Object.keys(nested).length > 0 ? nested : asServiceMap(maybe);
    }
  }

  return {};
}

function asServiceMap(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function summarizeService(service: string, spec: unknown): ServiceSummary {
  const rec = spec && typeof spec === "object" && !Array.isArray(spec) ? (spec as Record<string, unknown>) : {};
  const name = trimDescription(rec.name);
  const description = trimDescription(rec.description);
  return {
    service,
    ...(name ? { name } : {}),
    ...(description ? { description } : {}),
    fields: summarizeFields(rec.fields),
  };
}

function summarizeFields(fields: unknown): ServiceFieldSummary[] {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return [];
  }
  return Object.entries(fields as Record<string, unknown>)
    .slice(0, MAX_SERVICE_FIELDS)
    .map(([name, spec]) => {
      const description =
        spec && typeof spec === "object" && !Array.isArray(spec)
          ? trimDescription((spec as Record<string, unknown>).description)
          : undefined;
      return description ? { name, description } : { name };
    });
}

function trimDescription(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
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

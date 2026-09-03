const HTTP_TIMEOUT_MS = 15_000;

export type HomeAssistantConfig = {
  baseUrl: string;
  token: string;
  timeoutMs: number;
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ConfigError(
      "HA_URL is required. Use a base URL with no trailing slash that this computer can reach, such as http://homeassistant:8123.",
    );
  }

  let candidate = trimmed.replace(/\/+$/, "");
  if (candidate.endsWith("/api")) {
    candidate = candidate.slice(0, -4).replace(/\/+$/, "");
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new ConfigError("HA_URL must be an absolute http or https URL, for example http://homeassistant:8123.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ConfigError("HA_URL must use http or https.");
  }

  if (parsed.username || parsed.password) {
    throw new ConfigError("HA_URL must not include credentials. Put the long-lived token in HA_TOKEN.");
  }

  const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
  return `${parsed.protocol}//${parsed.host}${path}`;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): HomeAssistantConfig {
  const urlRaw = env.HA_URL ?? "";
  const token = (env.HA_TOKEN ?? "").trim();

  if (!token) {
    throw new ConfigError("HA_TOKEN is required. Create a long-lived access token in Home Assistant under Profile, Security.");
  }

  return {
    baseUrl: normalizeBaseUrl(urlRaw),
    token,
    timeoutMs: HTTP_TIMEOUT_MS,
  };
}

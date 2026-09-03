import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigError, loadConfig, normalizeBaseUrl } from "../src/config.ts";

test("normalizeBaseUrl strips trailing slashes and a trailing /api", () => {
  assert.equal(normalizeBaseUrl("http://homeassistant:8123/"), "http://homeassistant:8123");
  assert.equal(normalizeBaseUrl("http://homeassistant:8123/api/"), "http://homeassistant:8123");
  assert.equal(normalizeBaseUrl("https://example.ui.nabu.casa"), "https://example.ui.nabu.casa");
});

test("normalizeBaseUrl rejects credentials, empty values, and non-http schemes", () => {
  assert.throws(() => normalizeBaseUrl(""), ConfigError);
  assert.throws(() => normalizeBaseUrl("ftp://homeassistant:8123"), ConfigError);
  assert.throws(() => normalizeBaseUrl("http://user:pass@homeassistant:8123"), ConfigError);
  assert.throws(() => normalizeBaseUrl("homeassistant:8123"), ConfigError);
});

test("loadConfig requires HA_URL and HA_TOKEN", () => {
  assert.throws(() => loadConfig({}), ConfigError);
  assert.throws(() => loadConfig({ HA_URL: "http://homeassistant:8123" }), /HA_TOKEN/);
  assert.throws(() => loadConfig({ HA_TOKEN: "abc" }), /HA_URL/);
  const cfg = loadConfig({
    HA_URL: "http://homeassistant:8123/",
    HA_TOKEN: "  secret-token  ",
  });
  assert.equal(cfg.baseUrl, "http://homeassistant:8123");
  assert.equal(cfg.token, "secret-token");
});

test("this house hostname is an example, not a hardcoded default", () => {
  const cfg = loadConfig({
    HA_URL: "https://example.ui.nabu.casa",
    HA_TOKEN: "tok",
  });
  assert.equal(cfg.baseUrl, "https://example.ui.nabu.casa");
  assert.doesNotMatch(cfg.baseUrl, /100\.72\.49\.113/);
  assert.doesNotMatch(cfg.baseUrl, /homeassistant$/);
});

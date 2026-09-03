import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_STATE_LIMIT,
  HomeAssistantApiError,
  HomeAssistantClient,
  MAX_STATE_LIMIT,
} from "../src/client.ts";
import { loadConfig } from "../src/config.ts";
import { mockFetch, state } from "./helpers.ts";

const cfg = loadConfig({
  HA_URL: "http://homeassistant:8123",
  HA_TOKEN: "test-token",
});

test("ping calls GET /api/ with a bearer token", async () => {
  const { fetch, calls } = mockFetch([
    { path: "/api/", json: { message: "API running." } },
  ]);
  const client = new HomeAssistantClient(cfg, fetch);
  const result = await client.ping();
  assert.deepEqual(result, { message: "API running." });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, "GET");
  assert.equal(calls[0]?.url, "http://homeassistant:8123/api/");
  assert.equal(calls[0]?.headers.Authorization, "Bearer test-token");
  assert.equal(calls[0]?.headers.Accept, "application/json");
  assert.equal(calls[0]?.headers["Content-Type"], undefined);
});

test("listStates requires domain, prefix, or q and caps results", async () => {
  const many = Array.from({ length: 120 }, (_, i) =>
    state(`light.lamp_${i}`, i % 2 === 0 ? "on" : "off"),
  );
  const { fetch } = mockFetch([{ path: "/api/states", json: many }]);
  const client = new HomeAssistantClient(cfg, fetch);

  await assert.rejects(
    () => client.listStates({}),
    /requires domain .* prefix .* or q/,
  );

  const page = await client.listStates({ domain: "light", limit: 1000 });
  assert.equal(page.limit, MAX_STATE_LIMIT);
  assert.equal(page.offset, 0);
  assert.equal(page.total_matched, 120);
  assert.equal(page.returned, MAX_STATE_LIMIT);
  assert.equal(page.truncated, true);
  assert.equal(page.states[0]?.entity_id, "light.lamp_0");
  assert.equal(page.states[0]?.friendly_name, "light.lamp_0");
});

test("listStates default cap is 50 and prefix is an entity_id prefix", async () => {
  const states = [
    state("light.kitchen", "on", { attributes: { friendly_name: "Kitchen" } }),
    state("light.kitchen_sink", "off"),
    state("switch.kitchen", "on"),
    state("sensor.kitchen_temp", "21"),
  ];
  const { fetch } = mockFetch([{ path: "/api/states", json: states }]);
  const client = new HomeAssistantClient(cfg, fetch);

  const byPrefix = await client.listStates({ prefix: "light.kitchen" });
  assert.equal(byPrefix.limit, DEFAULT_STATE_LIMIT);
  assert.deepEqual(
    byPrefix.states.map((item) => item.entity_id),
    ["light.kitchen", "light.kitchen_sink"],
  );

  const both = await client.listStates({ domain: "switch", prefix: "switch.kit" });
  assert.deepEqual(
    both.states.map((item) => item.entity_id),
    ["switch.kitchen"],
  );
});

test("getState encodes the entity id path", async () => {
  const { fetch, calls } = mockFetch([
    {
      path: "/api/states/light.kitchen",
      json: state("light.kitchen", "on"),
    },
  ]);
  const client = new HomeAssistantClient(cfg, fetch);
  const result = await client.getState("Light.Kitchen");
  assert.equal(result.state, "on");
  assert.equal(calls[0]?.url, "http://homeassistant:8123/api/states/light.kitchen");
});

test("toggle posts domain toggle with entity_id", async () => {
  const { fetch, calls } = mockFetch([
    {
      method: "POST",
      path: "/api/services/switch/toggle",
      json: [state("switch.porch", "off")],
    },
  ]);
  const client = new HomeAssistantClient(cfg, fetch);
  await client.toggle("switch.porch");
  assert.equal(calls[0]?.method, "POST");
  assert.equal(calls[0]?.url, "http://homeassistant:8123/api/services/switch/toggle");
  assert.equal(calls[0]?.headers["Content-Type"], "application/json");
  assert.equal(calls[0]?.body, JSON.stringify({ entity_id: "switch.porch" }));
});

test("callService posts domain/service JSON", async () => {
  const { fetch, calls } = mockFetch([
    {
      method: "POST",
      path: "/api/services/light/turn_on",
      json: [],
    },
  ]);
  const client = new HomeAssistantClient(cfg, fetch);
  await client.callService("light", "turn_on", { entity_id: "light.kitchen", brightness: 128 });
  assert.equal(calls[0]?.url, "http://homeassistant:8123/api/services/light/turn_on");
  assert.equal(
    calls[0]?.body,
    JSON.stringify({ entity_id: "light.kitchen", brightness: 128 }),
  );
});

test("401 does not echo the token", async () => {
  const { fetch } = mockFetch([
    {
      path: "/api/",
      status: 401,
      text: "Bearer test-token is invalid",
    },
  ]);
  const client = new HomeAssistantClient(cfg, fetch);
  await assert.rejects(
    () => client.ping(),
    (error: unknown) => {
      assert(error instanceof HomeAssistantApiError);
      assert.equal(error.status, 401);
      assert.doesNotMatch(error.message, /test-token/);
      assert.match(error.message, /unauthorized/i);
      return true;
    },
  );
});

test("invalid entity ids are rejected before HTTP", async () => {
  const { fetch, calls } = mockFetch([]);
  const client = new HomeAssistantClient(cfg, fetch);
  await assert.rejects(() => client.getState("kitchen"), /entity_id/);
  await assert.rejects(() => client.toggle("../etc/passwd"), /entity_id/);
  await assert.rejects(() => client.callService("LIGHT!", "turn_on"), /domain/);
  assert.equal(calls.length, 0);
});

test("network error is caught and re-thrown as a plain Error", async () => {
  const failFetch: typeof fetch = async () => {
    throw new TypeError("fetch failed");
  };
  const client = new HomeAssistantClient(cfg, failFetch);
  await assert.rejects(
    () => client.ping(),
    (err: unknown) => {
      assert(err instanceof Error);
      assert.match(err.message, /request to \/api\/ failed/);
      return true;
    },
  );
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { HomeAssistantClient } from "../src/client.ts";
import { loadConfig } from "../src/config.ts";
import { createToolHandlers } from "../src/tools.ts";
import { mockFetch, state } from "./helpers.ts";

const cfg = loadConfig({
  HA_URL: "http://homeassistant:8123",
  HA_TOKEN: "test-token",
});

function parse(result: { content: Array<{ text: string }>; isError?: boolean }) {
  return {
    isError: Boolean(result.isError),
    body: JSON.parse(result.content[0]?.text ?? "{}") as Record<string, unknown>,
  };
}

test("ha_list_states tool returns a structured error without a filter", async () => {
  const { fetch } = mockFetch([{ path: "/api/states", json: [] }]);
  const tools = createToolHandlers(new HomeAssistantClient(cfg, fetch));
  const result = parse(await tools.ha_list_states({}));
  assert.equal(result.isError, true);
  assert.match(String(result.body.error), /requires domain/);
});

test("ha_toggle and ha_call_service wrap the REST response", async () => {
  const { fetch, calls } = mockFetch([
    {
      method: "POST",
      path: "/api/services/light/toggle",
      json: [state("light.kitchen", "off")],
    },
    {
      method: "POST",
      path: "/api/services/light/turn_on",
      json: [state("light.kitchen", "on")],
    },
  ]);
  const tools = createToolHandlers(new HomeAssistantClient(cfg, fetch));

  const toggled = parse(await tools.ha_toggle({ entity_id: "light.kitchen" }));
  assert.equal(toggled.isError, false);
  assert.equal(toggled.body.confirmed_action, "toggle");

  const called = parse(
    await tools.ha_call_service({
      domain: "light",
      service: "turn_on",
      entity_id: "light.kitchen",
      data: { brightness: 200 },
    }),
  );
  assert.equal(called.body.confirmed_action, "call_service");
  assert.deepEqual(called.body.data, {
    brightness: 200,
    entity_id: "light.kitchen",
  });
  assert.equal(calls.length, 2);
});

test("tool errors redact bearer tokens", async () => {
  const { fetch } = mockFetch([
    { path: "/api/", status: 401, text: "Bearer test-token rejected" },
  ]);
  const tools = createToolHandlers(new HomeAssistantClient(cfg, fetch));
  const result = parse(await tools.ha_ping());
  assert.equal(result.isError, true);
  assert.doesNotMatch(JSON.stringify(result.body), /test-token/);
});

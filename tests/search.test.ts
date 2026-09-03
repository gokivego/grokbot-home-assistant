import assert from "node:assert/strict";
import { test } from "node:test";
import { HomeAssistantClient } from "../src/client.ts";
import { loadConfig } from "../src/config.ts";
import { mockFetch, state } from "./helpers.ts";

const cfg = loadConfig({
  HA_URL: "http://homeassistant:8123",
  HA_TOKEN: "test-token",
});

test("listStates q matches entity_id and friendly_name case-insensitively", async () => {
  const states = [
    state("light.kitchen", "on", { attributes: { friendly_name: "Kitchen ceiling" } }),
    state("light.bedroom_lamp", "off", { attributes: { friendly_name: "Bedside" } }),
    state("light.hall", "on", { attributes: { friendly_name: "Bedroom hall" } }),
    state("switch.bedroom", "on", { attributes: { friendly_name: "Bedroom switch" } }),
    state("sensor.outdoor", "21", { attributes: { friendly_name: "Outside" } }),
  ];
  const { fetch } = mockFetch([{ path: "/api/states", json: states }]);
  const client = new HomeAssistantClient(cfg, fetch);

  const byQ = await client.listStates({ q: "BEDROOM" });
  assert.deepEqual(byQ.filter, { q: "BEDROOM" });
  assert.deepEqual(
    byQ.states.map((item) => item.entity_id),
    ["light.bedroom_lamp", "light.hall", "switch.bedroom"],
  );

  const combined = await client.listStates({ domain: "light", q: "bedroom" });
  assert.deepEqual(combined.filter, { domain: "light", q: "bedroom" });
  assert.deepEqual(
    combined.states.map((item) => item.entity_id),
    ["light.bedroom_lamp", "light.hall"],
  );
});

test("listStates offset pages after filtering; truncated if not all matched rows returned", async () => {
  const many = Array.from({ length: 120 }, (_, i) => state("light.lamp_" + i, "on"));
  const { fetch } = mockFetch([{ path: "/api/states", json: many }]);
  const client = new HomeAssistantClient(cfg, fetch);

  const mid = await client.listStates({ domain: "light", limit: 50, offset: 50 });
  assert.equal(mid.offset, 50);
  assert.equal(mid.limit, 50);
  assert.equal(mid.total_matched, 120);
  assert.equal(mid.returned, 50);
  assert.equal(mid.truncated, true);
  assert.equal(mid.states[0]?.entity_id, "light.lamp_50");

  const last = await client.listStates({ domain: "light", limit: 50, offset: 100 });
  assert.equal(last.offset, 100);
  assert.equal(last.returned, 20);
  assert.equal(last.truncated, false);
  assert.equal(last.states[0]?.entity_id, "light.lamp_100");

  const complete = await client.listStates({ prefix: "light.lamp_0", limit: 50, offset: 0 });
  assert.equal(complete.offset, 0);
  assert.equal(complete.total_matched, complete.returned);
  assert.equal(complete.truncated, false);
});

test("listServices requires a domain and returns trimmed field names", async () => {
  const payload = [
    {
      domain: "climate",
      services: { set_temperature: { name: "Set temperature", fields: {} } },
    },
    {
      domain: "light",
      services: {
        turn_on: {
          name: "Turn on",
          description: "Turn on one or more lights.",
          fields: {
            brightness: {
              description: "Number from 0 to 255",
              selector: { number: { min: 0, max: 255, extra: "huge" } },
            },
            brightness_pct: { description: "Percentage brightness" },
          },
        },
        turn_off: { name: "Turn off", fields: { transition: { description: "Duration" } } },
      },
    },
  ];
  const { fetch, calls } = mockFetch([{ path: "/api/services", json: payload }]);
  const client = new HomeAssistantClient(cfg, fetch);

  await assert.rejects(() => client.listServices(""), /domain is required/);

  const listed = await client.listServices("light");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, "GET");
  assert.equal(calls[0]?.url, "http://homeassistant:8123/api/services");
  assert.equal(listed.domain, "light");
  assert.equal(listed.returned, 2);
  assert.equal(listed.truncated, false);
  assert.deepEqual(
    listed.services.map((item) => item.service),
    ["turn_on", "turn_off"],
  );
  assert.deepEqual(
    listed.services[0]?.fields.map((field) => field.name),
    ["brightness", "brightness_pct"],
  );
  assert.equal(listed.services[0]?.fields[0]?.description, "Number from 0 to 255");
  assert.equal("selector" in (listed.services[0]?.fields[0] ?? {}), false);
  assert.doesNotMatch(JSON.stringify(listed), /huge/);
});

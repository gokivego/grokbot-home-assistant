import assert from "node:assert/strict";
import { test } from "node:test";
import { HomeAssistantClient } from "../src/client.ts";
import { loadConfig } from "../src/config.ts";

const live = Boolean(process.env.HA_URL && process.env.HA_TOKEN);

test(
  "live ha_ping against HA_URL",
  { skip: live ? false : "set HA_URL and HA_TOKEN to run the live check" },
  async () => {
    const client = new HomeAssistantClient(loadConfig(process.env));
    const result = await client.ping();
    assert.equal(typeof result.message, "string");
    assert.match(result.message, /API running/i);
  },
);

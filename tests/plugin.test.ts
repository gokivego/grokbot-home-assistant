import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("Cursor plugin manifest names the plugin and requires HA_URL plus HA_TOKEN", async () => {
  const plugin = JSON.parse(await readFile(".cursor-plugin/plugin.json", "utf8")) as {
    name: string;
    description: string;
    homepage: string;
    repository: string;
    license: string;
    author: { name: string };
    logo: string;
    variables: {
      required: string[];
      properties: Record<string, { type: string; description?: string }>;
    };
  };
  assert.equal(plugin.name, "home-assistant");
  assert.equal(plugin.homepage, "https://github.com/gokivego/grokbot-home-assistant");
  assert.equal(plugin.repository, "https://github.com/gokivego/grokbot-home-assistant");
  assert.doesNotMatch(plugin.repository, /github\.com\/gokivego\/home-assistant$/);
  assert.equal(plugin.license, "MIT");
  assert.equal(plugin.author.name, "Venkat Gokul Reddy Palampally");
  assert.equal(plugin.logo, "assets/logo.svg");
  assert.deepEqual(plugin.variables.required, ["HA_URL", "HA_TOKEN"]);
  assert.equal(plugin.variables.properties.HA_URL?.type, "string");
  assert.equal(plugin.variables.properties.HA_TOKEN?.type, "string");
  const tokenHelp = plugin.variables.properties.HA_TOKEN?.description ?? "";
  assert.match(tokenHelp, /User profile/);
  assert.match(tokenHelp, /Security/);
  assert.match(tokenHelp, /Long-lived access tokens/);
  assert.match(tokenHelp, /Create Token/);
  assert.match(tokenHelp, /Never put it in git or chat/);
  const urlHelp = plugin.variables.properties.HA_URL?.description ?? "";
  assert.match(urlHelp, /Grok Bot or Cursor computer/);
  assert.match(urlHelp, /not on Home Assistant/);
  assert.match(urlHelp, /http:\/\/homeassistant:8123/);
  assert.match(urlHelp, /Nabu Casa/);
  assert.match(urlHelp, /LAN-only IPs \(192\.168\.x, 10\.x, 172\.16-31\.x\) fail/);
  assert.match(urlHelp, /Grok Bot cloud computers are not/);
  assert.match(plugin.description, /MCP stdio runs on the Grok Bot or Cursor computer/);
});

test("mcp.json stdio env uses only HA_URL and HA_TOKEN placeholders", async () => {
  const mcp = JSON.parse(await readFile("mcp.json", "utf8")) as {
    mcpServers: { "home-assistant": { type: string; env: Record<string, string> } };
  };
  const server = mcp.mcpServers["home-assistant"];
  assert.equal(server.type, "stdio");
  assert.deepEqual(Object.keys(server.env).sort(), ["HA_TOKEN", "HA_URL"]);
  assert.equal(server.env.HA_URL, "${HA_URL}");
  assert.equal(server.env.HA_TOKEN, "${HA_TOKEN}");
});

test("skill description starts with use this when", async () => {
  const skill = await readFile("skills/home-assistant/SKILL.md", "utf8");
  assert.match(skill, /^---\nname: home-assistant\ndescription: use this when /);
  assert.match(skill, /MCP stdio runs on the Grok Bot or Cursor computer, not on Home Assistant/);
  assert.match(skill, /LAN-only IP fails unless that computer is on the LAN/);
});

test(".env.example has no token and documents MagicDNS", async () => {
  const example = await readFile(".env.example", "utf8");
  assert.match(example, /^HA_URL=http:\/\/homeassistant:8123$/m);
  assert.match(example, /^HA_TOKEN=$/m);
  assert.doesNotMatch(example, /eyJ[A-Za-z0-9_-]+\./);
  assert.match(example, /Tailscale MagicDNS/);
  assert.match(example, /LAN-only IPs fail/);
});

test("plugin.json repository points at the private grokbot-home-assistant repo", async () => {
  const plugin = JSON.parse(await readFile(".cursor-plugin/plugin.json", "utf8")) as {
    repository?: string;
  };
  assert.equal(plugin.repository, "https://github.com/gokivego/grokbot-home-assistant");
});

test("skill documents Reachability and ping-failure cause", async () => {
  const skill = await readFile("skills/home-assistant/SKILL.md", "utf8");
  assert.match(skill, /## Reachability/);
  assert.match(skill, /If `ha_ping` fails, the likely cause/);
  assert.match(skill, /Grok Bot cloud computers are not/);
  assert.match(skill, /`ha_toggle` and `ha_call_service`/);
  assert.match(skill, /explicitly confirms/);
  assert.match(skill, /ha_list_services/);
  assert.match(skill, /brightness_pct/);
  assert.match(skill, /prefix.*or `q`/);
  assert.match(skill, /homeassistant\.local:8123/);
  assert.match(skill, /will not resolve/);
  assert.doesNotMatch(skill, /100\.72\.49\.113/);
});

test("README uses generic networking examples and no house Tailscale IP", async () => {
  const readme = await readFile("README.md", "utf8");
  assert.match(readme, /## Reachability/);
  assert.match(readme, /Tailscale MagicDNS/);
  assert.match(readme, /http:\/\/homeassistant:8123/);
  assert.match(readme, /Nabu Casa/);
  assert.match(readme, /Grok Bot cloud computers are not/);
  assert.match(readme, /likely cause is `HA_URL` not reachable/);
  assert.match(readme, /Human must confirm first/);
  assert.match(readme, /Node.js 20\+/);
  assert.match(readme, /must be installed there/);
  assert.match(readme, /plugin will fail to launch/);
  assert.match(readme, /homeassistant\.local:8123/);
  assert.match(readme, /LAN example only/);
  assert.match(readme, /will not resolve mDNS/);
  assert.match(readme, /User profile > Security/);
  assert.match(readme, /Long-lived access tokens/);
  assert.match(readme, /copy it immediately/);
  assert.match(readme, /ha_list_services/);
  assert.match(readme, /Requires `domain`, `prefix`, or `q`/);
  assert.doesNotMatch(readme, /100\.72\.49\.113/);
});

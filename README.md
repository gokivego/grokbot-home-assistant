# Home Assistant plugin

Cursor marketplace plugin that lets an agent query and control Home Assistant over the REST API. It also loads as a Cursor-format plugin in Grok Bot. Plugin `name` is `home-assistant`. The public GitHub repo is [gokivego/grokbot-home-assistant](https://github.com/gokivego/grokbot-home-assistant). In this workspace the folder is still `home-assistant/`.

MCP stdio runs on the Grok Bot or Cursor computer. It does not run on Home Assistant. This plugin calls HA REST from that computer, so you do not need HA's native `/api/mcp` integration.

- `GET /api/`
- `GET /api/states`
- `GET /api/states/{entity_id}`
- `POST /api/services/{domain}/{service}`

## Reachability

The stdio server is a local `node` process on the Grok Bot or Cursor machine. `HA_URL` has to be reachable from **that** computer.

| `HA_URL` | Use it when |
| --- | --- |
| Tailscale MagicDNS, such as `http://homeassistant:8123` | Best default. Works as long as that computer is on the tailnet. |
| Nabu Casa or another public HTTPS URL | Fine. The computer only needs outbound HTTPS. |
| LAN-only IP (`192.168.x.x`, `10.x.x.x`, `172.16.x.x`–`172.31.x.x`) | Fails unless that computer is on the same LAN. Grok Bot cloud computers are not. |

## Install-time variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `HA_URL` | yes | Base URL, no trailing slash, reachable from the Grok Bot or Cursor computer. Prefer MagicDNS `http://homeassistant:8123`. |
| `HA_TOKEN` | yes | Long-lived access token from Home Assistant, Profile, Security. |

The plugin never stores those values in the repo. `mcp.json` only has `${HA_URL}` and `${HA_TOKEN}` placeholders. After install, set them under Plugins, Configure (Cursor) or the matching Grok plugin config.

Create the token in the HA UI. Do not paste it into chat.

## Tools

| Tool | REST | Notes |
| --- | --- | --- |
| `ha_ping` | `GET /api/` | Connectivity check. On failure, the likely cause is `HA_URL` not reachable from the Grok Bot/Cursor computer. |
| `ha_list_states` | `GET /api/states` | Requires `domain` or `prefix`. Default 50 results, hard cap 100 |
| `ha_get_state` | `GET /api/states/{id}` | One entity |
| `ha_toggle` | `POST /api/services/{domain}/toggle` | **Human must confirm first** |
| `ha_call_service` | `POST /api/services/{domain}/{service}` | **Human must confirm first** |

`ha_toggle` and `ha_call_service` are implemented. The bundled skill and this README require the agent to stop and get an explicit confirmation of the entity and action before calling them. "Check the lights" is not permission to toggle.

## Run locally

Needs Node 20+.

```bash
cd home-assistant
npm install
npm test
npm run build
```

Unit tests mock HTTP. They do not need a live Home Assistant. If `HA_URL` and `HA_TOKEN` are already in the environment, `tests/live.test.ts` runs `GET /api/` against that instance. Otherwise that test is skipped. Do not put a token in the repo.

Stdio MCP after a build. This process is the MCP server. Home Assistant is only the REST target:

```bash
export HA_URL=http://homeassistant:8123
export HA_TOKEN=your-long-lived-token
node bin/server.mjs
```

Point a local MCP client at the same command. In this repo that is `mcp.json`, with `${PLUGIN_ROOT}` expanded to this directory:

```json
{
  "mcpServers": {
    "home-assistant": {
      "type": "stdio",
      "command": "node",
      "args": ["${PLUGIN_ROOT}/bin/server.mjs"],
      "env": {
        "HA_URL": "${HA_URL}",
        "HA_TOKEN": "${HA_TOKEN}"
      }
    }
  }
}
```

## Layout

```
.cursor-plugin/plugin.json   Cursor manifest, including HA_URL and HA_TOKEN
mcp.json                     stdio MCP server
skills/home-assistant/       agent skill (confirm writes, filter lists, reachability)
src/                         REST client and MCP registration
bin/server.mjs               bundled stdio server (npm run build)
tests/                       mocked unit tests plus optional live ping
assets/logo.svg
```

## Publish to Cursor marketplace

The GitHub repo name is `grokbot-home-assistant`, not `home-assistant`. Plugin `name` stays `home-assistant`. Marketplace submission needs that repo to be public.

1. Host this directory at [gokivego/grokbot-home-assistant](https://github.com/gokivego/grokbot-home-assistant) so `.cursor-plugin/plugin.json` is at the repo root.
2. Confirm plugin `name` is `home-assistant`, `repository` is `https://github.com/gokivego/grokbot-home-assistant`, logo is `assets/logo.svg`, and both variables are declared.
3. After the repo is public, submit `https://github.com/gokivego/grokbot-home-assistant` at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish).

Docs used while building: [Cursor plugins](https://cursor.com/docs/reference/plugins), [Home Assistant REST](https://developers.home-assistant.io/docs/api/rest).

MIT. Author: Venkat Gokul Reddy Palampally.

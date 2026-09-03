# Home Assistant plugin log

## [2026-09-02] Pagination truncated flag and plugin polish

- Last page of `ha_list_states` now reports `truncated: false`; GET requests omit Content-Type; entity_id Zod regex on get/toggle/call_service; `ha_list_services` defers empty-domain to `requireSlug`; network-error test; README notes Cursor/Grok Bot expands `${PLUGIN_ROOT}` at install.

## [2026-09-02] Friendly-name search, offset, service discovery, token docs

- `ha_list_states` accepts `q` (entity_id / friendly_name substring) and `offset`; `ha_list_services` lists one domain; README documents Node 20+ on the MCP host and 2026 HA long-lived token UI; `.local` is LAN/mDNS only.


## [2026-09-02] GitHub repo is grokbot-home-assistant

- Plugin `name` stays `home-assistant`. Public git repo is `https://github.com/gokivego/grokbot-home-assistant`.
- Set `repository` and `homepage` in `.cursor-plugin/plugin.json` to that URL. Local workspace folder is still `home-assistant/`.

## [2026-09-02] Marketplace copy: MCP host vs HA_URL

- Reachability copy: MCP runs on the Grok Bot/Cursor computer. Best is Tailscale MagicDNS (`http://homeassistant:8123`); Nabu Casa or public HTTPS is fine; LAN-only IPs fail unless that computer is on the LAN (Grok Bot cloud computers are not). On `ha_ping` failure the skill tells the human this is the likely cause. House Tailscale IP removed. Private GitHub repo name is `gokivego/grokbot-home-assistant`.
- Install-time `HA_URL` text now states MCP stdio runs on the Grok Bot or Cursor computer, not on Home Assistant.
- Preferred URL is Tailscale MagicDNS such as `http://homeassistant:8123`. Nabu Casa or another public HTTPS URL is also fine. LAN-only IPs fail unless that computer is on the LAN.
- Cleared a real token from `.env.example` so the marketplace tree has no secrets. Use a gitignored `.env` for live tests.

## [2026-09-02] Initial Cursor plugin

- New project: Cursor-format plugin (`name=home-assistant`, MIT, author Venkat Gokul Reddy Palampally) that wraps Home Assistant REST instead of `/api/mcp`.
- Install-time variables `HA_URL` and `HA_TOKEN`. `HA_URL` is a base URL with no trailing slash. Secrets stay out of the repo; `mcp.json` only has placeholders.
- Tools: `ha_ping`, `ha_list_states` (domain or prefix required, results capped), `ha_get_state`, `ha_toggle`, `ha_call_service`. Skill and README require a human confirm before the two write tools.
- MCP is stdio on the Cursor/Grok machine. Reach HA via Tailscale MagicDNS, LAN, or Nabu Casa. Example `http://homeassistant:8123`. This house: hostname `homeassistant`, generic MagicDNS such as `http://homeassistant:8123`. Not hardcoded as the only URL.
- Tests mock HTTP and pass without a live instance. `tests/live.test.ts` skips unless both env vars are set.

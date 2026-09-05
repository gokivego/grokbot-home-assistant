# Home Assistant plugin log

## [2026-09-05] Cursor Marketplace application submitted

- `gokivego/grokbot-home-assistant` is public. `.env` is not in the repo (raw GitHub 404).
- Submitted `home-assistant` at `POST /api/marketplace/publish-application` (`{"ok":true}`). Contact `gokivego@gmail.com`. Cursor reviews by hand; follow-up goes to that inbox and marketplace-publishing@cursor.com.
- Listing is not live until Cursor approves it. Grok Bot Plugins will not show it before then.

## [2026-09-05] Secret scan and marketplace copy

- Tracked tree and git history of `gokivego/grokbot-home-assistant` have no Home Assistant JWT, no nonempty `HA_TOKEN=`, and no house Tailscale IP. Local `.env` holds a live token and stays gitignored.
- README and plugin description now say unofficial / not affiliated, plus a privacy section: no analytics, token stays on the MCP host, REST only to the user-supplied `HA_URL`.

## [2026-09-05] Publish path: plugin, not a new Bot

- Grok Bot approval is Cursor Marketplace (`cursor.com/marketplace/publish`), not a Home Assistant Bot template and not a PR to `xai-org/plugin-marketplace` (that catalog is Grok Build).
- `gokivego/grokbot-home-assistant` exists and is still private. Submit needs it public.
- A plugin is account-wide. Installing it does not create a Bot. A shared Bot does not install the plugin or copy tokens.

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
## [2026-09-03] Workspace subtree
- Integrated into ~/gokivego as a git subtree. Upstream remote grokbot-home-assistant stays private. Nested .git removed.

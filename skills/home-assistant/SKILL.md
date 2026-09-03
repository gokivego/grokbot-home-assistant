---
name: home-assistant
description: use this when the user wants to query Home Assistant entity states or call Home Assistant services such as lights, switches, covers, climate, or scenes.
---

# Home Assistant

Talk to a Home Assistant instance through this plugin's MCP tools. The tools wrap the REST API (`GET /api/`, `GET /api/states`, `GET /api/states/{entity_id}`, `GET /api/services`, `POST /api/services/{domain}/{service}`). Do not use Home Assistant's native `/api/mcp` endpoint. That needs a separate HA integration this plugin does not install.

MCP stdio runs on the Grok Bot or Cursor computer, not on Home Assistant. Users set `HA_URL` and `HA_TOKEN` at plugin install. Never invent, print, or store the token.

## Reachability

`HA_URL` must be reachable from that computer, not merely from a phone, browser, or the HA box itself.

- **Best:** Tailscale MagicDNS, for example `http://homeassistant:8123`, when the Grok Bot or Cursor computer is on the tailnet.
- **Also fine:** Nabu Casa or another public HTTPS URL.
- **Fails:** A LAN-only IP fails unless that computer is on the LAN (`192.168.x.x`, `10.x.x.x`, `172.16.x.x`–`172.31.x.x`). Grok Bot cloud computers are not on the house LAN.

If Cursor is on the same home LAN, `http://homeassistant.local:8123` can work via mDNS. That is a LAN example only. Grok Bot cloud computers will not resolve `.local`.

If `ha_ping` fails, the likely cause is this mismatch. Tell the human: the MCP runs on the Grok Bot/Cursor computer, so `HA_URL` must be MagicDNS, Nabu Casa, or another URL that computer can open. A LAN IP only works if that computer is on the same LAN.

## When to use

- "Is the kitchen light on?"
- "List climate entities"
- "What is sensor.outdoor_temperature?"
- After the human confirms, toggle or call a service

## Read first

1. If connectivity is in doubt, call `ha_ping`.
2. To find entities, call `ha_list_states` with a `domain` (`light`, `switch`, `sensor`), an `entity_id` `prefix` (`light.kitchen`, `sensor.weather`), and/or `q` (case-insensitive substring of `entity_id` or `friendly_name`, for example `domain=light` and `q=bedroom`). Unfiltered dumps are rejected. Results are capped (default 50, max 100) and pageable with `offset`. If `truncated` is true, narrow the filter or raise `offset`.
3. For one entity, call `ha_get_state` with the full `entity_id` (`domain.object_id`).
4. Before guessing `ha_call_service` fields, call `ha_list_services` with the domain (`light`, `climate`) to see service names and field names such as `brightness` vs `brightness_pct`. Domain is required; never dump every domain.

## Confirm before any write

`ha_toggle` and `ha_call_service` change the house. Do not call them until the human explicitly confirms the target and the action in this conversation.

Before you call either tool, say the `entity_id`, the service (`toggle`, `turn_on`, `turn_off`, and so on), and the expected effect, then wait. If they have not confirmed, ask. Do not treat "check the lights" as permission to toggle.

After a confirmed write, read the entity back with `ha_get_state` when you need to report the new state.

## Do not

- Call `ha_list_states` without `domain`, `prefix`, or `q`
- Call `ha_list_services` without a domain
- Guess `HA_URL`. If `ha_ping` fails, the likely cause is that the Grok Bot or Cursor computer cannot reach that URL. Ask for MagicDNS (`http://homeassistant:8123`), Nabu Casa, or another public HTTPS URL. Do not suggest a LAN-only IP unless this computer is on that LAN.
- Treat Home Assistant as the MCP host. It is not. Stdio runs here and calls HA REST.
- Print `HA_TOKEN` or put it in a command line the user will paste around
- Point tools at `/api/mcp`

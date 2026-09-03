import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { HomeAssistantClient, MAX_STATE_LIMIT } from "./client.ts";
import { ConfigError, loadConfig } from "./config.ts";
import { createToolHandlers } from "./tools.ts";

export const SERVER_NAME = "home-assistant";
export const SERVER_VERSION = "1.0.0";

const CONFIRM_TOGGLE =
  "Ask the human to confirm the entity_id and that they want it toggled before calling this tool.";
const CONFIRM_SERVICE =
  "Ask the human to confirm domain, service, target entity, and expected effect before calling this tool.";

export function createServer(client: HomeAssistantClient): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
  const tools = createToolHandlers(client);

  server.registerTool(
    "ha_ping",
    {
      description:
        "Check that HA_URL is reachable from this computer (GET /api/). MCP stdio runs here, not on Home Assistant.",
    },
    async () => tools.ha_ping(),
  );

  server.registerTool(
    "ha_list_states",
    {
      description:
        "List Home Assistant states (GET /api/states). Requires domain or prefix. Results are capped; do not request an unfiltered dump.",
      inputSchema: {
        domain: z
          .string()
          .optional()
          .describe("Entity domain such as light, switch, or sensor."),
        prefix: z
          .string()
          .optional()
          .describe("entity_id prefix such as light.kitchen or sensor.weather."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_STATE_LIMIT)
          .optional()
          .describe(`Max entities to return. Default 50, hard cap ${MAX_STATE_LIMIT}.`),
      },
    },
    async (input) => tools.ha_list_states(input),
  );

  server.registerTool(
    "ha_get_state",
    {
      description: "Get one entity state (GET /api/states/{entity_id}).",
      inputSchema: {
        entity_id: z.string().describe("Entity id such as light.kitchen."),
      },
    },
    async (input) => tools.ha_get_state(input),
  );

  server.registerTool(
    "ha_toggle",
    {
      description: `Toggle an entity (POST /api/services/{domain}/toggle). ${CONFIRM_TOGGLE}`,
      inputSchema: {
        entity_id: z.string().describe("Entity id to toggle, such as switch.porch."),
      },
    },
    async (input) => tools.ha_toggle(input),
  );

  server.registerTool(
    "ha_call_service",
    {
      description: `Call a Home Assistant service (POST /api/services/{domain}/{service}). ${CONFIRM_SERVICE}`,
      inputSchema: {
        domain: z.string().describe("Service domain such as light or climate."),
        service: z.string().describe("Service name such as turn_on or set_temperature."),
        entity_id: z.string().optional().describe("Optional target entity_id."),
        data: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Optional service data merged with entity_id."),
      },
    },
    async (input) => tools.ha_call_service(input),
  );

  return server;
}

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  let client: HomeAssistantClient;
  try {
    client = new HomeAssistantClient(loadConfig(env));
  } catch (error) {
    const message = error instanceof ConfigError ? error.message : String(error);
    console.error(`home-assistant MCP: ${message}`);
    process.exitCode = 1;
    return;
  }

  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`home-assistant MCP ${SERVER_VERSION} talking to ${client.baseUrl} over REST`);
}

const entry = process.argv[1];
if (entry && (entry.endsWith("index.ts") || entry.endsWith("server.mjs") || entry.endsWith("index.js"))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

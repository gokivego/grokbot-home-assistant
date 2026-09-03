import {
  HomeAssistantApiError,
  redactSecrets,
  type HomeAssistantClient,
  type ListStatesFilter,
} from "./client.ts";

export type ToolTextResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export type CallServiceInput = {
  domain: string;
  service: string;
  entity_id?: string;
  data?: Record<string, unknown>;
};

export function jsonResult(value: unknown, isError = false): ToolTextResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

export function errorResult(error: unknown): ToolTextResult {
  const message = redactSecrets(error instanceof Error ? error.message : String(error));
  const payload: Record<string, unknown> = { error: message };
  if (error instanceof HomeAssistantApiError) {
    payload.status = error.status;
    payload.path = error.path;
  }
  return jsonResult(payload, true);
}

export function createToolHandlers(client: HomeAssistantClient) {
  return {
    async ha_ping(): Promise<ToolTextResult> {
      try {
        const body = await client.ping();
        return jsonResult({ ok: true, base_url: client.baseUrl, ha: body });
      } catch (error) {
        return errorResult(error);
      }
    },

    async ha_list_states(input: ListStatesFilter): Promise<ToolTextResult> {
      try {
        return jsonResult(await client.listStates(input));
      } catch (error) {
        return errorResult(error);
      }
    },

    async ha_get_state(input: { entity_id: string }): Promise<ToolTextResult> {
      try {
        return jsonResult(await client.getState(input.entity_id));
      } catch (error) {
        return errorResult(error);
      }
    },

    async ha_toggle(input: { entity_id: string }): Promise<ToolTextResult> {
      try {
        return jsonResult({
          confirmed_action: "toggle",
          entity_id: input.entity_id,
          result: await client.toggle(input.entity_id),
        });
      } catch (error) {
        return errorResult(error);
      }
    },

    async ha_call_service(input: CallServiceInput): Promise<ToolTextResult> {
      try {
        const data: Record<string, unknown> = { ...(input.data ?? {}) };
        if (input.entity_id) {
          data.entity_id = input.entity_id;
        }
        return jsonResult({
          confirmed_action: "call_service",
          domain: input.domain,
          service: input.service,
          data,
          result: await client.callService(input.domain, input.service, data),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  };
}

export type ToolHandlers = ReturnType<typeof createToolHandlers>;

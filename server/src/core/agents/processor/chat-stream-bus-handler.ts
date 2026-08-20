/**
 * Chat Stream Bus Handler
 * Handles SessionBus events during streaming: accumulates sub-agent data
 * and forwards events to the AI SDK stream writer.
 * Extracted from chat-processor.ts for modularity.
 */

import logger from "@/lib/logger";
import type { SessionEvent } from "@/session/bus";
import type { SubAgentAccumulated } from "../types/chat";

/**
 * Create a bus event handler that accumulates sub-agent data and
 * forwards events to the stream writer.
 *
 * @param writer - The AI SDK stream writer (untyped to accept custom data types)
 * @param subAgentAccumulator - Map to accumulate sub-agent session data for persistence
 * @returns Event handler callback for bus.subscribeAll()
 */
export function createBusStreamHandler(
  writer: any,
  subAgentAccumulator: Map<string, SubAgentAccumulated> | undefined,
): (event: SessionEvent) => void {
  return (event: SessionEvent) => {
    // Accumulate sub-agent data for persistence (if accumulator provided)
    if (subAgentAccumulator) {
      accumulateSubAgentData(subAgentAccumulator, event);
    }

    // Forward events to the stream writer
    forwardEventToStream(writer, event);
  };
}

/**
 * Accumulate sub-agent data from bus events into the accumulator map.
 * @param accumulator - Map to store accumulated data per session
 * @param event - The session bus event
 */
function accumulateSubAgentData(
  accumulator: Map<string, SubAgentAccumulated>,
  event: SessionEvent,
): void {
  switch (event.type) {
    case "session.created": {
      accumulator.set(event.sessionID, {
        agentName: event.agentName,
        sessionId: event.sessionID,
        parentSessionId: event.parentSessionID ?? "",
        assistantId: event.data["assistant_id"] as string | undefined,
        text: "",
        toolCalls: [],
        status: "streaming",
        startedAt: Date.now(),
      });
      break;
    }
    case "message.text-delta": {
      const acc = accumulator.get(event.sessionID);
      if (acc) acc.text += (event.data["text"] as string) || "";
      break;
    }
    case "message.tool-call": {
      const acc = accumulator.get(event.sessionID);
      if (acc) {
        acc.toolCalls.push({
          toolName: event.data["toolName"] as string,
          toolCallId: event.data["toolCallId"] as string,
        });
      }
      break;
    }
    case "message.tool-result": {
      const acc = accumulator.get(event.sessionID);
      if (acc) {
        const tc = acc.toolCalls.find(
          (t) => t.toolCallId === event.data["toolCallId"],
        );
        if (tc) tc.result = event.data["result"];
      }
      break;
    }
    case "session.completed": {
      const acc = accumulator.get(event.sessionID);
      if (acc) {
        acc.status = "completed";
        acc.endedAt = Date.now();
      }
      break;
    }
    case "session.error": {
      const acc = accumulator.get(event.sessionID);
      if (acc) {
        acc.status = "error";
        acc.endedAt = Date.now();
        acc.error = event.data["error"] as string;
      }
      break;
    }
  }
}

/**
 * Forward a session bus event to the AI SDK stream writer.
 * AI SDK v5 custom data types use z.strictObject() which only allows:
 *   { type: "data-*", id?: string, data: unknown, transient?: boolean }
 * All custom fields go inside the `data` property.
 * transient: true prevents AI SDK from adding these to message.parts.
 *
 * @param writer - The AI SDK stream writer
 * @param event - The session bus event
 */
function forwardEventToStream(writer: any, event: SessionEvent): void {
  try {
    switch (event.type) {
      case "session.created":
        writer.write({
          type: "data-sub-agent-start",
          transient: true,
          data: {
            agent_name: event.agentName,
            session_id: event.sessionID,
            parent_session_id: event.parentSessionID,
            assistant_id: event.data["assistant_id"],
          },
        });
        break;
      case "message.text-delta":
        writer.write({
          type: "data-sub-agent-text-delta",
          transient: true,
          data: {
            agent_name: event.agentName,
            session_id: event.sessionID,
            text: event.data["text"],
          },
        });
        break;
      case "message.tool-call":
        writer.write({
          type: "data-sub-agent-tool-call",
          transient: true,
          data: {
            agent_name: event.agentName,
            session_id: event.sessionID,
            tool_name: event.data["toolName"],
            tool_call_id: event.data["toolCallId"],
          },
        });
        break;
      case "message.tool-result":
        writer.write({
          type: "data-sub-agent-tool-result",
          transient: true,
          data: {
            agent_name: event.agentName,
            session_id: event.sessionID,
            tool_name: event.data["toolName"],
            tool_call_id: event.data["toolCallId"],
          },
        });
        break;
      case "session.completed":
        writer.write({
          type: "data-sub-agent-end",
          transient: true,
          data: {
            agent_name: event.agentName,
            session_id: event.sessionID,
            success: true,
          },
        });
        break;
      case "session.error":
        writer.write({
          type: "data-sub-agent-end",
          transient: true,
          data: {
            agent_name: event.agentName,
            session_id: event.sessionID,
            success: false,
            error: event.data["error"],
          },
        });
        break;
      case "artifact.data":
        // Passthrough artifact events (data-kind, data-id, data-title, etc.)
        // from sub-agent createDocument/updateDocument to the SSE client
        writer.write(event.data["payload"]);
        break;
      case "flow-editor.open":
        // Forward as sub-agent event so the stream interceptor picks it up
        writer.write({
          type: "data-sub-agent-flow-editor-open",
          transient: true,
          data: {
            flow_id: event.data["flowId"],
            message: event.data["message"],
            agent_name: event.agentName,
            session_id: event.sessionID,
          },
        });
        break;
      default:
        break;
    }
  } catch (err) {
    logger.warn("Failed to write sub-agent event to stream", {
      eventType: event.type,
      error: String(err),
    });
  }
}

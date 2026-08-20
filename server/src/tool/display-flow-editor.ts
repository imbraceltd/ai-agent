/**
 * Display Flow Editor Tool
 *
 * Native tool for the Workflow Developer sub-agent.
 * Publishes a bus event that gets forwarded as a sub-agent SSE event,
 * which the client's stream interceptor picks up to open an iframe panel.
 */

import { tool } from "ai";
import z from "zod/v4";
import logger from "@/lib/logger";
import type { SessionBus } from "@/session/bus";

interface DisplayFlowEditorProps {
  bus: SessionBus;
  sessionID: string;
  agentName: string;
}

/**
 * Create the display_flow_editor tool.
 * @param props - bus, sessionID, agentName for publishing the event
 * @returns AI SDK tool definition
 */
export const displayFlowEditor = ({ bus, sessionID, agentName }: DisplayFlowEditorProps) =>
  tool({
    description:
      "Display the ActivePieces flow editor in an embedded iframe so the user can manually configure connections, edit steps, or review the flow. Call this when a piece step requires an auth connection that doesn't exist (list_connections returned no match).",
    inputSchema: z.object({
      flow_id: z.string().describe("The flow ID to open in the AP editor"),
      message: z
        .string()
        .optional()
        .describe(
          "Instructions to show the user above the iframe, e.g. which steps need connection configuration",
        ),
    }),
    execute: async ({ flow_id, message }) => {
      logger.info("display_flow_editor: publishing flow-editor.open event", {
        flowId: flow_id,
        sessionID,
        agentName,
      });

      bus.publish({
        sessionID,
        agentName,
        type: "flow-editor.open",
        data: {
          flowId: flow_id,
          message: message || "Please configure the required connections in the flow editor.",
        },
        timestamp: Date.now(),
      });

      return `Flow editor displayed for flow ${flow_id}. The user can now see and edit the flow. Wait for the user to confirm they have finished configuring connections before proceeding with verify_flow and publishing.`;
    },
  });

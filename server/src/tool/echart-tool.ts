import { tool } from "ai";
import { z } from "zod";
import axios from "axios";
import logger from "@/lib/logger";
import { getToolContext } from "@/core/agents/tool/toolContext";
import config from "@/config";

export const echartTool = tool({
  description: `Draw an EChart visualization based on actual data. The chart is rendered directly in the user's chat interface — they can see it immediately.

IMPORTANT RULES:
- Only call this tool ONCE per user request — create exactly ONE chart that directly answers the user's question.
- Do NOT create multiple charts for a single question.
- If you already called this tool for the current question, do NOT call it again.
- After calling this tool, describe the chart insights in plain language. Do NOT include any code (Python, JavaScript, etc.) to recreate the chart — the user already sees it rendered in the UI.

## Workflow
1. Call duckdb_query first to get the data
2. Use the \`rows_json\` field from the duckdb_query response as \`file_content\` — it is already a JSON array, no conversion needed
3. Generate echart_config yourself from the data (PREFERRED — skips extra LLM call)
4. Call this tool with both file_content and echart_config

## echart_config generation
YOU MUST generate the echart_config yourself as a valid Apache ECharts JSON configuration object.
This is the PREFERRED and FASTEST path — the chart config is saved directly without any extra LLM call.

CRITICAL:
- echart_config MUST be a valid Apache ECharts JSON string. YOU generate it from the data.
- echart_config must contain ONLY valid JSON — NO JavaScript functions, NO comments.
- For conditional coloring, use itemStyle objects in the data array.
- Tooltip formatter: ECharts ONLY supports template tokens {a}, {b}, {c}, {d} (optionally suffixed with a digit for series index: {a0}, {c1}, etc.). Array index syntax like {c[0]} or {c[1]} is INVALID and will render as literal text in the UI.
- For multi-series tooltips, PREFER omitting the formatter entirely and just set {"trigger": "axis"} — ECharts will auto-render a correct multi-series tooltip. Only provide a custom formatter when necessary, and use "{a0}: {c0}<br/>{a1}: {c1}" style (digit directly after the letter, NO brackets).
- Multi-series scale mismatch: If you generate 2+ bar/line series whose value ranges differ by 10x or more (e.g. counts ~50 vs currency ~2,000,000), you MUST use dual Y-axes. Set \`yAxis\` to an array of two axis objects and set \`yAxisIndex: 0/1\` on each series accordingly. Otherwise the smaller-scale series becomes invisible because the single axis auto-scales to the larger series.

How to generate echart_config:
- Analyze the data structure in file_content
- Choose the best chart type: bar, line, pie, scatter, etc.
- Build a complete ECharts option object with: title, tooltip, xAxis/yAxis (or equivalent), series
- The title.text MUST be short and concise (max 6 words). Use labels like "Microsoft 2025 Financials" instead of full sentences like "Bar chart comparing Microsoft's 2025 Revenue, Net Income, and Operating Income"
- Pass it as a JSON string in echart_config

Example — given file_content: [{"month":"Jan","value":100},{"month":"Feb","value":200}]
You should generate echart_config:
{
  "title": {"text": "Monthly Values"},
  "tooltip": {"trigger": "axis"},
  "xAxis": {"type": "category", "data": ["Jan", "Feb"]},
  "yAxis": {"type": "value"},
  "series": [{"type": "bar", "data": [100, 200], "itemStyle": {"color": "#5470C6"}}]
}

Dual Y-axis example (counts vs currency — scales differ by 10x+):
{
  "title": {"text": "Overdue Documents"},
  "tooltip": {"trigger": "axis"},
  "legend": {"data": ["Overdue Count", "Total Value ($)"]},
  "xAxis": {"type": "category", "data": ["Invoice", "Purchase Order"]},
  "yAxis": [
    {"type": "value", "name": "Count", "position": "left"},
    {"type": "value", "name": "Value ($)", "position": "right"}
  ],
  "series": [
    {"name": "Overdue Count", "type": "bar", "yAxisIndex": 0, "data": [51, 49]},
    {"name": "Total Value ($)", "type": "bar", "yAxisIndex": 1, "data": [2224600, 2245550]}
  ]
}

## Chart Type Guide
- **Bar chart**: distributions, comparisons, counts by category
- **Line chart**: trends over time, date-based series
- **Pie chart**: proportions (use only if < 7 categories)
- **Sankey diagram**: flows between categories, multi-stage processes

## INVALID file_content — NEVER pass these
- A SQL query string (e.g. 'SELECT * FROM table')
- The formatted text from duckdb_query \`result\` field (that is for reading, not for charts)
- Raw JSON config objects`,
  inputSchema: z.object({
    tool_title: z
      .string()
      .describe(
        "User-facing title explaining what you are doing with this Echart operation",
      ),
    question: z.string().describe("User question or instruction for the chart"),
    file_content: z
      .string()
      .describe(
        "Actual data in JSON array format. Must NOT be a SQL query. Should be the result/output from a database query.",
      ),
    echart_config: z
      .string()
      .optional()
      .default("")
      .describe(
        "A valid Apache ECharts JSON configuration string that YOU generate from file_content. This is the PREFERRED approach — when provided, the chart is saved directly without any extra LLM generation call, making it faster and more reliable.",
      ),
  }),
  execute: async ({ tool_title, question, file_content, echart_config }) => {
    try {
      logger.info("Executing Echart tool", {
        tool_title,
        question,
        hasEchartConfig: Boolean(echart_config),
      });

      // Validate that file_content is not a SQL query
      const trimmedContent = file_content.trim().toUpperCase();
      if (
        trimmedContent.startsWith("SELECT ") ||
        trimmedContent.includes('FROM "HTTP') ||
        /^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s/i.test(
          file_content.trim(),
        )
      ) {
        logger.error("Echart tool received SQL query instead of data", {
          file_content: file_content.substring(0, 200),
        });
        return {
          status: "error",
          error:
            "Invalid input: file_content must contain actual data, not a SQL query. Please execute the query using duckdbTool first, then pass the results to echartTool.",
        };
      }

      const toolContext = getToolContext();
      const threadId = toolContext.thread_id;
      if (!threadId) {
        logger.error("Echart tool missing thread_id in tool context");
        return {
          status: "error",
          error: "thread_id is missing from tool context",
        };
      }

      // Validate echart_config if provided
      let parsedEchartConfig: Record<string, unknown> | undefined;
      if (echart_config) {
        try {
          parsedEchartConfig = JSON.parse(echart_config);
          if (
            typeof parsedEchartConfig !== "object" ||
            parsedEchartConfig === null
          ) {
            logger.warn(
              "echart_config is not a valid object, falling back to API generation",
            );
            parsedEchartConfig = undefined;
          }
        } catch {
          logger.warn(
            "echart_config JSON parse failed, falling back to API generation",
          );
          parsedEchartConfig = undefined;
        }
      }

      logger.info("Executing Echart local tool", {
        questionSnippet: question.slice(0, 50),
        thread_id: threadId,
        file_content,
        mode: parsedEchartConfig ? "agent-generated" : "api-generated",
      });

      const apiUrl = config.aiv2Internal.url;
      const url = `${apiUrl}/api/v1/agent/echart`;
      const response = await axios.post(
        url,
        {
          question,
          file_content,
          thread_id: threadId,
          // Reason: When echart_config is provided, the API skips LLM generation
          // and saves the config directly — faster and more reliable.
          ...(parsedEchartConfig && { echart_config: parsedEchartConfig }),
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-organization-id": toolContext.organization_id || "",
          },
        },
      );

      // Return the API response as-is
      return response.data;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      logger.error("Echart tool execution failed", {
        error: message,
      });

      return {
        status: "error",
        error: message,
      };
    }
  },
});

export default echartTool;

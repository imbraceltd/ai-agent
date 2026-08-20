import { Request, Response } from "express";
import logger from "@/lib/logger";
import config from "@/config";

const GRAFANA_URL = config.grafana.url;

/**
 * GET /api/trace/traces - Get traces from Tempo
 */
export async function getTraces(req: Request, res: Response): Promise<void> {
  try {
    const serviceName =
      (req.query["service"] as string) || "message-suggestion-service";
    const limit = (req.query["limit"] as string) || "50";
    const timeRange = (req.query["timeRange"] as string) || "86400"; // default 1 day
    const orgId = req.query["orgId"] as string | undefined;

    const end = Math.floor(Date.now() / 1000);
    const start = end - parseInt(timeRange);

    // Build TraceQL query
    let query = `{.service.name="${serviceName}"}`;
    if (orgId) {
      query = `{.service.name="${serviceName}" && .ai.telemetry.metadata.organizationId="${orgId}"}`;
    }

    const tempoUrl = `${GRAFANA_URL}/api/search?q=${encodeURIComponent(query)}&start=${start}&end=${end}&limit=${limit}`;

    logger.debug("Fetching traces from Tempo:", { url: tempoUrl, query });

    const response = await fetch(tempoUrl);

    // Check if response is OK
    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Tempo API error:", {
        status: response.status,
        error: errorText,
      });
      res.status(response.status).json({
        error: "Tempo API error",
        message: errorText,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Try to parse JSON, handle non-JSON responses
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      logger.error("Failed to parse Tempo response:", { response: text });
      res.status(500).json({
        error: "Invalid response from Tempo",
        message: text,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Enrich with full trace details if requested
    if (req.query["details"] === "true" && data.traces?.length > 0) {
      const enrichedTraces = await Promise.all(
        data.traces.map(async (trace: any) => {
          try {
            const traceResponse = await fetch(
              `${GRAFANA_URL}/api/traces/${trace.traceID}`,
            );
            const traceDetails = await traceResponse.json();
            return { ...trace, details: traceDetails };
          } catch {
            return trace;
          }
        }),
      );

      res.json({
        traces: enrichedTraces,
        metrics: data.metrics,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.json({
        traces: data.traces || [],
        metrics: data.metrics || {},
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error("Error fetching traces:", error);
    res.status(500).json({
      error: "Failed to fetch traces",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * GET /api/trace/traces/:traceId - Get a specific trace by ID
 */
export async function getTraceById(req: Request, res: Response): Promise<void> {
  try {
    const { traceId } = req.params;
    const format = (req.query["format"] as string) || "json"; // Support different formats
    const includeSpanMetrics = req.query["spanMetrics"] === "true";

    // Build URL with potential query parameters for full content
    let tempoUrl = `${GRAFANA_URL}/api/traces/${traceId}`;
    const queryParams = new URLSearchParams();

    if (format !== "json") {
      queryParams.append("format", format);
    }
    if (includeSpanMetrics) {
      queryParams.append("spanMetrics", "true");
    }

    if (queryParams.toString()) {
      tempoUrl += `?${queryParams.toString()}`;
    }

    logger.debug("Fetching trace details from Tempo:", {
      traceId,
      url: tempoUrl,
      format,
      includeSpanMetrics,
    });

    // Add headers that might help with getting full content
    const response = await fetch(tempoUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        // Some APIs respect these headers for larger responses
        "X-Request-Full-Content": "true",
        "Cache-Control": "no-cache",
      },
    });

    // Check if response is OK
    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Tempo trace API error:", {
        traceId,
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: tempoUrl,
      });
      res.status(response.status).json({
        error: "Tempo trace API error",
        message: errorText,
        traceId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Get response as text first to handle large content and debug truncation
    const text = await response.text();
    logger.debug("Trace response size:", {
      traceId,
      responseSize: text.length,
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
    });

    // Try to parse JSON, handle non-JSON responses
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      logger.error("Failed to parse Tempo trace response:", {
        traceId,
        response: text.substring(0, 1000), // Log first 1KB for debugging
        parseError:
          parseError instanceof Error ? parseError.message : String(parseError),
      });
      res.status(500).json({
        error: "Invalid response from Tempo",
        message: "Failed to parse trace data",
        traceId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Log trace statistics for debugging
    if (data && data.batches) {
      const totalSpans = data.batches.reduce(
        (acc: number, batch: any) => acc + (batch.spans?.length || 0),
        0,
      );
      logger.debug("Trace details:", {
        traceId,
        batchCount: data.batches.length,
        totalSpans,
        hasSpans: totalSpans > 0,
      });

      // Check for potential truncation indicators
      const largeSpans = data.batches.flatMap(
        (batch: any) =>
          batch.spans?.filter((span: any) => {
            const spanSize = JSON.stringify(span).length;
            return spanSize > 50000; // Spans larger than 50KB
          }) || [],
      );

      if (largeSpans.length > 0) {
        logger.warn("Large spans detected that might be truncated:", {
          traceId,
          largeSpanCount: largeSpans.length,
          largeSpanIds: largeSpans.map(
            (span: any) => span.spanId || span.span_id,
          ),
        });
      }
    }

    res.json({
      trace: data,
      metadata: {
        traceId,
        responseSize: text.length,
        contentType: response.headers.get("content-type"),
        contentLength: response.headers.get("content-length"),
        format,
        includeSpanMetrics,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching trace:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      error: "Failed to fetch trace",
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/trace/services - Get available services
 */
export async function getServices(_req: Request, res: Response): Promise<void> {
  try {
    const response = await fetch(
      `${GRAFANA_URL}/api/search/tag/service.name/values`,
    );
    const data = await response.json();

    res.json({
      services: data.tagValues || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching services:", error);
    res.status(500).json({
      error: "Failed to fetch services",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * GET /api/trace/tags - Get all available span tags
 */
export async function getTags(req: Request, res: Response): Promise<void> {
  try {
    const timeRange = (req.query["timeRange"] as string) || "86400"; // default 24 hours
    const end = Math.floor(Date.now() / 1000);
    const start = end - parseInt(timeRange);

    // Use v2 API with time range to get actual tags from stored traces
    const response = await fetch(
      `${GRAFANA_URL}/api/v2/search/tags?start=${start}&end=${end}`,
    );
    const data = await response.json();

    // v2 API returns scopes with tags, flatten span-level tags and filter
    const allTags: string[] = [];

    if (data.scopes) {
      for (const scope of data.scopes) {
        if (scope.name === "span" && scope.tags) {
          // Add span-level tags (these are the ai.* tags we want)
          allTags.push(...scope.tags);
        }
      }
    }

    // Filter to common/useful span tags
    const filteredTags = allTags
      .filter(
        (tag: string) =>
          !tag.startsWith("k6.") &&
          tag !== "ai.telemetry.metadata.organizationId",
      )
      .sort();

    res.json({
      tags: filteredTags,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching tags:", error);
    res.status(500).json({
      error: "Failed to fetch tags",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * GET /api/trace/tags/:tagName/values - Get values for a specific tag
 */
export async function getTagValues(req: Request, res: Response): Promise<void> {
  try {
    const tagName = req.params["tagName"] || "";
    const timeRange = (req.query["timeRange"] as string) || "86400"; // default 1 day

    const end = Math.floor(Date.now() / 1000);
    const start = end - parseInt(timeRange);

    logger.debug("Fetching values for tag:", { tagName, timeRange });

    const response = await fetch(
      `${GRAFANA_URL}/api/search/tag/${encodeURIComponent(tagName)}/values?start=${start}&end=${end}`,
    );
    const data = await response.json();

    res.json({
      tagName,
      values: data.tagValues || [],
      timeRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching tag values:", error);
    res.status(500).json({
      error: "Failed to fetch tag values",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * GET /api/trace/search/traceql - Search traces using TraceQL
 */
export async function searchTraceQL(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const limit = (req.query["limit"] as string) || "50";
    const timeRange = (req.query["timeRange"] as string) || "86400"; // default 1 day
    const orgId = req.query["orgId"] as string | undefined;

    const end = Math.floor(Date.now() / 1000);
    const start = end - parseInt(timeRange);

    // Build orgId tag filter - if orgId is provided, use it; otherwise no org filter
    const orgIdTag = orgId
      ? `.ai.telemetry.metadata.organizationId="${orgId}"`
      : null;

    // Support multiple queries or single query
    let queries: string[] = [];
    if (req.query["queries"]) {
      queries = JSON.parse(req.query["queries"] as string);
    } else if (req.query["q"]) {
      queries = [req.query["q"] as string];
    } else {
      queries = ["{}"];
    }

    // If orgId is provided, inject it into every query that doesn't already have it
    if (orgIdTag) {
      queries = queries.map((q) => {
        if (q.includes(".ai.telemetry.metadata.organizationId=")) return q;
        if (q.trim() === "{}" || q.trim() === "") return `{${orgIdTag}}`;

        let inner = q.trim();
        if (inner.startsWith("{") && inner.endsWith("}")) {
          inner = inner.slice(1, -1);
        }
        if (!inner) return `{${orgIdTag}}`;
        return `{${inner} && ${orgIdTag}}`;
      });
    }

    logger.debug("Executing TraceQL queries:", { queries });

    // Execute all queries in parallel
    const results = await Promise.all(
      queries.map(async (query) => {
        const tempoUrl = `${GRAFANA_URL}/api/search?q=${encodeURIComponent(query)}&start=${start}&end=${end}&limit=${limit}`;
        const response = await fetch(tempoUrl);
        const data = await response.json();

        return {
          query,
          traces: data.traces || [],
          metrics: data.metrics || {},
        };
      }),
    );

    // If multiple queries, return combined results
    if (queries.length > 1) {
      const allTraces = results.flatMap((r) => r.traces);
      const uniqueTraces = Array.from(
        new Map(allTraces.map((t) => [t.traceID, t])).values(),
      );

      res.json({
        traces: uniqueTraces,
        results,
        totalQueries: queries.length,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.json({
        traces: results[0]?.traces ?? [],
        metrics: results[0]?.metrics ?? {},
        query: results[0]?.query ?? "",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error("Error executing TraceQL query:", error);
    res.status(500).json({
      error: "Failed to execute TraceQL query",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

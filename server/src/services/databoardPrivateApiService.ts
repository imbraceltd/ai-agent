/**
 * Databoard private API client.
 *
 * Ports packages/pieces/community/databoard/src/lib/common/api.ts from imbrace/ap-workflow
 * so the Databoard-Engineer sub-agent can CRUD boards natively.
 */

import axios, { AxiosRequestConfig } from "axios";
import config from "@/config";
import logger from "@/lib/logger";
import {
  getOrganizationId,
  getUserId,
  getXAccessToken,
} from "@/core/agents/tool/toolContext";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type ActionResponse = {
  action: string;
  success: boolean;
  data: unknown;
  summary: string;
  nextSteps: string[];
};

export function buildResponse(
  action: string,
  data: unknown,
  summary: string,
  nextSteps: string[] = [],
): ActionResponse {
  return { action, success: true, data, summary, nextSteps };
}

export function buildErrorResponse(
  action: string,
  error: unknown,
  nextSteps: string[] = [
    "Check the error message and verify your parameters",
  ],
): ActionResponse {
  const message =
    error instanceof Error ? error.message : JSON.stringify(error);
  return {
    action,
    success: false,
    data: null,
    summary: `Error: ${message}`,
    nextSteps,
  };
}

function getBaseUrl(): string {
  // Reason: data-board service is the new home for board CRUD; legacy
  // backend at IMBRACE_PRIVATE_API doesn't share data with the FE chip's
  // ?databoardId= scope on staging/prod (different ID space).
  const url = config.dataBoard.url;
  if (!url) {
    throw new Error(
      "config.dataBoard.url (DATA_BOARD_URL) is not set.",
    );
  }
  return url.replace(/\/$/, "");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Strip the data-board service's envelope shape so callers can keep using
 * the legacy bare-object/bare-array contract (the previous `IMBRACE_PRIVATE_API`
 * returned unwrapped responses; `data-board` wraps responses as
 * `{ data, count? }` for lists, `{ data }` for single resources, and
 * `{ message, count }` for bulk writes — pass-through when no `data` key).
 */
function unwrapDataBoardEnvelope<T>(payload: unknown): T {
  if (isPlainObject(payload) && "data" in payload && payload["data"] !== undefined) {
    return payload["data"] as T;
  }
  return payload as T;
}

function filterUndefined(
  params?: Record<string, string | undefined>,
): Record<string, string> | undefined {
  if (!params) return undefined;
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      filtered[key] = value;
    }
  }
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

/**
 * Issue a request against the Imbrace private API.
 *
 * Auto-injects `x-organization-id` from the current tool context when
 * available; callers may override or supplement via `extraHeaders`. Some
 * endpoints additionally expect the organization id in the request body —
 * callers still pass that explicitly, matching the semantics of the AP
 * piece-databoard source.
 */
export async function privateApiRequest<T = unknown>(
  method: HttpMethod,
  endpoint: string,
  body?: unknown,
  queryParams?: Record<string, string | undefined>,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const organizationId = getOrganizationId();
  const userId = getUserId();
  const xAccessToken = getXAccessToken();
  // Reason: data-board service's extractUserContext middleware requires
  // both x-organization-id and x-user-id; missing either is 401. The
  // x-access-token is forwarded for downstream auth-aware endpoints.
  const authHeaders: Record<string, string> = {
    ...(organizationId ? { "x-organization-id": organizationId } : {}),
    ...(userId ? { "x-user-id": userId } : {}),
    ...(xAccessToken ? { "x-access-token": xAccessToken } : {}),
  };

  const request: AxiosRequestConfig = {
    method,
    url: `${getBaseUrl()}${endpoint}`,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...extraHeaders,
    },
    params: filterUndefined(queryParams),
  };

  const hasBody =
    body !== undefined &&
    body !== null &&
    !(
      typeof body === "object" &&
      !Array.isArray(body) &&
      Object.keys(body as object).length === 0
    );
  if (hasBody) {
    request.data = body;
  }

  try {
    const response = await axios.request<unknown>(request);
    return unwrapDataBoardEnvelope<T>(response.data);
  } catch (error: any) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    logger.error("privateApiRequest failed", {
      method,
      endpoint,
      status,
      data,
      message: error?.message,
    });
    throw new Error(
      data?.message ||
        data?.error ||
        error?.message ||
        `Private API request failed (${status ?? "unknown"})`,
    );
  }
}

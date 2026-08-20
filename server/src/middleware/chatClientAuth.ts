/**
 * Chat Client Auth Middleware
 * Validates Imbrace token and resolves to local PostgreSQL user
 */

import { Request, Response, NextFunction } from "express";
import axios from "axios";
import config from "@/config";
import logger from "@/lib/logger";
import { createOrFindUserByEmail } from "@/database/pgQueries";
import { credentialHeader } from "@/utils/credential";
import { redis } from "@/lib/redis";

/**
 * Cached user info per token (stored as JSON in Redis).
 */
interface CachedUser {
  id: string;
  email: string;
}

/** Redis cache TTL for token → user (5 minutes). */
const TOKEN_CACHE_TTL_SECONDS = 5 * 60;

/** Namespace for token cache keys. Combined with the client's nba: keyPrefix. */
const TOKEN_CACHE_KEY_PREFIX = "token:";

/**
 * Extended request with chatClientUser
 */
export interface ChatClientRequest extends Request {
  chatClientUser: { id: string; email: string };
}

/**
 * Middleware that validates x-access-token via Imbrace API
 * and resolves to a local PostgreSQL user
 */
export const chatClientAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userContext = (req as any).userContext;
  // userContext.x_access_token holds the user's credential — either an
  // acc_* access token or an api_* API key (parseUserContext stores them in
  // the same field; credentialHeader picks the right wire header).
  const token = userContext?.x_access_token;

  if (!token) {
    res.status(401).json({
      code: "unauthorized:auth",
      message: "Missing credential (x-access-token or x-api-key)",
    });
    return;
  }

  // Reason: log only a token prefix, never the full token (PII / auth secret).
  const tokenPrefix = `${token.slice(0, 8)}…`;

  try {
    // Check Redis cache first (Redis TTL handles expiry).
    const cacheKey = `${TOKEN_CACHE_KEY_PREFIX}${token}`;
    const cachedRaw = await redis.get(cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as CachedUser;
        logger.debug("[chatClientAuth] token cache HIT", {
          tokenPrefix,
          userId: cached.id,
        });
        (req as any).chatClientUser = { id: cached.id, email: cached.email };
        next();
        return;
      } catch (parseErr) {
        logger.warn("[chatClientAuth] Failed to parse cached user, re-verifying", {
          tokenPrefix,
          error: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
        // Fall through to re-verify
      }
    } else {
      logger.debug("[chatClientAuth] token cache MISS — verifying with Imbrace", {
        tokenPrefix,
      });
    }

    // Verify token with Imbrace API
    const imbraceBaseUrl =
      config.appGateway.url || config.webAppApi.url;

    if (!imbraceBaseUrl) {
      logger.error("[chatClientAuth] No Imbrace API base URL configured");
      res.status(500).json({
        code: "bad_request:auth",
        message: "Imbrace API not configured",
      });
      return;
    }

    // app-gateway's `/platform/v1/account` validates differently per credential:
    //
    //   - SSO JWT (starts with "eyJ"): JWT path via `hasBearerAuth`. Needs
    //     `Authorization: Bearer <jwt>` AND `x-organization-id` header together.
    //
    //   - acc_* exchange token: access-token path. Plain `x-access-token` against
    //     `/platform/v1/account` (NO orgId in URL/query) routes through to
    //     platform-service which validates acc_* directly. Adding `?organizationId=`
    //     forces the backend pre-check route which rejects exchange-issued acc_*
    //     with 401 — verified empirically against app-gateway.dev.
    //
    // x-api-key (api_*): handled by credentialHeader, no orgId gymnastics needed.
    const orgId = userContext?.organization_id as string | undefined;
    const isJwt = token.startsWith("eyJ");

    const accountUrl = `${imbraceBaseUrl}/platform/v1/account`;

    const requestHeaders: Record<string, string> = {
      Accept: "application/json",
      ...credentialHeader(token),
      "Cache-Control": "no-cache, no-store, must-revalidate",
    };
    if (isJwt) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
      if (orgId) requestHeaders["x-organization-id"] = orgId;
    }

    logger.debug("[chatClientAuth] Verifying token", {
      url: accountUrl,
      mode: isJwt ? "jwt" : "access-token",
    });

    const response = await axios.get(accountUrl, {
      headers: requestHeaders,
      timeout: 10000,
    });

    const imbraceAccount = response.data;

    if (!imbraceAccount?.email) {
      logger.error("[chatClientAuth] Imbrace account missing email");
      res.status(401).json({
        code: "unauthorized:auth",
        message: "Invalid Imbrace account",
      });
      return;
    }

    // Find or create local user in PostgreSQL
    const localUser = await createOrFindUserByEmail(imbraceAccount.email);

    if (!localUser) {
      logger.error("[chatClientAuth] Failed to create/find local user");
      res.status(500).json({
        code: "bad_request:database",
        message: "Failed to resolve user",
      });
      return;
    }

    // Cache the result in Redis with TTL
    const userToCache: CachedUser = {
      id: localUser.id,
      email: localUser.email,
    };
    await redis.setex(
      cacheKey,
      TOKEN_CACHE_TTL_SECONDS,
      JSON.stringify(userToCache),
    );
    logger.info("[chatClientAuth] token cache SET", {
      tokenPrefix,
      userId: localUser.id,
      ttlSeconds: TOKEN_CACHE_TTL_SECONDS,
    });

    // Attach user to request
    (req as any).chatClientUser = { id: localUser.id, email: localUser.email };

    next();
  } catch (error) {
    logger.error("[chatClientAuth] Error verifying token", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? (error as any).cause : undefined,
    });

    if (axios.isAxiosError(error) && error.response?.status === 401) {
      res.status(401).json({
        code: "unauthorized:auth",
        message: "Invalid or expired access token",
      });
      return;
    }

    res.status(500).json({
      code: "bad_request:auth",
      message: "Failed to verify access token",
    });
  }
};

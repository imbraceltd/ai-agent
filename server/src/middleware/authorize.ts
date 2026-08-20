import { Request, Response, NextFunction } from "express";

/**
 * Extract identity headers populated by app-gateway after it validated the
 * caller's credential. Either x-access-token (acc_*) or x-api-key (api_*) is
 * valid; we store whichever is present in `x_access_token` so downstream code
 * continues to work unchanged. Outbound calls use credentialHeader() to pick
 * the right header name on the wire.
 */
export const parseUserContext = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const apiKey = req.headers["x-api-key"];
  const accessToken = req.headers["x-access-token"];
  // Prefer api-key when both are present (matches gateway authRouter priority).
  const credential = (apiKey || accessToken) as string | undefined;

  (req as any).userContext = {
    // Single credential field used by every outbound call. Value may be
    // either an api_* key or an acc_* token; credentialHeader() picks the
    // wire header name based on the prefix.
    x_access_token: credential,
    x_org_id: req.headers["x-organization-id"] ?? req.headers["x-org-id"],
    user_id:
      req.headers["x-user-id"] ??
      req.headers["x-user_id"] ??
      req.headers["x-userid"],
  };

  next();
};

export const authorize = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const userContext = (req as any).userContext;
  if (!userContext) {
    res.status(401).json({ message: "Missing user context" });
    return;
  }

  if (!userContext.x_access_token) {
    res
      .status(401)
      .json({ message: "Missing credential (x-access-token or x-api-key)" });
    return;
  }

  next();
};

/**
 * Requires `x-organization-id` header.
 * Mount AFTER `authorize` on routes that operate within an organization scope
 * (e.g. /chat, /v2/chat). Other routes can omit it.
 */
export const requireOrganizationId = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const userContext = (req as any).userContext;
  if (!userContext?.x_org_id) {
    res.status(401).json({ message: "Missing organization ID" });
    return;
  }
  next();
};

export const requireUserAndOrgContext = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const userContext = (req as any).userContext;
  // TEMP: x-user-id check disabled while gateway/upstream wiring stabilises.
  // Re-enable once data_board reliably forwards the header.
  // if (!userContext?.user_id) {
  //   res.status(401).json({ message: "Missing user ID" });
  //   return;
  // }
  if (!userContext?.x_org_id) {
    res.status(401).json({ message: "Missing organization ID" });
    return;
  }
  next();
};

/**
 * Credential header helper.
 *
 * The user-supplied credential reaching ai-agent can be either a legacy
 * access-token (`acc_*`) or an API key (`api_*`). app-gateway's authRouter
 * dispatches differently based on which header is present, so when ai-agent
 * makes its own outbound calls we must pick the right header name.
 *
 * Usage:
 *   axios.get(url, {
 *     headers: { ...credentialHeader(xAccessToken), ...otherHeaders },
 *   });
 */
export function credentialHeader(
  credential: string | undefined | null,
): Record<string, string> {
  if (!credential) return {};
  if (credential.startsWith("api_")) {
    return { "x-api-key": credential };
  }
  return { "x-access-token": credential };
}

/** True when the credential is an API key (api_*). */
export function isApiKey(credential: string | undefined | null): boolean {
  return !!credential && credential.startsWith("api_");
}

import "server-only";

export const BUNGIE_AUTHORIZE = "https://www.bungie.net/en/OAuth/Authorize";
export const BUNGIE_TOKEN = "https://www.bungie.net/Platform/App/OAuth/token/";
export const BUNGIE_PLATFORM = "https://www.bungie.net/Platform";

export type BungieTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;          // seconds, typically 3600
  refresh_expires_in: number;  // seconds, historically ~90 days
  membership_id: string;
};

function basicAuthHeader(): string {
  const id = process.env.BUNGIE_CLIENT_ID!;
  const secret = process.env.BUNGIE_CLIENT_SECRET!;
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.BUNGIE_CLIENT_ID!,
    response_type: "code",
    state,
  });
  return `${BUNGIE_AUTHORIZE}?${params.toString()}`;
}

// Confidential client: Basic auth header + X-API-Key, form-encoded body.
async function tokenRequest(body: Record<string, string>): Promise<BungieTokens> {
  const res = await fetch(BUNGIE_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
      "X-API-Key": process.env.BUNGIE_API_KEY!,
    },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    // Never log the body verbatim — it may carry tokens.
    throw new Error(`Bungie token endpoint failed: ${res.status}`);
  }
  return (await res.json()) as BungieTokens;
}

export function exchangeCode(code: string): Promise<BungieTokens> {
  return tokenRequest({ grant_type: "authorization_code", code });
}

export function refreshTokens(refreshToken: string): Promise<BungieTokens> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

// Authenticated GET against the Platform API with a user/service access token.
export async function bungieGet<T = unknown>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${BUNGIE_PLATFORM}${path}`, {
    headers: {
      "X-API-Key": process.env.BUNGIE_API_KEY!,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bungie GET ${path} failed: ${res.status}`);
  const json = (await res.json()) as { ErrorCode?: number; Response?: T; Message?: string };
  if (json.ErrorCode && json.ErrorCode !== 1) {
    throw new Error(`Bungie API error ${json.ErrorCode}: ${json.Message ?? "unknown"}`);
  }
  return json.Response as T;
}

export type Memberships = {
  bungieNetUser: { membershipId: string; displayName: string };
  destinyMemberships: Array<{
    membershipId: string;
    membershipType: number;
    displayName: string;
    crossSaveOverride?: number;
  }>;
  primaryMembershipId?: string;
};

export async function getMembershipsForCurrentUser(accessToken: string): Promise<Memberships> {
  return bungieGet<Memberships>("/User/GetMembershipsForCurrentUser/", accessToken);
}

// Pick the cross-save primary membership when present, else the first.
export function primaryDestinyMembership(m: Memberships) {
  if (m.primaryMembershipId) {
    const found = m.destinyMemberships.find((d) => d.membershipId === m.primaryMembershipId);
    if (found) return found;
  }
  return m.destinyMemberships.find((d) => !d.crossSaveOverride || d.crossSaveOverride === d.membershipType)
    ?? m.destinyMemberships[0];
}

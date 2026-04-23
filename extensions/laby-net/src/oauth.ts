import { OAuth } from "@raycast/api";
import axios from "axios";

const CLIENT_ID = "f452239e-3c09-42d3-bf42-87f449829856";
const AUTHORIZE_URL = "https://laby.net/oauth/authorize";
const TOKEN_URL = "https://laby.net/api/v3/oauth/token";
const SCOPE = "openid profile";

const log = (message: string, data?: unknown) => {
  if (data !== undefined) {
    console.log(`[laby-net oauth] ${message}`, data);
  } else {
    console.log(`[laby-net oauth] ${message}`);
  }
};

const client = new OAuth.PKCEClient({
  redirectMethod: OAuth.RedirectMethod.Web,
  providerName: "Laby.net",
  providerIcon: "command-icon.png",
  providerId: "laby-net",
  description: "Connect your Laby.net account",
});

let authorizePromise: Promise<string> | null = null;

interface LabyTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

function maskToken(token: string | undefined | null): string {
  if (!token) return "<none>";
  if (token.length <= 12) return `${token.slice(0, 2)}…${token.slice(-2)}`;
  return `${token.slice(0, 6)}…${token.slice(-4)} (len=${token.length})`;
}

async function fetchTokens(
  authRequest: OAuth.AuthorizationRequest,
  authCode: string,
): Promise<LabyTokenResponse> {
  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("code", authCode);
  params.append("code_verifier", authRequest.codeVerifier);
  params.append("grant_type", "authorization_code");
  params.append("redirect_uri", authRequest.redirectURI);

  log("POST token (authorization_code)", {
    url: TOKEN_URL,
    clientId: CLIENT_ID,
    redirectURI: authRequest.redirectURI,
    authCode: maskToken(authCode),
    codeVerifier: maskToken(authRequest.codeVerifier),
  });

  try {
    const response = await axios.post<LabyTokenResponse>(TOKEN_URL, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    log("token response received", {
      status: response.status,
      tokenType: response.data.token_type,
      expiresIn: response.data.expires_in,
      scope: response.data.scope,
      hasRefreshToken: !!response.data.refresh_token,
      accessToken: maskToken(response.data.access_token),
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      log("token exchange failed", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
    } else {
      log("token exchange failed (non-axios)", error);
    }
    throw error;
  }
}

async function refreshTokens(refreshToken: string): Promise<LabyTokenResponse> {
  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("refresh_token", refreshToken);
  params.append("grant_type", "refresh_token");

  log("POST token (refresh_token)", {
    url: TOKEN_URL,
    refreshToken: maskToken(refreshToken),
  });

  try {
    const response = await axios.post<LabyTokenResponse>(TOKEN_URL, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const tokenResponse = response.data;
    tokenResponse.refresh_token = tokenResponse.refresh_token ?? refreshToken;
    log("refresh response received", {
      status: response.status,
      expiresIn: tokenResponse.expires_in,
      accessToken: maskToken(tokenResponse.access_token),
    });
    return tokenResponse;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      log("token refresh failed", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
    } else {
      log("token refresh failed (non-axios)", error);
    }
    throw error;
  }
}

export async function authorize(): Promise<string> {
  if (authorizePromise) {
    log("authorize() already in flight — reusing existing promise");
    return authorizePromise;
  }
  authorizePromise = (async () => {
    try {
      return await doAuthorize();
    } finally {
      authorizePromise = null;
    }
  })();
  return authorizePromise;
}

async function doAuthorize(): Promise<string> {
  log("authorize() called");
  const existing = await client.getTokens();
  log("existing tokens", {
    hasAccessToken: !!existing?.accessToken,
    hasRefreshToken: !!existing?.refreshToken,
    isExpired: existing?.isExpired?.(),
    scope: existing?.scope,
  });

  if (existing?.accessToken) {
    if (existing.refreshToken && existing.isExpired()) {
      log("access token expired, refreshing…");
      const refreshed = await refreshTokens(existing.refreshToken);
      await client.setTokens(refreshed);
      log("tokens refreshed & stored");
      return refreshed.access_token;
    }
    log("reusing existing access token", { accessToken: maskToken(existing.accessToken) });
    return existing.accessToken;
  }

  log("building authorization request", {
    endpoint: AUTHORIZE_URL,
    clientId: CLIENT_ID,
    scope: SCOPE,
  });
  const authRequest = await client.authorizationRequest({
    endpoint: AUTHORIZE_URL,
    clientId: CLIENT_ID,
    scope: SCOPE,
  });
  log("authorization request prepared", {
    redirectURI: authRequest.redirectURI,
    state: authRequest.state,
    codeChallenge: authRequest.codeChallenge,
    codeChallengeMethod: "S256",
  });

  log("calling client.authorize() — waiting for user to complete flow in browser…");
  const { authorizationCode } = await client.authorize(authRequest);
  log("received authorization code from redirect", {
    authorizationCode: maskToken(authorizationCode),
  });

  const tokens = await fetchTokens(authRequest, authorizationCode);
  await client.setTokens(tokens);
  log("tokens stored successfully");
  return tokens.access_token;
}

export async function getAccessToken(): Promise<string | null> {
  const tokens = await client.getTokens();
  if (!tokens?.accessToken) {
    return null;
  }
  if (tokens.refreshToken && tokens.isExpired()) {
    try {
      log("getAccessToken: token expired, refreshing…");
      const refreshed = await refreshTokens(tokens.refreshToken);
      await client.setTokens(refreshed);
      return refreshed.access_token;
    } catch (error) {
      console.error("[laby-net oauth] Failed to refresh token:", error);
      return null;
    }
  }
  return tokens.accessToken;
}

export async function isAuthenticated(): Promise<boolean> {
  const tokens = await client.getTokens();
  return !!tokens?.accessToken;
}

export async function logout(): Promise<void> {
  log("logout() — removing stored tokens");
  await client.removeTokens();
}

import { NextRequest, NextResponse } from "next/server";

export const BACKEND = process.env.NEST_API_URL ?? "http://localhost:3001";
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

export const isProd = process.env.NODE_ENV === "production";
export const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL ?? 900);
export const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL ?? 2592000);

/** Detect whether the client connection is secure (HTTPS) by checking
 *  x-forwarded-proto, the request URL, or falling back to isProd. */
export function isSecureRequest(req?: NextRequest): boolean {
  if (!req) return isProd;
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto === "https";
  return req.nextUrl.protocol === "https:" || isProd;
}

function cookieOpts(maxAge: number, secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge,
  };
}

/** Read tokens from the request cookies. */
export function readTokens(req: NextRequest) {
  return {
    access: req.cookies.get(ACCESS_COOKIE)?.value,
    refresh: req.cookies.get(REFRESH_COOKIE)?.value,
  };
}

/** Build a backend fetch for the given path, forwarding method, body, headers. */
async function forward(
  req: NextRequest,
  path: string,
  accessToken?: string,
): Promise<Response> {
  const headers = new Headers();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const isForm = req.headers.get("content-type")?.includes("multipart/form-data") ?? false;
  // For multipart we let fetch generate the boundary (the original header carries a stale one).
  if (!isForm && req.headers.get("content-type")) {
    headers.set("Content-Type", req.headers.get("content-type")!);
  }

  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : isForm
        ? await req.formData()
        : await req.text();

  return fetch(`${BACKEND}/v1${path}${req.nextUrl.search}`, {
    method: req.method,
    headers,
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
}

async function callRefresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${BACKEND}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-refresh-token": refreshToken },
      body: JSON.stringify({}),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    if (!data.accessToken || !data.refreshToken) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Generic BFF proxy with transparent refresh-token rotation:
 * 1. forwards the request with the access token,
 * 2. on 401 it rotates the refresh token and retries once,
 * 3. cookie refreshes are returned as Set-Cookie headers.
 */
export async function proxyToBackend(req: NextRequest, path: string): Promise<NextResponse> {
  const secure = isSecureRequest(req);
  const { access, refresh } = readTokens(req);

  let backendRes = await forward(req, path, access);

  if (backendRes.status === 401 && refresh && !path.startsWith("/auth/refresh")) {
    const rotated = await callRefresh(refresh);
    if (rotated) {
      backendRes = await forward(req, path, rotated.accessToken);
      const headers = new Headers(backendRes.headers);
      headers.set(
        "Set-Cookie",
        `${ACCESS_COOKIE}=${rotated.accessToken}; ${serializeOpts(ACCESS_TTL, secure)}; ${REFRESH_COOKIE}=${rotated.refreshToken}; ${serializeOpts(REFRESH_TTL, secure)}`,
      );
      return new NextResponse(await backendRes.text(), {
        status: backendRes.status,
        headers,
      });
    }
  }

  const headers = new Headers(backendRes.headers);
  if (backendRes.status === 401) {
    // Session is dead — clear both cookies.
    headers.set(
      "Set-Cookie",
      `${ACCESS_COOKIE}=; Max-Age=0; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; ${REFRESH_COOKIE}=; Max-Age=0; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax`,
    );
  }
  return new NextResponse(await backendRes.text(), {
    status: backendRes.status,
    headers,
  });
}

export function serializeOpts(maxAge: number, secure: boolean): string {
  return `Path=/; HttpOnly; Max-Age=${maxAge}; ${secure ? "Secure; " : ""}SameSite=Lax`;
}

/** For login/register: attach tokens from the response body as httpOnly cookies.
 *  Accepts the request so we can determine the correct Secure flag. */
export function withSessionCookies(req: NextRequest, json: unknown, status = 200): NextResponse {
  const secure = isSecureRequest(req);
  const data = json as { accessToken?: string; refreshToken?: string };
  const headers = new Headers();
  if (data.accessToken) {
    headers.set("Set-Cookie", `${ACCESS_COOKIE}=${data.accessToken}; ${serializeOpts(ACCESS_TTL, secure)}`);
  }
  if (data.refreshToken) {
    headers.append(
      "Set-Cookie",
      `${REFRESH_COOKIE}=${data.refreshToken}; ${serializeOpts(REFRESH_TTL, secure)}`,
    );
  }
  const safe = { ...data };
  delete (safe as { accessToken?: string }).accessToken;
  delete (safe as { refreshToken?: string }).refreshToken;
  return NextResponse.json(safe, { status, headers });
}

export { cookieOpts };

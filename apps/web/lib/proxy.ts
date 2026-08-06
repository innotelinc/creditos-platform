import { NextRequest, NextResponse } from "next/server";

export const BACKEND = process.env.NEST_API_URL ?? "http://localhost:3001";
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

export const isProd = process.env.NODE_ENV === "production";
export const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL ?? 900);
export const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL ?? 2592000);

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
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
  const { access, refresh } = readTokens(req);

  let backendRes = await forward(req, path, access);

  if (backendRes.status === 401 && refresh && !path.startsWith("/auth/refresh")) {
    const rotated = await callRefresh(refresh);
    if (rotated) {
      backendRes = await forward(req, path, rotated.accessToken);
      const headers = new Headers(backendRes.headers);
      headers.set(
        "Set-Cookie",
        `${ACCESS_COOKIE}=${rotated.accessToken}; ${serializeOpts(ACCESS_TTL)}; ${REFRESH_COOKIE}=${rotated.refreshToken}; ${serializeOpts(REFRESH_TTL)}`,
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
      `${ACCESS_COOKIE}=; Max-Age=0; Path=/; HttpOnly; ${isProd ? "Secure; " : ""}SameSite=Lax; ${REFRESH_COOKIE}=; Max-Age=0; Path=/; HttpOnly; ${isProd ? "Secure; " : ""}SameSite=Lax`,
    );
  }
  return new NextResponse(await backendRes.text(), {
    status: backendRes.status,
    headers,
  });
}

export function serializeOpts(maxAge: number): string {
  return `Path=/; HttpOnly; Max-Age=${maxAge}; ${isProd ? "Secure; " : ""}SameSite=Lax`;
}

/** For login/register: attach tokens from the response body as httpOnly cookies. */
export function withSessionCookies(json: unknown, status = 200): NextResponse {
  const data = json as { accessToken?: string; refreshToken?: string };
  const headers = new Headers();
  if (data.accessToken) {
    headers.set("Set-Cookie", `${ACCESS_COOKIE}=${data.accessToken}; ${serializeOpts(ACCESS_TTL)}`);
  }
  if (data.refreshToken) {
    headers.append(
      "Set-Cookie",
      `${REFRESH_COOKIE}=${data.refreshToken}; ${serializeOpts(REFRESH_TTL)}`,
    );
  }
  const safe = { ...data };
  delete (safe as { accessToken?: string }).accessToken;
  delete (safe as { refreshToken?: string }).refreshToken;
  return NextResponse.json(safe, { status, headers });
}

export { cookieOpts };

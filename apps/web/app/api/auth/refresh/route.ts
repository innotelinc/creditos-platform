import { NextRequest, NextResponse } from "next/server";
import { readTokens, BACKEND, serializeOpts, REFRESH_TTL, ACCESS_TTL, cookieOpts } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { refresh } = readTokens(req);
  if (!refresh) return NextResponse.json({ message: "No session" }, { status: 401 });
  const res = await fetch(`${BACKEND}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-refresh-token": refresh },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ message: "Session expired" }, { status: 401 });
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  const next = NextResponse.json({ success: true });
  next.cookies.set("access_token", data.accessToken, cookieOpts(ACCESS_TTL));
  next.cookies.set("refresh_token", data.refreshToken, cookieOpts(REFRESH_TTL));
  return next;
}

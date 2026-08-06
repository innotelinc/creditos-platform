import { NextRequest, NextResponse } from "next/server";
import { readTokens, BACKEND, isProd } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { refresh } = readTokens(req);
  if (refresh) {
    await fetch(`${BACKEND}/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-refresh-token": refresh },
      body: JSON.stringify({}),
      cache: "no-store",
    }).catch(() => undefined);
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set("access_token", "", { maxAge: 0, path: "/", httpOnly: true, sameSite: "lax", secure: isProd });
  res.cookies.set("refresh_token", "", { maxAge: 0, path: "/", httpOnly: true, sameSite: "lax", secure: isProd });
  return res;
}

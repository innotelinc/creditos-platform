import { NextRequest, NextResponse } from "next/server";
import { withSessionCookies, BACKEND } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${BACKEND}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json(data ?? { message: "Registration failed" }, { status: res.status });
  }
  return withSessionCookies(data);
}

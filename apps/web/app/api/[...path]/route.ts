import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/proxy";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiPath = `/${path.join("/")}`;
  return proxyToBackend(req, apiPath);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;

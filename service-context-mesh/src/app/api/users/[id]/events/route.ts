export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// Deprecated: redirects to /api/profiles/[id]
// Kept for backwards compatibility with old SDK
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return NextResponse.redirect(`${baseUrl}/api/profiles/${params.id}`);
}

import { NextResponse } from "next/server";
import { authorizeRequest, authErrorResponse } from "@/lib/apiProtect";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "This endpoint no longer returns API keys. POST with authentication to mint a short-lived Deepgram token.",
    },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const auth = await authorizeRequest(req);
  if (!auth.ok) {
    return authErrorResponse(auth);
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Deepgram is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const grantRes = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: 30 }),
    });

    if (!grantRes.ok) {
      return NextResponse.json(
        { error: "Failed to mint Deepgram token" },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data = (await grantRes.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!data.access_token) {
      return NextResponse.json(
        { error: "Failed to mint Deepgram token" },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        access_token: data.access_token,
        expires_in: data.expires_in ?? 30,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to mint Deepgram token" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}

import { anthropic } from "@ai-sdk/anthropic";
import { convertToCoreMessages, streamText } from "ai";
import { NextResponse } from "next/server";
import {
  authorizeRequest,
  authErrorResponse,
  sanitizeChatMessages,
} from "@/lib/apiProtect";

export const runtime = "edge";

export async function POST(req: Request) {
  const auth = await authorizeRequest(req);
  if (!auth.ok) {
    return authErrorResponse(auth);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sanitized = sanitizeChatMessages((body as { messages?: unknown }).messages);
  if (!sanitized.ok) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  const result = await streamText({
    model: anthropic("claude-3-5-sonnet-20240620"),
    messages: convertToCoreMessages(sanitized.messages),
    system: "You are a helpful AI assistant",
  });

  return result.toDataStreamResponse();
}

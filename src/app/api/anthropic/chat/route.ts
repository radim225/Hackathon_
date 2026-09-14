import { anthropic } from "@ai-sdk/anthropic";
import { convertToCoreMessages, streamText } from "ai";
import { NextResponse } from "next/server";
import {
  authorizeRequest,
  authErrorResponse,
  validateChatMessages,
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

  const messages = (body as { messages?: unknown }).messages;
  const invalid = validateChatMessages(messages);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const result = await streamText({
    model: anthropic("claude-3-5-sonnet-20240620"),
    messages: convertToCoreMessages(messages as Parameters<typeof convertToCoreMessages>[0]),
    system: "You are a helpful AI assistant",
  });

  return result.toDataStreamResponse();
}

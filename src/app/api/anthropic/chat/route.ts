import { anthropic } from "@ai-sdk/anthropic";
import { convertToCoreMessages, streamText } from "ai";
import { protectAiRoute } from "@/lib/security/protectApi";
import { sanitizeChatMessages } from "@/lib/security/sanitizeAiInput";
import { jsonError } from "@/lib/security/jsonError";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const MAX_JSON_BYTES = 256 * 1024;

export async function POST(req: Request) {
  const blocked = protectAiRoute(req, {
    prefix: "anthropic-chat",
    limit: 10,
    maxBytes: MAX_JSON_BYTES,
  });
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  const rawMessages = body && typeof body === "object" ? (body as { messages?: unknown }).messages : undefined;

  let messages;
  try {
    messages = sanitizeChatMessages(rawMessages);
  } catch {
    return jsonError(400, "Invalid messages");
  }

  try {
    const result = await streamText({
      model: anthropic("claude-3-5-sonnet-20240620"),
      messages: convertToCoreMessages(messages),
      system: "You are a helpful AI assistant",
    });

    return result.toDataStreamResponse();
  } catch {
    return jsonError(502, "Chat request failed");
  }
}

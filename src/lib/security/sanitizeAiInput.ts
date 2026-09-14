export type SanitizedChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_MESSAGES = 20;
const MAX_CONTENT_CHARS = 4000;

/**
 * Limit and sanitize client-supplied chat payloads.
 * Drops system/tool/developer roles to reduce prompt-injection via the API.
 */
export function sanitizeChatMessages(input: unknown): SanitizedChatMessage[] {
  if (!Array.isArray(input)) {
    throw new Error("INVALID_MESSAGES");
  }

  const sliced = input.slice(-MAX_MESSAGES);
  const messages: SanitizedChatMessage[] = [];

  for (const item of sliced) {
    if (!item || typeof item !== "object") continue;
    const record = item as { role?: unknown; content?: unknown };
    if (record.role !== "user" && record.role !== "assistant") continue;

    const content =
      typeof record.content === "string"
        ? record.content.slice(0, MAX_CONTENT_CHARS)
        : "";
    if (!content.trim()) continue;

    messages.push({ role: record.role, content });
  }

  if (messages.length === 0) {
    throw new Error("INVALID_MESSAGES");
  }

  return messages;
}

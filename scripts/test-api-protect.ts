import {
  checkRateLimit,
  isPublicApiPath,
  validateChatMessages,
} from "../src/lib/apiProtect";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(isPublicApiPath("/api/save-trip"), "save-trip should be public");
assert(!isPublicApiPath("/api/openai/chat"), "openai chat must not be public");
assert(!isPublicApiPath("/api/deepgram"), "deepgram must not be public");

assert(validateChatMessages(null) !== null, "null messages should fail");
assert(validateChatMessages([]) !== null, "empty messages should fail");
assert(
  validateChatMessages([{ role: "user", content: "hello" }]) === null,
  "simple user message should pass"
);
assert(
  validateChatMessages([{ role: "user", content: "x".repeat(8001) }]) !== null,
  "oversized message should fail"
);
assert(
  validateChatMessages(Array.from({ length: 33 }, () => ({ role: "user", content: "x" }))) !==
    null,
  "too many messages should fail"
);

const key = `test-${Date.now()}-${Math.random()}`;
assert(checkRateLimit(key, 2, 60_000).ok, "first hit should pass");
assert(checkRateLimit(key, 2, 60_000).ok, "second hit should pass");
assert(!checkRateLimit(key, 2, 60_000).ok, "third hit should be limited");

console.log("apiProtect checks passed");

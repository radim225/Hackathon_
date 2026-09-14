import { NextResponse } from "next/server";

const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT = 10;
const SAVE_TRIP_RATE_LIMIT = 30;

type RateBucket = { count: number; resetAt: number };

const rateBuckets = new Map<string, RateBucket>();

export function isPublicApiPath(pathname: string): boolean {
  return pathname === "/api/save-trip";
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function checkRateLimit(
  key: string,
  limit: number = DEFAULT_RATE_LIMIT,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const existing = rateBuckets.get(key);

  if (!existing || now >= existing.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  existing.count += 1;
  return { ok: true };
}

export function saveTripRateLimit(): number {
  return SAVE_TRIP_RATE_LIMIT;
}

function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < maxLen; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= ca ^ cb;
  }
  return mismatch === 0;
}

function getBearerToken(req: Request): string {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

async function verifyFirebaseIdToken(idToken: string): Promise<boolean> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId || !idToken) return false;

  try {
    const url = new URL("https://oauth2.googleapis.com/tokeninfo");
    url.searchParams.set("id_token", idToken);
    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    if (!res.ok) return false;

    const payload = (await res.json()) as {
      aud?: string;
      iss?: string;
      exp?: string;
    };

    if (payload.aud !== projectId) return false;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return false;

    const exp = Number(payload.exp);
    if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return false;

    return true;
  } catch {
    return false;
  }
}

export type AuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function authorizeRequest(req: Request): Promise<AuthResult> {
  const sharedSecret = process.env.API_ROUTE_SECRET;
  const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!sharedSecret && !firebaseProjectId) {
    return {
      ok: false,
      status: 503,
      error: "API authentication is not configured",
    };
  }

  const headerSecret = req.headers.get("x-api-secret")?.trim() || "";
  const bearer = getBearerToken(req);

  if (sharedSecret) {
    if (headerSecret && timingSafeEqual(headerSecret, sharedSecret)) {
      return { ok: true };
    }
    if (bearer && timingSafeEqual(bearer, sharedSecret)) {
      return { ok: true };
    }
  }

  if (firebaseProjectId && bearer.split(".").length === 3) {
    if (await verifyFirebaseIdToken(bearer)) {
      return { ok: true };
    }
  }

  return { ok: false, status: 401, error: "Unauthorized" };
}

export function authErrorResponse(auth: Extract<AuthResult, { ok: false }>): NextResponse {
  return NextResponse.json(
    { error: auth.error },
    { status: auth.status, headers: { "Cache-Control": "no-store" } }
  );
}

export function rateLimitExceededResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "Cache-Control": "no-store",
      },
    }
  );
}

export function rateLimitForPath(pathname: string): number {
  if (pathname.includes("/transcribe")) return 5;
  if (pathname.includes("/replicate")) return 5;
  if (pathname.includes("/deepgram")) return 10;
  return DEFAULT_RATE_LIMIT;
}

export function maxBodyBytesForPath(pathname: string): number {
  if (pathname.includes("/transcribe")) return 12 * 1024 * 1024;
  if (pathname.includes("/replicate")) return 32 * 1024;
  if (pathname.includes("/deepgram")) return 4 * 1024;
  return 100 * 1024;
}

export function rejectOversizedBody(req: Request, pathname: string): NextResponse | null {
  const maxBytes = maxBodyBytesForPath(pathname);
  const contentLength = req.headers.get("content-length");
  if (!contentLength) return null;
  const size = Number(contentLength);
  if (!Number.isFinite(size) || size <= maxBytes) return null;
  return NextResponse.json({ error: "Request body too large" }, { status: 413 });
}

const MAX_CHAT_MESSAGES = 32;
const MAX_MESSAGE_CHARS = 8000;

export function validateChatMessages(messages: unknown): string | null {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_CHAT_MESSAGES) {
    return `messages must be a non-empty array of at most ${MAX_CHAT_MESSAGES} items`;
  }

  for (const message of messages) {
    if (!message || typeof message !== "object") {
      return "each message must be an object";
    }
    const role = (message as { role?: unknown }).role;
    const content = (message as { content?: unknown }).content;
    if (typeof role !== "string" || !role) {
      return "each message must include a role";
    }
    if (typeof content === "string") {
      if (content.length > MAX_MESSAGE_CHARS) {
        return `message content exceeds ${MAX_MESSAGE_CHARS} characters`;
      }
      continue;
    }
    try {
      const serialized = JSON.stringify(content);
      if (!serialized || serialized.length > MAX_MESSAGE_CHARS) {
        return `message content exceeds ${MAX_MESSAGE_CHARS} characters`;
      }
    } catch {
      return "invalid message content";
    }
  }

  return null;
}

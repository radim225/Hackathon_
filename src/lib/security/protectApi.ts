import { NextResponse } from "next/server";
import { jsonError } from "./jsonError";

type RateBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateBucket>();

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function secretsEqual(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export function enforceRateLimit(
  req: Request,
  {
    limit,
    windowMs,
    prefix,
  }: { limit: number; windowMs: number; prefix: string }
): NextResponse | null {
  const ip = getClientIp(req);
  const key = `${prefix}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 500) {
      buckets.forEach((v, k) => {
        if (now >= v.resetAt) buckets.delete(k);
      });
    }
    return null;
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  bucket.count += 1;
  return null;
}

export function enforceBodySize(req: Request, maxBytes: number): NextResponse | null {
  const raw = req.headers.get("content-length");
  if (!raw) return null;
  const length = Number(raw);
  if (!Number.isFinite(length) || length < 0) return jsonError(400, "Invalid request");
  if (length > maxBytes) return jsonError(413, "Payload too large");
  return null;
}

export function requireApiSecret(req: Request): NextResponse | null {
  const expected = process.env.API_SECRET;
  if (!expected) {
    return jsonError(503, "API authentication is not configured");
  }

  const headerSecret = req.headers.get("x-api-secret") ?? "";
  const authorization = req.headers.get("authorization") ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const provided = headerSecret || bearer;

  if (!provided || !secretsEqual(provided, expected)) {
    return jsonError(401, "Unauthorized");
  }
  return null;
}

/** Auth + rate limit for paid model endpoints. Fails closed if API_SECRET is unset. */
export function protectAiRoute(
  req: Request,
  opts?: { prefix?: string; limit?: number; windowMs?: number; maxBytes?: number }
): NextResponse | null {
  const sized = opts?.maxBytes ? enforceBodySize(req, opts.maxBytes) : null;
  if (sized) return sized;

  const limited = enforceRateLimit(req, {
    limit: opts?.limit ?? 10,
    windowMs: opts?.windowMs ?? 60_000,
    prefix: opts?.prefix ?? "ai",
  });
  if (limited) return limited;

  return requireApiSecret(req);
}

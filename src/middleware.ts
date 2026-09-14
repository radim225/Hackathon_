import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  authErrorResponse,
  checkRateLimit,
  getClientIp,
  isPublicApiPath,
  rateLimitExceededResponse,
  rateLimitForPath,
  rejectOversizedBody,
  saveTripRateLimit,
} from "@/lib/apiProtect";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  if (isPublicApiPath(pathname)) {
    const limited = checkRateLimit(`save-trip:${ip}`, saveTripRateLimit());
    if (!limited.ok) {
      return rateLimitExceededResponse(limited.retryAfterSec);
    }
    return NextResponse.next();
  }

  const oversized = rejectOversizedBody(request, pathname);
  if (oversized) return oversized;

  const limited = checkRateLimit(`${pathname}:${ip}`, rateLimitForPath(pathname));
  if (!limited.ok) {
    return rateLimitExceededResponse(limited.retryAfterSec);
  }

  const auth = await authorizeRequest(request);
  if (!auth.ok) {
    return authErrorResponse(auth);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};

import { NextResponse } from "next/server";

/** Generic JSON error — never include upstream messages or secrets. */
export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

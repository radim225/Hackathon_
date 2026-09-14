import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { protectAiRoute } from "@/lib/security/protectApi";
import { jsonError } from "@/lib/security/jsonError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_JSON_BYTES = 6 * 1024 * 1024;
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const blocked = protectAiRoute(req, {
    prefix: "openai-transcribe",
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

  const base64Audio =
    body && typeof body === "object" && typeof (body as { audio?: unknown }).audio === "string"
      ? (body as { audio: string }).audio
      : "";

  if (!base64Audio) {
    return jsonError(400, "Missing audio");
  }

  let audio: Buffer;
  try {
    audio = Buffer.from(base64Audio, "base64");
  } catch {
    return jsonError(400, "Invalid audio");
  }

  if (!audio.length || audio.byteLength > MAX_AUDIO_BYTES) {
    return jsonError(413, "Audio too large");
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonError(503, "Transcription is not configured");
  }

  const filePath = path.join(os.tmpdir(), `whisper-${randomUUID()}.wav`);

  try {
    fs.writeFileSync(filePath, audio);
    const openai = new OpenAI();
    const data = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
    });
    return NextResponse.json({ text: data.text });
  } catch {
    return jsonError(502, "Transcription failed");
  } finally {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore cleanup errors
    }
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";
import { enforceBodySize, enforceRateLimit } from "@/lib/security/protectApi";
import { jsonError } from "@/lib/security/jsonError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

function extractTranscript(result: unknown): string {
  const channels = (result as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  })?.results?.channels;
  return channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
}

export async function POST(req: Request) {
  const sized = enforceBodySize(req, MAX_AUDIO_BYTES);
  if (sized) return sized;

  const limited = enforceRateLimit(req, {
    limit: 20,
    windowMs: 60_000,
    prefix: "deepgram",
  });
  if (limited) return limited;

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return jsonError(503, "Speech transcription is not configured");
  }

  const contentType = req.headers.get("content-type") || "";
  let audio: Buffer;

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("audio");
      if (!(file instanceof Blob)) {
        return jsonError(400, "Missing audio");
      }
      if (file.size > MAX_AUDIO_BYTES) {
        return jsonError(413, "Audio too large");
      }
      audio = Buffer.from(await file.arrayBuffer());
    } else {
      const buf = Buffer.from(await req.arrayBuffer());
      if (buf.byteLength > MAX_AUDIO_BYTES) {
        return jsonError(413, "Audio too large");
      }
      audio = buf;
    }
  } catch {
    return jsonError(400, "Invalid audio payload");
  }

  if (!audio.length) {
    return jsonError(400, "Empty audio");
  }

  try {
    const deepgram = createClient(apiKey);
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(audio, {
      model: "nova-2",
      smart_format: true,
    });

    if (error) {
      return jsonError(502, "Transcription failed");
    }

    return NextResponse.json({ transcript: extractTranscript(result) });
  } catch {
    return jsonError(502, "Transcription failed");
  }
}

/** Former GET handler returned the raw Deepgram API key. Keep GET disabled. */
export async function GET() {
  return jsonError(405, "Method not allowed");
}

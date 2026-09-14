import { NextResponse } from "next/server";
import fs from "fs";
import OpenAI from "openai";
import { authorizeRequest, authErrorResponse } from "@/lib/apiProtect";

const openai = new OpenAI();

const MAX_AUDIO_CHARS = 8 * 1024 * 1024;

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

  const base64Audio = (body as { audio?: unknown }).audio;
  if (typeof base64Audio !== "string" || base64Audio.length === 0) {
    return NextResponse.json({ error: "audio is required" }, { status: 400 });
  }
  if (base64Audio.length > MAX_AUDIO_CHARS) {
    return NextResponse.json({ error: "audio payload too large" }, { status: 413 });
  }

  const audio = Buffer.from(base64Audio, "base64");
  const filePath = "tmp/input.wav";

  try {
    fs.mkdirSync("tmp", { recursive: true });
    fs.writeFileSync(filePath, audio);

    const readStream = fs.createReadStream(filePath);

    const data = await openai.audio.transcriptions.create({
      file: readStream,
      model: "whisper-1",
    });

    fs.unlinkSync(filePath);

    return NextResponse.json(data);
  } catch {
    console.error("Error processing audio");
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // ignore cleanup errors
    }
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 });
  }
}

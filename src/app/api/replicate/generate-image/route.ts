import { NextResponse } from "next/server";
import Replicate from "replicate";
import { authorizeRequest, authErrorResponse } from "@/lib/apiProtect";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const MAX_PROMPT_CHARS = 2000;

export async function POST(request: Request) {
  const auth = await authorizeRequest(request);
  if (!auth.ok) {
    return authErrorResponse(auth);
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "Replicate is not configured" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body as { prompt?: unknown }).prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json({ error: "prompt is too long" }, { status: 400 });
  }

  try {
    const output = await replicate.run(
      "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
      {
        input: {
          prompt: prompt,
          image_dimensions: "512x512",
          num_outputs: 1,
          num_inference_steps: 50,
          guidance_scale: 7.5,
          scheduler: "DPMSolverMultistep",
        },
      }
    );

    return NextResponse.json({ output }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}

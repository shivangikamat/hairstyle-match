import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const DEFAULT_MODEL_ID = "eleven_flash_v2_5";

function getElevenLabsConfig() {
  const apiKey = process.env.ELEVENLABS_API_KEY || null;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;

  return {
    apiKey,
    voiceId,
    modelId,
    configured: Boolean(apiKey),
  };
}

export async function GET() {
  const config = getElevenLabsConfig();

  return NextResponse.json({
    configured: config.configured,
    provider: config.configured ? "elevenlabs" : "browser",
    voiceId: config.voiceId,
    modelId: config.modelId,
  });
}

export async function POST(request: Request) {
  try {
    const config = getElevenLabsConfig();

    if (!config.configured || !config.apiKey) {
      return NextResponse.json(
        {
          error:
            "ElevenLabs is not configured. Add ELEVENLABS_API_KEY to enable studio voice.",
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as {
      text?: string;
    };
    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json(
        { error: "text is required." },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
          "xi-api-key": config.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: config.modelId,
          voice_settings: {
            stability: 0.42,
            similarity_boost: 0.72,
            style: 0.38,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        {
          error:
            errorText ||
            "ElevenLabs could not generate the stylist voice response.",
        },
        { status: response.status }
      );
    }

    const mimeType = response.headers.get("content-type") || "audio/mpeg";
    const audioBuffer = Buffer.from(await response.arrayBuffer());

    return NextResponse.json({
      provider: "elevenlabs",
      mimeType,
      audioDataUrl: `data:${mimeType};base64,${audioBuffer.toString("base64")}`,
    });
  } catch (error) {
    console.error("Error in /api/voice/stylist:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the stylist voice response.",
      },
      { status: 500 }
    );
  }
}

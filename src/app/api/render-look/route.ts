import { NextResponse } from "next/server";
import { generateRenderLookWithGemini } from "@/lib/gemini";
import type { FaceProfile, MakeoverLevel, PresetTuning } from "@/lib/types";
import { inferPresetIdFromStyleName } from "@/lib/styleStudio";

export const runtime = "nodejs";

function parseDataUrl(dataUrl?: string | null) {
  if (!dataUrl || typeof dataUrl !== "string") {
    return null;
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    imageBytes: Buffer.from(match[2], "base64"),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      selectedStyle?: string | null;
      presetId?: string | null;
      presetLabel?: string | null;
      tuning?: Partial<PresetTuning> | null;
      makeoverLevel?: MakeoverLevel | null;
      preferences?: string | null;
      preferencesSummary?: string | null;
      stylistReply?: string | null;
      faceProfile?: FaceProfile | null;
      selfieDataUrl?: string | null;
    };
    const selectedStyle = body.selectedStyle?.trim() || null;
    const presetId = inferPresetIdFromStyleName(selectedStyle, body.preferences || "");

    const payload = await generateRenderLookWithGemini({
      selectedStyle,
      presetId,
      presetLabel: body.presetLabel || null,
      tuning: body.tuning || null,
      makeoverLevel: body.makeoverLevel || null,
      preferences: body.preferences || null,
      preferencesSummary: body.preferencesSummary || null,
      stylistReply: body.stylistReply || null,
      faceProfile: body.faceProfile || null,
      selfie: parseDataUrl(body.selfieDataUrl),
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error in /api/render-look:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to render the on-face hairstyle.",
      },
      { status: 500 }
    );
  }
}

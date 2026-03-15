import { NextResponse } from "next/server";
import { generateStyleBoardWithGemini } from "@/lib/gemini";
import type {
  ClientProfileMemory,
  FaceProfile,
  MakeoverLevel,
  PresetTuning,
} from "@/lib/types";
import { inferPresetIdFromStyleName } from "@/lib/styleStudio";

export const runtime = "nodejs";

function isPresetId(value?: string | null) {
  return (
    value === "precision-bob" ||
    value === "italian-bob" ||
    value === "soft-lob" ||
    value === "face-frame-flip" ||
    value === "curtain-cloud" ||
    value === "curtain-gloss" ||
    value === "butterfly-blowout" ||
    value === "sleek-midi" ||
    value === "modern-shag" ||
    value === "bixie-air" ||
    value === "volume-waves" ||
    value === "ribbon-waves"
  );
}

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
      mashupName?: string | null;
      preferences?: string | null;
      preferencesSummary?: string | null;
      stylistReply?: string | null;
      clientProfile?: ClientProfileMemory | null;
      faceProfile?: FaceProfile | null;
      selfieDataUrl?: string | null;
    };
    const selectedStyle = body.selectedStyle?.trim() || body.mashupName?.trim() || null;
    const presetId =
      body.presetId && isPresetId(body.presetId)
        ? body.presetId
        : inferPresetIdFromStyleName(selectedStyle, body.preferences || "");

    const payload = await generateStyleBoardWithGemini({
      selectedStyle,
      presetId,
      presetLabel: body.presetLabel || null,
      tuning: body.tuning || null,
      makeoverLevel: body.makeoverLevel || null,
      preferences: body.preferences || null,
      preferencesSummary: body.preferencesSummary || null,
      stylistReply: body.stylistReply || null,
      clientProfile:
        body.clientProfile && typeof body.clientProfile === "object"
          ? body.clientProfile
          : null,
      faceProfile: body.faceProfile || null,
      selfie: parseDataUrl(body.selfieDataUrl),
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error in /api/style-board:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate style board.",
      },
      { status: 500 }
    );
  }
}

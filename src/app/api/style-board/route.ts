import { NextResponse } from "next/server";
import { generateStyleBoardWithGemini } from "@/lib/gemini";
import type { FaceProfile } from "@/lib/types";

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
      selectedStyle?: string;
      mashupName?: string | null;
      preferences?: string | null;
      preferencesSummary?: string | null;
      stylistReply?: string | null;
      faceProfile?: FaceProfile | null;
      selfieDataUrl?: string | null;
    };

    if (!body.selectedStyle?.trim()) {
      return NextResponse.json(
        { error: "selectedStyle is required." },
        { status: 400 }
      );
    }

    const payload = await generateStyleBoardWithGemini({
      selectedStyle: body.selectedStyle.trim(),
      mashupName: body.mashupName || null,
      preferences: body.preferences || null,
      preferencesSummary: body.preferencesSummary || null,
      stylistReply: body.stylistReply || null,
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

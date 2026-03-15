import { NextResponse } from "next/server";
import { generateStyleMashupWithGemini } from "@/lib/gemini";
import type {
  ClientProfileMemory,
  HairstyleSuggestion,
  StyleAgentTurn,
} from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      preferences?: string;
      currentStyle?: string | null;
      suggestions?: HairstyleSuggestion[];
      conversationHistory?: StyleAgentTurn[];
      clientProfile?: ClientProfileMemory | null;
    };

    const suggestions = Array.isArray(body.suggestions)
      ? body.suggestions.filter(
          (suggestion) =>
            suggestion &&
            typeof suggestion.name === "string" &&
            typeof suggestion.reason === "string"
        )
      : [];

    if (suggestions.length === 0) {
      return NextResponse.json(
        { error: "At least one hairstyle suggestion is required." },
        { status: 400 }
      );
    }

    const response = await generateStyleMashupWithGemini({
      preferences: body.preferences || "",
      suggestions,
      currentStyle: body.currentStyle || null,
      conversationHistory: Array.isArray(body.conversationHistory)
        ? body.conversationHistory.filter(
            (turn) =>
              turn &&
              (turn.speaker === "user" || turn.speaker === "agent") &&
              typeof turn.text === "string"
          )
        : [],
      clientProfile:
        body.clientProfile && typeof body.clientProfile === "object"
          ? body.clientProfile
          : null,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in /api/style-agent:", error);
    return NextResponse.json(
      { error: "Failed to create style mashup." },
      { status: 500 }
    );
  }
}

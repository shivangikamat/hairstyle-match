import { GoogleGenerativeAI } from "@google/generative-ai";
import type { FaceProfile, HairstyleSuggestion } from "./types";

type GeminiFaceResponse = {
  faceProfile: FaceProfile;
  suggestions: HairstyleSuggestion[];
};

const DEFAULT_SUGGESTIONS: HairstyleSuggestion[] = [
  {
    name: "Classic Textured Bob",
    reason: "A timeless choice that adds volume and soft framing, perfect if the AI is still analyzing your unique features.",
  },
  {
    name: "Curtain Fringe Layers",
    reason:
      "Great for balancing facial proportions and providing a modern, effortless look.",
  },
  {
    name: "Modern Wispy Shag",
    reason:
      "A versatile cut that works across many hair textures to add movement and edge.",
  },
];

const DEFAULT_FACE_PROFILE: FaceProfile = {
  faceShape: "oval",
  hairTexture: "unknown",
  skinTone: "unknown",
};

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn(
      "GEMINI_API_KEY is not set. Using fallback logic."
    );
    return null;
  }

  return new GoogleGenerativeAI(apiKey);
}

export async function analyzeSelfieWithGemini(
  imageBytes: Buffer,
  mimeType: string
): Promise<GeminiFaceResponse> {
  const client = getClient();

  if (!client) {
    return {
      faceProfile: DEFAULT_FACE_PROFILE,
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const prompt = `
You are a world-class hairstylist and expert in facial aesthetics.
Your goal is to provide a precise facial analysis and recommendation for 3 hairstyles that would look stunning on this individual.

AVAILABLE STYLE CATEGORIES:
- "Textured Bob" (Modern, chic, chin-length)
- "Layered Long" (Voluminous, face-framing)
- "Curtain Fringe" (Soft bangs, balanced look)
- "Modern Shag" (Edgy, textured, messy-cool)
- "Pixie Cut" (Bold, high-fashion, short)
- "Sleek Lob" (Professional, shoulder-length)

TASK:
1) Analyze the face shape (round, oval, square, heart, diamond, or oblong).
2) Analyze the hair texture (straight, wavy, curly, coily, fine, thick).
3) Analyze the skin tone category.
4) Recommend 3 specific hairstyles. For each, use one of the names from the "AVAILABLE STYLE CATEGORIES" above if they fit well, or provide a unique name if none fit.
5) Provide a compelling, professional reason for each recommendation (1-2 sentences).

Respond with STRICT JSON matching this TypeScript type:

type Response = {
  faceProfile: {
    faceShape: "round" | "oval" | "square" | "heart" | "diamond" | "oblong";
    hairTexture: string;
    skinTone: string;
  };
  suggestions: {
    name: string;
    reason: string;
  }[];
};

Return ONLY valid JSON.
`.trim();

  const imagePart = {
    inlineData: {
      data: imageBytes.toString("base64"),
      mimeType,
    },
  };

  let parsed: GeminiFaceResponse | null = null;

  try {
    const result = await model.generateContent([
      { text: prompt },
      imagePart,
    ]);

    let cleanText = result.response.text().trim();
    console.log("RAW GEMINI RESPONSE:", cleanText);

    // Robust JSON extraction: find the first { and last }
    const firstBrace = cleanText.indexOf("{");
    const lastBrace = cleanText.lastIndexOf("}");
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }

    try {
      parsed = JSON.parse(cleanText) as GeminiFaceResponse;
      console.log("PARSED GEMINI RESPONSE:", JSON.stringify(parsed, null, 2));
    } catch (error) {
      console.error("Failed to parse Gemini JSON response:", error);
      console.error("Attempted text:", cleanText);
    }
  } catch (error) {
    // If the model ID is unavailable for this key / API version (404) or any
    // other error occurs, fall back to safe defaults so the UI keeps working.
    console.error("Error calling Gemini for selfie analysis:", error);
  }

  if (
    !parsed ||
    !parsed.suggestions ||
    !Array.isArray(parsed.suggestions) ||
    parsed.suggestions.length === 0
  ) {
    return {
      faceProfile: DEFAULT_FACE_PROFILE,
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  return parsed;
}


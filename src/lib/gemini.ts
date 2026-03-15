import { GoogleGenAI, Modality } from "@google/genai";
import type {
  FaceProfile,
  HairOverlayConfig,
  HairstyleSuggestion,
  StyleAgentResponse,
  StyleAgentTurn,
  StyleBoardResponse,
} from "./types";
import {
  buildLivePreferenceContext,
  createFallbackStyleAgentResponse,
} from "./styleStudio";

type GeminiFaceResponse = {
  faceProfile: FaceProfile;
  suggestions: HairstyleSuggestion[];
};

type InlineImagePayload = {
  mimeType: string;
  data: string;
};

const TEXT_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-2.5-flash-image";

const DEFAULT_SUGGESTIONS: HairstyleSuggestion[] = [
  {
    name: "Textured Bob",
    reason: "Adds movement and volume while softly framing most face shapes.",
  },
  {
    name: "Curtain Layers",
    reason:
      "Long, face-framing layers that balance wide cheeks and soften sharp jawlines.",
  },
  {
    name: "Modern Shag",
    reason:
      "Works well for wavy or straight hair, adding lift at the crown and definition around the eyes.",
  },
];

const DEFAULT_FACE_PROFILE: FaceProfile = {
  faceShape: "oval",
  hairTexture: "unknown",
  skinTone: "unknown",
};

const VALID_SILHOUETTES: HairOverlayConfig["silhouette"][] = [
  "bob",
  "curtain",
  "shag",
];
const VALID_COLORS: HairOverlayConfig["colorName"][] = [
  "soft-black",
  "espresso",
  "chestnut",
  "copper",
  "golden-blonde",
];
const VALID_PARTS: HairOverlayConfig["part"][] = ["center", "side"];
const VALID_TEXTURES: HairOverlayConfig["texture"][] = [
  "sleek",
  "airy",
  "piecey",
  "wavy",
];
const VALID_VOLUMES: HairOverlayConfig["volume"][] = ["low", "medium", "high"];
const VALID_FRINGES: HairOverlayConfig["fringe"][] = [
  "none",
  "curtain",
  "wispy",
  "full",
];
const VALID_LENGTHS: HairOverlayConfig["length"][] = [
  "short",
  "medium",
  "long",
];

function getApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
}

function getClient() {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn(
      "No Gemini API key found. Falling back to mock hairstyle responses."
    );
    return null;
  }

  return new GoogleGenAI({ apiKey });
}

function getRequiredClient() {
  const client = getClient();

  if (!client) {
    throw new Error("GEMINI_API_KEY is not configured for image generation.");
  }

  return client;
}

function isOneOf<T extends string>(
  value: unknown,
  items: readonly T[]
): value is T {
  return typeof value === "string" && items.includes(value as T);
}

function parseJsonResponse<T>(text: string): T | null {
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function toInlineImagePayload(
  imageBytes?: Buffer | null,
  mimeType?: string | null
): InlineImagePayload | null {
  if (!imageBytes || imageBytes.length === 0 || !mimeType?.startsWith("image/")) {
    return null;
  }

  return {
    data: imageBytes.toString("base64"),
    mimeType,
  };
}

function extractImageFromResponse(response: {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
  }>;
}) {
  const parts = response.candidates?.[0]?.content?.parts || [];

  for (const part of parts) {
    const inlineData = part.inlineData;

    if (inlineData?.data && inlineData.mimeType?.startsWith("image/")) {
      return {
        data: inlineData.data,
        mimeType: inlineData.mimeType,
      };
    }
  }

  return null;
}

function sanitizeAgentResponse(
  candidate: unknown,
  preferences: string,
  suggestions: HairstyleSuggestion[],
  currentStyle?: string | null,
  conversationHistory: StyleAgentTurn[] = []
): StyleAgentResponse {
  const fallback = createFallbackStyleAgentResponse(
    preferences,
    suggestions,
    currentStyle,
    conversationHistory
  );

  if (!candidate || typeof candidate !== "object") {
    return fallback;
  }

  const parsed = candidate as Record<string, unknown>;
  const suggestionNames = suggestions.map((suggestion) => suggestion.name);
  const selectedStyle =
    typeof parsed.selectedStyle === "string" &&
    suggestionNames.includes(parsed.selectedStyle)
      ? parsed.selectedStyle
      : fallback.selectedStyle;

  const overlayCandidate =
    parsed.overlay && typeof parsed.overlay === "object"
      ? (parsed.overlay as Record<string, unknown>)
      : {};

  return {
    selectedStyle,
    mashupName:
      typeof parsed.mashupName === "string" && parsed.mashupName.trim()
        ? parsed.mashupName.trim()
        : fallback.mashupName,
    agentReply:
      typeof parsed.agentReply === "string" && parsed.agentReply.trim()
        ? parsed.agentReply.trim()
        : fallback.agentReply,
    preferencesSummary:
      typeof parsed.preferencesSummary === "string" &&
      parsed.preferencesSummary.trim()
        ? parsed.preferencesSummary.trim()
        : fallback.preferencesSummary,
    overlay: {
      silhouette: isOneOf(overlayCandidate.silhouette, VALID_SILHOUETTES)
        ? overlayCandidate.silhouette
        : fallback.overlay.silhouette,
      colorName: isOneOf(overlayCandidate.colorName, VALID_COLORS)
        ? overlayCandidate.colorName
        : fallback.overlay.colorName,
      part: isOneOf(overlayCandidate.part, VALID_PARTS)
        ? overlayCandidate.part
        : fallback.overlay.part,
      texture: isOneOf(overlayCandidate.texture, VALID_TEXTURES)
        ? overlayCandidate.texture
        : fallback.overlay.texture,
      volume: isOneOf(overlayCandidate.volume, VALID_VOLUMES)
        ? overlayCandidate.volume
        : fallback.overlay.volume,
      fringe: isOneOf(overlayCandidate.fringe, VALID_FRINGES)
        ? overlayCandidate.fringe
        : fallback.overlay.fringe,
      length: isOneOf(overlayCandidate.length, VALID_LENGTHS)
        ? overlayCandidate.length
        : fallback.overlay.length,
      fit: fallback.overlay.fit,
    },
  };
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

  const prompt = `
You are a world-class hairstylist and face-shape analyst.

Look closely at this selfie and:
1) Infer the person's face shape, hair texture, and skin tone category.
2) Recommend 3 specific hairstyles that would be very flattering.

Respond with strict JSON only using this shape:
{
  "faceProfile": {
    "faceShape": "round | oval | square | heart | diamond | oblong",
    "hairTexture": "string",
    "skinTone": "string"
  },
  "suggestions": [
    {
      "name": "string",
      "reason": "string"
    }
  ]
}
`.trim();

  const image = toInlineImagePayload(imageBytes, mimeType);
  const result = await client.models.generateContent({
    model: TEXT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...(image ? [{ inlineData: image }] : []),
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.4,
    },
  });

  const parsed = parseJsonResponse<GeminiFaceResponse>(result.text || "");

  if (
    !parsed ||
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

export async function generateStyleMashupWithGemini(params: {
  preferences: string;
  suggestions: HairstyleSuggestion[];
  currentStyle?: string | null;
  conversationHistory?: StyleAgentTurn[];
}): Promise<StyleAgentResponse> {
  const { preferences, suggestions, currentStyle, conversationHistory = [] } =
    params;
  const livePreferenceContext = buildLivePreferenceContext(
    preferences,
    conversationHistory
  );
  const fallback = createFallbackStyleAgentResponse(
    livePreferenceContext,
    suggestions,
    currentStyle,
    conversationHistory
  );
  const client = getClient();

  if (!client) {
    return fallback;
  }

  const prompt = `
You are a live celebrity hair stylist agent for a Gemini hackathon demo.

The user is talking to a webcam preview and wants a hairstyle mashup recommendation.
You must pick exactly one base style from this available list:
${suggestions
  .map((suggestion) => `- ${suggestion.name}: ${suggestion.reason}`)
  .join("\n")}

Current selected style: ${currentStyle || "none"}
Recent conversation:
${
  conversationHistory.length > 0
    ? conversationHistory
        .map(
          (turn) =>
            `${turn.speaker === "user" ? "User" : "Agent"}: ${turn.text}`
        )
        .join("\n")
    : "No prior conversation yet."
}

Newest preferences transcript:
${preferences || "No specific preferences given."}

Cumulative preference direction:
${livePreferenceContext || "No specific preferences given."}

Respond with strict JSON only. Use this shape exactly:
{
  "selectedStyle": "one of the available style names exactly",
  "mashupName": "short memorable demo name",
  "agentReply": "2-3 sentence stylist response in a warm, decisive tone",
  "preferencesSummary": "one sentence summary of what the user asked for",
  "overlay": {
    "silhouette": "bob" | "curtain" | "shag",
    "colorName": "soft-black" | "espresso" | "chestnut" | "copper" | "golden-blonde",
    "part": "center" | "side",
    "texture": "sleek" | "airy" | "piecey" | "wavy",
    "volume": "low" | "medium" | "high",
    "fringe": "none" | "curtain" | "wispy" | "full",
    "length": "short" | "medium" | "long"
  }
}
`.trim();

  try {
    const result = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });

    return sanitizeAgentResponse(
      parseJsonResponse(result.text || ""),
      livePreferenceContext,
      suggestions,
      currentStyle,
      conversationHistory
    );
  } catch (error) {
    console.error("Failed to generate style mashup:", error);
    return fallback;
  }
}

export async function generateStyleBoardWithGemini(params: {
  selectedStyle: string;
  mashupName?: string | null;
  preferences?: string | null;
  preferencesSummary?: string | null;
  stylistReply?: string | null;
  faceProfile?: FaceProfile | null;
  selfie?: {
    imageBytes: Buffer;
    mimeType: string;
  } | null;
}): Promise<StyleBoardResponse> {
  const client = getRequiredClient();
  const title = params.mashupName?.trim() || params.selectedStyle.trim();
  const preferenceSummary =
    params.preferencesSummary?.trim() ||
    params.preferences?.trim() ||
    "polished, flattering, salon-ready";
  const stylistReply =
    params.stylistReply?.trim() ||
    `Build an elevated salon board for ${params.selectedStyle}.`;
  const faceNotes = params.faceProfile
    ? `${params.faceProfile.faceShape} face shape, ${params.faceProfile.hairTexture} texture, ${params.faceProfile.skinTone} tone.`
    : "No face profile was supplied.";

  const prompt = `
Create a polished hairstyle style board image for a salon consultation.

Primary hairstyle: ${params.selectedStyle}
Board title direction: ${title}
User preference summary: ${preferenceSummary}
Stylist brief: ${stylistReply}
Face and texture notes: ${faceNotes}

Requirements:
- photorealistic beauty editorial result
- shoulders-up framing
- hairstyle is the hero, with clear silhouette and texture
- luxury salon campaign lighting
- clean background
- no text, no watermark, no split panels, no collage
- keep the look wearable and stylist-ready
- if a reference selfie is provided, preserve the person's identity while changing only the hairstyle
`.trim();

  const image = toInlineImagePayload(
    params.selfie?.imageBytes,
    params.selfie?.mimeType
  );
  const result = await client.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...(image ? [{ inlineData: image }] : []),
        ],
      },
    ],
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
      temperature: 0.8,
    },
  });

  const generatedImage = extractImageFromResponse(result);

  if (!generatedImage) {
    throw new Error(
      result.text?.trim() ||
        "Gemini did not return an image for the style board request."
    );
  }

  return {
    imageDataUrl: `data:${generatedImage.mimeType};base64,${generatedImage.data}`,
    mimeType: generatedImage.mimeType,
    title,
    brief: preferenceSummary,
    prompt,
    model: IMAGE_MODEL,
    modelText: result.text?.trim() || "",
  };
}

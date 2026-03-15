import { GoogleGenAI, Modality } from "@google/genai";
import type {
  FaceProfile,
  HairstyleSuggestion,
  HeroPresetId,
  MakeoverLevel,
  PresetTuning,
  RenderLookResponse,
  StyleAgentResponse,
  StyleAgentTurn,
  StyleBoardResponse,
} from "./types";
import {
  HERO_PRESET_IDS,
  HERO_PRESET_SUGGESTIONS,
  buildLivePreferenceContext,
  buildPresetCatalogPrompt,
  buildRenderLookPrompt,
  buildStyleBoardPrompt,
  createFallbackStyleAgentResponse,
  createOverlayFromPreset,
  getHeroPreset,
  inferPresetIdFromStyleName,
  normalizePresetTuning,
} from "./styleStudio";

type GeminiFaceResponse = {
  faceProfile: FaceProfile;
  suggestions: HairstyleSuggestion[];
};

type InlineImagePayload = {
  mimeType: string;
  data: string;
};

type GeminiImageInput = {
  imageBytes: Buffer;
  mimeType: string;
} | null;

const TEXT_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-2.5-flash-image";

const DEFAULT_FACE_PROFILE: FaceProfile = {
  faceShape: "oval",
  hairTexture: "unknown",
  skinTone: "unknown",
};

const DEFAULT_SUGGESTIONS = HERO_PRESET_SUGGESTIONS.slice(0, 4);

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

function isPresetId(value: unknown): value is HeroPresetId {
  return typeof value === "string" && HERO_PRESET_IDS.includes(value as HeroPresetId);
}

function isMakeoverLevel(value: unknown): value is MakeoverLevel {
  return value === "subtle" || value === "signature" || value === "editorial";
}

function sanitizeSuggestion(candidate: unknown): HairstyleSuggestion | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const parsed = candidate as Record<string, unknown>;
  const presetId = isPresetId(parsed.presetId)
    ? parsed.presetId
    : inferPresetIdFromStyleName(
        typeof parsed.name === "string" ? parsed.name : undefined
      );
  const preset = getHeroPreset(presetId);

  return {
    name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : preset.label,
    reason:
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : preset.description,
    presetId,
  };
}

function sanitizeAnalyzeResponse(candidate: unknown): GeminiFaceResponse {
  if (!candidate || typeof candidate !== "object") {
    return {
      faceProfile: DEFAULT_FACE_PROFILE,
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const parsed = candidate as Record<string, unknown>;
  const faceCandidate =
    parsed.faceProfile && typeof parsed.faceProfile === "object"
      ? (parsed.faceProfile as Record<string, unknown>)
      : {};
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions
        .map((item) => sanitizeSuggestion(item))
        .filter((item): item is HairstyleSuggestion => Boolean(item))
        .slice(0, 4)
    : [];

  return {
    faceProfile: {
      faceShape:
        typeof faceCandidate.faceShape === "string"
          ? faceCandidate.faceShape
          : DEFAULT_FACE_PROFILE.faceShape,
      hairTexture:
        typeof faceCandidate.hairTexture === "string"
          ? faceCandidate.hairTexture
          : DEFAULT_FACE_PROFILE.hairTexture,
      skinTone:
        typeof faceCandidate.skinTone === "string"
          ? faceCandidate.skinTone
          : DEFAULT_FACE_PROFILE.skinTone,
    },
    suggestions: suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS,
  };
}

function sanitizeTuningCandidate(
  candidate: unknown
): Partial<PresetTuning> | undefined {
  if (!candidate || typeof candidate !== "object") {
    return undefined;
  }

  const parsed = candidate as Record<string, unknown>;

  return {
    part:
      parsed.part === "center" || parsed.part === "side"
        ? parsed.part
        : undefined,
    fringeStrength:
      typeof parsed.fringeStrength === "number" ? parsed.fringeStrength : undefined,
    softness: typeof parsed.softness === "number" ? parsed.softness : undefined,
    lengthBias:
      typeof parsed.lengthBias === "number" ? parsed.lengthBias : undefined,
    crownVolume:
      typeof parsed.crownVolume === "number" ? parsed.crownVolume : undefined,
    sleekness:
      typeof parsed.sleekness === "number" ? parsed.sleekness : undefined,
    waveBoost:
      typeof parsed.waveBoost === "number" ? parsed.waveBoost : undefined,
    density: typeof parsed.density === "number" ? parsed.density : undefined,
    colorDirection: isColorName(parsed.colorDirection)
      ? parsed.colorDirection
      : undefined,
  };
}

function isColorName(value: unknown): value is PresetTuning["colorDirection"] {
  return (
    value === "soft-black" ||
    value === "espresso" ||
    value === "chestnut" ||
    value === "copper" ||
    value === "golden-blonde"
  );
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
  const presetId = isPresetId(parsed.presetId)
    ? parsed.presetId
    : inferPresetIdFromStyleName(
        typeof parsed.selectedStyle === "string" ? parsed.selectedStyle : currentStyle,
        preferences
      );
  const preset = getHeroPreset(presetId);
  const tuning = normalizePresetTuning(
    presetId,
    sanitizeTuningCandidate(parsed.tuning)
  );
  const makeoverLevel = isMakeoverLevel(parsed.makeoverLevel)
    ? parsed.makeoverLevel
    : fallback.makeoverLevel;
  const overlay = createOverlayFromPreset(presetId, tuning, makeoverLevel);

  return {
    selectedStyle:
      typeof parsed.selectedStyle === "string" && parsed.selectedStyle.trim()
        ? parsed.selectedStyle.trim()
        : preset.label,
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
    presetId,
    presetLabel:
      typeof parsed.presetLabel === "string" && parsed.presetLabel.trim()
        ? parsed.presetLabel.trim()
        : preset.label,
    tuning,
    makeoverLevel,
    overlay,
  };
}

async function generateImagePayload(params: {
  prompt: string;
  title: string;
  presetId: HeroPresetId;
  presetLabel: string;
  makeoverLevel: MakeoverLevel;
  selfie?: GeminiImageInput;
}) {
  const client = getRequiredClient();
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
          { text: params.prompt },
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
        "Gemini did not return an image for this hairstyle render."
    );
  }

  return {
    imageDataUrl: `data:${generatedImage.mimeType};base64,${generatedImage.data}`,
    mimeType: generatedImage.mimeType,
    title: params.title,
    prompt: params.prompt,
    model: IMAGE_MODEL,
    modelText: result.text?.trim() || "",
    presetId: params.presetId,
    presetLabel: params.presetLabel,
    makeoverLevel: params.makeoverLevel,
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
You are a celebrity stylist helping a user pick one of the available hero haircut presets for a live try-on app.

Available hero presets:
${buildPresetCatalogPrompt()}

Look at the selfie and:
1. infer the person's face shape, natural hair texture, and skin tone
2. choose up to 4 flattering presets from the available list only

Respond with strict JSON only:
{
  "faceProfile": {
    "faceShape": "round | oval | square | heart | diamond | oblong",
    "hairTexture": "string",
    "skinTone": "string"
  },
  "suggestions": [
    {
      "name": "preset label exactly as written above",
      "reason": "one sentence",
      "presetId": "exact preset id"
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
      temperature: 0.35,
    },
  });

  return sanitizeAnalyzeResponse(parseJsonResponse(result.text || ""));
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
You are a warm, decisive live salon agent. The app renders only a fixed preset catalog, so you must choose and tune one preset instead of inventing a custom haircut.

Available hero presets:
${buildPresetCatalogPrompt()}

Available suggestions already shortlisted for this user:
${suggestions
  .map((suggestion) => {
    const presetId =
      suggestion.presetId || inferPresetIdFromStyleName(suggestion.name);
    return `- ${suggestion.name} (${presetId}): ${suggestion.reason}`;
  })
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

Newest preference transcript:
${preferences || "No specific preferences given."}

Cumulative preference direction:
${livePreferenceContext || "No specific preferences given."}

Respond with strict JSON only:
{
  "selectedStyle": "preset label exactly",
  "presetId": "exact preset id",
  "presetLabel": "preset label exactly",
  "mashupName": "short memorable name",
  "agentReply": "2-3 sentences in a supportive stylist voice",
  "preferencesSummary": "one sentence summary",
  "makeoverLevel": "subtle | signature | editorial",
  "tuning": {
    "part": "center | side",
    "fringeStrength": -1.0,
    "softness": 0.0,
    "lengthBias": 0.0,
    "crownVolume": 0.0,
    "sleekness": 0.0,
    "waveBoost": 0.0,
    "density": 0.0,
    "colorDirection": "soft-black | espresso | chestnut | copper | golden-blonde"
  }
}

Rules:
- choose one preset only
- keep tuning values bounded and realistic
- prefer believable, salon-ready advice over fantasy
- if the user sounds subtle, keep makeoverLevel subtle or signature
`.trim();

  try {
    const result = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.65,
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

export async function generateRenderLookWithGemini(params: {
  selectedStyle?: string | null;
  presetId: HeroPresetId;
  presetLabel?: string | null;
  tuning?: Partial<PresetTuning> | null;
  makeoverLevel?: MakeoverLevel | null;
  preferences?: string | null;
  preferencesSummary?: string | null;
  stylistReply?: string | null;
  faceProfile?: FaceProfile | null;
  selfie?: GeminiImageInput;
}): Promise<RenderLookResponse> {
  const preset = getHeroPreset(params.presetId);
  const tuning = normalizePresetTuning(params.presetId, params.tuning);
  const makeoverLevel = params.makeoverLevel || preset.makeoverBias;
  const title = params.selectedStyle?.trim() || preset.label;
  const brief =
    params.preferencesSummary?.trim() ||
    params.preferences?.trim() ||
    preset.description;
  const prompt = buildRenderLookPrompt({
    selectedStyle: title,
    presetId: params.presetId,
    presetLabel: params.presetLabel || preset.label,
    tuning,
    makeoverLevel,
    preferences: params.preferences || null,
    preferencesSummary: params.preferencesSummary || null,
    stylistReply: params.stylistReply || null,
    faceProfile: params.faceProfile || null,
  });
  const imagePayload = await generateImagePayload({
    prompt,
    title,
    presetId: params.presetId,
    presetLabel: params.presetLabel || preset.label,
    makeoverLevel,
    selfie: params.selfie || null,
  });

  return {
    ...imagePayload,
    brief,
  };
}

export async function generateStyleBoardWithGemini(params: {
  selectedStyle?: string | null;
  presetId: HeroPresetId;
  presetLabel?: string | null;
  tuning?: Partial<PresetTuning> | null;
  makeoverLevel?: MakeoverLevel | null;
  preferences?: string | null;
  preferencesSummary?: string | null;
  stylistReply?: string | null;
  faceProfile?: FaceProfile | null;
  selfie?: GeminiImageInput;
}): Promise<StyleBoardResponse> {
  const preset = getHeroPreset(params.presetId);
  const tuning = normalizePresetTuning(params.presetId, params.tuning);
  const makeoverLevel = params.makeoverLevel || preset.makeoverBias;
  const title = params.selectedStyle?.trim() || preset.label;
  const brief =
    params.preferencesSummary?.trim() ||
    params.preferences?.trim() ||
    preset.description;
  const prompt = buildStyleBoardPrompt({
    selectedStyle: title,
    presetId: params.presetId,
    presetLabel: params.presetLabel || preset.label,
    tuning,
    makeoverLevel,
    preferences: params.preferences || null,
    preferencesSummary: params.preferencesSummary || null,
    stylistReply: params.stylistReply || null,
    faceProfile: params.faceProfile || null,
  });
  const imagePayload = await generateImagePayload({
    prompt,
    title,
    presetId: params.presetId,
    presetLabel: params.presetLabel || preset.label,
    makeoverLevel,
    selfie: params.selfie || null,
  });

  return {
    ...imagePayload,
    brief,
    boardCaption: `${title} tuned for ${makeoverLevel} impact.`,
  };
}

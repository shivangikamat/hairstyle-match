import type {
  DetectedFaceFrame,
  FaceAnchorDiagnostics,
  FaceProfile,
  HairColorName,
  HairFringe,
  HairOverlayConfig,
  HairOverlayFit,
  HairPart,
  HairTextureMode,
  HairVolume,
  HairstyleSuggestion,
  HeroPresetId,
  HeroPresetSpec,
  MakeoverLevel,
  OverlayAdjustment,
  OverlaySourceMode,
  PresetTuning,
  StyleAgentResponse,
  StyleAgentTurn,
  TrackedFacePose,
} from "./types";

type OverlayPalette = {
  base: string;
  mid: string;
  shine: string;
  shadow: string;
};

const COLOR_KEYWORDS: Array<{ keywords: string[]; color: HairColorName }> = [
  { keywords: ["black", "inky", "jet"], color: "soft-black" },
  { keywords: ["espresso", "dark brown", "rich brown"], color: "espresso" },
  { keywords: ["brown", "brunette", "chocolate"], color: "chestnut" },
  { keywords: ["copper", "red", "auburn"], color: "copper" },
  { keywords: ["blonde", "gold", "honey"], color: "golden-blonde" },
];

const PALETTES: Record<HairColorName, OverlayPalette> = {
  "soft-black": {
    base: "#1b1f27",
    mid: "#303744",
    shine: "#7a8598",
    shadow: "#0d1117",
  },
  espresso: {
    base: "#2b221d",
    mid: "#4d3a31",
    shine: "#8d7364",
    shadow: "#17110f",
  },
  chestnut: {
    base: "#5b3528",
    mid: "#84503d",
    shine: "#c09279",
    shadow: "#311c16",
  },
  copper: {
    base: "#813b24",
    mid: "#b95d37",
    shine: "#f0a26f",
    shadow: "#3c1d14",
  },
  "golden-blonde": {
    base: "#967238",
    mid: "#c89e55",
    shine: "#f5d799",
    shadow: "#5a4320",
  },
};

const PRESET_KEYWORDS: Record<HeroPresetId, string[]> = {
  "precision-bob": ["precision bob", "glass bob", "french bob", "bob"],
  "soft-lob": ["soft lob", "lob", "collarbone", "sleek medium"],
  "curtain-cloud": ["curtain cloud", "airy curtain", "soft curtain", "curtain layers"],
  "curtain-gloss": ["curtain gloss", "gloss curtain", "polished curtain", "runway curtain"],
  "modern-shag": ["modern shag", "shag", "wolf", "texture shag"],
  "volume-waves": ["volume waves", "waves", "blowout", "glam waves"],
};

const PRESET_BASE_FIT: Record<HeroPresetId, HairOverlayFit> = {
  "precision-bob": {
    scale: 1,
    width: 0.82,
    height: 0.79,
    offsetX: 0,
    offsetY: -6,
    rotation: 0,
    opacity: 0.95,
  },
  "soft-lob": {
    scale: 1,
    width: 0.84,
    height: 0.88,
    offsetX: 0,
    offsetY: -4,
    rotation: 0,
    opacity: 0.95,
  },
  "curtain-cloud": {
    scale: 1,
    width: 0.86,
    height: 0.93,
    offsetX: 0,
    offsetY: -4,
    rotation: 0,
    opacity: 0.94,
  },
  "curtain-gloss": {
    scale: 1,
    width: 0.85,
    height: 0.9,
    offsetX: 0,
    offsetY: -5,
    rotation: 0,
    opacity: 0.95,
  },
  "modern-shag": {
    scale: 1,
    width: 0.89,
    height: 0.9,
    offsetX: 0,
    offsetY: -8,
    rotation: 0,
    opacity: 0.93,
  },
  "volume-waves": {
    scale: 1,
    width: 0.9,
    height: 0.97,
    offsetX: 0,
    offsetY: -5,
    rotation: 0,
    opacity: 0.93,
  },
};

export const DEFAULT_OVERLAY_ADJUSTMENT: OverlayAdjustment = {
  scale: 0,
  width: 0,
  height: 0,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  opacity: 0,
};

export const HERO_PRESETS: Record<HeroPresetId, HeroPresetSpec> = {
  "precision-bob": {
    id: "precision-bob",
    label: "Precision Bob",
    shortLabel: "Bob",
    description:
      "A sharp glassy bob that frames the jaw and reads expensive on camera.",
    silhouette: "bob",
    length: "short",
    defaultColor: "espresso",
    defaultTexture: "glossy",
    defaultPart: "side",
    defaultVolume: "low",
    defaultFringe: "wispy",
    vibes: ["polished", "camera-ready", "luxury"],
    salonTags: ["precision cut", "glass finish", "blowout"],
    bestFaceShapes: ["oval", "heart", "square"],
    maintenance: "medium",
    makeoverBias: "signature",
    tuningLimits: {
      fringeStrength: [-0.4, 0.8],
      softness: [-0.3, 0.5],
      lengthBias: [-0.5, 0.25],
      crownVolume: [-0.4, 0.3],
      sleekness: [0.15, 1],
      waveBoost: [-0.6, 0.15],
      density: [-0.25, 0.35],
    },
  },
  "soft-lob": {
    id: "soft-lob",
    label: "Soft Lob",
    shortLabel: "Lob",
    description:
      "A collarbone-grazing lob with clean movement and a luxe salon bend.",
    silhouette: "lob",
    length: "medium",
    defaultColor: "chestnut",
    defaultTexture: "sleek",
    defaultPart: "side",
    defaultVolume: "medium",
    defaultFringe: "side-swoop",
    vibes: ["refined", "wearable", "sleek"],
    salonTags: ["lob", "soft bend", "shine finish"],
    bestFaceShapes: ["oval", "round", "diamond"],
    maintenance: "medium",
    makeoverBias: "signature",
    tuningLimits: {
      fringeStrength: [-0.5, 0.45],
      softness: [0, 0.8],
      lengthBias: [-0.35, 0.35],
      crownVolume: [-0.25, 0.45],
      sleekness: [0, 1],
      waveBoost: [-0.2, 0.55],
      density: [-0.2, 0.4],
    },
  },
  "curtain-cloud": {
    id: "curtain-cloud",
    label: "Curtain Cloud Layers",
    shortLabel: "Cloud Layers",
    description:
      "Airy curtain layers that open the face and keep the finish romantic.",
    silhouette: "curtain",
    length: "long",
    defaultColor: "chestnut",
    defaultTexture: "airy",
    defaultPart: "center",
    defaultVolume: "medium",
    defaultFringe: "curtain",
    vibes: ["soft glam", "romantic", "face-framing"],
    salonTags: ["curtain bangs", "soft layers", "round-brush blowout"],
    bestFaceShapes: ["round", "square", "oblong"],
    maintenance: "medium",
    makeoverBias: "subtle",
    tuningLimits: {
      fringeStrength: [0.15, 1],
      softness: [0.2, 1],
      lengthBias: [-0.2, 0.45],
      crownVolume: [-0.15, 0.55],
      sleekness: [-0.35, 0.45],
      waveBoost: [0, 0.7],
      density: [-0.25, 0.5],
    },
  },
  "curtain-gloss": {
    id: "curtain-gloss",
    label: "Curtain Gloss Layers",
    shortLabel: "Gloss Layers",
    description:
      "Glossy face-framing layers with stronger shape definition and shine.",
    silhouette: "curtain",
    length: "long",
    defaultColor: "espresso",
    defaultTexture: "glossy",
    defaultPart: "center",
    defaultVolume: "medium",
    defaultFringe: "curtain",
    vibes: ["editorial", "polished", "runway"],
    salonTags: ["face framing", "gloss treatment", "polished blowout"],
    bestFaceShapes: ["oval", "heart", "diamond"],
    maintenance: "high",
    makeoverBias: "signature",
    tuningLimits: {
      fringeStrength: [0.1, 0.9],
      softness: [-0.1, 0.55],
      lengthBias: [-0.25, 0.4],
      crownVolume: [-0.2, 0.45],
      sleekness: [0.2, 1],
      waveBoost: [-0.15, 0.45],
      density: [-0.2, 0.35],
    },
  },
  "modern-shag": {
    id: "modern-shag",
    label: "Modern Shag",
    shortLabel: "Shag",
    description:
      "A directional shag with crown lift, airy ends, and cool-girl movement.",
    silhouette: "shag",
    length: "medium",
    defaultColor: "soft-black",
    defaultTexture: "piecey",
    defaultPart: "center",
    defaultVolume: "high",
    defaultFringe: "wispy",
    vibes: ["editorial", "edgy", "textured"],
    salonTags: ["shag", "crown lift", "piecey finish"],
    bestFaceShapes: ["heart", "oval", "oblong"],
    maintenance: "medium",
    makeoverBias: "editorial",
    tuningLimits: {
      fringeStrength: [-0.1, 0.9],
      softness: [-0.35, 0.4],
      lengthBias: [-0.25, 0.3],
      crownVolume: [0.15, 1],
      sleekness: [-0.8, 0.2],
      waveBoost: [0.05, 0.75],
      density: [-0.3, 0.55],
    },
  },
  "volume-waves": {
    id: "volume-waves",
    label: "Volume Waves",
    shortLabel: "Waves",
    description:
      "A rich blowout-inspired wave look with bounce, softness, and shine.",
    silhouette: "waves",
    length: "long",
    defaultColor: "golden-blonde",
    defaultTexture: "wavy",
    defaultPart: "side",
    defaultVolume: "high",
    defaultFringe: "none",
    vibes: ["glam", "soft", "camera-ready"],
    salonTags: ["blowout", "volume set", "big waves"],
    bestFaceShapes: ["round", "square", "diamond", "oval"],
    maintenance: "high",
    makeoverBias: "editorial",
    tuningLimits: {
      fringeStrength: [-0.8, 0.35],
      softness: [0.1, 1],
      lengthBias: [0, 0.55],
      crownVolume: [0.1, 1],
      sleekness: [-0.3, 0.5],
      waveBoost: [0.2, 1],
      density: [0, 0.65],
    },
  },
};

export const HERO_PRESET_IDS = Object.keys(HERO_PRESETS) as HeroPresetId[];

export const HERO_PRESET_SUGGESTIONS: HairstyleSuggestion[] = HERO_PRESET_IDS.map(
  (presetId) => ({
    name: HERO_PRESETS[presetId].label,
    reason: HERO_PRESETS[presetId].description,
    presetId,
  })
);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function interpolate(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function normalizeText(text?: string | null) {
  return text?.toLowerCase().trim() || "";
}

function serializeNumber(value: number) {
  return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

export function normalizeOverlayFit(fit: HairOverlayFit): HairOverlayFit {
  return {
    scale: clamp(fit.scale, 0.84, 1.22),
    width: clamp(fit.width, 0.62, 0.98),
    height: clamp(fit.height, 0.68, 1.08),
    offsetX: clamp(fit.offsetX, -92, 92),
    offsetY: clamp(fit.offsetY, -120, 92),
    rotation: clamp(fit.rotation, -12, 12),
    opacity: clamp(fit.opacity, 0.72, 1),
  };
}

export function getHeroPreset(presetId: HeroPresetId) {
  return HERO_PRESETS[presetId];
}

export function getOverlayPalette(colorName: HairColorName): OverlayPalette {
  return PALETTES[colorName];
}

function inferColor(preferences: string) {
  const normalized = normalizeText(preferences);
  const matched = COLOR_KEYWORDS.find(({ keywords }) =>
    includesAny(normalized, keywords)
  );

  return matched?.color || null;
}

function inferPart(preferences: string, fallback: HairPart): HairPart {
  const normalized = normalizeText(preferences);

  if (includesAny(normalized, ["side part", "deep part", "off center"])) {
    return "side";
  }

  if (includesAny(normalized, ["center part", "middle part"])) {
    return "center";
  }

  return fallback;
}

function inferMakeoverLevel(preferences: string): MakeoverLevel {
  const normalized = normalizeText(preferences);

  if (includesAny(normalized, ["editorial", "dramatic", "runway", "statement"])) {
    return "editorial";
  }

  if (includesAny(normalized, ["small change", "subtle", "natural", "soft"])) {
    return "subtle";
  }

  return "signature";
}

export function inferPresetIdFromStyleName(
  styleName?: string | null,
  preferences = ""
): HeroPresetId {
  const normalized = `${normalizeText(styleName)} ${normalizeText(preferences)}`.trim();

  for (const presetId of HERO_PRESET_IDS) {
    if (includesAny(normalized, PRESET_KEYWORDS[presetId])) {
      return presetId;
    }
  }

  if (includesAny(normalized, ["wave", "blowout", "glam"])) {
    return "volume-waves";
  }

  if (includesAny(normalized, ["shag", "texture", "edgy"])) {
    return "modern-shag";
  }

  if (includesAny(normalized, ["lob", "collarbone", "sleek medium"])) {
    return "soft-lob";
  }

  if (includesAny(normalized, ["curtain", "layer", "face framing"])) {
    return includesAny(normalized, ["polished", "gloss", "runway", "clean"])
      ? "curtain-gloss"
      : "curtain-cloud";
  }

  return "precision-bob";
}

function detectFringe(preset: HeroPresetSpec, tuning: PresetTuning): HairFringe {
  if (preset.id === "volume-waves" && tuning.fringeStrength < -0.2) {
    return "none";
  }

  if (preset.id === "soft-lob") {
    return tuning.fringeStrength > 0.15 ? "side-swoop" : "none";
  }

  if (preset.silhouette === "curtain") {
    return tuning.fringeStrength > 0.2 ? "curtain" : "wispy";
  }

  if (preset.id === "modern-shag") {
    return tuning.fringeStrength > 0.45 ? "full" : "wispy";
  }

  if (tuning.fringeStrength > 0.55) {
    return "full";
  }

  return preset.defaultFringe;
}

function detectTexture(preset: HeroPresetSpec, tuning: PresetTuning): HairTextureMode {
  if (preset.id === "modern-shag") {
    return tuning.softness > 0.2 ? "airy" : "piecey";
  }

  if (preset.id === "volume-waves") {
    return tuning.waveBoost > 0.5 ? "wavy" : "airy";
  }

  if (tuning.sleekness > 0.65) {
    return "glossy";
  }

  if (tuning.waveBoost > 0.4) {
    return "wavy";
  }

  if (tuning.softness > 0.45) {
    return "airy";
  }

  return preset.defaultTexture;
}

function detectVolume(preset: HeroPresetSpec, tuning: PresetTuning): HairVolume {
  const score = tuning.crownVolume + tuning.density;

  if (preset.defaultVolume === "high" || score > 0.55) {
    return "high";
  }

  if (preset.defaultVolume === "low" && score < 0.1) {
    return "low";
  }

  return score < -0.1 ? "low" : "medium";
}

function buildBaseTuning(preset: HeroPresetSpec): PresetTuning {
  return {
    part: preset.defaultPart,
    fringeStrength:
      preset.defaultFringe === "curtain"
        ? 0.55
        : preset.defaultFringe === "wispy"
          ? 0.18
          : preset.defaultFringe === "side-swoop"
            ? 0.24
            : 0,
    softness:
      preset.defaultTexture === "airy"
        ? 0.65
        : preset.defaultTexture === "wavy"
          ? 0.48
          : 0.2,
    lengthBias:
      preset.length === "short" ? -0.15 : preset.length === "long" ? 0.2 : 0,
    crownVolume:
      preset.defaultVolume === "high"
        ? 0.65
        : preset.defaultVolume === "medium"
          ? 0.3
          : -0.08,
    sleekness:
      preset.defaultTexture === "glossy"
        ? 0.82
        : preset.defaultTexture === "sleek"
          ? 0.55
          : -0.1,
    waveBoost:
      preset.defaultTexture === "wavy"
        ? 0.7
        : preset.id === "soft-lob"
          ? 0.18
          : 0,
    density: preset.defaultVolume === "high" ? 0.28 : 0,
    colorDirection: preset.defaultColor,
  };
}

export function normalizePresetTuning(
  presetId: HeroPresetId,
  tuning?: Partial<PresetTuning> | null
): PresetTuning {
  const preset = getHeroPreset(presetId);
  const base = buildBaseTuning(preset);
  const next = {
    ...base,
    ...tuning,
    part: tuning?.part === "center" || tuning?.part === "side" ? tuning.part : base.part,
    colorDirection:
      tuning?.colorDirection && PALETTES[tuning.colorDirection]
        ? tuning.colorDirection
        : base.colorDirection,
  };

  return {
    part: next.part,
    fringeStrength: clamp(
      next.fringeStrength,
      preset.tuningLimits.fringeStrength[0],
      preset.tuningLimits.fringeStrength[1]
    ),
    softness: clamp(
      next.softness,
      preset.tuningLimits.softness[0],
      preset.tuningLimits.softness[1]
    ),
    lengthBias: clamp(
      next.lengthBias,
      preset.tuningLimits.lengthBias[0],
      preset.tuningLimits.lengthBias[1]
    ),
    crownVolume: clamp(
      next.crownVolume,
      preset.tuningLimits.crownVolume[0],
      preset.tuningLimits.crownVolume[1]
    ),
    sleekness: clamp(
      next.sleekness,
      preset.tuningLimits.sleekness[0],
      preset.tuningLimits.sleekness[1]
    ),
    waveBoost: clamp(
      next.waveBoost,
      preset.tuningLimits.waveBoost[0],
      preset.tuningLimits.waveBoost[1]
    ),
    density: clamp(
      next.density,
      preset.tuningLimits.density[0],
      preset.tuningLimits.density[1]
    ),
    colorDirection: next.colorDirection,
  };
}

function inferTuningFromPreferences(
  presetId: HeroPresetId,
  preferences: string
): PresetTuning {
  const preset = getHeroPreset(presetId);
  const tuning = buildBaseTuning(preset);
  const normalized = normalizeText(preferences);
  const color = inferColor(preferences);

  tuning.part = inferPart(preferences, tuning.part);

  if (includesAny(normalized, ["soft", "romantic", "gentle"])) {
    tuning.softness += 0.26;
  }

  if (includesAny(normalized, ["sharp", "clean", "precise", "structured"])) {
    tuning.softness -= 0.22;
    tuning.sleekness += 0.14;
  }

  if (includesAny(normalized, ["shorter", "short", "trim it", "low maintenance"])) {
    tuning.lengthBias -= 0.2;
  }

  if (includesAny(normalized, ["longer", "keep length", "more length"])) {
    tuning.lengthBias += 0.2;
  }

  if (includesAny(normalized, ["volume", "lift", "bigger", "fuller"])) {
    tuning.crownVolume += 0.22;
    tuning.density += 0.12;
  }

  if (includesAny(normalized, ["sleek", "polished", "glossy", "glass"])) {
    tuning.sleekness += 0.25;
    tuning.waveBoost -= 0.1;
  }

  if (includesAny(normalized, ["wave", "bouncy", "bend", "movement"])) {
    tuning.waveBoost += 0.28;
    tuning.softness += 0.08;
  }

  if (includesAny(normalized, ["bang", "fringe", "face framing"])) {
    tuning.fringeStrength += 0.24;
  }

  if (includesAny(normalized, ["open forehead", "no bangs", "no fringe"])) {
    tuning.fringeStrength -= 0.4;
  }

  if (color) {
    tuning.colorDirection = color;
  }

  return normalizePresetTuning(presetId, tuning);
}

function buildPresetFit(presetId: HeroPresetId, tuning: PresetTuning): HairOverlayFit {
  const base = PRESET_BASE_FIT[presetId];
  const widthBias = tuning.density * 0.045 + tuning.crownVolume * 0.028;
  const heightBias = tuning.lengthBias * 0.14 + tuning.waveBoost * 0.045;
  const liftBias = tuning.crownVolume * -16 + tuning.lengthBias * 7;
  const rotationBias = tuning.part === "side" ? 1.6 : 0;

  return normalizeOverlayFit({
    scale: base.scale + tuning.crownVolume * 0.05 + tuning.waveBoost * 0.02,
    width: base.width + widthBias,
    height: base.height + heightBias,
    offsetX: base.offsetX + (tuning.part === "side" ? 4 : 0),
    offsetY: base.offsetY + liftBias,
    rotation: base.rotation + rotationBias,
    opacity: base.opacity,
  });
}

export function createOverlayFromPreset(
  presetId: HeroPresetId,
  tuning?: Partial<PresetTuning> | null,
  makeoverLevel?: MakeoverLevel | null
): HairOverlayConfig {
  const preset = getHeroPreset(presetId);
  const normalizedTuning = normalizePresetTuning(presetId, tuning);
  const volume = detectVolume(preset, normalizedTuning);
  const texture = detectTexture(preset, normalizedTuning);
  const fringe = detectFringe(preset, normalizedTuning);

  return {
    presetId,
    presetLabel: preset.label,
    silhouette: preset.silhouette,
    colorName: normalizedTuning.colorDirection,
    part: normalizedTuning.part,
    texture,
    volume,
    fringe,
    length: preset.length,
    fit: buildPresetFit(presetId, normalizedTuning),
    tuning: normalizedTuning,
    makeoverLevel: makeoverLevel || preset.makeoverBias,
    salonTags: preset.salonTags,
    layerOpacity: {
      shadow: 0.28 + normalizedTuning.density * 0.04,
      back: 0.82,
      body: 0.94,
      front:
        fringe === "none"
          ? 0.58
          : preset.silhouette === "curtain"
            ? 0.84
            : 0.74,
    },
  };
}

export function createOverlayFromStyle(styleName: string, preferences = "") {
  const presetId = inferPresetIdFromStyleName(styleName, preferences);
  const tuning = inferTuningFromPreferences(presetId, preferences);
  const makeoverLevel = inferMakeoverLevel(preferences);

  return createOverlayFromPreset(presetId, tuning, makeoverLevel);
}

export function calibrateOverlayToFace(
  overlay: HairOverlayConfig,
  faceProfile?: FaceProfile | null,
  sourceMode: OverlaySourceMode = "mannequin"
): HairOverlayConfig {
  const fit = { ...overlay.fit };
  const faceShape = normalizeText(faceProfile?.faceShape) || "oval";

  if (faceShape === "round") {
    fit.width += 0.03;
    fit.offsetY -= 4;
  } else if (faceShape === "square") {
    fit.width += 0.015;
    fit.height += 0.02;
    fit.offsetY -= 2;
  } else if (faceShape === "heart") {
    fit.width -= 0.02;
    fit.offsetY -= 5;
  } else if (faceShape === "diamond") {
    fit.width -= 0.012;
    fit.offsetY -= 3;
  } else if (faceShape === "oblong") {
    fit.width += 0.03;
    fit.height -= 0.025;
    fit.offsetY += 2;
  }

  if (sourceMode === "webcam") {
    fit.scale += 0.02;
    fit.opacity -= 0.04;
    fit.offsetY -= 2;
  } else if (sourceMode === "selfie") {
    fit.opacity += 0.02;
  } else {
    fit.offsetY += 2;
  }

  return {
    ...overlay,
    fit: normalizeOverlayFit(fit),
  };
}

export function calibrateOverlayToTrackedPose(
  overlay: HairOverlayConfig,
  trackedPose?: TrackedFacePose | null
): HairOverlayConfig {
  if (!trackedPose) {
    return overlay;
  }

  const { frame, foreheadAnchor, crownAnchor, faceCenter, templeSpan, jawSpan, roll } =
    trackedPose;
  const frameWidthRatio = frame.width / frame.frameWidth;
  const frameHeightRatio = frame.height / frame.frameHeight;
  const faceCoverage = frameWidthRatio * frameHeightRatio;
  const templeToJawRatio = templeSpan > 0 ? jawSpan / templeSpan : 1;
  const topAnchorDelta = crownAnchor.y - foreheadAnchor.y;
  const targetWidth = clamp(
    frameWidthRatio *
      (overlay.presetId === "precision-bob" ? 1.65 : 1.75) +
      overlay.tuning.density * 0.035 +
      overlay.tuning.crownVolume * 0.028,
    0.68,
    0.98
  );
  const targetHeight = clamp(
    frameHeightRatio *
      (overlay.length === "long" ? 2 : overlay.length === "short" ? 1.56 : 1.78) +
      overlay.tuning.lengthBias * 0.08 +
      overlay.tuning.waveBoost * 0.03,
    0.72,
    1.04
  );
  const desiredTop =
    crownAnchor.y - frame.frameHeight * (0.12 + overlay.tuning.crownVolume * 0.05);
  const baseTop = frame.frameHeight * 0.06;
  const targetOffsetY =
    desiredTop -
    baseTop -
    topAnchorDelta * 0.35 +
    (1 - faceCoverage / 0.12) * 6;
  const targetOffsetX = clamp(
    faceCenter.x - frame.frameWidth / 2 + (overlay.part === "side" ? 8 : 0),
    -frame.frameWidth * 0.16,
    frame.frameWidth * 0.16
  );
  const targetRotation = clamp(roll * 0.8 + (overlay.part === "side" ? 1 : 0), -9, 9);
  const crownLift = templeToJawRatio < 0.92 ? -4 : templeToJawRatio > 1.04 ? 3 : 0;

  return {
    ...overlay,
    fit: normalizeOverlayFit({
      ...overlay.fit,
      width: interpolate(overlay.fit.width, targetWidth, 0.42 + trackedPose.stability * 0.3),
      height: interpolate(
        overlay.fit.height,
        targetHeight,
        0.42 + trackedPose.stability * 0.28
      ),
      offsetX: interpolate(
        overlay.fit.offsetX,
        targetOffsetX,
        0.44 + trackedPose.stability * 0.26
      ),
      offsetY: interpolate(
        overlay.fit.offsetY,
        targetOffsetY + crownLift,
        0.44 + trackedPose.stability * 0.26
      ),
      rotation: interpolate(
        overlay.fit.rotation,
        targetRotation,
        0.36 + trackedPose.stability * 0.22
      ),
      opacity: overlay.fit.opacity,
      scale: overlay.fit.scale,
    }),
  };
}

export function calibrateOverlayToDetectedFace(
  overlay: HairOverlayConfig,
  faceFrame?: DetectedFaceFrame | null,
  trackedPose?: TrackedFacePose | null
): HairOverlayConfig {
  if (trackedPose) {
    return calibrateOverlayToTrackedPose(overlay, trackedPose);
  }

  if (!faceFrame) {
    return overlay;
  }

  const syntheticPose: TrackedFacePose = {
    frame: faceFrame,
    foreheadAnchor: {
      x: faceFrame.x + faceFrame.width / 2,
      y: faceFrame.y + faceFrame.height * 0.12,
    },
    crownAnchor: {
      x: faceFrame.x + faceFrame.width / 2,
      y: faceFrame.y + faceFrame.height * 0.02,
    },
    leftTemple: {
      x: faceFrame.x + faceFrame.width * 0.18,
      y: faceFrame.y + faceFrame.height * 0.28,
    },
    rightTemple: {
      x: faceFrame.x + faceFrame.width * 0.82,
      y: faceFrame.y + faceFrame.height * 0.28,
    },
    jawLeft: {
      x: faceFrame.x + faceFrame.width * 0.2,
      y: faceFrame.y + faceFrame.height * 0.76,
    },
    jawRight: {
      x: faceFrame.x + faceFrame.width * 0.8,
      y: faceFrame.y + faceFrame.height * 0.76,
    },
    faceCenter: {
      x: faceFrame.x + faceFrame.width / 2,
      y: faceFrame.y + faceFrame.height / 2,
    },
    templeSpan: faceFrame.width * 0.64,
    jawSpan: faceFrame.width * 0.6,
    yaw: 0,
    roll: 0,
    pitch: 0,
    stability: 0.55,
    timestamp: Date.now(),
  };

  return calibrateOverlayToTrackedPose(overlay, syntheticPose);
}

export function applyOverlayAdjustment(
  overlay: HairOverlayConfig,
  adjustment: OverlayAdjustment
): HairOverlayConfig {
  return {
    ...overlay,
    fit: normalizeOverlayFit({
      scale: overlay.fit.scale + adjustment.scale,
      width: overlay.fit.width + adjustment.width,
      height: overlay.fit.height + adjustment.height,
      offsetX: overlay.fit.offsetX + adjustment.offsetX,
      offsetY: overlay.fit.offsetY + adjustment.offsetY,
      rotation: overlay.fit.rotation + adjustment.rotation,
      opacity: overlay.fit.opacity + adjustment.opacity,
    }),
  };
}

function getFrameFromPose(
  face: DetectedFaceFrame | TrackedFacePose | null | undefined
): DetectedFaceFrame | null {
  if (!face) {
    return null;
  }

  return "frame" in face ? face.frame : face;
}

export function getFaceAnchorDiagnostics(
  face: DetectedFaceFrame | TrackedFacePose | null | undefined
): FaceAnchorDiagnostics {
  const frame = getFrameFromPose(face);

  if (!frame || frame.frameWidth <= 0 || frame.frameHeight <= 0) {
    return {
      score: 0,
      label: "recovering",
      guidance: "No face lock yet. Keep your forehead visible and stay centered.",
    };
  }

  const centerX = (frame.x + frame.width / 2) / frame.frameWidth;
  const centerY = (frame.y + frame.height / 2) / frame.frameHeight;
  const coverage = (frame.width / frame.frameWidth) * (frame.height / frame.frameHeight);
  const top = frame.y / frame.frameHeight;
  const aspect = frame.width / frame.height;
  const coverageScore = clamp(1 - Math.abs(coverage - 0.11) / 0.07, 0, 1);
  const centerScore = clamp(
    1 -
      (Math.abs(centerX - 0.5) / 0.22 + Math.abs(centerY - 0.54) / 0.24) / 2,
    0,
    1
  );
  const topScore = clamp(1 - Math.abs(top - 0.2) / 0.16, 0, 1);
  const aspectScore = clamp(1 - Math.abs(aspect - 0.74) / 0.22, 0, 1);
  const stabilityScore =
    face && "stability" in face ? clamp(face.stability, 0, 1) : 0.62;
  const score = clamp(
    coverageScore * 0.26 +
      centerScore * 0.26 +
      topScore * 0.16 +
      aspectScore * 0.14 +
      stabilityScore * 0.18,
    0,
    1
  );

  if (score >= 0.8) {
    return {
      score,
      label: "strong",
      guidance: "Strong lock. Crown and temple anchors are stable enough for auto rendering.",
    };
  }

  if (score >= 0.58) {
    return {
      score,
      label: "steady",
      guidance: "Good lock. Hold still for a beat and the on-face render will sharpen up.",
    };
  }

  return {
    score,
    label: "recovering",
    guidance: "Tracking is still settling. Face the camera and keep your hairline visible.",
  };
}

export function smoothDetectedFaceFrame(
  currentFrame: DetectedFaceFrame | null,
  nextFrame: DetectedFaceFrame,
  smoothing = 0.34
): DetectedFaceFrame {
  if (!currentFrame) {
    return nextFrame;
  }

  return {
    x: interpolate(currentFrame.x, nextFrame.x, smoothing),
    y: interpolate(currentFrame.y, nextFrame.y, smoothing),
    width: interpolate(currentFrame.width, nextFrame.width, smoothing),
    height: interpolate(currentFrame.height, nextFrame.height, smoothing),
    frameWidth: nextFrame.frameWidth,
    frameHeight: nextFrame.frameHeight,
  };
}

export function smoothTrackedFacePose(
  currentPose: TrackedFacePose | null,
  nextPose: TrackedFacePose,
  smoothing = 0.28
): TrackedFacePose {
  if (!currentPose) {
    return nextPose;
  }

  const mixPoint = (
    current: { x: number; y: number },
    next: { x: number; y: number }
  ) => ({
    x: interpolate(current.x, next.x, smoothing),
    y: interpolate(current.y, next.y, smoothing),
  });

  return {
    frame: smoothDetectedFaceFrame(currentPose.frame, nextPose.frame, smoothing),
    foreheadAnchor: mixPoint(currentPose.foreheadAnchor, nextPose.foreheadAnchor),
    crownAnchor: mixPoint(currentPose.crownAnchor, nextPose.crownAnchor),
    leftTemple: mixPoint(currentPose.leftTemple, nextPose.leftTemple),
    rightTemple: mixPoint(currentPose.rightTemple, nextPose.rightTemple),
    jawLeft: mixPoint(currentPose.jawLeft, nextPose.jawLeft),
    jawRight: mixPoint(currentPose.jawRight, nextPose.jawRight),
    faceCenter: mixPoint(currentPose.faceCenter, nextPose.faceCenter),
    templeSpan: interpolate(currentPose.templeSpan, nextPose.templeSpan, smoothing),
    jawSpan: interpolate(currentPose.jawSpan, nextPose.jawSpan, smoothing),
    yaw: interpolate(currentPose.yaw, nextPose.yaw, smoothing),
    roll: interpolate(currentPose.roll, nextPose.roll, smoothing),
    pitch: interpolate(currentPose.pitch, nextPose.pitch, smoothing),
    stability: interpolate(currentPose.stability, nextPose.stability, smoothing),
    timestamp: nextPose.timestamp,
  };
}

export function buildLivePreferenceContext(
  preferences: string,
  conversationHistory: StyleAgentTurn[] = []
) {
  const priorUserTurns = conversationHistory
    .filter((turn) => turn.speaker === "user")
    .map((turn) => turn.text.trim())
    .filter(Boolean)
    .slice(-2);

  return [...priorUserTurns, preferences.trim()].filter(Boolean).join(" ").trim();
}

function scorePresetMatch(
  suggestion: HairstyleSuggestion,
  preferences: string,
  currentStyle?: string | null
) {
  const presetId =
    suggestion.presetId || inferPresetIdFromStyleName(suggestion.name, preferences);
  const preset = getHeroPreset(presetId);
  const normalized = normalizeText(preferences);
  let score = 0;

  if (currentStyle && currentStyle === suggestion.name) {
    score += 2;
  }

  if (includesAny(normalized, preset.vibes)) {
    score += 4;
  }

  if (includesAny(normalized, preset.salonTags)) {
    score += 3;
  }

  if (includesAny(normalized, PRESET_KEYWORDS[presetId])) {
    score += 4;
  }

  if (presetId === "precision-bob" && includesAny(normalized, ["short", "polished", "clean"])) {
    score += 4;
  }

  if (
    presetId === "curtain-cloud" &&
    includesAny(normalized, ["soft", "face framing", "romantic", "long"])
  ) {
    score += 4;
  }

  if (
    presetId === "modern-shag" &&
    includesAny(normalized, ["edgy", "texture", "movement", "cool"])
  ) {
    score += 4;
  }

  if (
    presetId === "volume-waves" &&
    includesAny(normalized, ["waves", "glam", "big", "blowout"])
  ) {
    score += 4;
  }

  return score;
}

function summarizePreferences(preferences: string) {
  const trimmed = preferences.trim();

  if (!trimmed) {
    return "You want the live preview to look believable, polished, and stylist-ready.";
  }

  if (trimmed.length <= 160) {
    return trimmed;
  }

  return `${trimmed.slice(0, 157)}...`;
}

function buildMashupName(presetId: HeroPresetId, tuning: PresetTuning) {
  const preset = getHeroPreset(presetId);
  const finish =
    tuning.sleekness > 0.55
      ? "Gloss"
      : tuning.waveBoost > 0.45
        ? "Wave"
        : tuning.softness > 0.5
          ? "Soft"
          : "Shape";

  return `${finish} ${preset.shortLabel} Edit`;
}

export function createFallbackStyleAgentResponse(
  preferences: string,
  suggestions: HairstyleSuggestion[],
  currentStyle?: string | null,
  conversationHistory: StyleAgentTurn[] = []
): StyleAgentResponse {
  const effectivePreferences = buildLivePreferenceContext(
    preferences,
    conversationHistory
  );
  const safeSuggestions =
    suggestions.length > 0 ? suggestions : HERO_PRESET_SUGGESTIONS.slice(0, 3);

  const selected =
    safeSuggestions
      .map((suggestion) => ({
        suggestion,
        score: scorePresetMatch(suggestion, effectivePreferences, currentStyle),
      }))
      .sort((a, b) => b.score - a.score)[0]?.suggestion || safeSuggestions[0];
  const presetId =
    selected.presetId || inferPresetIdFromStyleName(selected.name, effectivePreferences);
  const tuning = inferTuningFromPreferences(presetId, effectivePreferences);
  const makeoverLevel = inferMakeoverLevel(effectivePreferences);
  const overlay = createOverlayFromPreset(presetId, tuning, makeoverLevel);
  const preset = getHeroPreset(presetId);
  const summary = summarizePreferences(effectivePreferences);

  return {
    selectedStyle: preset.label,
    mashupName: buildMashupName(presetId, tuning),
    agentReply: `I’m steering you toward ${preset.label}. It keeps the finish aligned with "${summary}" while staying strong on camera and believable enough for a real salon handoff.`,
    preferencesSummary: summary,
    presetId,
    presetLabel: preset.label,
    tuning,
    makeoverLevel,
    overlay,
  };
}

export function buildPresetCatalogPrompt() {
  return HERO_PRESET_IDS.map((presetId) => {
    const preset = getHeroPreset(presetId);

    return `- ${preset.label} (${preset.id}): ${preset.description}. Vibes: ${preset.vibes.join(
      ", "
    )}. Tags: ${preset.salonTags.join(", ")}.`;
  }).join("\n");
}

function buildSharedPromptContext(params: {
  selectedStyle?: string | null;
  presetId: HeroPresetId;
  presetLabel?: string | null;
  tuning: PresetTuning;
  makeoverLevel: MakeoverLevel;
  preferences?: string | null;
  preferencesSummary?: string | null;
  stylistReply?: string | null;
  faceProfile?: FaceProfile | null;
}) {
  const preset = getHeroPreset(params.presetId);

  return {
    selectedStyle: params.selectedStyle?.trim() || preset.label,
    presetLabel: params.presetLabel?.trim() || preset.label,
    summary:
      params.preferencesSummary?.trim() ||
      summarizePreferences(params.preferences || ""),
    brief:
      params.stylistReply?.trim() ||
      `Keep the ${preset.label} look premium, believable, and flattering on the actual face.`,
    faceNotes: params.faceProfile
      ? `${params.faceProfile.faceShape} face shape, ${params.faceProfile.hairTexture} natural texture, ${params.faceProfile.skinTone} tone.`
      : "No face profile supplied.",
  };
}

export function buildRenderLookPrompt(params: {
  selectedStyle?: string | null;
  presetId: HeroPresetId;
  presetLabel?: string | null;
  tuning: PresetTuning;
  makeoverLevel: MakeoverLevel;
  preferences?: string | null;
  preferencesSummary?: string | null;
  stylistReply?: string | null;
  faceProfile?: FaceProfile | null;
}) {
  const preset = getHeroPreset(params.presetId);
  const context = buildSharedPromptContext(params);

  return `
Create a photoreal makeover render on the same person in the reference image.

Selected look: ${context.selectedStyle}
Preset: ${context.presetLabel} (${preset.id})
Makeover level: ${params.makeoverLevel}
Preference summary: ${context.summary}
Stylist direction: ${context.brief}
Face notes: ${context.faceNotes}
Preset styling notes: ${preset.description}
Tuning:
- part: ${params.tuning.part}
- fringe strength: ${serializeNumber(params.tuning.fringeStrength)}
- softness: ${serializeNumber(params.tuning.softness)}
- length bias: ${serializeNumber(params.tuning.lengthBias)}
- crown volume: ${serializeNumber(params.tuning.crownVolume)}
- sleekness: ${serializeNumber(params.tuning.sleekness)}
- wave boost: ${serializeNumber(params.tuning.waveBoost)}
- density: ${serializeNumber(params.tuning.density)}
- color direction: ${params.tuning.colorDirection}

Requirements:
- preserve the person's identity and facial features
- change the hairstyle only
- realistic salon-quality hairline and crown placement
- premium beauty editorial lighting
- shoulders-up framing
- no text, no collage, no split screen, no watermark
- the hairstyle must look wearable, flattering, and intentionally cut for this face
`.trim();
}

export function buildStyleBoardPrompt(params: {
  selectedStyle?: string | null;
  presetId: HeroPresetId;
  presetLabel?: string | null;
  tuning: PresetTuning;
  makeoverLevel: MakeoverLevel;
  preferences?: string | null;
  preferencesSummary?: string | null;
  stylistReply?: string | null;
  faceProfile?: FaceProfile | null;
}) {
  const preset = getHeroPreset(params.presetId);
  const context = buildSharedPromptContext(params);

  return `
Create a polished salon beauty board image for the same person in the reference image.

Hero look: ${context.selectedStyle}
Preset: ${context.presetLabel} (${preset.id})
Makeover level: ${params.makeoverLevel}
Preference summary: ${context.summary}
Stylist direction: ${context.brief}
Face notes: ${context.faceNotes}
Preset styling notes: ${preset.description}
Tuning:
- part: ${params.tuning.part}
- fringe strength: ${serializeNumber(params.tuning.fringeStrength)}
- softness: ${serializeNumber(params.tuning.softness)}
- length bias: ${serializeNumber(params.tuning.lengthBias)}
- crown volume: ${serializeNumber(params.tuning.crownVolume)}
- sleekness: ${serializeNumber(params.tuning.sleekness)}
- wave boost: ${serializeNumber(params.tuning.waveBoost)}
- density: ${serializeNumber(params.tuning.density)}
- color direction: ${params.tuning.colorDirection}

Requirements:
- photoreal luxury salon campaign finish
- one finished look only, not a collage
- shoulders-up framing with clean negative space
- hairstyle silhouette and texture must read clearly
- preserve the person's identity if a reference portrait is supplied
- no text, no watermark
`.trim();
}

export type FaceProfile = {
  faceShape: string;
  hairTexture: string;
  skinTone: string;
};

export type HairstyleSuggestion = {
  name: string;
  reason: string;
  presetId?: HeroPresetId;
};

export type StyleAgentTurn = {
  speaker: "user" | "agent";
  text: string;
};

export type Salon = {
  id: string;
  name: string;
  address: string;
  rating: number;
  reason: string;
  vibe: string;
  priceBand: "$" | "$$" | "$$$";
  website?: string;
  matchedServices: string[];
};

export type SalonSearchResponse = {
  demo: true;
  location: string;
  selectedStyle: string;
  salons: Salon[];
};

export type HeroPresetId =
  | "precision-bob"
  | "italian-bob"
  | "soft-lob"
  | "face-frame-flip"
  | "curtain-cloud"
  | "curtain-gloss"
  | "butterfly-blowout"
  | "sleek-midi"
  | "modern-shag"
  | "bixie-air"
  | "volume-waves"
  | "ribbon-waves";

export type MakeoverLevel = "subtle" | "signature" | "editorial";

export type HairSilhouette = "bob" | "lob" | "curtain" | "shag" | "waves";
export type HairColorName =
  | "soft-black"
  | "espresso"
  | "chestnut"
  | "copper"
  | "golden-blonde";
export type HairPart = "center" | "side";
export type HairTextureMode = "sleek" | "airy" | "piecey" | "wavy" | "glossy";
export type HairVolume = "low" | "medium" | "high";
export type HairFringe = "none" | "curtain" | "wispy" | "full" | "side-swoop";
export type HairLength = "short" | "medium" | "long";
export type OverlaySourceMode = "mannequin" | "selfie" | "webcam";

export type HairOverlayFit = {
  scale: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  opacity: number;
};

export type OverlayAdjustment = {
  scale: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  opacity: number;
};

export type DetectedFaceFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
};

export type FaceAnchorDiagnostics = {
  score: number;
  label: "strong" | "steady" | "recovering";
  guidance: string;
};

export type PresetTuning = {
  part: HairPart;
  fringeStrength: number;
  softness: number;
  lengthBias: number;
  crownVolume: number;
  sleekness: number;
  waveBoost: number;
  density: number;
  colorDirection: HairColorName;
};

export type HeroPresetSpec = {
  id: HeroPresetId;
  label: string;
  shortLabel: string;
  description: string;
  silhouette: HairSilhouette;
  length: HairLength;
  defaultColor: HairColorName;
  defaultTexture: HairTextureMode;
  defaultPart: HairPart;
  defaultVolume: HairVolume;
  defaultFringe: HairFringe;
  vibes: string[];
  salonTags: string[];
  bestFaceShapes: string[];
  maintenance: "low" | "medium" | "high";
  makeoverBias: MakeoverLevel;
  tuningLimits: {
    fringeStrength: [number, number];
    softness: [number, number];
    lengthBias: [number, number];
    crownVolume: [number, number];
    sleekness: [number, number];
    waveBoost: [number, number];
    density: [number, number];
  };
};

export type TrackedFacePose = {
  frame: DetectedFaceFrame;
  foreheadAnchor: {
    x: number;
    y: number;
  };
  crownAnchor: {
    x: number;
    y: number;
  };
  leftTemple: {
    x: number;
    y: number;
  };
  rightTemple: {
    x: number;
    y: number;
  };
  jawLeft: {
    x: number;
    y: number;
  };
  jawRight: {
    x: number;
    y: number;
  };
  faceCenter: {
    x: number;
    y: number;
  };
  templeSpan: number;
  jawSpan: number;
  yaw: number;
  roll: number;
  pitch: number;
  stability: number;
  timestamp: number;
};

export type HairOverlayConfig = {
  presetId: HeroPresetId;
  presetLabel: string;
  silhouette: HairSilhouette;
  colorName: HairColorName;
  part: HairPart;
  texture: HairTextureMode;
  volume: HairVolume;
  fringe: HairFringe;
  length: HairLength;
  fit: HairOverlayFit;
  tuning: PresetTuning;
  makeoverLevel: MakeoverLevel;
  salonTags: string[];
  layerOpacity: {
    shadow: number;
    back: number;
    body: number;
    front: number;
  };
};

export type StyleAgentResponse = {
  selectedStyle: string;
  mashupName: string;
  agentReply: string;
  preferencesSummary: string;
  presetId: HeroPresetId;
  presetLabel: string;
  tuning: PresetTuning;
  makeoverLevel: MakeoverLevel;
  overlay: HairOverlayConfig;
};

export type RenderLookRequest = {
  selectedStyle?: string | null;
  presetId: HeroPresetId;
  presetLabel?: string | null;
  tuning?: Partial<PresetTuning> | null;
  makeoverLevel?: MakeoverLevel | null;
  preferences?: string | null;
  preferencesSummary?: string | null;
  stylistReply?: string | null;
  faceProfile?: FaceProfile | null;
  selfieDataUrl?: string | null;
};

export type RenderLookResponse = {
  imageDataUrl: string;
  mimeType: string;
  title: string;
  brief: string;
  prompt: string;
  model: string;
  modelText: string;
  presetId: HeroPresetId;
  presetLabel: string;
  makeoverLevel: MakeoverLevel;
};

export type StyleBoardResponse = RenderLookResponse & {
  boardCaption?: string;
};

"use client";

import Image from "next/image";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Heart,
  Mic,
  MicOff,
  Scissors,
  Sparkles,
  Upload,
  Video,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  ClientProfileMemory,
  FaceProfile,
  HairColorName,
  HairstyleSuggestion,
  HeroPresetId,
  MakeoverLevel,
  PersistedPortraitAsset,
  PresetTuning,
  RenderLookResponse,
  Salon,
  StyleAgentResponse,
  StyleAgentTurn,
  StyleBoardResponse,
  TrackedFacePose,
} from "@/lib/types";
import {
  ACTIVE_PORTRAIT_ASSET_ID,
  clearPersistedPortraitAsset,
  createEmptyClientProfile,
  describeClientProfile,
  loadClientProfileMemory,
  loadPersistedPortraitAsset,
  mergeClientProfile,
  saveClientProfileMemory,
  savePersistedPortraitAsset,
} from "@/lib/clientProfile";
import {
  HAIR_COLOR_OPTIONS,
  calibrateOverlayToFace,
  calibrateOverlayToTrackedPose,
  createOverlayFromPreset,
  getColorLabel,
  getFaceAnchorDiagnostics,
  getHeroPreset,
  getOverlayPalette,
  getPresetRecommendations,
  HERO_PRESET_SUGGESTIONS,
  inferPresetIdFromStyleName,
  normalizePresetTuning,
  smoothTrackedFacePose,
} from "@/lib/styleStudio";
import { cn } from "@/lib/utils";
import HairstyleOverlay from "./HairstyleOverlay";
import SalonList from "./SalonList";

type RunningMode = "IMAGE" | "VIDEO";
type MirrorViewMode = "live" | "compare" | "render";
type DrawerCategory = "all" | "bobs" | "lobs" | "curtain" | "shag" | "waves";
type VoiceProvider = "browser" | "elevenlabs";

type SpeechRecognitionResultLike = {
  [index: number]: {
    transcript: string;
  };
  isFinal: boolean;
  length: number;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    [index: number]: SpeechRecognitionResultLike;
    length: number;
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: null | (() => void);
  onerror: null | ((event: { error?: string }) => void);
  onresult: null | ((event: SpeechRecognitionEventLike) => void);
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type FaceLandmarkerLike = {
  setOptions: (options: { runningMode: RunningMode }) => Promise<void>;
  detect: (image: HTMLImageElement) => {
    faceLandmarks?: Array<Array<{ x: number; y: number }>>;
  };
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number
  ) => {
    faceLandmarks?: Array<Array<{ x: number; y: number }>>;
  };
  close?: () => void;
};

type Props = {
  faceProfile: FaceProfile | null;
  suggestions: HairstyleSuggestion[];
  selfieUrl: string | null;
  selectedStyle: string | null;
  onSelectStyle: (styleName: string) => void;
  onPortraitAnalyzed: (payload: {
    suggestions: HairstyleSuggestion[];
    imageUrl: string;
    faceProfile: FaceProfile | null;
  }) => void;
  location: string;
  onLocationChange: (value: string) => void;
  onFindSalons: () => void;
  salonLoading: boolean;
  salonError: string | null;
  salons: Salon[];
  hasSearchedSalons: boolean;
  onBackToLobby: () => void;
};

const QUICK_PROMPTS = [
  "Soft, face-framing, polished, and low maintenance.",
  "Luxury bob energy with cleaner lines and a salon finish.",
  "Big movement, richer color melt, and a more editorial mood.",
];

const PRESET_GROUPS: Array<{
  id: DrawerCategory;
  label: string;
  presetIds: HeroPresetId[];
}> = [
  { id: "all", label: "All Looks", presetIds: [] },
  { id: "bobs", label: "Bobs", presetIds: ["precision-bob", "italian-bob"] },
  {
    id: "lobs",
    label: "Lobs & Layers",
    presetIds: ["soft-lob", "face-frame-flip", "sleek-midi"],
  },
  {
    id: "curtain",
    label: "Curtain & Face-Framing",
    presetIds: ["curtain-cloud", "curtain-gloss", "butterfly-blowout"],
  },
  { id: "shag", label: "Shag & Bixie", presetIds: ["modern-shag", "bixie-air"] },
  { id: "waves", label: "Waves & Volume", presetIds: ["volume-waves", "ribbon-waves"] },
];

const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";
const MEDIAPIPE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const FACE_LOCK_HOLD_MS = 1800;
const FACE_SCAN_INTERVAL_MS = 180;
const AUTO_RENDER_DELAY_MS = 1500;
const AUTO_RENDER_COOLDOWN_MS = 7000;
const INITIAL_AGENT_REPLY =
  "Welcome to your private mirror. Tell me the vibe, and I’ll steer the live try-on toward the sharpest preset, then use Gemini to finish it on your portrait.";

function getSpeechRecognitionConstructor():
  | SpeechRecognitionConstructor
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const maybeWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return maybeWindow.SpeechRecognition || maybeWindow.webkitSpeechRecognition;
}

function composePreferenceText(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim() || "")
    .filter(Boolean)
    .join("\n\n");
}

function distanceBetween(
  left: { x: number; y: number },
  right: { x: number; y: number }
) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function urlToDataUrl(url: string) {
  if (url.startsWith("data:")) {
    return url;
  }

  const response = await fetch(url);
  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to convert the portrait into a usable data URL."));
    };
    reader.onerror = () =>
      reject(new Error("Unable to read the portrait for Gemini rendering."));
    reader.readAsDataURL(blob);
  });
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read the portrait file."));
    };
    reader.onerror = () => reject(new Error("Unable to read the portrait file."));
    reader.readAsDataURL(file);
  });
}

async function createPortraitThumbnail(sourceDataUrl: string) {
  if (typeof window === "undefined") {
    return sourceDataUrl;
  }

  const image = new window.Image();
  image.src = sourceDataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to prepare the portrait thumbnail."));
  });

  const canvas = document.createElement("canvas");
  const longestSide = 280;
  const scale = Math.min(1, longestSide / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    return sourceDataUrl;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

async function dataUrlToFile(dataUrl: string, filename: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

function normalizePointToContainer(params: {
  x: number;
  y: number;
  sourceWidth: number;
  sourceHeight: number;
  containerWidth: number;
  containerHeight: number;
}) {
  const {
    x,
    y,
    sourceWidth,
    sourceHeight,
    containerWidth,
    containerHeight,
  } = params;
  const scale = Math.max(
    containerWidth / sourceWidth,
    containerHeight / sourceHeight
  );
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const cropOffsetX = (containerWidth - renderedWidth) / 2;
  const cropOffsetY = (containerHeight - renderedHeight) / 2;

  return {
    x: x * sourceWidth * scale + cropOffsetX,
    y: y * sourceHeight * scale + cropOffsetY,
  };
}

function buildTrackedPoseFromLandmarks(params: {
  landmarks: Array<{ x: number; y: number }>;
  sourceWidth: number;
  sourceHeight: number;
  containerWidth: number;
  containerHeight: number;
  previousPose: TrackedFacePose | null;
}) {
  const {
    landmarks,
    sourceWidth,
    sourceHeight,
    containerWidth,
    containerHeight,
    previousPose,
  } = params;
  const mapPoint = (index: number) =>
    normalizePointToContainer({
      x: landmarks[index]?.x || 0,
      y: landmarks[index]?.y || 0,
      sourceWidth,
      sourceHeight,
      containerWidth,
      containerHeight,
    });
  const allPoints = landmarks.map((landmark) =>
    normalizePointToContainer({
      x: landmark.x,
      y: landmark.y,
      sourceWidth,
      sourceHeight,
      containerWidth,
      containerHeight,
    })
  );
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const frame = {
    x: clamp(minX, 0, containerWidth),
    y: clamp(minY, 0, containerHeight),
    width: clamp(maxX - minX, 1, containerWidth),
    height: clamp(maxY - minY, 1, containerHeight),
    frameWidth: containerWidth,
    frameHeight: containerHeight,
  };
  const foreheadAnchor = mapPoint(10);
  const crownAnchor = {
    x: foreheadAnchor.x,
    y: Math.min(frame.y, foreheadAnchor.y - frame.height * 0.08),
  };
  const leftTemple = mapPoint(127);
  const rightTemple = mapPoint(356);
  const jawLeft = mapPoint(172);
  const jawRight = mapPoint(397);
  const leftEyeOuter = mapPoint(33);
  const rightEyeOuter = mapPoint(263);
  const noseTip = mapPoint(1);
  const chin = mapPoint(152);
  const faceCenter = {
    x: frame.x + frame.width / 2,
    y: frame.y + frame.height / 2,
  };
  const eyeAngle = Math.atan2(
    rightEyeOuter.y - leftEyeOuter.y,
    rightEyeOuter.x - leftEyeOuter.x
  );
  const roll = (eyeAngle * 180) / Math.PI;
  const templeCenterX = (leftTemple.x + rightTemple.x) / 2;
  const yaw = clamp(
    ((noseTip.x - templeCenterX) /
      Math.max(1, distanceBetween(leftTemple, rightTemple))) *
      90,
    -16,
    16
  );
  const pitch = clamp(
    (((chin.y - noseTip.y) - (noseTip.y - foreheadAnchor.y)) /
      Math.max(1, frame.height)) *
      130,
    -16,
    16
  );
  const movement = previousPose
    ? Math.abs(faceCenter.x - previousPose.faceCenter.x) / containerWidth +
      Math.abs(faceCenter.y - previousPose.faceCenter.y) / containerHeight +
      Math.abs(frame.width - previousPose.frame.width) / containerWidth
    : 0.05;
  const stability = clamp(1 - movement * 3.8, 0.2, 1);

  return {
    frame,
    foreheadAnchor,
    crownAnchor,
    leftTemple,
    rightTemple,
    jawLeft,
    jawRight,
    faceCenter,
    templeSpan: distanceBetween(leftTemple, rightTemple),
    jawSpan: distanceBetween(jawLeft, jawRight),
    yaw,
    roll,
    pitch,
    stability,
    timestamp: Date.now(),
  } satisfies TrackedFacePose;
}

export default function PremiumSalonStudio({
  faceProfile,
  suggestions,
  selfieUrl,
  selectedStyle,
  onSelectStyle,
  onPortraitAnalyzed,
  location,
  onLocationChange,
  onFindSalons,
  salonLoading,
  salonError,
  salons,
  hasSearchedSalons,
  onBackToLobby,
}: Props) {
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const selfieImageRef = useRef<HTMLImageElement | null>(null);
  const portraitInputRef = useRef<HTMLInputElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerLike | null>(null);
  const runningModeRef = useRef<RunningMode>("VIDEO");
  const detectionLoopRef = useRef<number | null>(null);
  const detectionBusyRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastFaceSeenAtRef = useRef(0);
  const trackedPoseRef = useRef<TrackedFacePose | null>(null);
  const skipSyncStyleRef = useRef<string | null>(null);
  const speechBasePreferencesRef = useRef("");
  const speechCommittedTranscriptRef = useRef("");
  const lastRenderAtRef = useRef(0);
  const lastRenderSignatureRef = useRef("");
  const autoRenderTimeoutRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(false);

  const initialPresetId = inferPresetIdFromStyleName(
    selectedStyle || suggestions[0]?.name
  );
  const initialPreset = getHeroPreset(initialPresetId);

  const [presetId, setPresetId] = useState(initialPresetId);
  const [tuning, setTuning] = useState<PresetTuning>(() =>
    normalizePresetTuning(initialPresetId)
  );
  const [makeoverLevel, setMakeoverLevel] = useState<MakeoverLevel>(
    initialPreset.makeoverBias
  );
  const [mashupName, setMashupName] = useState(initialPreset.label);
  const [agentReply, setAgentReply] = useState(INITIAL_AGENT_REPLY);
  const [agentSummary, setAgentSummary] = useState(
    "Portrait-aware preset tracking ready."
  );
  const [preferences, setPreferences] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speechDraft, setSpeechDraft] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] =
    useState(false);
  const [speechSynthesisSupported, setSpeechSynthesisSupported] =
    useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [trackingReady, setTrackingReady] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackedPose, setTrackedPose] = useState<TrackedFacePose | null>(null);
  const [faceLockActive, setFaceLockActive] = useState(false);
  const [faceLockHolding, setFaceLockHolding] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitSaving, setPortraitSaving] = useState(false);
  const [portraitBusy, setPortraitBusy] = useState(false);
  const [portraitError, setPortraitError] = useState<string | null>(null);
  const [renderLookLoading, setRenderLookLoading] = useState(false);
  const [renderLookError, setRenderLookError] = useState<string | null>(null);
  const [renderLook, setRenderLook] = useState<RenderLookResponse | null>(null);
  const [styleBoardLoading, setStyleBoardLoading] = useState(false);
  const [styleBoardError, setStyleBoardError] = useState<string | null>(null);
  const [styleBoard, setStyleBoard] = useState<StyleBoardResponse | null>(null);
  const [sessionTurns, setSessionTurns] = useState<StyleAgentTurn[]>([
    { speaker: "agent", text: INITIAL_AGENT_REPLY },
  ]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCategory, setDrawerCategory] = useState<DrawerCategory>("all");
  const [mirrorView, setMirrorView] = useState<MirrorViewMode>("live");
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>("browser");
  const [elevenLabsReady, setElevenLabsReady] = useState(false);
  const [clientProfile, setClientProfile] = useState<ClientProfileMemory>(
    createEmptyClientProfile()
  );
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [portraitAsset, setPortraitAsset] =
    useState<PersistedPortraitAsset | null>(null);

  const activePortraitUrl = portraitAsset?.dataUrl || selfieUrl;
  const portraitPreviewUrl = portraitAsset?.previewDataUrl || activePortraitUrl;
  const resolvedFaceProfile = faceProfile || clientProfile.faceProfile || null;
  const preset = getHeroPreset(presetId);
  const overlaySourceMode = cameraActive
    ? "webcam"
    : activePortraitUrl
      ? "selfie"
      : "mannequin";
  const baseOverlay = createOverlayFromPreset(presetId, tuning, makeoverLevel);
  const calibratedOverlay = calibrateOverlayToTrackedPose(
    calibrateOverlayToFace(baseOverlay, resolvedFaceProfile, overlaySourceMode),
    trackedPose
  );
  const previewOverlay = cameraActive
    ? {
        ...calibratedOverlay,
        fit: {
          ...calibratedOverlay.fit,
          offsetX: -calibratedOverlay.fit.offsetX,
          rotation: -calibratedOverlay.fit.rotation,
        },
      }
    : calibratedOverlay;
  const anchorDiagnostics = getFaceAnchorDiagnostics(trackedPose);
  const displayPoseFrame = trackedPose
    ? cameraActive
      ? {
          ...trackedPose.frame,
          x:
            trackedPose.frame.frameWidth -
            trackedPose.frame.x -
            trackedPose.frame.width,
        }
      : trackedPose.frame
    : null;
  const renderSignature = useMemo(
    () =>
      JSON.stringify({
        presetId,
        tuning,
        makeoverLevel,
        portrait: Boolean(activePortraitUrl),
      }),
    [activePortraitUrl, makeoverLevel, presetId, tuning]
  );
  const currentPresetFavorite = clientProfile.favoritePresetIds.includes(presetId);
  const currentPresetRejected = clientProfile.rejectedPresetIds.includes(presetId);
  const clientMemorySummary = describeClientProfile(clientProfile);

  const updateClientProfile = useCallback(
    (
      updater:
        | Partial<ClientProfileMemory>
        | ((current: ClientProfileMemory) => Partial<ClientProfileMemory>)
    ) => {
      setClientProfile((current) => {
        const base = current || createEmptyClientProfile();
        const patch = typeof updater === "function" ? updater(base) : updater;
        return mergeClientProfile(base, patch);
      });
    },
    []
  );

  const rememberedPreferenceContext = useMemo(() => {
    const favoriteLabels = clientProfile.favoritePresetIds
      .map((favoritePresetId) => getHeroPreset(favoritePresetId).label)
      .join(", ");
    const rejectedLabels = clientProfile.rejectedPresetIds
      .map((rejectedPresetId) => getHeroPreset(rejectedPresetId).label)
      .join(", ");

    return composePreferenceText(
      preferences,
      clientProfile.summary,
      favoriteLabels ? `Loved before: ${favoriteLabels}` : null,
      rejectedLabels ? `Avoid before: ${rejectedLabels}` : null,
      clientProfile.recentNotes.join(" ")
    );
  }, [clientProfile, preferences]);

  const presetLibrary = useMemo(() => {
    const merged = [...suggestions, ...HERO_PRESET_SUGGESTIONS];

    return Array.from(
      new Map(
        merged.map((suggestion) => [
          suggestion.presetId || inferPresetIdFromStyleName(suggestion.name),
          suggestion,
        ])
      ).values()
    );
  }, [suggestions]);

  const recommendedPresets = useMemo(() => {
    const rawRecommendations = getPresetRecommendations({
      suggestions: presetLibrary,
      preferences: rememberedPreferenceContext,
      currentStyle: preset.label,
      faceProfile: resolvedFaceProfile,
      limit: 6,
    });
    const rejectedPresetIds = new Set(clientProfile.rejectedPresetIds);

    return rawRecommendations.filter((suggestion) => {
      const suggestionPresetId =
        suggestion.presetId || inferPresetIdFromStyleName(suggestion.name);
      return !rejectedPresetIds.has(suggestionPresetId);
    });
  }, [
    clientProfile.rejectedPresetIds,
    preset.label,
    presetLibrary,
    rememberedPreferenceContext,
    resolvedFaceProfile,
  ]);

  const alternateRecommendations = useMemo(
    () =>
      recommendedPresets.filter((suggestion) => {
        const suggestionPresetId =
          suggestion.presetId || inferPresetIdFromStyleName(suggestion.name);
        return suggestionPresetId !== presetId;
      }).slice(0, 3),
    [presetId, recommendedPresets]
  );

  const faceGuideStyle = displayPoseFrame
    ? {
        left: `${displayPoseFrame.x}px`,
        top: `${displayPoseFrame.y}px`,
        width: `${displayPoseFrame.width}px`,
        height: `${displayPoseFrame.height}px`,
      }
    : undefined;
  const crownGuideStyle =
    displayPoseFrame && trackedPose
      ? {
          left: `${cameraActive ? trackedPose.frame.frameWidth - trackedPose.crownAnchor.x - 34 : trackedPose.crownAnchor.x - 34}px`,
          top: `${trackedPose.crownAnchor.y - 4}px`,
          width: "68px",
        }
      : undefined;
  const filteredDrawerSuggestions = useMemo(() => {
    if (drawerCategory === "all") {
      return presetLibrary;
    }

    const group = PRESET_GROUPS.find((entry) => entry.id === drawerCategory);
    const allowedIds = new Set(group?.presetIds || []);

    return presetLibrary.filter((suggestion) => {
      const suggestionPresetId =
        suggestion.presetId || inferPresetIdFromStyleName(suggestion.name);
      return allowedIds.has(suggestionPresetId);
    });
  }, [drawerCategory, presetLibrary]);
  const premiumPortraitReady = Boolean(activePortraitUrl);
  const voicePlaybackReady =
    voiceProvider === "elevenlabs" || speechSynthesisSupported;

  const ensureTrackingMode = useCallback(async (mode: RunningMode) => {
    if (!landmarkerRef.current || runningModeRef.current === mode) {
      return;
    }

    await landmarkerRef.current.setOptions({ runningMode: mode });
    runningModeRef.current = mode;
  }, []);

  const updateTrackedPose = useCallback(
    (nextPose: TrackedFacePose | null) => {
      if (!nextPose) {
        const shouldHoldLock =
          Date.now() - lastFaceSeenAtRef.current < FACE_LOCK_HOLD_MS &&
          Boolean(trackedPoseRef.current);

        setFaceLockActive(false);
        setFaceLockHolding(shouldHoldLock);

        if (!shouldHoldLock) {
          trackedPoseRef.current = null;
          setTrackedPose(null);
        }

        return;
      }

      lastFaceSeenAtRef.current = Date.now();
      setFaceLockActive(true);
      setFaceLockHolding(false);
      setTrackedPose((currentPose) => {
        const smoothed = smoothTrackedFacePose(
          currentPose,
          nextPose,
          cameraActive ? 0.3 : 0.42
        );
        trackedPoseRef.current = smoothed;
        return smoothed;
      });
    },
    [cameraActive]
  );

  const detectPoseInElement = useCallback(
    async (element: HTMLVideoElement | HTMLImageElement, mode: RunningMode) => {
      const previewFrame = previewFrameRef.current;

      if (!previewFrame || !landmarkerRef.current) {
        updateTrackedPose(null);
        return;
      }

      const sourceWidth =
        element instanceof HTMLVideoElement
          ? element.videoWidth
          : element.naturalWidth;
      const sourceHeight =
        element instanceof HTMLVideoElement
          ? element.videoHeight
          : element.naturalHeight;

      if (!sourceWidth || !sourceHeight) {
        updateTrackedPose(null);
        return;
      }

      await ensureTrackingMode(mode);

      const result =
        mode === "VIDEO"
          ? landmarkerRef.current.detectForVideo(
              element as HTMLVideoElement,
              performance.now()
            )
          : landmarkerRef.current.detect(element as HTMLImageElement);
      const landmarks = result?.faceLandmarks?.[0];

      if (!landmarks || landmarks.length === 0) {
        updateTrackedPose(null);
        return;
      }

      const nextPose = buildTrackedPoseFromLandmarks({
        landmarks,
        sourceWidth,
        sourceHeight,
        containerWidth: previewFrame.clientWidth,
        containerHeight: previewFrame.clientHeight,
        previousPose: trackedPoseRef.current,
      });

      updateTrackedPose(nextPose);
    },
    [ensureTrackingMode, updateTrackedPose]
  );

  const getPremiumPortraitDataUrl = useCallback(async () => {
    if (!activePortraitUrl) {
      return null;
    }

    return await urlToDataUrl(activePortraitUrl);
  }, [activePortraitUrl]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speakReply = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        return;
      }

      stopSpeaking();

      if (voiceProvider === "elevenlabs") {
        try {
          const response = await fetch("/api/voice/stylist", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text }),
          });
          const data = (await response.json()) as
            | { audioDataUrl: string; provider: "elevenlabs" }
            | { error?: string };

          if (!response.ok || !("audioDataUrl" in data)) {
            throw new Error(
              "error" in data
                ? data.error
                : "ElevenLabs could not speak the stylist reply."
            );
          }

          const audio = new Audio(data.audioDataUrl);
          audioRef.current = audio;
          audio.onplay = () => setSpeaking(true);
          audio.onended = () => {
            setSpeaking(false);
            audioRef.current = null;
          };
          audio.onerror = () => {
            setSpeaking(false);
            audioRef.current = null;
          };

          await audio.play();
          return;
        } catch (error) {
          console.error("ElevenLabs playback failed, falling back:", error);
          setVoiceError(
            error instanceof Error
              ? `${error.message} Falling back to browser voice.`
              : "ElevenLabs voice failed. Falling back to browser voice."
          );
          setVoiceProvider("browser");
          setElevenLabsReady(false);
        }
      }

      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      const preferredVoice = synth
        .getVoices()
        .find((voice) => voice.lang.toLowerCase().startsWith("en"));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.rate = 0.97;
      utterance.pitch = 1.02;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      synth.cancel();
      synth.speak(utterance);
    },
    [stopSpeaking, voiceProvider]
  );

  const rememberCurrentLook = useCallback(() => {
    updateClientProfile((current) => ({
      summary: agentSummary || current.summary,
      favoritePresetIds: [...current.favoritePresetIds, presetId],
      rejectedPresetIds: current.rejectedPresetIds.filter((id) => id !== presetId),
      preferredColors: [...current.preferredColors, tuning.colorDirection],
      maintenancePreference: preset.maintenance,
      recentNotes: [
        ...current.recentNotes,
        `Approved ${preset.label} with ${getColorLabel(tuning.colorDirection)}.`,
      ].slice(-6),
      lastPresetId: presetId,
      portraitAssetId: portraitAsset?.id || current.portraitAssetId,
      faceProfile: resolvedFaceProfile,
    }));
  }, [
    agentSummary,
    portraitAsset?.id,
    preset.label,
    preset.maintenance,
    presetId,
    resolvedFaceProfile,
    tuning.colorDirection,
    updateClientProfile,
  ]);

  const rejectCurrentLook = useCallback(() => {
    updateClientProfile((current) => ({
      rejectedPresetIds: [...current.rejectedPresetIds, presetId],
      favoritePresetIds: current.favoritePresetIds.filter((id) => id !== presetId),
      recentNotes: [
        ...current.recentNotes,
        `Avoid ${preset.label} unless the brief changes.`,
      ].slice(-6),
      lastPresetId: current.lastPresetId,
    }));
  }, [preset.label, presetId, updateClientProfile]);

  const handleRenderLook = useCallback(
    async (mode: "manual" | "auto") => {
      const referenceDataUrl = await getPremiumPortraitDataUrl();

      if (!referenceDataUrl) {
        setRenderLookError(
          "Upload a portrait to unlock the premium Gemini render."
        );
        return;
      }

      if (
        mode === "auto" &&
        Date.now() - lastRenderAtRef.current < AUTO_RENDER_COOLDOWN_MS
      ) {
        return;
      }

      setRenderLookLoading(true);
      setRenderLookError(null);

      try {
        const response = await fetch("/api/render-look", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            selectedStyle: preset.label,
            presetId,
            presetLabel: preset.label,
            tuning,
            makeoverLevel,
            preferences,
            preferencesSummary: agentSummary,
            stylistReply: agentReply,
            clientProfile,
            faceProfile: resolvedFaceProfile,
            selfieDataUrl: referenceDataUrl,
          }),
        });
        const data = (await response.json()) as
          | RenderLookResponse
          | { error?: string };

        if (!response.ok || !("imageDataUrl" in data)) {
          const message =
            "error" in data ? data.error : "The realistic look could not be rendered.";
          throw new Error(message || "The realistic look could not be rendered.");
        }

        setRenderLook(data);
        setMirrorView((current) => (current === "live" ? "compare" : current));
        lastRenderAtRef.current = Date.now();
        lastRenderSignatureRef.current = renderSignature;
        rememberCurrentLook();
      } catch (error) {
        setRenderLookError(
          error instanceof Error
            ? error.message
            : "The realistic look could not be rendered."
        );
      } finally {
        setRenderLookLoading(false);
      }
    },
    [
      agentReply,
      agentSummary,
      clientProfile,
      getPremiumPortraitDataUrl,
      makeoverLevel,
      preferences,
      preset.label,
      presetId,
      rememberCurrentLook,
      renderSignature,
      resolvedFaceProfile,
      tuning,
    ]
  );

  const handleGenerateStyleBoard = useCallback(async () => {
    const referenceDataUrl = await getPremiumPortraitDataUrl();

    if (!referenceDataUrl) {
      setStyleBoardError(
        "Upload a portrait before generating the final salon handoff."
      );
      return;
    }

    setStyleBoardLoading(true);
    setStyleBoardError(null);

    try {
      const response = await fetch("/api/style-board", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedStyle: preset.label,
          presetId,
          presetLabel: preset.label,
          tuning,
          makeoverLevel,
          mashupName,
          preferences,
          preferencesSummary: agentSummary,
          stylistReply: agentReply,
          clientProfile,
          faceProfile: resolvedFaceProfile,
          selfieDataUrl: referenceDataUrl,
        }),
      });
      const data = (await response.json()) as
        | StyleBoardResponse
        | { error?: string };

      if (!response.ok || !("imageDataUrl" in data)) {
        const message =
          "error" in data ? data.error : "The style board could not be generated.";
        throw new Error(message || "The style board could not be generated.");
      }

      setStyleBoard(data);
      rememberCurrentLook();
    } catch (error) {
      setStyleBoardError(
        error instanceof Error
          ? error.message
          : "The style board could not be generated."
      );
    } finally {
      setStyleBoardLoading(false);
    }
  }, [
    agentReply,
    agentSummary,
    clientProfile,
    getPremiumPortraitDataUrl,
    makeoverLevel,
    mashupName,
    preferences,
    preset.label,
    presetId,
    rememberCurrentLook,
    resolvedFaceProfile,
    tuning,
  ]);

  const handlePresetSelect = useCallback(
    (styleName: string) => {
      const nextPresetId = inferPresetIdFromStyleName(styleName);
      const nextPreset = getHeroPreset(nextPresetId);

      skipSyncStyleRef.current = styleName;
      setPresetId(nextPresetId);
      setTuning(normalizePresetTuning(nextPresetId));
      setMakeoverLevel(nextPreset.makeoverBias);
      setMashupName(nextPreset.label);
      setAgentSummary(`${nextPreset.label} is loaded in the mirror suite.`);
      onSelectStyle(nextPreset.label);
      setRenderLook(null);
      setStyleBoard(null);
      updateClientProfile({
        lastPresetId: nextPresetId,
        maintenancePreference: nextPreset.maintenance,
      });
    },
    [onSelectStyle, updateClientProfile]
  );

  const handleColorSelect = useCallback(
    (colorName: HairColorName) => {
      setTuning((current) =>
        normalizePresetTuning(presetId, {
          ...current,
          colorDirection: colorName,
        })
      );
      setRenderLook(null);
      setStyleBoard(null);
      updateClientProfile((current) => ({
        preferredColors: [...current.preferredColors, colorName],
      }));
    },
    [presetId, updateClientProfile]
  );

  const handleAgentSubmit = useCallback(async () => {
    const composedPreferences = listening
      ? composePreferenceText(
          speechBasePreferencesRef.current,
          speechCommittedTranscriptRef.current,
          speechDraft
        )
      : preferences;
    const trimmedPreferences = composedPreferences.trim();

    if (listening) {
      setPreferences(composedPreferences);
      setSpeechDraft("");
      recognitionRef.current?.stop();
      setListening(false);
    }

    if (speechSynthesisSupported) {
      stopSpeaking();
    }

    setAgentLoading(true);
    setVoiceError(null);

    try {
      const response = await fetch("/api/style-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preferences: composedPreferences,
          currentStyle: preset.label,
          suggestions,
          conversationHistory: sessionTurns.slice(-6),
          clientProfile,
        }),
      });
      const data = (await response.json()) as
        | StyleAgentResponse
        | { error?: string };

      if (!response.ok || !("presetId" in data)) {
        const message =
          "error" in data ? data.error : "The style agent could not respond.";
        throw new Error(message || "The style agent could not respond.");
      }

      skipSyncStyleRef.current = data.selectedStyle;
      setPresetId(data.presetId);
      setTuning(data.tuning);
      setMakeoverLevel(data.makeoverLevel);
      setMashupName(data.mashupName);
      setAgentReply(data.agentReply);
      setAgentSummary(data.preferencesSummary);
      setRenderLook(null);
      setStyleBoard(null);
      startTransition(() => {
        setSessionTurns((currentTurns) => {
          const nextTurns: StyleAgentTurn[] = trimmedPreferences
            ? [
                ...currentTurns,
                { speaker: "user", text: trimmedPreferences },
                { speaker: "agent", text: data.agentReply },
              ]
            : [...currentTurns, { speaker: "agent", text: data.agentReply }];

          return nextTurns.slice(-8);
        });
      });
      onSelectStyle(data.selectedStyle);
      updateClientProfile((current) => ({
        summary: data.preferencesSummary,
        favoritePresetIds: current.favoritePresetIds.includes(data.presetId)
          ? current.favoritePresetIds
          : current.favoritePresetIds,
        preferredColors: [...current.preferredColors, data.tuning.colorDirection],
        recentNotes: [
          ...current.recentNotes,
          trimmedPreferences || data.preferencesSummary,
          data.agentReply,
        ].slice(-6),
        lastPresetId: data.presetId,
        maintenancePreference: getHeroPreset(data.presetId).maintenance,
        faceProfile: resolvedFaceProfile,
      }));

      if (voiceReplyEnabled && voicePlaybackReady) {
        void speakReply(data.agentReply);
      }
    } catch (error) {
      setVoiceError(
        error instanceof Error
          ? error.message
          : "The style agent could not respond."
      );
    } finally {
      setAgentLoading(false);
    }
  }, [
    clientProfile,
    listening,
    onSelectStyle,
    preferences,
    preset.label,
    sessionTurns,
    speakReply,
    speechDraft,
    speechSynthesisSupported,
    stopSpeaking,
    suggestions,
    updateClientProfile,
    voicePlaybackReady,
    voiceReplyEnabled,
    resolvedFaceProfile,
  ]);

  const handlePortraitAnalyze = useCallback(async () => {
    if (!activePortraitUrl) {
      setPortraitError("Upload a portrait before analyzing it.");
      return;
    }

    setPortraitBusy(true);
    setPortraitError(null);

    try {
      const file =
        portraitFile || (await dataUrlToFile(await urlToDataUrl(activePortraitUrl), "hairmatch-portrait.jpg"));
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analyze-selfie", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        suggestions?: HairstyleSuggestion[];
        faceProfile?: FaceProfile;
        error?: string;
      };

      if (!response.ok || !data.suggestions) {
        throw new Error(data.error || "We couldn't analyze that portrait.");
      }

      onPortraitAnalyzed({
        suggestions: data.suggestions,
        imageUrl: activePortraitUrl,
        faceProfile: data.faceProfile || null,
      });
      updateClientProfile({
        summary:
          clientProfile.summary ||
          "Portrait analyzed and ready for premium salon rendering.",
        portraitAssetId: ACTIVE_PORTRAIT_ASSET_ID,
        faceProfile: data.faceProfile || null,
      });
      setRenderLook(null);
      setStyleBoard(null);
      setAgentSummary(
        data.faceProfile
          ? `Portrait analyzed for a ${data.faceProfile.faceShape} face with ${data.faceProfile.hairTexture} texture.`
          : "Portrait analyzed and ready for premium rendering."
      );
    } catch (error) {
      setPortraitError(
        error instanceof Error
          ? error.message
          : "We couldn't analyze that portrait."
      );
    } finally {
      setPortraitBusy(false);
    }
  }, [
    activePortraitUrl,
    clientProfile.summary,
    onPortraitAnalyzed,
    portraitFile,
    updateClientProfile,
  ]);

  const handlePortraitSelection = useCallback(
    async (file: File | null) => {
      setPortraitFile(file);
      setPortraitError(null);

      if (!file) {
        return;
      }

      setPortraitSaving(true);

      try {
        const dataUrl = await fileToDataUrl(file);
        const previewDataUrl = await createPortraitThumbnail(dataUrl);
        const nextAsset: PersistedPortraitAsset = {
          id: ACTIVE_PORTRAIT_ASSET_ID,
          dataUrl,
          previewDataUrl,
          mimeType: file.type || "image/jpeg",
          updatedAt: new Date().toISOString(),
        };

        setPortraitAsset(nextAsset);
        await savePersistedPortraitAsset(nextAsset);
        updateClientProfile({
          portraitAssetId: ACTIVE_PORTRAIT_ASSET_ID,
        });
        setRenderLook(null);
        setStyleBoard(null);
      } catch (error) {
        setPortraitError(
          error instanceof Error
            ? error.message
            : "We couldn't store that portrait."
        );
      } finally {
        setPortraitSaving(false);
      }
    },
    [updateClientProfile]
  );

  const removePortrait = useCallback(async () => {
    setPortraitFile(null);
    setPortraitAsset(null);
    setPortraitError(null);
    setRenderLook(null);
    setStyleBoard(null);
    await clearPersistedPortraitAsset();
    updateClientProfile({
      portraitAssetId: null,
    });
  }, [updateClientProfile]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Webcam access is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      setCameraActive(true);
      setCameraError(null);
    } catch (error) {
      console.error("Failed to start webcam:", error);
      setCameraError(
        "We couldn’t access the webcam. You can still style from portrait mode."
      );
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setFaceLockHolding(false);
  }, []);

  const returnToLobby = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    stopSpeaking();
    stopCamera();
    onBackToLobby();
  }, [onBackToLobby, stopCamera, stopSpeaking]);

  const toggleListening = useCallback(() => {
    if (listening) {
      const committedPreferences = composePreferenceText(
        speechBasePreferencesRef.current,
        speechCommittedTranscriptRef.current,
        speechDraft
      );

      setPreferences(committedPreferences);
      setSpeechDraft("");
      recognitionRef.current?.stop();
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();

    if (!Recognition) {
      setVoiceError(
        "Voice capture works best in Chrome. You can still type to the stylist below."
      );
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    speechBasePreferencesRef.current = preferences.trim();
    speechCommittedTranscriptRef.current = "";
    setSpeechDraft("");

    recognition.onresult = (event) => {
      const committedTranscript = Array.from(
        { length: event.results.length },
        (_, index) => event.results[index]
      )
        .filter((result) => result.isFinal)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      const interimTranscript = Array.from(
        { length: event.results.length },
        (_, index) => event.results[index]
      )
        .filter((result) => !result.isFinal)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();

      speechCommittedTranscriptRef.current = committedTranscript;
      setSpeechDraft(interimTranscript);
      setPreferences(
        composePreferenceText(
          speechBasePreferencesRef.current,
          committedTranscript
        )
      );
      setVoiceError(null);
    };

    recognition.onerror = (event) => {
      setVoiceError(
        event.error
          ? `Voice capture error: ${event.error}.`
          : "Voice capture hit an unexpected error."
      );
      setListening(false);
    };

    recognition.onend = () => {
      setPreferences(
        composePreferenceText(
          speechBasePreferencesRef.current,
          speechCommittedTranscriptRef.current
        )
      );
      setSpeechDraft("");
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setVoiceError(null);
  }, [listening, preferences, speechDraft]);

  useEffect(() => {
    mountedRef.current = true;
    setSpeechRecognitionSupported(Boolean(getSpeechRecognitionConstructor()));
    setSpeechSynthesisSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setClientProfile(loadClientProfileMemory());
    let cancelled = false;

    const hydratePortrait = async () => {
      const asset = await loadPersistedPortraitAsset();

      if (!cancelled) {
        setPortraitAsset(asset);
        setProfileHydrated(true);
      }
    };

    void hydratePortrait();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!profileHydrated) {
      return;
    }

    saveClientProfileMemory(clientProfile);
  }, [clientProfile, profileHydrated]);

  useEffect(() => {
    if (!profileHydrated) {
      return;
    }

    if (
      sessionTurns.length === 1 &&
      (clientMemorySummary || clientProfile.lastPresetId || portraitAsset)
    ) {
      const welcomeBack = clientMemorySummary
        ? `Welcome back. I remember ${clientMemorySummary.toLowerCase()}. We can refine from there or push in a new direction.`
        : "Welcome back. Your portrait and styling profile are already in the room.";

      setAgentReply(welcomeBack);
      setSessionTurns([{ speaker: "agent", text: welcomeBack }]);
    }
  }, [
    clientMemorySummary,
    clientProfile.lastPresetId,
    portraitAsset,
    profileHydrated,
    sessionTurns.length,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadVoiceProvider = async () => {
      try {
        const response = await fetch("/api/voice/stylist", {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          configured?: boolean;
          provider?: VoiceProvider;
        };

        if (cancelled) {
          return;
        }

        if (response.ok && data.configured && data.provider === "elevenlabs") {
          setVoiceProvider("elevenlabs");
          setElevenLabsReady(true);
        }
      } catch {
        if (!cancelled) {
          setVoiceProvider("browser");
          setElevenLabsReady(false);
        }
      }
    };

    void loadVoiceProvider();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootMediaPipe = async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(
          MEDIAPIPE_WASM_URL
        );
        const landmarker = await vision.FaceLandmarker.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath: MEDIAPIPE_MODEL_URL,
            },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
            minFaceDetectionConfidence: 0.55,
            minFacePresenceConfidence: 0.55,
            minTrackingConfidence: 0.55,
          }
        );

        if (cancelled) {
          landmarker.close?.();
          return;
        }

        landmarkerRef.current = landmarker;
        runningModeRef.current = "VIDEO";
        setTrackingReady(true);
      } catch (error) {
        console.error("Unable to boot MediaPipe Face Landmarker:", error);
        setTrackingError(
          "MediaPipe face tracking could not load. The mirror will stay in manual preview mode."
        );
      }
    };

    void bootMediaPipe();
    void startCamera();

    return () => {
      cancelled = true;
      recognitionRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (detectionLoopRef.current) {
        cancelAnimationFrame(detectionLoopRef.current);
      }
      if (autoRenderTimeoutRef.current) {
        window.clearTimeout(autoRenderTimeoutRef.current);
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
    };
  }, [startCamera]);

  useEffect(() => {
    if (skipSyncStyleRef.current === selectedStyle) {
      skipSyncStyleRef.current = null;
      return;
    }

    const nextStyle = selectedStyle || suggestions[0]?.name;

    if (!nextStyle) {
      return;
    }

    const nextPresetId = inferPresetIdFromStyleName(nextStyle);
    const nextPreset = getHeroPreset(nextPresetId);
    setPresetId(nextPresetId);
    setTuning((current) => normalizePresetTuning(nextPresetId, current));
    setMakeoverLevel(nextPreset.makeoverBias);
    setMashupName(nextPreset.label);
  }, [selectedStyle, suggestions]);

  useEffect(() => {
    trackedPoseRef.current = trackedPose;
  }, [trackedPose]);

  useEffect(() => {
    setRenderLook(null);
    setRenderLookError(null);
    setStyleBoard(null);
    setStyleBoardError(null);
    lastRenderSignatureRef.current = "";
  }, [mashupName, presetId, tuning, makeoverLevel]);

  useEffect(() => {
    if (!cameraActive || !trackingReady || !videoRef.current) {
      return;
    }

    let cancelled = false;
    let lastDetectionAt = 0;

    const loop = async (timestamp: number) => {
      if (cancelled) {
        return;
      }

      const video = videoRef.current;

      if (
        video &&
        video.readyState >= 2 &&
        !detectionBusyRef.current &&
        timestamp - lastDetectionAt > FACE_SCAN_INTERVAL_MS
      ) {
        detectionBusyRef.current = true;
        lastDetectionAt = timestamp;

        try {
          await detectPoseInElement(video, "VIDEO");
        } finally {
          detectionBusyRef.current = false;
        }
      }

      detectionLoopRef.current = requestAnimationFrame(loop);
    };

    detectionLoopRef.current = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      if (detectionLoopRef.current) {
        cancelAnimationFrame(detectionLoopRef.current);
        detectionLoopRef.current = null;
      }
    };
  }, [cameraActive, detectPoseInElement, trackingReady]);

  useEffect(() => {
    const image = selfieImageRef.current;

    if (!activePortraitUrl || cameraActive || !image || !trackingReady) {
      return;
    }

    const run = async () => {
      if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
        return;
      }

      await detectPoseInElement(image, "IMAGE");
    };

    void run();
  }, [activePortraitUrl, cameraActive, detectPoseInElement, trackingReady]);

  useEffect(() => {
    if (
      !trackingReady ||
      !premiumPortraitReady ||
      !cameraActive ||
      !faceLockActive ||
      anchorDiagnostics.score < 0.58 ||
      renderLookLoading
    ) {
      if (autoRenderTimeoutRef.current) {
        window.clearTimeout(autoRenderTimeoutRef.current);
      }
      return;
    }

    if (lastRenderSignatureRef.current === renderSignature) {
      return;
    }

    autoRenderTimeoutRef.current = window.setTimeout(() => {
      void handleRenderLook("auto");
    }, AUTO_RENDER_DELAY_MS);

    return () => {
      if (autoRenderTimeoutRef.current) {
        window.clearTimeout(autoRenderTimeoutRef.current);
      }
    };
  }, [
    anchorDiagnostics.score,
    cameraActive,
    faceLockActive,
    handleRenderLook,
    premiumPortraitReady,
    renderLookLoading,
    renderSignature,
    trackingReady,
  ]);

  const renderOverlayModeControls =
    renderLook && (
      <div className="absolute right-4 top-4 z-20 flex gap-2 rounded-full border border-white/12 bg-slate-950/75 p-1 backdrop-blur">
        {([
          { id: "live", label: "Live" },
          { id: "compare", label: "Compare" },
          { id: "render", label: "Gemini" },
        ] as Array<{ id: MirrorViewMode; label: string }>).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setMirrorView(option.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors",
              mirrorView === option.id
                ? "bg-cyan-300 text-slate-950"
                : "text-slate-300 hover:text-white"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    );

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_top,#123554_0%,#08111d_38%,#04070d_100%)] px-4 py-4 text-white md:px-8 md:py-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={returnToLobby}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white transition-colors hover:border-cyan-400/35 hover:text-cyan-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to salon lobby
          </button>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
              Personal Mirror Suite
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
              {cameraActive ? "Webcam live" : "Camera optional"}
            </span>
            <span
              className={cn(
                "rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em]",
                premiumPortraitReady
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                  : "border-amber-400/20 bg-amber-400/10 text-amber-100"
              )}
            >
              {premiumPortraitReady ? "Portrait ready" : "Portrait required"}
            </span>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.33fr_0.67fr]">
          <div className="relative min-h-[780px] overflow-hidden rounded-[2.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(88,47,98,0.22),rgba(7,16,28,0.9))] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(127,211,255,0.18),transparent_64%)]" />
            <div className="relative mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Private stylist session
                </div>
                <h2 className="mt-3 text-3xl font-medium tracking-tight text-white">
                  Sit at the mirror and try looks in one place.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                  The webcam stays live in the mirror, the portrait dock keeps premium renders unlocked, and the salon drawer holds presets, color melts, and refinements without leaving the room.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={cameraActive ? stopCamera : startCamera}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                >
                  {cameraActive ? <Camera className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  {cameraActive ? "Pause webcam" : "Use webcam"}
                </button>
                <button
                  type="button"
                  onClick={() => portraitInputRef.current?.click()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                >
                  <Upload className="h-4 w-4" />
                  Add portrait
                </button>
              </div>
            </div>

            <div className="relative min-h-[640px] overflow-hidden rounded-[2.4rem] border border-[#d8c08f]/25 bg-[linear-gradient(180deg,rgba(58,34,75,0.46),rgba(5,11,21,0.85))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="absolute inset-0 rounded-[2rem] border border-white/5" />
              <div className="absolute inset-4 overflow-hidden rounded-[2rem] border border-[#d8c08f]/35 bg-[radial-gradient(circle_at_top,rgba(87,156,189,0.18),rgba(9,18,30,0.94)_38%,rgba(4,8,16,1)_100%)] shadow-[0_30px_90px_rgba(0,0,0,0.46)]">
                <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0))]" />
                <div className="pointer-events-none absolute inset-0 opacity-80">
                  <motion.div
                    animate={{ x: ["-18%", "118%"] }}
                    transition={{ duration: 4.8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-y-0 w-24 bg-[linear-gradient(90deg,transparent,rgba(219,247,255,0.18),transparent)] blur-xl"
                  />
                </div>

                <div
                  ref={previewFrameRef}
                  className="absolute inset-0 overflow-hidden"
                >
                  {cameraActive ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
                    />
                  ) : activePortraitUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        ref={selfieImageRef}
                        src={activePortraitUrl}
                        alt="Portrait preview"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(24,54,75,0.28),rgba(7,13,23,0.96))]">
                      <div className="text-center">
                        <div className="mx-auto h-44 w-44 rounded-full border border-white/10 bg-white/[0.04]" />
                        <div className="mx-auto mt-5 h-52 w-64 rounded-[46%] border border-white/10 bg-white/[0.04]" />
                        <p className="mt-6 text-sm text-slate-300">
                          Start the webcam or upload a portrait to wake up the mirror.
                        </p>
                      </div>
                    </div>
                  )}

                  <HairstyleOverlay config={previewOverlay} mirrored={cameraActive} />

                  {faceGuideStyle && (
                    <>
                      <div
                        style={faceGuideStyle}
                        className="pointer-events-none absolute rounded-[42%] border border-emerald-300/45 bg-emerald-300/[0.04]"
                      />
                      {crownGuideStyle && (
                        <div
                          style={crownGuideStyle}
                          className="pointer-events-none absolute border-t border-dashed border-cyan-300/60"
                        />
                      )}
                    </>
                  )}

                  {mirrorView !== "live" && renderLook && (
                    <div
                      className={cn(
                        "absolute inset-0 z-10 transition-all duration-300",
                        mirrorView === "render"
                          ? "bg-slate-950/88"
                          : "pointer-events-none bg-gradient-to-r from-transparent via-transparent to-slate-950/92"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950/82 shadow-[0_24px_60px_rgba(0,0,0,0.35)]",
                          mirrorView === "render"
                            ? "inset-4"
                            : "right-4 top-4 bottom-4 w-[45%]"
                        )}
                      >
                        <Image
                          src={renderLook.imageDataUrl}
                          alt={renderLook.title}
                          fill
                          unoptimized
                          sizes="(max-width: 1280px) 100vw, 35vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/96 to-transparent p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                            Gemini render
                          </div>
                          <div className="mt-1 text-sm font-medium text-white">
                            {renderLook.title}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-slate-950/72 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200 backdrop-blur">
                    {cameraActive ? "Webcam live" : activePortraitUrl ? "Portrait mode" : "Mirror idle"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-slate-950/72 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
                    {preset.label}
                  </span>
                  <span className="rounded-full border border-white/10 bg-slate-950/72 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200 backdrop-blur">
                    {trackingReady
                      ? faceLockActive
                        ? "Tracking locked"
                        : faceLockHolding
                          ? "Holding frame"
                          : "Tracking ready"
                      : "Tracking booting"}
                  </span>
                </div>

                {renderOverlayModeControls}

                <div className="absolute left-4 bottom-24 z-20 max-w-sm rounded-[1.6rem] border border-white/10 bg-slate-950/75 px-4 py-3 backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    Current salon edit
                  </div>
                  <div className="mt-2 text-2xl font-medium text-white">
                    {mashupName}
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-slate-300">
                    {agentSummary}
                  </div>
                </div>

                <div className="absolute right-4 bottom-24 z-20 rounded-full border border-white/10 bg-slate-950/72 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-200 backdrop-blur">
                  {anchorDiagnostics.label} • {Math.round(anchorDiagnostics.score * 100)}%
                </div>
              </div>

              <div className="pointer-events-none absolute inset-x-8 bottom-4 z-10 h-6 rounded-full bg-black/45 blur-xl" />

              <div className="absolute right-8 top-8 z-30 w-[220px] rounded-[1.7rem] border border-white/12 bg-slate-950/78 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.32)] backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">
                      Portrait dock
                    </div>
                    <div className="mt-1 text-sm text-white">
                      Premium renders need your portrait.
                    </div>
                  </div>
                  {portraitPreviewUrl ? (
                    <button
                      type="button"
                      onClick={() => void removePortrait()}
                      className="rounded-full border border-white/10 p-2 text-slate-300 transition-colors hover:border-rose-400/30 hover:text-rose-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                <input
                  ref={portraitInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    void handlePortraitSelection(event.target.files?.[0] || null);
                  }}
                  className="hidden"
                />

                <div className="mt-4 overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.04]">
                  {portraitPreviewUrl ? (
                    <div className="relative aspect-[4/5]">
                      <Image
                        src={portraitPreviewUrl}
                        alt="Portrait dock"
                        fill
                        unoptimized
                        sizes="220px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[4/5] items-center justify-center px-4 text-center text-sm text-slate-400">
                      Upload once and keep the same portrait on across visits.
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={() => portraitInputRef.current?.click()}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {portraitSaving ? "Saving portrait..." : portraitPreviewUrl ? "Change portrait" : "Upload portrait"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePortraitAnalyze()}
                    disabled={!portraitPreviewUrl || portraitBusy}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {portraitBusy ? "Analyzing..." : "Analyze portrait"}
                  </button>
                </div>

                <div className="mt-3 text-xs leading-relaxed text-slate-400">
                  {portraitPreviewUrl
                    ? "Portrait is pinned and will keep the Gemini finish consistent."
                    : "You can still chat and preview live without it, but premium renders stay locked until a portrait is added."}
                </div>

                {portraitError && (
                  <div className="mt-3 rounded-[1.2rem] border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                    {portraitError}
                  </div>
                )}
              </div>

              <div className="absolute inset-x-4 bottom-4 z-30">
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen((current) => !current)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-slate-950/84 px-5 text-sm font-medium text-white backdrop-blur transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                  >
                    {drawerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    Salon drawer
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {drawerOpen && (
                    <motion.div
                      initial={{ y: 80, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 80, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 240, damping: 24 }}
                      className="mt-3 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/90 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.48)] backdrop-blur"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                            Salon drawer
                          </div>
                          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
                            Explore grouped cuts, shift the color melt, and fine-tune the feel while the mirror stays live.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleRenderLook("manual")}
                            disabled={renderLookLoading || !premiumPortraitReady}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            {renderLookLoading ? "Rendering..." : "Render on portrait"}
                          </button>
                          <button
                            type="button"
                            onClick={handleAgentSubmit}
                            disabled={agentLoading}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 px-4 text-xs font-medium text-white transition-colors hover:border-cyan-400/30 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                            {agentLoading ? "Stylist thinking..." : "Ask stylist"}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {PRESET_GROUPS.map((group) => (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => setDrawerCategory(group.id)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors",
                              drawerCategory === group.id
                                ? "border-fuchsia-400/35 bg-fuchsia-400/10 text-fuchsia-100"
                                : "border-white/10 text-slate-300 hover:border-white/20 hover:text-white"
                            )}
                          >
                            {group.label}
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-3 xl:grid-cols-[1.06fr_0.94fr]">
                        <div className="space-y-4">
                          <div>
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Stylist picks
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {alternateRecommendations.slice(0, 3).map((suggestion) => {
                                const suggestionPresetId =
                                  suggestion.presetId || inferPresetIdFromStyleName(suggestion.name);

                                return (
                                  <button
                                    key={`drawer-pick-${suggestionPresetId}`}
                                    type="button"
                                    onClick={() => handlePresetSelect(suggestion.name)}
                                    className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition-colors hover:border-cyan-300/35 hover:bg-cyan-400/14"
                                  >
                                    {suggestion.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2 xl:max-h-[320px] xl:overflow-y-auto xl:pr-1">
                            {filteredDrawerSuggestions.map((suggestion) => {
                              const suggestionPresetId =
                                suggestion.presetId || inferPresetIdFromStyleName(suggestion.name);
                              const suggestionPreset = getHeroPreset(suggestionPresetId);
                              const active = suggestionPresetId === presetId;

                              return (
                                <button
                                  key={`${drawerCategory}-${suggestionPresetId}`}
                                  type="button"
                                  onClick={() => handlePresetSelect(suggestion.name)}
                                  className={cn(
                                    "rounded-[1.6rem] border px-4 py-4 text-left transition-colors",
                                    active
                                      ? "border-cyan-400/35 bg-cyan-400/10 text-white"
                                      : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20 hover:bg-white/[0.05]"
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-medium">
                                      {suggestionPreset.label}
                                    </div>
                                    {suggestionPresetId === clientProfile.lastPresetId ? (
                                      <span className="rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-fuchsia-100">
                                        remembered
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-2 text-xs leading-relaxed text-slate-400">
                                    {suggestion.reason}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {suggestionPreset.vibes.slice(0, 2).map((vibe) => (
                                      <span
                                        key={`${suggestionPresetId}-${vibe}`}
                                        className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-400"
                                      >
                                        {vibe}
                                      </span>
                                    ))}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Color melt
                            </div>
                            <div className="grid gap-2 sm:grid-cols-5 xl:grid-cols-1">
                              {HAIR_COLOR_OPTIONS.map((color) => {
                                const palette = getOverlayPalette(color.id);
                                const active = tuning.colorDirection === color.id;

                                return (
                                  <button
                                    key={`drawer-color-${color.id}`}
                                    type="button"
                                    onClick={() => handleColorSelect(color.id)}
                                    className={cn(
                                      "rounded-[1.2rem] border px-3 py-3 text-left transition-colors",
                                      active
                                        ? "border-cyan-400/35 bg-cyan-400/10"
                                        : "border-white/10 bg-white/[0.03] hover:border-white/20"
                                    )}
                                  >
                                    <div
                                      className="h-10 rounded-[0.9rem]"
                                      style={{
                                        background: `linear-gradient(135deg, ${palette.shine}, ${palette.mid} 48%, ${palette.base} 100%)`,
                                      }}
                                    />
                                    <div className="mt-2 text-xs font-medium text-white">
                                      {getColorLabel(color.id)}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Custom finish
                            </div>
                            <div className="mt-3 grid gap-4">
                              <div>
                                <div className="mb-2 text-xs font-medium text-white">
                                  Part
                                </div>
                                <div className="flex gap-2">
                                  {(["center", "side"] as const).map((part) => (
                                    <button
                                      key={part}
                                      type="button"
                                      onClick={() => {
                                        setTuning((current) =>
                                          normalizePresetTuning(presetId, {
                                            ...current,
                                            part,
                                          })
                                        );
                                      }}
                                      className={cn(
                                        "rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                                        tuning.part === part
                                          ? "border-fuchsia-400/35 bg-fuchsia-400/10 text-fuchsia-100"
                                          : "border-white/10 text-slate-300 hover:border-white/20 hover:text-white"
                                      )}
                                    >
                                      {part}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {([
                                {
                                  key: "softness",
                                  label: "Softness",
                                  min: -0.3,
                                  max: 1,
                                  step: 0.05,
                                },
                                {
                                  key: "crownVolume",
                                  label: "Crown volume",
                                  min: -0.3,
                                  max: 1,
                                  step: 0.05,
                                },
                                {
                                  key: "waveBoost",
                                  label: "Movement",
                                  min: -0.2,
                                  max: 1,
                                  step: 0.05,
                                },
                              ] as Array<{
                                key: keyof Pick<
                                  PresetTuning,
                                  "softness" | "crownVolume" | "waveBoost"
                                >;
                                label: string;
                                min: number;
                                max: number;
                                step: number;
                              }>).map((control) => (
                                <label key={control.key}>
                                  <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                                    <span>{control.label}</span>
                                    <span>{tuning[control.key].toFixed(2)}</span>
                                  </div>
                                  <input
                                    type="range"
                                    min={control.min}
                                    max={control.max}
                                    step={control.step}
                                    value={tuning[control.key]}
                                    onChange={(event) => {
                                      const nextValue = Number(event.target.value);
                                      setTuning((current) =>
                                        normalizePresetTuning(presetId, {
                                          ...current,
                                          [control.key]: nextValue,
                                        })
                                      );
                                    }}
                                    className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-300"
                                  />
                                </label>
                              ))}

                              <div>
                                <div className="mb-2 text-xs font-medium text-white">
                                  Makeover level
                                </div>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  {(["subtle", "signature", "editorial"] as MakeoverLevel[]).map(
                                    (level) => (
                                      <button
                                        key={level}
                                        type="button"
                                        onClick={() => setMakeoverLevel(level)}
                                        className={cn(
                                          "rounded-[1.2rem] border px-3 py-2 text-left text-xs transition-colors",
                                          makeoverLevel === level
                                            ? "border-cyan-400/35 bg-cyan-400/10 text-cyan-100"
                                            : "border-white/10 text-slate-300 hover:border-white/20 hover:text-white"
                                        )}
                                      >
                                        <div className="font-medium capitalize">{level}</div>
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {(cameraError || trackingError) && (
              <div className="mt-4 rounded-[1.5rem] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                {cameraError || trackingError}
              </div>
            )}
          </div>

          <aside className="rounded-[2.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,249,244,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.32)] backdrop-blur xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
            <div className="space-y-4">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                      Returning client memory
                    </div>
                    <div className="mt-2 text-2xl font-medium text-white">
                      {clientMemorySummary ? "Profile loaded" : "Fresh consult"}
                    </div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-slate-300">
                    {clientProfile.updatedAt ? "Saved locally" : "No memory yet"}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  {clientMemorySummary ||
                    "Once you save or reject looks, the stylist will remember your direction, color preferences, and portrait the next time you open the mirror."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {clientProfile.favoritePresetIds.slice(0, 3).map((favoritePresetId) => (
                    <span
                      key={`favorite-${favoritePresetId}`}
                      className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100"
                    >
                      Loves {getHeroPreset(favoritePresetId).shortLabel}
                    </span>
                  ))}
                  {clientProfile.preferredColors.slice(0, 2).map((color) => (
                    <span
                      key={`memory-color-${color}`}
                      className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-100"
                    >
                      {getColorLabel(color)}
                    </span>
                  ))}
                  {clientProfile.rejectedPresetIds.slice(0, 2).map((rejectedPresetId) => (
                    <span
                      key={`memory-reject-${rejectedPresetId}`}
                      className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-100"
                    >
                      Skip {getHeroPreset(rejectedPresetId).shortLabel}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                    Live salon agent
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (speaking) {
                        stopSpeaking();
                      }
                      setVoiceReplyEnabled((current) => !current);
                    }}
                    disabled={!voicePlaybackReady}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-cyan-400/30 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {voiceReplyEnabled ? (
                      <Volume2 className="h-3.5 w-3.5" />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5" />
                    )}
                    {voiceReplyEnabled ? "Voice on" : "Voice off"}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        if (listening) {
                          recognitionRef.current?.stop();
                          setListening(false);
                          setSpeechDraft("");
                        }
                        setPreferences(prompt);
                      }}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <textarea
                  value={preferences}
                  onChange={(event) => setPreferences(event.target.value)}
                  placeholder="Tell the stylist what you want to change, keep, or avoid..."
                  readOnly={listening}
                  className="mt-4 min-h-[140px] w-full rounded-[1.6rem] border border-white/10 bg-slate-950/82 p-4 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400/40 read-only:cursor-default"
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={cn(
                      "inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
                      listening
                        ? "bg-rose-500 text-white hover:bg-rose-400"
                        : "border border-white/10 text-white hover:border-cyan-400/30 hover:text-cyan-200"
                    )}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {listening ? "Stop talking" : "Talk to stylist"}
                  </button>
                  <button
                    type="button"
                    onClick={handleAgentSubmit}
                    disabled={agentLoading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Wand2 className="h-4 w-4" />
                    {agentLoading ? "Stylist tuning..." : "Create live mashup"}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="rounded-full border border-white/10 bg-slate-950/55 px-3 py-1.5 text-xs text-slate-400">
                    {speechRecognitionSupported ? "Chrome mic ready" : "Mic best in Chrome"}
                  </div>
                  <div className="rounded-full border border-white/10 bg-slate-950/55 px-3 py-1.5 text-xs text-slate-400">
                    {elevenLabsReady ? "ElevenLabs voice ready" : "Browser voice fallback"}
                  </div>
                </div>

                {voiceError && (
                  <div className="mt-4 rounded-[1.3rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {voiceError}
                  </div>
                )}

                <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-slate-950/72 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Stylist response
                    </div>
                    <button
                      type="button"
                      onClick={() => void speakReply(agentReply)}
                      disabled={!voicePlaybackReady || !agentReply.trim()}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-cyan-400/30 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      Hear it
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-200">
                    {agentReply}
                  </p>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                      Current look
                    </div>
                    <div className="mt-2 text-2xl font-medium text-white">
                      {preset.label}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">
                      {preset.description}
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs font-medium capitalize text-slate-300">
                    {makeoverLevel}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={rememberCurrentLook}
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold transition-colors",
                      currentPresetFavorite
                        ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                        : "border border-white/10 text-white hover:border-emerald-400/30 hover:text-emerald-200"
                    )}
                  >
                    {currentPresetFavorite ? <Check className="h-3.5 w-3.5" /> : <Heart className="h-3.5 w-3.5" />}
                    {currentPresetFavorite ? "Saved to profile" : "Love this look"}
                  </button>
                  <button
                    type="button"
                    onClick={rejectCurrentLook}
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold transition-colors",
                      currentPresetRejected
                        ? "border border-rose-400/20 bg-rose-400/10 text-rose-100"
                        : "border border-white/10 text-white hover:border-rose-400/30 hover:text-rose-200"
                    )}
                  >
                    <X className="h-3.5 w-3.5" />
                    {currentPresetRejected ? "Marked as avoid" : "Not for me"}
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  {alternateRecommendations.map((suggestion) => {
                    const suggestionPresetId =
                      suggestion.presetId || inferPresetIdFromStyleName(suggestion.name);
                    const suggestionPreset = getHeroPreset(suggestionPresetId);

                    return (
                      <button
                        key={`rail-alt-${suggestionPresetId}`}
                        type="button"
                        onClick={() => handlePresetSelect(suggestion.name)}
                        className="rounded-[1.5rem] border border-white/10 bg-slate-950/65 px-4 py-4 text-left transition-colors hover:border-cyan-400/30 hover:bg-slate-950/80"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-white">
                            {suggestionPreset.label}
                          </div>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                            try this
                          </span>
                        </div>
                        <div className="mt-2 text-sm leading-relaxed text-slate-400">
                          {suggestion.reason}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_28%),linear-gradient(180deg,rgba(8,15,28,0.92),rgba(8,11,20,0.9))] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200">
                      Premium Gemini render
                    </div>
                    <div className="mt-2 text-2xl font-medium text-white">
                      On your portrait
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRenderLook("manual")}
                    disabled={renderLookLoading || !premiumPortraitReady}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-blue-300 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Sparkles className="h-4 w-4" />
                    {renderLookLoading ? "Rendering..." : "Render look"}
                  </button>
                </div>

                <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                  {premiumPortraitReady
                    ? faceLockActive
                      ? "Portrait is ready and the mirror is tracking. Hold still for the cleanest automatic refresh."
                      : "Portrait is ready. Turn on the webcam if you want auto-refresh while you test looks."
                    : "Upload a portrait to unlock the premium Gemini finish and final handoff."}
                </div>

                {renderLookError && (
                  <div className="mt-4 rounded-[1.4rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {renderLookError}
                  </div>
                )}

                {renderLook ? (
                  <div className="mt-5 overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/[0.04]">
                    <div className="relative aspect-[4/5]">
                      <Image
                        src={renderLook.imageDataUrl}
                        alt={renderLook.title}
                        fill
                        unoptimized
                        sizes="(max-width: 1280px) 100vw, 30vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <div className="text-sm font-medium text-white">
                        {renderLook.title}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-300">
                        {renderLook.brief}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            downloadDataUrl(
                              renderLook.imageDataUrl,
                              `${preset.id}-render.png`
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Save image
                        </button>
                        <button
                          type="button"
                          onClick={() => setMirrorView("render")}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                        >
                          View in mirror
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_28%),linear-gradient(180deg,rgba(8,15,28,0.92),rgba(8,11,20,0.9))] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">
                      Final salon handoff
                    </div>
                    <div className="mt-2 text-2xl font-medium text-white">
                      Style board + salons
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleGenerateStyleBoard()}
                    disabled={styleBoardLoading || !premiumPortraitReady}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-amber-300 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Sparkles className="h-4 w-4" />
                    {styleBoardLoading ? "Generating..." : "Generate board"}
                  </button>
                </div>

                {styleBoardError && (
                  <div className="mt-4 rounded-[1.4rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {styleBoardError}
                  </div>
                )}

                {styleBoard ? (
                  <div className="mt-5 overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/[0.04]">
                    <div className="relative aspect-[4/5]">
                      <Image
                        src={styleBoard.imageDataUrl}
                        alt={styleBoard.title}
                        fill
                        unoptimized
                        sizes="(max-width: 1280px) 100vw, 30vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <div className="text-sm font-medium text-white">
                        {styleBoard.title}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-300">
                        {styleBoard.brief}
                      </p>
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() =>
                            downloadDataUrl(
                              styleBoard.imageDataUrl,
                              `${preset.id}-style-board.png`
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Save board
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Salon search
                  </div>
                  <div className="mt-3 flex flex-col gap-3">
                    <input
                      value={location}
                      onChange={(event) => onLocationChange(event.target.value)}
                      placeholder="City, neighborhood, or postal code"
                      className="h-11 rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400/50"
                    />
                    <button
                      type="button"
                      onClick={onFindSalons}
                      disabled={salonLoading || !preset.label}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-medium text-white transition-colors hover:border-cyan-400/30 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Scissors className="h-4 w-4" />
                      {salonLoading ? "Matching salons..." : "Find matching salons"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Session memory
                  </div>
                  <div className="text-xs text-slate-500">
                    Last {Math.min(sessionTurns.length, 6)} turns
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {sessionTurns.slice(-4).map((turn, index) => (
                    <div
                      key={`${turn.speaker}-${index}-${turn.text.slice(0, 24)}`}
                      className={cn(
                        "max-w-[92%] rounded-[1.5rem] border px-4 py-3",
                        turn.speaker === "user"
                          ? "ml-auto border-cyan-400/20 bg-cyan-400/10 text-cyan-50"
                          : "border-white/10 bg-slate-950/65 text-slate-100"
                      )}
                    >
                      <div
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-[0.2em]",
                          turn.speaker === "user" ? "text-cyan-200" : "text-slate-500"
                        )}
                      >
                        {turn.speaker === "user" ? "You" : "Stylist"}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed">{turn.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {(hasSearchedSalons || salons.length > 0 || salonError) && (
          <div className="mt-6">
            <SalonList
              selectedStyle={preset.label}
              location={location}
              onLocationChange={onLocationChange}
              onSearch={onFindSalons}
              loading={salonLoading}
              error={salonError}
              salons={salons}
              hasSearched={hasSearchedSalons}
            />
          </div>
        )}
      </div>
    </section>
  );
}

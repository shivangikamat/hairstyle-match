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
  Camera,
  ChevronDown,
  ChevronUp,
  Download,
  Mic,
  MicOff,
  Sparkles,
  Upload,
  Video,
  Volume2,
  VolumeX,
  Wand2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  FaceProfile,
  HairColorName,
  HairstyleSuggestion,
  MakeoverLevel,
  OverlayAdjustment,
  PresetTuning,
  RenderLookResponse,
  Salon,
  StyleAgentResponse,
  StyleAgentTurn,
  StyleBoardResponse,
  TrackedFacePose,
} from "@/lib/types";
import {
  DEFAULT_OVERLAY_ADJUSTMENT,
  HAIR_COLOR_OPTIONS,
  applyOverlayAdjustment,
  calibrateOverlayToFace,
  calibrateOverlayToTrackedPose,
  createOverlayFromPreset,
  getFaceAnchorDiagnostics,
  getColorLabel,
  getHeroPreset,
  getOverlayPalette,
  getPresetRecommendations,
  HERO_PRESET_SUGGESTIONS,
  inferPresetIdFromStyleName,
  normalizePresetTuning,
  smoothTrackedFacePose,
} from "@/lib/styleStudio";
import HairstyleOverlay from "./HairstyleOverlay";
import SalonList from "./SalonList";

type RunningMode = "IMAGE" | "VIDEO";

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
};

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

type WorkspaceTab = "agent" | "portrait" | "render" | "handoff";
type VoiceProvider = "browser" | "elevenlabs";

const QUICK_PROMPTS = [
  "Soft and face-framing, but still polished on camera.",
  "Shorter and cleaner with low daily maintenance.",
  "Edgy texture, volume, and a little runway energy.",
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
  "Tell me the vibe first. I’ll pick the closest salon-grade preset, keep it tracking on camera, and generate a realistic on-face render once the framing settles.";

const FIT_CONTROLS: Array<{
  key: keyof OverlayAdjustment;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "offsetY", label: "Crown lift", min: -32, max: 32, step: 1 },
  { key: "height", label: "Length drop", min: -0.08, max: 0.08, step: 0.01 },
  { key: "offsetX", label: "Left / right", min: -24, max: 24, step: 1 },
  { key: "width", label: "Width", min: -0.08, max: 0.08, step: 0.01 },
  { key: "rotation", label: "Angle", min: -5, max: 5, step: 0.25 },
];

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

async function objectUrlToDataUrl(objectUrl: string) {
  const response = await fetch(objectUrl);
  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to convert the portrait into a data URL."));
    };
    reader.onerror = () =>
      reject(new Error("Unable to read the portrait for Gemini rendering."));
    reader.readAsDataURL(blob);
  });
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

export default function LiveStyleStudio({
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
  const [agentSummary, setAgentSummary] = useState("Preset tracking ready");
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
  const [fitAdjustment, setFitAdjustment] =
    useState<OverlayAdjustment>(DEFAULT_OVERLAY_ADJUSTMENT);
  const [agentLoading, setAgentLoading] = useState(false);
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [draftPortraitUrl, setDraftPortraitUrl] = useState<string | null>(null);
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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("agent");
  const [enteredSalon, setEnteredSalon] = useState(false);
  const [mirrorMode, setMirrorMode] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [showFitControls, setShowFitControls] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>("browser");
  const [elevenLabsReady, setElevenLabsReady] = useState(false);

  const activeSelfieUrl = draftPortraitUrl || selfieUrl;
  const preset = getHeroPreset(presetId);
  const overlaySourceMode = cameraActive
    ? "webcam"
    : activeSelfieUrl
      ? "selfie"
      : "mannequin";
  const baseOverlay = createOverlayFromPreset(presetId, tuning, makeoverLevel);
  const calibratedOverlay = calibrateOverlayToTrackedPose(
    calibrateOverlayToFace(baseOverlay, faceProfile, overlaySourceMode),
    trackedPose
  );
  const overlay = applyOverlayAdjustment(calibratedOverlay, fitAdjustment);
  const previewOverlay = cameraActive
    ? {
        ...overlay,
        fit: {
          ...overlay.fit,
          offsetX: -overlay.fit.offsetX,
          rotation: -overlay.fit.rotation,
        },
      }
    : overlay;
  const anchorDiagnostics = getFaceAnchorDiagnostics(trackedPose);
  const fitAdjusted = FIT_CONTROLS.some(
    ({ key }) => Math.abs(fitAdjustment[key]) > 0.001
  );
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
        source: activeSelfieUrl ? "selfie" : cameraActive ? "camera" : "none",
      }),
    [activeSelfieUrl, cameraActive, makeoverLevel, presetId, tuning]
  );

  const ensureTrackingMode = useCallback(async (mode: RunningMode) => {
    if (!landmarkerRef.current || runningModeRef.current === mode) {
      return;
    }

    await landmarkerRef.current.setOptions({ runningMode: mode });
    runningModeRef.current = mode;
  }, []);

  const updateTrackedPose = useCallback((nextPose: TrackedFacePose | null) => {
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
  }, [cameraActive]);

  const detectPoseInElement = useCallback(
    async (element: HTMLVideoElement | HTMLImageElement, mode: RunningMode) => {
      const previewFrame = previewFrameRef.current;

      if (!previewFrame || !landmarkerRef.current) {
        updateTrackedPose(null);
        return;
      }

      const sourceWidth =
        element instanceof HTMLVideoElement ? element.videoWidth : element.naturalWidth;
      const sourceHeight =
        element instanceof HTMLVideoElement ? element.videoHeight : element.naturalHeight;

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

  const captureReferenceDataUrl = useCallback(async () => {
    if (activeSelfieUrl) {
      return objectUrlToDataUrl(activeSelfieUrl);
    }

    if (cameraActive && videoRef.current) {
      const video = videoRef.current;

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        return null;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        return null;
      }

      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.94);
    }

    return null;
  }, [activeSelfieUrl, cameraActive]);

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

      if (
        typeof window === "undefined" ||
        !("speechSynthesis" in window)
      ) {
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

  const handleRenderLook = useCallback(
    async (mode: "manual" | "auto") => {
      const referenceDataUrl = await captureReferenceDataUrl();

      if (!referenceDataUrl) {
        setRenderLookError(
          "Add a portrait or turn on the webcam before generating the realistic render."
        );
        return;
      }

      if (mode === "auto" && Date.now() - lastRenderAtRef.current < AUTO_RENDER_COOLDOWN_MS) {
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
            faceProfile,
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
        lastRenderAtRef.current = Date.now();
        lastRenderSignatureRef.current = renderSignature;
        if (mode === "manual") {
          setActiveTab("render");
        }
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
      captureReferenceDataUrl,
      faceProfile,
      makeoverLevel,
      preferences,
      preset.label,
      presetId,
      renderSignature,
      tuning,
    ]
  );

  const handleGenerateStyleBoard = useCallback(async () => {
    const referenceDataUrl = await captureReferenceDataUrl();

    if (!referenceDataUrl) {
      setStyleBoardError(
        "Add a portrait or turn on the webcam before generating the style board."
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
          faceProfile,
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
      setActiveTab("handoff");
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
    captureReferenceDataUrl,
    faceProfile,
    makeoverLevel,
    mashupName,
    preferences,
    preset.label,
    presetId,
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
      setAgentSummary(`${nextPreset.label} selected for live tracking`);
      onSelectStyle(nextPreset.label);
      setRenderLook(null);
      setStyleBoard(null);
      setActiveTab("agent");
    },
    [onSelectStyle]
  );

  const handleColorSelect = useCallback((colorName: HairColorName) => {
    setTuning((current) =>
      normalizePresetTuning(presetId, {
        ...current,
        colorDirection: colorName,
      })
    );
    setRenderLook(null);
    setStyleBoard(null);
  }, [presetId]);

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

          return nextTurns.slice(-6);
        });
      });
      onSelectStyle(data.selectedStyle);
      setActiveTab("render");

      if (voiceReplyEnabled && speechSynthesisSupported) {
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
    voiceReplyEnabled,
  ]);

  const handlePortraitAnalyze = useCallback(async () => {
    if (!portraitFile || !draftPortraitUrl) {
      setPortraitError("Choose a portrait before analyzing it.");
      return;
    }

    setPortraitBusy(true);
    setPortraitError(null);

    try {
      const formData = new FormData();
      formData.append("file", portraitFile);

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
        imageUrl: draftPortraitUrl,
        faceProfile: data.faceProfile || null,
      });
      setRenderLook(null);
      setStyleBoard(null);
      setActiveTab("agent");
    } catch (error) {
      setPortraitError(
        error instanceof Error
          ? error.message
          : "We couldn't analyze that portrait."
      );
    } finally {
      setPortraitBusy(false);
    }
  }, [draftPortraitUrl, onPortraitAnalyzed, portraitFile]);

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
      setRenderLook(null);
    } catch (error) {
      console.error("Failed to start webcam:", error);
      setCameraError(
        "We couldn’t access the webcam. You can still personalize the session with a portrait."
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

  const handleMirrorActivate = useCallback(async () => {
    setEnteredSalon(true);
    setMirrorMode(true);
    setDrawerOpen(true);
    setActiveTab("agent");

    if (!cameraActive) {
      await startCamera();
    }
  }, [cameraActive, startCamera]);

  const handleSalonHotspot = useCallback(
    async (destination: "mirror" | "agent" | "looks" | "portrait") => {
      setEnteredSalon(true);

      if (destination === "mirror") {
        setMirrorMode(true);
        setDrawerOpen(true);
        setActiveTab("agent");
        if (!cameraActive) {
          await startCamera();
        }
        return;
      }

      if (destination === "looks") {
        setDrawerOpen(true);
        setActiveTab("agent");
        return;
      }

      if (destination === "portrait") {
        setActiveTab("portrait");
        portraitInputRef.current?.click();
        return;
      }

      setActiveTab("agent");
    },
    [cameraActive, startCamera]
  );

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
        "Voice capture works best in Chrome. You can still type your direction below."
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
    setSpeechRecognitionSupported(Boolean(getSpeechRecognitionConstructor()));
    setSpeechSynthesisSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
  }, []);

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
          "MediaPipe face tracking could not load. The studio will stay in manual alignment mode."
        );
      }
    };

    void bootMediaPipe();

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
  }, []);

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
    if (portraitFile) {
      const objectUrl = URL.createObjectURL(portraitFile);
      setDraftPortraitUrl(objectUrl);

      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }

    setDraftPortraitUrl(null);
  }, [portraitFile]);

  useEffect(() => {
    trackedPoseRef.current = trackedPose;
  }, [trackedPose]);

  useEffect(() => {
    setRenderLook(null);
    setRenderLookError(null);
    setStyleBoard(null);
    setStyleBoardError(null);
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

    if (!activeSelfieUrl || cameraActive || !image || !trackingReady) {
      return;
    }

    const run = async () => {
      if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
        return;
      }

      await detectPoseInElement(image, "IMAGE");
    };

    void run();
  }, [activeSelfieUrl, cameraActive, detectPoseInElement, trackingReady]);

  useEffect(() => {
    if (
      !trackingReady ||
      !(activeSelfieUrl || cameraActive) ||
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
    activeSelfieUrl,
    anchorDiagnostics.score,
    cameraActive,
    faceLockActive,
    handleRenderLook,
    renderLookLoading,
    renderSignature,
    trackingReady,
  ]);

  const previewModeLabel = cameraActive
    ? "Live webcam"
    : activeSelfieUrl
      ? "Portrait personalize"
      : "Studio mannequin";
  const trackingLabel = trackingReady
    ? faceLockActive
      ? "Landmarks live"
      : faceLockHolding
        ? "Landmarks holding"
        : "Landmarks ready"
    : trackingError
      ? "Tracking unavailable"
      : "Loading landmarks";
  const presetSummary = `${preset.shortLabel} • ${overlay.texture} • ${overlay.colorName.replace(
    "-",
    " "
  )}`;
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
  const recommendedPresets = useMemo(
    () =>
      getPresetRecommendations({
        suggestions: presetLibrary,
        preferences,
        currentStyle: preset.label,
        faceProfile,
        limit: 4,
      }),
    [faceProfile, preferences, preset.label, presetLibrary]
  );
  const activePalette = getOverlayPalette(overlay.colorName);
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
          left: `${cameraActive ? trackedPose.frame.frameWidth - trackedPose.crownAnchor.x - 32 : trackedPose.crownAnchor.x - 32}px`,
          top: `${trackedPose.crownAnchor.y - 2}px`,
          width: "64px",
        }
      : undefined;
  const voicePlaybackReady =
    voiceProvider === "elevenlabs" || speechSynthesisSupported;
  const workspaceTabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: "agent", label: "Agent" },
    { id: "portrait", label: "Portrait" },
    { id: "render", label: "Render" },
    { id: "handoff", label: "Handoff" },
  ];
  const liveActionLabel = cameraActive
    ? "Mirror live"
    : activeSelfieUrl
      ? "Portrait loaded"
      : "Start webcam";

  return (
    <section className="relative mb-10 overflow-hidden rounded-[3rem] border border-[#f8c9b8]/35 bg-[linear-gradient(180deg,#50255c_0%,#8a5d78_16%,#dfab9f_16.5%,#dfab9f_68%,#72518a_100%)] p-4 shadow-[0_40px_140px_rgba(51,16,48,0.28)] md:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(44,18,56,0.96),rgba(44,18,56,0.36))]" />
      <div className="pointer-events-none absolute -left-12 bottom-10 h-44 w-44 rounded-full bg-[#74b368]/20 blur-3xl" />
      <div className="pointer-events-none absolute right-4 top-20 h-56 w-56 rounded-full bg-[#6ab5c1]/16 blur-3xl" />

      <div className="relative grid gap-6 xl:grid-cols-[1.36fr_0.64fr] xl:items-start">
        <div className="rounded-[2.4rem] border border-white/15 bg-[linear-gradient(180deg,rgba(72,28,79,0.62),rgba(26,10,33,0.28))] p-4 backdrop-blur md:p-5 xl:sticky xl:top-24">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" />
                Enter The Salon
              </div>
              <h3 className="text-2xl font-medium text-white md:text-3xl">
                Walk into the dressing room, sit at the mirror, and try on looks live.
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
                The mirror opens the webcam consult, the stylist shelf opens the live agent, and the bottom drawer lets you audition cuts without leaving the room.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setMirrorMode((current) => !current);
                  setDrawerOpen(true);
                }}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
                  mirrorMode
                    ? "border-fuchsia-400/35 bg-fuchsia-400/12 text-fuchsia-100"
                    : "border-white/10 text-white hover:border-fuchsia-400/25 hover:text-fuchsia-100"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                {mirrorMode ? "Mirror mode on" : "Mirror mode"}
              </button>
              <button
                onClick={cameraActive ? stopCamera : startCamera}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 px-4 text-sm font-medium text-white transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
              >
                {cameraActive ? <Camera className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                {cameraActive ? "Stop webcam" : "Use webcam"}
              </button>
            </div>
          </div>

          <div
            className={`relative overflow-hidden rounded-[2.2rem] border border-white/10 transition-all duration-500 ${
              mirrorMode
                ? "aspect-[4/5] bg-[linear-gradient(180deg,#3d213f_0%,#9d6b79_24%,#deaf9e_24.5%,#deaf9e_67%,#6c4e84_100%)]"
                : "aspect-[4/5] bg-[radial-gradient(circle_at_top,#18364b_0%,#0a1220_44%,#04070d_100%)]"
            }`}
          >
            {mirrorMode && (
              <>
                <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(47,20,61,0.92),rgba(47,20,61,0.45))]" />
                <div className="absolute inset-x-0 top-0 h-10 bg-[linear-gradient(90deg,transparent,rgba(205,230,219,0.18),transparent)] opacity-70" />
                {[18, 48, 78].map((left) => (
                  <div
                    key={left}
                    className="absolute top-0 h-24 w-14 -translate-x-1/2"
                    style={{ left: `${left}%` }}
                  >
                    <div className="mx-auto h-10 w-[2px] bg-white/30" />
                    <div className="mx-auto h-10 w-10 rounded-b-[1.4rem] bg-[linear-gradient(180deg,#7e2d74,#4b1d59)] shadow-[0_10px_30px_rgba(0,0,0,0.35)]" />
                    <div className="mx-auto mt-2 h-2 w-10 rounded-full bg-yellow-100/55 blur-sm" />
                  </div>
                ))}
                <div className="absolute left-4 top-[23%] h-[34%] w-[15%] rounded-[1.6rem] border border-[#4c7b86]/60 bg-[#315563]/75 shadow-[0_18px_40px_rgba(5,10,16,0.3)]" />
                <div className="absolute right-4 top-[18%] h-[42%] w-[17%] rounded-[1.6rem] border border-[#5c7a77]/55 bg-[#6d8676]/70 shadow-[0_18px_40px_rgba(5,10,16,0.26)]" />
                <div className="absolute left-[7%] bottom-[11%] h-20 w-20 rounded-[1.6rem] bg-[#cc8e52]/50 blur-[1px]" />
                <div className="absolute left-[12%] bottom-[18%] h-20 w-12 rounded-t-full rounded-b-[1.3rem] bg-[#5f9f57]/80 blur-[0.5px]" />
                <div className="absolute left-[16%] bottom-[18%] h-24 w-10 rounded-t-full rounded-b-[1.3rem] bg-[#6eaf62]/80 blur-[0.5px]" />
                <div className="absolute right-[8%] bottom-[13%] h-16 w-16 rounded-[1.4rem] bg-[#d37b63]/55" />
              </>
            )}

            <button
              type="button"
              onClick={() => void handleSalonHotspot("looks")}
              className="absolute left-4 top-[34%] z-10 rounded-full border border-white/15 bg-slate-950/72 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur transition-colors hover:border-cyan-300/35 hover:text-cyan-100"
            >
              Look wall
            </button>
            <button
              type="button"
              onClick={() => void handleSalonHotspot("agent")}
              className="absolute right-4 top-[26%] z-10 rounded-full border border-white/15 bg-slate-950/72 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur transition-colors hover:border-fuchsia-300/35 hover:text-fuchsia-100"
            >
              Meet stylist
            </button>
            <button
              type="button"
              onClick={() => void handleSalonHotspot("portrait")}
              className="absolute right-8 bottom-[14%] z-10 rounded-full border border-white/15 bg-slate-950/72 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur transition-colors hover:border-amber-300/35 hover:text-amber-100"
            >
              Add portrait
            </button>

            <div
              className={`absolute inset-x-[12%] top-[11%] bottom-[18%] overflow-hidden rounded-[2.6rem_2.6rem_1.9rem_1.9rem] border p-3 shadow-[0_30px_80px_rgba(4,9,17,0.45)] ${
                mirrorMode
                  ? "border-[#d0b06a]/70 bg-[linear-gradient(180deg,rgba(248,226,188,0.25),rgba(113,70,30,0.24))]"
                  : "border-white/10 bg-slate-950/35"
              }`}
            >
              <div
                className="absolute inset-0 opacity-70"
                style={{
                  background: `radial-gradient(circle at 20% 18%, ${activePalette.shine}22, transparent 24%), radial-gradient(circle at 78% 16%, ${activePalette.mid}1a, transparent 26%)`,
                }}
              />
              <div
                ref={previewFrameRef}
                className={`relative h-full overflow-hidden rounded-[2rem] ${
                  mirrorMode
                    ? "bg-[radial-gradient(circle_at_top,rgba(67,118,133,0.26),rgba(17,27,39,0.94)_38%,rgba(4,9,17,1)_100%)]"
                    : "bg-[radial-gradient(circle_at_top,#18364b_0%,#0a1220_44%,#04070d_100%)]"
                }`}
              >
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
                  />
                ) : activeSelfieUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    ref={selfieImageRef}
                    src={activeSelfieUrl}
                    alt="Portrait preview"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center px-8">
                    <div className="relative flex h-full w-full items-center justify-center">
                      <div className="relative h-[72%] w-[62%] rounded-[45%] border border-white/10 bg-slate-900/58">
                        <div className="absolute left-1/2 top-[16%] h-[18%] w-[32%] -translate-x-1/2 rounded-full bg-slate-800/90" />
                        <div className="absolute left-1/2 top-[28%] h-[38%] w-[42%] -translate-x-1/2 rounded-[42%] bg-slate-800/60" />
                      </div>
                      <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-3">
                        <button
                          onClick={() => void handleMirrorActivate()}
                          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-100"
                        >
                          <Video className="h-4 w-4" />
                          Open mirror consult
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab("portrait");
                            portraitInputRef.current?.click();
                          }}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 px-5 text-xs font-medium text-white transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Add portrait instead
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!enteredSalon && (
                  <div className="absolute inset-0 z-[1] flex items-end justify-center bg-[radial-gradient(circle_at_center,transparent_34%,rgba(5,8,15,0.52)_78%,rgba(5,8,15,0.76)_100%)] p-6">
                    <button
                      type="button"
                      onClick={() => void handleMirrorActivate()}
                      className="rounded-[1.9rem] border border-white/15 bg-slate-950/78 px-6 py-5 text-center text-white shadow-[0_18px_40px_rgba(2,8,23,0.35)] backdrop-blur transition-transform hover:-translate-y-0.5"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                        Tap The Mirror
                      </div>
                      <div className="mt-2 text-lg font-medium">
                        Start the live stylist consult
                      </div>
                      <div className="mt-2 max-w-xs text-sm leading-relaxed text-slate-300">
                        Your webcam opens in the mirror, the drawer rises from the floor, and the agent joins the session.
                      </div>
                    </button>
                  </div>
                )}

                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-slate-950/30 to-transparent" />
                <div className="absolute left-5 top-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200 backdrop-blur">
                    {previewModeLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 backdrop-blur">
                    {preset.label}
                  </span>
                  <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200 backdrop-blur">
                    {trackingLabel}
                  </span>
                </div>

                <div className="absolute right-5 top-5 max-w-[230px] rounded-[1.4rem] border border-white/10 bg-slate-950/76 px-4 py-3 text-right backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
                    Stylist live
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">{liveActionLabel}</div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-400">
                    Talk, audition looks, then let the render sharpen once the frame locks.
                  </div>
                </div>

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

                <HairstyleOverlay config={previewOverlay} mirrored={cameraActive} />

                <div className="absolute left-4 top-auto bottom-24 max-w-sm rounded-[1.75rem] border border-white/10 bg-slate-950/78 px-4 py-3 backdrop-blur">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                    Agent Mashup
                  </div>
                  <div className="mt-1 text-xl font-medium text-white">{mashupName}</div>
                  <div className="mt-1 text-sm leading-relaxed text-slate-400">
                    {agentSummary}
                  </div>
                </div>

                <div className="absolute right-4 bottom-24 rounded-full border border-white/10 bg-slate-950/72 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-300 backdrop-blur">
                  {presetSummary}
                </div>
              </div>
            </div>

            <div className="absolute inset-x-4 bottom-4 z-20">
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setDrawerOpen((current) => !current)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-5 text-sm font-medium text-white backdrop-blur transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                >
                  {drawerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  Style drawer
                </button>
              </div>

              <AnimatePresence initial={false}>
                {drawerOpen && (
                  <motion.div
                    initial={{ y: 120, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 120, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 24 }}
                    className="mt-3 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/88 p-4 shadow-[0_24px_80px_rgba(2,8,23,0.5)] backdrop-blur"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                          Mirror Drawer
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-slate-400">
                          Tap a look, shift the color melt, and keep talking while the preview updates.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => void handleRenderLook("manual")}
                          disabled={renderLookLoading}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {renderLookLoading ? "Rendering..." : "Render"}
                        </button>
                        <button
                          onClick={() => setActiveTab("agent")}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 px-4 text-xs font-medium text-white transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                          Talk to agent
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4">
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Agent picks
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {recommendedPresets.map((suggestion) => {
                            const suggestionPresetId =
                              suggestion.presetId || inferPresetIdFromStyleName(suggestion.name);
                            const active = suggestionPresetId === presetId;

                            return (
                              <button
                                key={`recommended-${suggestionPresetId}`}
                                type="button"
                                onClick={() => handlePresetSelect(suggestion.name)}
                                className={`rounded-[1.4rem] border px-4 py-3 text-left transition-colors ${
                                  active
                                    ? "border-cyan-400/35 bg-cyan-400/10 text-white"
                                    : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20 hover:bg-white/[0.05]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-medium">{suggestion.name}</div>
                                  <div className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                                    pick
                                  </div>
                                </div>
                                <div className="mt-2 text-xs leading-relaxed text-slate-400">
                                  {suggestion.reason}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Full style rail
                        </div>
                        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
                          {presetLibrary.map((suggestion) => {
                            const suggestionPresetId =
                              suggestion.presetId || inferPresetIdFromStyleName(suggestion.name);
                            const suggestionPreset = getHeroPreset(suggestionPresetId);
                            const active = suggestionPresetId === presetId;

                            return (
                              <button
                                key={`${suggestionPresetId}-rail`}
                                type="button"
                                onClick={() => handlePresetSelect(suggestion.name)}
                                className={`min-w-[190px] snap-start rounded-[1.5rem] border px-4 py-3 text-left transition-colors ${
                                  active
                                    ? "border-fuchsia-400/35 bg-fuchsia-400/10 text-white"
                                    : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20 hover:bg-white/[0.05]"
                                }`}
                              >
                                <div className="text-sm font-medium">{suggestionPreset.label}</div>
                                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                                  {suggestionPreset.length} • {suggestionPreset.maintenance}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {suggestionPreset.vibes.slice(0, 2).map((vibe) => (
                                    <span
                                      key={`${suggestionPresetId}-${vibe}`}
                                      className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-400"
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

                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Color melt
                        </div>
                        <div className="grid gap-2 sm:grid-cols-5">
                          {HAIR_COLOR_OPTIONS.map((color) => {
                            const palette = getOverlayPalette(color.id);
                            const active = tuning.colorDirection === color.id;

                            return (
                              <button
                                key={color.id}
                                type="button"
                                onClick={() => handleColorSelect(color.id)}
                                className={`rounded-[1.2rem] border px-3 py-3 text-left transition-colors ${
                                  active
                                    ? "border-cyan-400/35 bg-cyan-400/10"
                                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
                                }`}
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
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Tracking quality
              </div>
              <div className="mt-1 text-sm text-white">
                {anchorDiagnostics.label} • {Math.round(anchorDiagnostics.score * 100)}%
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Makeover level
              </div>
              <div className="mt-1 text-sm text-white capitalize">
                {makeoverLevel}
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Face notes
              </div>
              <div className="mt-1 text-sm text-white capitalize">
                {faceProfile?.faceShape || "Editorial default"} fit
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Color melt
              </div>
              <div className="mt-1 text-sm text-white">{getColorLabel(tuning.colorDirection)}</div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Precision fit controls
                </div>
                <p className="mt-1 max-w-lg text-sm leading-relaxed text-slate-400">
                  MediaPipe handles crown, temple, jaw, and head-angle tracking. Open this only when you want the last-mile polish.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowFitControls((current) => !current)}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-xs font-medium text-white transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                >
                  {showFitControls ? "Hide fit controls" : "Fine-tune fit"}
                </button>
                <button
                  onClick={() => setFitAdjustment(DEFAULT_OVERLAY_ADJUSTMENT)}
                  disabled={!fitAdjusted}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-xs font-medium text-white transition-colors hover:border-cyan-400/30 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset fit
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {showFitControls && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {FIT_CONTROLS.map((control) => (
                      <label
                        key={control.key}
                        className="rounded-[1.4rem] border border-white/10 bg-slate-950/60 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-white">
                            {control.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {fitAdjustment[control.key].toFixed(control.step < 0.1 ? 2 : 1)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={control.min}
                          max={control.max}
                          step={control.step}
                          value={fitAdjustment[control.key]}
                          onChange={(event) => {
                            const nextValue = Number(event.target.value);
                            setFitAdjustment((current) => ({
                              ...current,
                              [control.key]: nextValue,
                            }));
                          }}
                          className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-300"
                        />
                      </label>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {(cameraError || trackingError) && (
            <div className="mt-4 rounded-[1.4rem] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {cameraError || trackingError}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col">
          {!enteredSalon ? (
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              className="overflow-hidden rounded-[2.3rem] border border-white/15 bg-[linear-gradient(180deg,rgba(255,247,240,0.9),rgba(252,225,214,0.82))] p-5 text-slate-900 shadow-[0_24px_80px_rgba(88,34,70,0.18)] backdrop-blur"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-[#6d4d6d]/20 bg-white/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6d4d6d]">
                <Sparkles className="h-3.5 w-3.5" />
                Salon Concierge
              </div>
              <h4 className="mt-4 text-3xl font-medium tracking-tight text-[#40273f]">
                Choose where you want to begin.
              </h4>
              <p className="mt-3 text-sm leading-relaxed text-[#5d4358]">
                This room is interactive. Click the mirror to open the live camera consult, open the look wall for instant try-ons, or upload a portrait from the color trolley.
              </p>

              <div className="mt-6 grid gap-3">
                {[
                  {
                    id: "mirror",
                    title: "Sit at the mirror",
                    body: "Start the webcam view and talk directly to the stylist.",
                  },
                  {
                    id: "looks",
                    title: "Browse the look wall",
                    body: "Raise the drawer and flip through hairstyles in one place.",
                  },
                  {
                    id: "portrait",
                    title: "Bring a portrait",
                    body: "Personalize the render with an uploaded face photo.",
                  },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      void handleSalonHotspot(
                        option.id as "mirror" | "looks" | "portrait"
                      )
                    }
                    className="rounded-[1.6rem] border border-[#6d4d6d]/15 bg-white/60 px-4 py-4 text-left transition-colors hover:border-[#4dbdd1]/30 hover:bg-white/80"
                  >
                    <div className="text-sm font-semibold text-[#40273f]">{option.title}</div>
                    <div className="mt-1 text-sm leading-relaxed text-[#6a5064]">
                      {option.body}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-[1.8rem] border border-[#6d4d6d]/15 bg-[#4b2953] px-4 py-4 text-white">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f7d9c9]">
                  What happens next
                </div>
                <div className="mt-2 space-y-2 text-sm text-white/80">
                  <p>1. The stylist picks a cut from the salon library.</p>
                  <p>2. The mirror tracks your face live with webcam or portrait mode.</p>
                  <p>3. Gemini renders the premium finish and salon handoff.</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <>
          <div className="mb-3 flex flex-wrap gap-2">
            {workspaceTabs.map((tab) => {
              const active = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
                    active
                      ? "border-cyan-400/35 bg-cyan-400/10 text-cyan-100"
                      : "border-white/10 bg-slate-950/55 text-slate-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 overflow-hidden rounded-[2.2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur xl:max-h-[calc(100vh-8.5rem)] xl:overflow-y-auto">
            {activeTab === "agent" && (
              <>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200">
                  <Volume2 className="h-3.5 w-3.5" />
                  Talk To The Stylist
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
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
                  placeholder="Tell the stylist what you want..."
                  readOnly={listening}
                  className="mt-5 min-h-[148px] w-full rounded-[1.8rem] border border-white/10 bg-slate-950/85 p-5 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400/40 read-only:cursor-default read-only:border-cyan-400/30"
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={toggleListening}
                    className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors ${
                      listening
                        ? "bg-rose-500 text-white hover:bg-rose-400"
                        : "border border-white/10 text-white hover:border-cyan-400/30 hover:text-cyan-200"
                    }`}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {listening ? "Stop listening" : "Start talking"}
                  </button>
                  <button
                    onClick={handleAgentSubmit}
                    disabled={agentLoading}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Wand2 className="h-4 w-4" />
                    {agentLoading ? "Tuning preset..." : "Create live mashup"}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
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
                    {voiceReplyEnabled ? "Voice reply on" : "Voice reply muted"}
                  </button>
                  <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-slate-400">
                    {speechRecognitionSupported ? "Chrome mic ready" : "Mic best in Chrome"}
                  </div>
                  <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-slate-400">
                    {elevenLabsReady ? "ElevenLabs voice ready" : "Browser voice fallback"}
                  </div>
                </div>

                {voiceError && (
                  <div className="mt-4 rounded-[1.5rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {voiceError}
                  </div>
                )}

                <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-slate-950/65 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Stylist response
                    </div>
                    <button
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

                <div className="mt-5 rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Finish controls
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">
                        Steer the color melt and makeover energy without leaving the live consultation.
                      </p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-slate-950/65 px-3 py-1.5 text-xs font-medium text-slate-300">
                      {getColorLabel(tuning.colorDirection)}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="grid gap-2 sm:grid-cols-5">
                      {HAIR_COLOR_OPTIONS.map((color) => {
                        const palette = getOverlayPalette(color.id);
                        const active = tuning.colorDirection === color.id;

                        return (
                          <button
                            key={`agent-color-${color.id}`}
                            type="button"
                            onClick={() => handleColorSelect(color.id)}
                            className={`rounded-[1.2rem] border px-3 py-3 text-left transition-colors ${
                              active
                                ? "border-cyan-400/35 bg-cyan-400/10"
                                : "border-white/10 bg-slate-950/60 hover:border-white/20"
                            }`}
                          >
                            <div
                              className="h-10 rounded-[0.9rem]"
                              style={{
                                background: `linear-gradient(135deg, ${palette.shine}, ${palette.mid} 48%, ${palette.base} 100%)`,
                              }}
                            />
                            <div className="mt-2 text-[11px] font-medium text-white">
                              {getColorLabel(color.id)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid gap-2">
                      {(["subtle", "signature", "editorial"] as MakeoverLevel[]).map(
                        (level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => {
                              setMakeoverLevel(level);
                              setRenderLook(null);
                              setStyleBoard(null);
                            }}
                            className={`rounded-[1.3rem] border px-4 py-3 text-left text-sm transition-colors ${
                              makeoverLevel === level
                                ? "border-fuchsia-400/35 bg-fuchsia-400/10 text-white"
                                : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-white/20"
                            }`}
                          >
                            <div className="font-medium capitalize">{level}</div>
                            <div className="mt-1 text-xs text-slate-400">
                              {level === "subtle"
                                ? "Keeps the shift believable and softly salon-ready."
                                : level === "signature"
                                  ? "Pushes the look with a premium editorial edge."
                                  : "Turns the styling into a bold campaign moment."}
                            </div>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-[2rem] border border-white/10 bg-slate-950/68 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Expanded look library
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">
                        The mirror drawer is the fast path. This panel gives you the full recommendation deck in one place.
                      </p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300">
                      {presetLibrary.length} live options
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {presetLibrary.map((suggestion) => {
                      const suggestionPresetId =
                        suggestion.presetId || inferPresetIdFromStyleName(suggestion.name);
                      const active = suggestionPresetId === presetId;
                      const recommended = recommendedPresets.some(
                        (entry) =>
                          (entry.presetId || inferPresetIdFromStyleName(entry.name)) ===
                          suggestionPresetId
                      );

                      return (
                        <button
                          key={`${suggestionPresetId}-${suggestion.name}`}
                          type="button"
                          onClick={() => handlePresetSelect(suggestion.name)}
                          className={`rounded-[1.6rem] border px-4 py-4 text-left transition-colors ${
                            active
                              ? "border-cyan-400/35 bg-cyan-400/10 text-white"
                              : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm font-medium">{suggestion.name}</div>
                            <div className="flex flex-wrap gap-2">
                              {recommended && (
                                <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                                  agent pick
                                </div>
                              )}
                              <div className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                {suggestionPresetId}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-sm leading-relaxed text-slate-400">
                            {suggestion.reason}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Session Memory
                    </div>
                    <div className="text-xs text-slate-500">
                      Last {Math.min(sessionTurns.length, 6)} turns
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {sessionTurns.slice(-4).map((turn, index) => (
                      <div
                        key={`${turn.speaker}-${index}-${turn.text.slice(0, 24)}`}
                        className={`max-w-[92%] rounded-[1.5rem] border px-4 py-3 ${
                          turn.speaker === "user"
                            ? "ml-auto border-cyan-400/20 bg-cyan-400/10 text-cyan-50"
                            : "border-white/10 bg-slate-950/65 text-slate-100"
                        }`}
                      >
                        <div
                          className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
                            turn.speaker === "user" ? "text-cyan-200" : "text-slate-500"
                          }`}
                        >
                          {turn.speaker === "user" ? "You" : "Stylist"}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed">{turn.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === "portrait" && (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Personalize with portrait
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      Keep everything in the same session. Upload once, analyze once, and the preview plus renders update from here.
                    </p>
                  </div>
                  <button
                    onClick={() => portraitInputRef.current?.click()}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 px-4 text-xs font-medium text-white transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Choose portrait
                  </button>
                </div>
                <input
                  ref={portraitInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setPortraitFile(file);
                    setPortraitError(null);
                  }}
                  className="hidden"
                />
                <div className="mt-5 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                  <div className="relative min-h-[240px] overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/80">
                    {activeSelfieUrl ? (
                      <Image
                        src={activeSelfieUrl}
                        alt="Session portrait"
                        fill
                        unoptimized
                        sizes="(max-width: 1024px) 100vw, 32vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                        Your session portrait will appear here.
                      </div>
                    )}
                  </div>
                  <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/60 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Session portrait
                    </div>
                    <div className="mt-2 text-sm text-white">
                      {portraitFile?.name ||
                        (activeSelfieUrl
                          ? "Portrait already in session"
                          : "No portrait chosen yet")}
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-slate-400">
                      Best results come from a straight-on image with visible hairline and soft light.
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={handlePortraitAnalyze}
                        disabled={portraitBusy || !portraitFile}
                        className="inline-flex h-11 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {portraitBusy ? "Analyzing..." : "Analyze portrait"}
                      </button>
                    </div>
                    {portraitError && (
                      <div className="mt-4 rounded-[1.3rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                        {portraitError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "render" && (
              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_28%),linear-gradient(160deg,rgba(9,14,26,0.96),rgba(8,10,18,0.9))] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200">
                      On-Face Render
                    </div>
                    <div className="mt-2 text-lg font-medium text-white">
                      Realistic makeover preview
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      This auto-refreshes once tracking is steady, or you can force a new render manually.
                    </p>
                  </div>
                  <button
                    onClick={() => void handleRenderLook("manual")}
                    disabled={renderLookLoading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-blue-300 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Sparkles className="h-4 w-4" />
                    {renderLookLoading ? "Rendering..." : "Render on my face"}
                  </button>
                </div>

                <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                  {faceLockActive
                    ? `Tracking is ${anchorDiagnostics.label}. Hold still for one beat and the auto render will stay cleaner.`
                    : "Turn on webcam or analyze a portrait to unlock the realistic render."}
                </div>

                {renderLookError && (
                  <div className="mt-4 rounded-[1.4rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {renderLookError}
                  </div>
                )}

                {renderLook ? (
                  <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="relative min-h-[320px] overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/80">
                      <Image
                        src={renderLook.imageDataUrl}
                        alt={renderLook.title}
                        fill
                        unoptimized
                        sizes="(max-width: 1024px) 100vw, 40vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Render brief
                      </div>
                      <div className="mt-2 text-xl font-medium text-white">
                        {renderLook.title}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-300">
                        {renderLook.brief}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
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
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
                    Your realistic on-face render will appear here as soon as you generate it.
                  </div>
                )}
              </div>
            )}

            {activeTab === "handoff" && (
              <div className="space-y-5">
                <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_28%),linear-gradient(160deg,rgba(9,14,26,0.96),rgba(8,10,18,0.9))] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                        Nano Banana Finish
                      </div>
                      <div className="mt-2 text-lg font-medium text-white">
                        Final stylist-ready board
                      </div>
                    </div>
                    <button
                      onClick={() => void handleGenerateStyleBoard()}
                      disabled={styleBoardLoading}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-amber-300 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Sparkles className="h-4 w-4" />
                      {styleBoardLoading ? "Generating..." : "Generate style board"}
                    </button>
                  </div>

                  {styleBoardError && (
                    <div className="mt-4 rounded-[1.4rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                      {styleBoardError}
                    </div>
                  )}

                  {styleBoard ? (
                    <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                      <div className="relative min-h-[320px] overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/80">
                        <Image
                          src={styleBoard.imageDataUrl}
                          alt={styleBoard.title}
                          fill
                          unoptimized
                          sizes="(max-width: 1024px) 100vw, 40vw"
                          className="object-cover"
                        />
                      </div>
                      <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Board brief
                        </div>
                        <div className="mt-2 text-xl font-medium text-white">
                          {styleBoard.title}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300">
                          {styleBoard.brief}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
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
                  ) : (
                    <div className="mt-5 rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
                      Generate the final board here, then match it to salons without leaving the workspace.
                    </div>
                  )}
                </div>

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
            </>
          )}
        </div>
      </div>
    </section>
  );
}

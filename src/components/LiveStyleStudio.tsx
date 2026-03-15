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
import type {
  FaceProfile,
  HairstyleSuggestion,
  MakeoverLevel,
  OverlayAdjustment,
  PresetTuning,
  RenderLookResponse,
  StyleAgentResponse,
  StyleAgentTurn,
  StyleBoardResponse,
  TrackedFacePose,
} from "@/lib/types";
import {
  DEFAULT_OVERLAY_ADJUSTMENT,
  applyOverlayAdjustment,
  calibrateOverlayToFace,
  calibrateOverlayToTrackedPose,
  createOverlayFromPreset,
  getFaceAnchorDiagnostics,
  getHeroPreset,
  inferPresetIdFromStyleName,
  normalizePresetTuning,
  smoothTrackedFacePose,
} from "@/lib/styleStudio";
import HairstyleOverlay from "./HairstyleOverlay";

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
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speakReply = useCallback((text: string) => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !text.trim()
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
  }, []);

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
    },
    [onSelectStyle]
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

      if (voiceReplyEnabled && speechSynthesisSupported) {
        speakReply(data.agentReply);
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

  return (
    <section className="relative mb-10 overflow-hidden rounded-[2.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.12),transparent_24%),linear-gradient(145deg,rgba(7,11,19,0.98),rgba(11,17,30,0.9))] p-5 shadow-[0_40px_140px_rgba(2,8,23,0.5)] md:p-7">
      <div className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-fuchsia-400/10 blur-3xl" />

      <div className="relative grid gap-8 xl:grid-cols-[1.16fr_0.84fr] xl:items-start">
        <div className="rounded-[2.3rem] border border-white/10 bg-slate-950/55 p-4 backdrop-blur md:p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" />
                Live Salon Agent
              </div>
              <h3 className="text-2xl font-medium text-white md:text-3xl">
                See the cut, talk through it, then render it on your face.
              </h3>
            </div>
            <button
              onClick={cameraActive ? stopCamera : startCamera}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 px-4 text-sm font-medium text-white transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
            >
              {cameraActive ? <Camera className="h-4 w-4" /> : <Video className="h-4 w-4" />}
              {cameraActive ? "Stop webcam" : "Use webcam"}
            </button>
          </div>

          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,#18364b_0%,#0a1220_44%,#04070d_100%)]">
            <div ref={previewFrameRef} className="absolute inset-0">
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
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative h-[74%] w-[64%] rounded-[45%] border border-white/10 bg-slate-900/60">
                    <div className="absolute left-1/2 top-[16%] h-[18%] w-[32%] -translate-x-1/2 rounded-full bg-slate-800/90" />
                    <div className="absolute left-1/2 top-[28%] h-[38%] w-[42%] -translate-x-1/2 rounded-[42%] bg-slate-800/60" />
                  </div>
                </div>
              )}
            </div>

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

            <div className="absolute inset-x-4 bottom-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="max-w-sm rounded-[1.75rem] border border-white/10 bg-slate-950/78 px-4 py-3 backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  Agent Mashup
                </div>
                <div className="mt-1 text-xl font-medium text-white">{mashupName}</div>
                <div className="mt-1 text-sm leading-relaxed text-slate-400">
                  {agentSummary}
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-slate-950/72 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-300 backdrop-blur">
                {presetSummary}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
          </div>

          <div className="mt-4 rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Precision fit controls
                </div>
                <p className="mt-1 max-w-lg text-sm leading-relaxed text-slate-400">
                  MediaPipe handles crown, temple, jaw, and head-angle tracking. These controls are just the last-mile polish for the demo.
                </p>
              </div>
              <button
                onClick={() => setFitAdjustment(DEFAULT_OVERLAY_ADJUSTMENT)}
                disabled={!fitAdjusted}
                className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-xs font-medium text-white transition-colors hover:border-cyan-400/30 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset fit
              </button>
            </div>

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
          </div>

          {(cameraError || trackingError) && (
            <div className="mt-4 rounded-[1.4rem] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {cameraError || trackingError}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-[2.2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
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
              className="mt-5 min-h-[156px] w-full rounded-[1.8rem] border border-white/10 bg-slate-950/85 p-5 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400/40 read-only:cursor-default read-only:border-cyan-400/30"
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
                disabled={!speechSynthesisSupported}
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
                  onClick={() => speakReply(agentReply)}
                  disabled={!speechSynthesisSupported || !agentReply.trim()}
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

          <div className="rounded-[2rem] border border-white/10 bg-slate-950/68 p-5 backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Hero presets
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  These are the tracked live looks the agent can actually render well.
                </p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300">
                {suggestions.length} live options
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {suggestions.map((suggestion) => {
                const suggestionPresetId =
                  suggestion.presetId || inferPresetIdFromStyleName(suggestion.name);
                const active = suggestionPresetId === presetId;

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
                      <div className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {suggestionPresetId}
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

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Personalize with portrait
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Optional, but it gives Gemini a better face reference for the realistic render and board.
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
            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-slate-950/60 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Session portrait
              </div>
              <div className="mt-2 text-sm text-white">
                {portraitFile?.name || (activeSelfieUrl ? "Portrait already in session" : "No portrait chosen yet")}
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

          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_28%),linear-gradient(160deg,rgba(9,14,26,0.96),rgba(8,10,18,0.9))] p-5 backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200">
                  On-Face Render
                </div>
                <div className="mt-2 text-lg font-medium text-white">
                  Realistic makeover preview
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  The app auto-refreshes this once face tracking is steady, or you can force it manually.
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

            {renderLookError && (
              <div className="mt-4 rounded-[1.4rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {renderLookError}
              </div>
            )}

            {renderLook && (
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
            )}
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_28%),linear-gradient(160deg,rgba(9,14,26,0.96),rgba(8,10,18,0.9))] p-5 backdrop-blur">
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

            {styleBoard && (
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
            )}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
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
        </div>
      </div>
    </section>
  );
}

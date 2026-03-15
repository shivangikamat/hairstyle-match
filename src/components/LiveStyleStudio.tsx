"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Mic,
  MicOff,
  Sparkles,
  Video,
  Wand2,
  Volume2,
  VolumeX,
} from "lucide-react";
import type {
  DetectedFaceFrame,
  FaceProfile,
  HairstyleSuggestion,
  OverlayAdjustment,
  StyleAgentResponse,
  StyleBoardResponse,
  StyleAgentTurn,
} from "@/lib/types";
import {
  applyOverlayAdjustment,
  calibrateOverlayToDetectedFace,
  calibrateOverlayToFace,
  createOverlayFromStyle,
  DEFAULT_OVERLAY_ADJUSTMENT,
  getFaceAnchorDiagnostics,
  smoothDetectedFaceFrame,
} from "@/lib/styleStudio";
import HairstyleOverlay from "./HairstyleOverlay";

type DetectedFaceLike = {
  boundingBox?: DOMRectReadOnly;
};

type FaceDetectorLike = {
  detect: (
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap
  ) => Promise<DetectedFaceLike[]>;
};

type FaceDetectorConstructor = new (options?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => FaceDetectorLike;

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
};

const QUICK_PROMPTS = [
  "Soft and face-framing, but still polished on camera.",
  "Shorter and cleaner with low daily maintenance.",
  "Edgy texture, volume, and a little runway energy.",
];

const FACE_LOCK_SMOOTHING = 0.3;
const FACE_LOCK_HOLD_MS = 1800;
const FACE_LOCK_SCAN_INTERVAL_MS = 320;

const INITIAL_AGENT_REPLY =
  "Turn on the webcam or use your uploaded selfie, then tell the agent what vibe you want. I’ll turn that into a live preview-friendly mashup.";

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
  { key: "scale", label: "Overall size", min: -0.08, max: 0.08, step: 0.01 },
  { key: "width", label: "Width", min: -0.08, max: 0.08, step: 0.01 },
  { key: "rotation", label: "Angle", min: -3, max: 3, step: 0.25 },
  { key: "opacity", label: "Blend", min: -0.12, max: 0.05, step: 0.01 },
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

function getFaceDetectorConstructor():
  | FaceDetectorConstructor
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const maybeWindow = window as Window & {
    FaceDetector?: FaceDetectorConstructor;
  };

  return maybeWindow.FaceDetector;
}

function composePreferenceText(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim() || "")
    .filter(Boolean)
    .join("\n\n");
}

function normalizeDetectedFaceFrame(params: {
  bounds: DOMRectReadOnly;
  sourceWidth: number;
  sourceHeight: number;
  containerWidth: number;
  containerHeight: number;
}): DetectedFaceFrame {
  const {
    bounds,
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
  const x = bounds.x * scale + cropOffsetX;
  const y = bounds.y * scale + cropOffsetY;
  const right = x + bounds.width * scale;
  const bottom = y + bounds.height * scale;

  return {
    x: Math.max(0, Math.min(containerWidth, x)),
    y: Math.max(0, Math.min(containerHeight, y)),
    width: Math.max(
      1,
      Math.min(containerWidth, right) - Math.max(0, Math.min(containerWidth, x))
    ),
    height: Math.max(
      1,
      Math.min(containerHeight, bottom) -
        Math.max(0, Math.min(containerHeight, y))
    ),
    frameWidth: containerWidth,
    frameHeight: containerHeight,
  };
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
      reject(new Error("Unable to read the portrait for style board generation."));
    reader.readAsDataURL(blob);
  });
}

export default function LiveStyleStudio({
  faceProfile,
  suggestions,
  selfieUrl,
  selectedStyle,
  onSelectStyle,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const selfieImageRef = useRef<HTMLImageElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const detectorRef = useRef<FaceDetectorLike | null>(null);
  const detectionFrameRef = useRef<number | null>(null);
  const skipSyncStyleRef = useRef<string | null>(null);
  const faceFrameRef = useRef<DetectedFaceFrame | null>(null);
  const lastFaceSeenAtRef = useRef(0);
  const speechBasePreferencesRef = useRef("");
  const speechCommittedTranscriptRef = useRef("");

  const previewStyle = selectedStyle || suggestions[0]?.name || "Textured Bob";
  const [overlayBlueprint, setOverlayBlueprint] = useState(() =>
    createOverlayFromStyle(previewStyle)
  );
  const [fitAdjustment, setFitAdjustment] =
    useState<OverlayAdjustment>(DEFAULT_OVERLAY_ADJUSTMENT);
  const [mashupName, setMashupName] = useState(previewStyle);
  const [agentReply, setAgentReply] = useState(INITIAL_AGENT_REPLY);
  const [preferences, setPreferences] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speechDraft, setSpeechDraft] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentSummary, setAgentSummary] = useState("Live overlay ready");
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] =
    useState(false);
  const [speechSynthesisSupported, setSpeechSynthesisSupported] =
    useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [detectedFaceFrame, setDetectedFaceFrame] =
    useState<DetectedFaceFrame | null>(null);
  const [faceLockAvailable, setFaceLockAvailable] = useState(false);
  const [faceLockActive, setFaceLockActive] = useState(false);
  const [faceLockHolding, setFaceLockHolding] = useState(false);
  const [styleBoardLoading, setStyleBoardLoading] = useState(false);
  const [styleBoardError, setStyleBoardError] = useState<string | null>(null);
  const [styleBoard, setStyleBoard] = useState<StyleBoardResponse | null>(null);
  const [sessionTurns, setSessionTurns] = useState<StyleAgentTurn[]>([
    {
      speaker: "agent",
      text: INITIAL_AGENT_REPLY,
    },
  ]);
  const overlaySourceMode = cameraActive
    ? "webcam"
    : selfieUrl
      ? "selfie"
      : "mannequin";
  const calibratedOverlay = detectedFaceFrame
    ? calibrateOverlayToDetectedFace(
        calibrateOverlayToFace(overlayBlueprint, faceProfile, overlaySourceMode),
        detectedFaceFrame
      )
    : calibrateOverlayToFace(overlayBlueprint, faceProfile, overlaySourceMode);
  const overlay = applyOverlayAdjustment(calibratedOverlay, fitAdjustment);
  const displayFaceFrame =
    cameraActive && detectedFaceFrame
      ? {
          ...detectedFaceFrame,
          x:
            detectedFaceFrame.frameWidth -
            detectedFaceFrame.x -
            detectedFaceFrame.width,
        }
      : detectedFaceFrame;
  const previewOverlay =
    cameraActive
      ? {
          ...overlay,
          fit: {
            ...overlay.fit,
            offsetX: -overlay.fit.offsetX,
            rotation: -overlay.fit.rotation,
          },
        }
      : overlay;
  const fitAdjusted = FIT_CONTROLS.some(
    ({ key }) => Math.abs(fitAdjustment[key]) > 0.001
  );

  useEffect(() => {
    if (skipSyncStyleRef.current === previewStyle) {
      skipSyncStyleRef.current = null;
      return;
    }

    setOverlayBlueprint(createOverlayFromStyle(previewStyle, preferences));
    setMashupName(previewStyle);
  }, [preferences, previewStyle]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSpeechRecognitionSupported(Boolean(getSpeechRecognitionConstructor()));
      setSpeechSynthesisSupported("speechSynthesis" in window);
      setFaceLockAvailable(Boolean(getFaceDetectorConstructor()));
    }

    return () => {
      recognitionRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (detectionFrameRef.current) {
        cancelAnimationFrame(detectionFrameRef.current);
      }

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!selfieUrl && !cameraActive) {
      setDetectedFaceFrame(null);
      setFaceLockActive(false);
      setFaceLockHolding(false);
      faceFrameRef.current = null;
      lastFaceSeenAtRef.current = 0;
    }
  }, [cameraActive, selfieUrl]);

  useEffect(() => {
    faceFrameRef.current = detectedFaceFrame;
  }, [detectedFaceFrame]);

  useEffect(() => {
    setStyleBoard(null);
    setStyleBoardError(null);
  }, [agentReply, agentSummary, mashupName, previewStyle, selfieUrl]);

  const detectFaceInElement = useCallback(
    async (params: {
      element: HTMLImageElement | HTMLVideoElement;
      sourceWidth: number;
      sourceHeight: number;
    }) => {
      const Detector = getFaceDetectorConstructor();
      const previewFrame = previewFrameRef.current;

      if (!Detector || !previewFrame) {
        setFaceLockActive(false);
        return false;
      }

      if (!detectorRef.current) {
        detectorRef.current = new Detector({
          fastMode: true,
          maxDetectedFaces: 1,
        });
      }

      try {
        const faces = await detectorRef.current.detect(params.element);
        const face = faces[0];

        if (!face?.boundingBox) {
          const shouldHoldLock =
            Date.now() - lastFaceSeenAtRef.current < FACE_LOCK_HOLD_MS &&
            Boolean(faceFrameRef.current);

          setFaceLockActive(false);
          setFaceLockHolding(shouldHoldLock);

          if (!shouldHoldLock) {
            setDetectedFaceFrame(null);
            faceFrameRef.current = null;
          }

          return false;
        }

        const frame = normalizeDetectedFaceFrame({
          bounds: face.boundingBox,
          sourceWidth: params.sourceWidth,
          sourceHeight: params.sourceHeight,
          containerWidth: previewFrame.clientWidth,
          containerHeight: previewFrame.clientHeight,
        });

        lastFaceSeenAtRef.current = Date.now();
        setDetectedFaceFrame((currentFrame) =>
          smoothDetectedFaceFrame(
            currentFrame,
            frame,
            cameraActive ? FACE_LOCK_SMOOTHING : 0.45
          )
        );
        setFaceLockActive(true);
        setFaceLockHolding(false);
        return true;
      } catch (error) {
        console.error("Face detection failed:", error);
        setFaceLockActive(false);
        setFaceLockHolding(false);
        return false;
      }
    },
    [cameraActive]
  );

  useEffect(() => {
    const image = selfieImageRef.current;

    if (!selfieUrl || cameraActive || !image || !faceLockAvailable) {
      return;
    }

    const run = async () => {
      if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
        return;
      }

      await detectFaceInElement({
        element: image,
        sourceWidth: image.naturalWidth,
        sourceHeight: image.naturalHeight,
      });
    };

    void run();
  }, [cameraActive, detectFaceInElement, faceLockAvailable, selfieUrl]);

  useEffect(() => {
    if (!cameraActive || !faceLockAvailable) {
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
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        timestamp - lastDetectionAt > FACE_LOCK_SCAN_INTERVAL_MS
      ) {
        lastDetectionAt = timestamp;
        await detectFaceInElement({
          element: video,
          sourceWidth: video.videoWidth,
          sourceHeight: video.videoHeight,
        });
      }

      detectionFrameRef.current = requestAnimationFrame(loop);
    };

    detectionFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      if (detectionFrameRef.current) {
        cancelAnimationFrame(detectionFrameRef.current);
        detectionFrameRef.current = null;
      }
    };
  }, [cameraActive, detectFaceInElement, faceLockAvailable]);

  const refreshSelfieFaceLock = useCallback(() => {
    const image = selfieImageRef.current;

    if (
      cameraActive ||
      !selfieUrl ||
      !image ||
      !image.complete ||
      image.naturalWidth === 0 ||
      image.naturalHeight === 0
    ) {
      return;
    }

    void detectFaceInElement({
      element: image,
      sourceWidth: image.naturalWidth,
      sourceHeight: image.naturalHeight,
    });
  }, [cameraActive, detectFaceInElement, selfieUrl]);

  const realignOverlayFromFaceLock = useCallback(() => {
    setFitAdjustment(DEFAULT_OVERLAY_ADJUSTMENT);

    if (cameraActive) {
      const video = videoRef.current;

      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }

      void detectFaceInElement({
        element: video,
        sourceWidth: video.videoWidth,
        sourceHeight: video.videoHeight,
      });
      return;
    }

    refreshSelfieFaceLock();
  }, [cameraActive, detectFaceInElement, refreshSelfieFaceLock]);

  useEffect(() => {
    const previewFrame = previewFrameRef.current;
    const image = selfieImageRef.current;

    if (!previewFrame || !image || cameraActive || !selfieUrl || !faceLockAvailable) {
      return;
    }

    let frameId: number | null = null;
    const scheduleRefresh = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        refreshSelfieFaceLock();
      });
    };

    scheduleRefresh();
    image.addEventListener("load", scheduleRefresh);

    let resizeObserver: ResizeObserver | null = null;
    const supportsResizeObserver = typeof ResizeObserver !== "undefined";

    if (supportsResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        scheduleRefresh();
      });
      resizeObserver.observe(previewFrame);
    } else {
      window.addEventListener("resize", scheduleRefresh);
    }

    return () => {
      image.removeEventListener("load", scheduleRefresh);
      resizeObserver?.disconnect();
      if (!supportsResizeObserver) {
        window.removeEventListener("resize", scheduleRefresh);
      }
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [cameraActive, faceLockAvailable, refreshSelfieFaceLock, selfieUrl]);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Webcam access is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      setCameraActive(true);
      setCameraError(null);
      setFaceLockHolding(false);
    } catch (error) {
      console.error("Failed to start webcam:", error);
      setCameraError(
        "We couldn’t access the webcam. You can still use the uploaded selfie preview."
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setFaceLockHolding(false);
  };

  const toggleListening = () => {
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
        "Voice capture works best in Chrome-based browsers. You can still type your preferences below."
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
  };

  const stopSpeaking = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const speakReply = (text: string) => {
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
  };

  const handleAgentSubmit = async () => {
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
          currentStyle: selectedStyle,
          suggestions,
          conversationHistory: sessionTurns.slice(-6),
        }),
      });

      const data = (await response.json()) as
        | StyleAgentResponse
        | { error?: string };

      if (!response.ok || !("overlay" in data)) {
        const message =
          "error" in data ? data.error : "The style agent could not respond.";
        throw new Error(message || "The style agent could not respond.");
      }

      skipSyncStyleRef.current = data.selectedStyle;
      setOverlayBlueprint(data.overlay);
      setMashupName(data.mashupName);
      setAgentReply(data.agentReply);
      setAgentSummary(data.preferencesSummary);
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
  };

  const handleGenerateStyleBoard = async () => {
    setStyleBoardLoading(true);
    setStyleBoardError(null);

    try {
      const selfieDataUrl = selfieUrl ? await objectUrlToDataUrl(selfieUrl) : null;
      const response = await fetch("/api/style-board", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedStyle: previewStyle,
          mashupName,
          preferences,
          preferencesSummary: agentSummary,
          stylistReply: agentReply,
          faceProfile,
          selfieDataUrl,
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
  };

  const previewBackground =
    !cameraActive && selfieUrl
      ? { backgroundImage: `url(${selfieUrl})` }
      : undefined;
  const previewModeLabel = cameraActive
    ? "Live camera feed"
    : selfieUrl
      ? "Uploaded portrait preview"
      : "Studio mannequin";
  const fitLabel = faceProfile?.faceShape
    ? `${faceProfile.faceShape} fit`
    : "Editorial fit";
  const fitReadout = `x${overlay.fit.scale.toFixed(2)} • y ${overlay.fit.offsetY > 0 ? "+" : ""}${overlay.fit.offsetY.toFixed(1)} • h ${(overlay.fit.height * 100).toFixed(0)}% • w ${(overlay.fit.width * 100).toFixed(0)}%`;
  const anchorDiagnostics = getFaceAnchorDiagnostics(detectedFaceFrame);
  const anchorScoreLabel = `${Math.round(anchorDiagnostics.score * 100)}%`;
  const anchorPillClassName =
    anchorDiagnostics.label === "strong"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : anchorDiagnostics.label === "steady"
        ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
        : "border-amber-400/20 bg-amber-400/10 text-amber-200";
  const anchorCardClassName =
    anchorDiagnostics.label === "strong"
      ? "border-emerald-400/15 bg-emerald-400/[0.06]"
      : anchorDiagnostics.label === "steady"
        ? "border-cyan-400/15 bg-cyan-400/[0.06]"
        : "border-amber-400/15 bg-amber-400/[0.06]";
  const anchorGuidance =
    faceLockHolding && anchorDiagnostics.label !== "strong"
      ? "Holding the last stable face box so the overlay stays demo-ready while the browser reacquires your face."
      : anchorDiagnostics.guidance;
  const canRealignFromFaceLock =
    cameraActive || Boolean(selfieUrl && faceLockAvailable);
  const faceGuideStyle = displayFaceFrame
    ? {
        left: `${displayFaceFrame.x}px`,
        top: `${displayFaceFrame.y}px`,
        width: `${displayFaceFrame.width}px`,
        height: `${displayFaceFrame.height}px`,
      }
    : undefined;
  const crownGuideStyle = displayFaceFrame
    ? {
        left: `${displayFaceFrame.x + displayFaceFrame.width * 0.14}px`,
        top: `${displayFaceFrame.y + displayFaceFrame.height * 0.12}px`,
        width: `${displayFaceFrame.width * 0.72}px`,
      }
    : undefined;

  return (
    <section className="relative mb-14 overflow-hidden rounded-[2.8rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.12),transparent_24%),linear-gradient(145deg,rgba(7,11,19,0.98),rgba(11,17,30,0.9))] p-5 shadow-[0_40px_140px_rgba(2,8,23,0.5)] md:p-7">
      <div className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-fuchsia-400/10 blur-3xl" />

      <div className="relative grid gap-8 xl:grid-cols-[1.18fr_0.82fr] xl:items-stretch">
        <div className="rounded-[2.3rem] border border-white/10 bg-slate-950/55 p-4 backdrop-blur md:p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" />
                Live Stylist Studio
              </div>
              <h3 className="text-2xl font-medium text-white md:text-3xl">
                See the mashup before you commit to the cut.
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
            ) : previewBackground ? (
              <Image
                ref={selfieImageRef}
                src={selfieUrl ?? ""}
                alt="Uploaded portrait preview"
                fill
                unoptimized
                sizes="(max-width: 1280px) 100vw, 60vw"
                className="absolute inset-0 h-full w-full object-cover opacity-95"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative h-[74%] w-[64%] rounded-[45%] border border-white/10 bg-slate-900/60">
                  <div className="absolute left-1/2 top-[18%] h-[18%] w-[32%] -translate-x-1/2 rounded-full bg-slate-800/90" />
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
                {previewStyle}
              </span>
              <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200 backdrop-blur">
                {fitLabel}
              </span>
              {fitAdjusted && (
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200 backdrop-blur">
                  Precision fit
                </span>
              )}
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur ${
                  faceLockActive
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                    : faceLockHolding
                      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                    : faceLockAvailable
                      ? "border-white/10 bg-slate-950/70 text-slate-300"
                      : "border-white/10 bg-slate-950/70 text-slate-500"
                }`}
              >
                {faceLockActive
                  ? "Face lock live"
                  : faceLockHolding
                    ? "Face lock holding"
                  : faceLockAvailable
                    ? "Face lock scanning"
                    : "Face lock unavailable"}
              </span>
              {faceLockAvailable && (
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur ${anchorPillClassName}`}
                >
                  Anchor {anchorDiagnostics.label}
                </span>
              )}
            </div>

            {faceGuideStyle && (
              <>
                <div
                  style={faceGuideStyle}
                  className="pointer-events-none absolute rounded-[42%] border border-emerald-300/45 bg-emerald-300/[0.04] shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
                  aria-hidden="true"
                />
                <div
                  style={crownGuideStyle}
                  className="pointer-events-none absolute border-t border-dashed border-cyan-300/60"
                  aria-hidden="true"
                />
                <div
                  style={{
                    left: `${displayFaceFrame.x + displayFaceFrame.width * 0.14}px`,
                    top: `${Math.max(18, displayFaceFrame.y - 22)}px`,
                  }}
                  className="pointer-events-none absolute rounded-full border border-cyan-300/25 bg-slate-950/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200 backdrop-blur"
                  aria-hidden="true"
                >
                  Crown anchor
                </div>
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
                {overlay.texture} texture • {overlay.fringe} fringe
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Style Base
              </div>
              <div className="mt-1 text-sm text-white">{previewStyle}</div>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Overlay Fit
              </div>
              <div className="mt-1 text-sm text-white capitalize">
                {fitAdjusted
                  ? `${overlaySourceMode} calibrated + tuned`
                  : `${overlaySourceMode} calibrated`}
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Color Direction
              </div>
              <div className="mt-1 text-sm text-white capitalize">
                {overlay.colorName.replace("-", " ")}
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3 sm:col-span-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Anchor Quality
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${anchorPillClassName}`}>
                  {anchorDiagnostics.label}
                </span>
                <span className="text-sm text-slate-300">
                  {anchorDiagnostics.guidance}
                </span>
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
                  Fine-tune the overlay live for this face and camera angle. This
                  sits on top of the automatic calibration so the demo operator
                  can recover alignment in seconds, even when the browser face
                  lock lands slightly left, right, high, low, or short through
                  the fringe and ends.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300">
                  {fitReadout}
                </div>
                <button
                  onClick={realignOverlayFromFaceLock}
                  disabled={!canRealignFromFaceLock}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 text-xs font-medium text-cyan-100 transition-colors hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-white disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-slate-500"
                >
                  Auto align
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

            <div
              className={`mt-4 rounded-[1.4rem] border px-4 py-4 ${anchorCardClassName}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300/80">
                    Face lock quality
                  </div>
                  <div className="mt-1 text-sm text-white">
                    {cameraActive
                      ? "Live anchor guidance for the mirrored webcam preview."
                      : selfieUrl
                        ? "Anchor guidance for the uploaded portrait crop."
                        : "Turn on the webcam or upload a portrait to anchor the overlay."}
                  </div>
                </div>
                <div
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${anchorPillClassName}`}
                >
                  {anchorDiagnostics.label} lock • {anchorScoreLabel}
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {anchorGuidance}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                {cameraActive
                  ? "Keep your forehead visible, stay centered for one beat, then use Auto align if the crown guide drifts."
                  : selfieUrl
                    ? "Use Auto align once after changing crop size or orientation, then make final slider tweaks only if needed."
                    : "Without a detectable face box, the studio falls back to editorial heuristics tuned to face shape and hairstyle silhouette."}
              </p>
            </div>
          </div>

          {faceProfile && (
            <p className="mt-4 text-sm text-slate-400">
              Fit is tuned for a {faceProfile.faceShape} face shape
              {faceLockActive
                ? ` and browser face detection is actively anchoring the overlay to the detected face box with ${anchorDiagnostics.label} confidence.`
                : faceLockHolding
                  ? " and the last stable face lock is being held briefly so the overlay does not jump during motion."
                : " with the overlay lifted around the crown for a more believable try-on."}{" "}
              You can still fine-tune it live when the framing shifts.
            </p>
          )}

          {cameraError && (
            <p className="mt-4 text-sm text-amber-200">{cameraError}</p>
          )}
        </div>

        <div className="flex flex-col justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200">
              <Volume2 className="h-3.5 w-3.5" />
              Talk To The Agent
            </div>
            <h3 className="max-w-md text-2xl font-medium text-white md:text-3xl">
              Shape the brief out loud like you&apos;re in the chair.
            </h3>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-400">
              Ask for softness, polish, edge, lower maintenance, or a little
              more drama. The agent will rebalance the live overlay, remember
              your last few turns, and speak the strongest stylist-ready mashup
              back to you.
            </p>
          </div>

          <div className="mt-6 rounded-[2.2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
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
              placeholder="Type or dictate your preferences here..."
              readOnly={listening}
              className="mt-5 min-h-[180px] w-full rounded-[1.8rem] border border-white/10 bg-slate-950/85 p-5 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400/40 read-only:cursor-default read-only:border-cyan-400/30"
            />
            <div className="mt-3 rounded-[1.5rem] border border-white/10 bg-slate-950/55 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Spoken preference capture
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                      speechRecognitionSupported
                        ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                        : "border-white/10 bg-slate-900/70 text-slate-500"
                    }`}
                  >
                    {speechRecognitionSupported
                      ? listening
                        ? "Mic live"
                        : "Mic ready"
                      : "Mic unavailable"}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                      speechSynthesisSupported
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                        : "border-white/10 bg-slate-900/70 text-slate-500"
                    }`}
                  >
                    {speechSynthesisSupported ? "Voice ready" : "Voice unavailable"}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {listening
                  ? speechDraft
                    ? speechDraft
                    : "Listening for your next phrase..."
                  : "Typed notes stay in place while final dictated phrases are added to the brief."}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {listening
                  ? "The brief is locked while listening so the live transcript does not overwrite manual edits mid-demo."
                  : "Start talking to append spoken direction, then edit the combined brief before sending it to the agent."}
              </p>
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
                {speechSynthesisSupported
                  ? voiceReplyEnabled
                    ? "Voice reply on"
                    : "Voice reply muted"
                  : "Voice reply unavailable"}
              </button>
              <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-slate-400">
                Session memory {sessionTurns.length} turns
              </div>
              {speaking && (
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
                  Speaking live response
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
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
                {agentLoading ? "Crafting mashup..." : "Create live mashup"}
              </button>
            </div>

            {voiceError && (
              <div className="mt-4 rounded-[1.5rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {voiceError}
              </div>
            )}
          </div>

          <div className="mt-5 rounded-[2rem] border border-white/10 bg-slate-950/68 p-5 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Stylist Response
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => speakReply(agentReply)}
                  disabled={!speechSynthesisSupported || !agentReply.trim()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-cyan-400/30 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Hear response
                </button>
                {speaking && (
                  <button
                    onClick={stopSpeaking}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-rose-400/30 hover:text-rose-200"
                  >
                    <VolumeX className="h-3.5 w-3.5" />
                    Stop voice
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-200">
              {agentReply}
            </p>
            <div className="mt-4 rounded-[1.35rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-slate-400">
              The agent now keeps the recent conversation in play, so follow-up
              requests like softer, shorter, or more editorial build on the
              previous direction instead of resetting the session.
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_28%),linear-gradient(160deg,rgba(9,14,26,0.96),rgba(8,10,18,0.9))] p-5 backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                  Nano Banana Finish
                </div>
                <div className="mt-2 text-lg font-medium text-white">
                  Generate the stylist-ready board
                </div>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-400">
                  This sends the current haircut direction, face notes, and your
                  portrait reference into Gemini image generation to create the
                  final beauty board for handoff.
                </p>
              </div>
              <button
                onClick={handleGenerateStyleBoard}
                disabled={styleBoardLoading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-amber-300 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {styleBoardLoading ? "Generating board..." : "Generate style board"}
              </button>
            </div>

            {styleBoardError && (
              <div className="mt-4 rounded-[1.4rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {styleBoardError}
              </div>
            )}

            {styleBoard && (
              <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/80">
                  <Image
                    src={styleBoard.imageDataUrl}
                    alt={styleBoard.title}
                    fill
                    unoptimized
                    sizes="(max-width: 1024px) 100vw, 42vw"
                    className="object-cover"
                  />
                </div>
                <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Generated brief
                  </div>
                  <div className="mt-2 text-xl font-medium text-white">
                    {styleBoard.title}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {styleBoard.brief}
                  </p>
                  {styleBoard.modelText && (
                    <p className="mt-4 text-sm leading-relaxed text-slate-400">
                      {styleBoard.modelText}
                    </p>
                  )}
                  <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-slate-950/70 px-4 py-3 text-xs leading-relaxed text-slate-500">
                    Model: {styleBoard.model}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
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
                      turn.speaker === "user"
                        ? "text-cyan-200"
                        : "text-slate-500"
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

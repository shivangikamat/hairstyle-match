"use client";

import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import type { FaceProfile, HairstyleSuggestion } from "@/lib/types";
import { createOverlayFromStyle } from "@/lib/styleStudio";
import HairstyleOverlay from "./HairstyleOverlay";

type QuickPlayPayload = {
  suggestions: HairstyleSuggestion[];
  faceProfile: FaceProfile;
  initialStyle: string;
};

type Props = {
  onStart: (payload: QuickPlayPayload) => void;
};

type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  detail: string;
};

type FaceShape =
  | "oval"
  | "round"
  | "square"
  | "heart"
  | "diamond"
  | "oblong";
type HairTexture = "straight" | "wavy" | "curly" | "coily";
type SkinTone = "cool fair" | "warm medium" | "deep neutral";
type DesiredLength = "short" | "medium" | "long";
type StyleVibe =
  | "camera-polish"
  | "soft-glam"
  | "editorial-edge"
  | "easy-luxe";
type MaintenanceLevel = "low" | "medium" | "high";
type StyleFamily = "bob" | "curtain" | "shag";

const FACE_SHAPES: ChoiceOption<FaceShape>[] = [
  { value: "oval", label: "Oval", detail: "Balanced and versatile." },
  { value: "round", label: "Round", detail: "Soft width through the cheeks." },
  { value: "square", label: "Square", detail: "Defined jaw and strong lines." },
  { value: "heart", label: "Heart", detail: "Wider forehead, narrower chin." },
  { value: "diamond", label: "Diamond", detail: "Cheekbone-led structure." },
  { value: "oblong", label: "Oblong", detail: "Longer vertical balance." },
];

const TEXTURES: ChoiceOption<HairTexture>[] = [
  { value: "straight", label: "Straight", detail: "Smooth and sharp." },
  { value: "wavy", label: "Wavy", detail: "Soft movement built in." },
  { value: "curly", label: "Curly", detail: "Defined bend and bounce." },
  { value: "coily", label: "Coily", detail: "Dense texture and lift." },
];

const SKIN_TONES: ChoiceOption<SkinTone>[] = [
  { value: "cool fair", label: "Fair", detail: "Cool to neutral light tones." },
  { value: "warm medium", label: "Medium", detail: "Warm, golden, or olive tones." },
  { value: "deep neutral", label: "Deep", detail: "Rich deeper tones." },
];

const LENGTHS: ChoiceOption<DesiredLength>[] = [
  { value: "short", label: "Short", detail: "Ready for a cut shift." },
  { value: "medium", label: "Medium", detail: "Shoulder and collarbone range." },
  { value: "long", label: "Long", detail: "Keep noticeable length in play." },
];

const VIBES: ChoiceOption<StyleVibe>[] = [
  {
    value: "camera-polish",
    label: "Camera polish",
    detail: "Glossy, clean, and instantly on-screen.",
  },
  {
    value: "soft-glam",
    label: "Soft glam",
    detail: "Romantic movement and face framing.",
  },
  {
    value: "editorial-edge",
    label: "Editorial edge",
    detail: "Sharper texture and runway energy.",
  },
  {
    value: "easy-luxe",
    label: "Easy luxe",
    detail: "Low effort, still expensive-looking.",
  },
];

const MAINTENANCE_LEVELS: ChoiceOption<MaintenanceLevel>[] = [
  { value: "low", label: "Low upkeep", detail: "Minimal styling time." },
  { value: "medium", label: "Balanced", detail: "Some polish, still practical." },
  { value: "high", label: "Styling moment", detail: "Happy to finesse it." },
];

const VIBE_STYLES: Record<
  StyleVibe,
  Record<StyleFamily, { name: string; prompt: string }>
> = {
  "camera-polish": {
    bob: {
      name: "Camera Polish Bob",
      prompt: "glossy polished clean camera-ready",
    },
    curtain: {
      name: "Studio Curtain Layers",
      prompt: "camera-ready polished soft face framing",
    },
    shag: {
      name: "Spotlight Texture Shag",
      prompt: "camera polish textured movement lifted crown",
    },
  },
  "soft-glam": {
    bob: {
      name: "Soft Gloss Bob",
      prompt: "soft glam romantic airy glossy",
    },
    curtain: {
      name: "Soft Curtain Layers",
      prompt: "soft glam airy romantic face framing",
    },
    shag: {
      name: "Romantic Texture Shag",
      prompt: "soft glam textured airy movement",
    },
  },
  "editorial-edge": {
    bob: {
      name: "Precision Edge Bob",
      prompt: "editorial edge sharp polished structure",
    },
    curtain: {
      name: "Runway Curtain Cut",
      prompt: "editorial edge face framing movement",
    },
    shag: {
      name: "Runway Texture Shag",
      prompt: "editorial edge piecey textured volume",
    },
  },
  "easy-luxe": {
    bob: {
      name: "Easy Finish Bob",
      prompt: "easy luxe low maintenance smooth easy finish",
    },
    curtain: {
      name: "Easy Curtain Layers",
      prompt: "easy luxe soft face framing low maintenance",
    },
    shag: {
      name: "Lived-In Luxe Shag",
      prompt: "easy luxe lived-in textured effortless",
    },
  },
};

const ORDER_BY_LENGTH: Record<DesiredLength, StyleFamily[]> = {
  short: ["bob", "curtain", "shag"],
  medium: ["curtain", "shag", "bob"],
  long: ["curtain", "shag", "bob"],
};

function formatFaceShape(faceShape: FaceShape) {
  return faceShape.charAt(0).toUpperCase() + faceShape.slice(1);
}

function buildQuickPlaySuggestions(params: {
  faceShape: FaceShape;
  hairTexture: HairTexture;
  desiredLength: DesiredLength;
  vibe: StyleVibe;
  maintenance: MaintenanceLevel;
}): HairstyleSuggestion[] {
  const { faceShape, hairTexture, desiredLength, vibe, maintenance } = params;
  const maintenanceLine =
    maintenance === "low"
      ? "keeps the styling routine approachable without losing shape"
      : maintenance === "medium"
        ? "holds polish without turning into a full daily production"
        : "gives room for a more intentional finish and stronger styling payoff";
  const textureLine =
    hairTexture === "straight"
      ? "leans into clean line work and shine"
      : hairTexture === "wavy"
        ? "works with natural movement instead of fighting it"
        : hairTexture === "curly"
          ? "keeps bounce and shape feeling deliberate"
          : "respects density and volume while staying directional";

  return ORDER_BY_LENGTH[desiredLength].map((family) => {
    const style = VIBE_STYLES[vibe][family];
    const silhouetteLine =
      family === "bob"
        ? "brings a sharper silhouette to frame the face"
        : family === "curtain"
          ? "opens the face with soft framing and flexible length"
          : "adds texture and crown lift for more attitude on camera";

    return {
      name: style.name,
      reason: `${style.name} flatters a ${faceShape} face, ${textureLine}, and ${maintenanceLine}. It ${silhouetteLine}.`,
    };
  });
}

function ChoiceGroup<T extends string>(props: {
  label: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
}) {
  const { label, value, options, onChange } = props;

  return (
    <div>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const active = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-[1.5rem] border px-4 py-4 text-left transition-colors ${
                active
                  ? "border-cyan-400/35 bg-cyan-400/10 text-white"
                  : "border-white/10 bg-slate-950/55 text-slate-300 hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              <div className="text-sm font-medium">{option.label}</div>
              <div
                className={`mt-1 text-xs leading-relaxed ${
                  active ? "text-cyan-100/80" : "text-slate-500"
                }`}
              >
                {option.detail}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function QuickPlayStarter({ onStart }: Props) {
  const [faceShape, setFaceShape] = useState<FaceShape>("oval");
  const [hairTexture, setHairTexture] = useState<HairTexture>("wavy");
  const [skinTone, setSkinTone] = useState<SkinTone>("warm medium");
  const [desiredLength, setDesiredLength] = useState<DesiredLength>("medium");
  const [vibe, setVibe] = useState<StyleVibe>("soft-glam");
  const [maintenance, setMaintenance] = useState<MaintenanceLevel>("low");

  const starterSuggestions = buildQuickPlaySuggestions({
    faceShape,
    hairTexture,
    desiredLength,
    vibe,
    maintenance,
  });
  const initialStyle = starterSuggestions[0]?.name || "Soft Curtain Layers";
  const previewPrompt = `${VIBE_STYLES[vibe][ORDER_BY_LENGTH[desiredLength][0]].prompt} ${hairTexture} ${maintenance}`;
  const previewOverlay = createOverlayFromStyle(initialStyle, previewPrompt);

  return (
    <section className="relative overflow-hidden rounded-[2.9rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.16),transparent_28%),linear-gradient(145deg,rgba(16,10,18,0.98),rgba(9,14,28,0.92))] p-6 shadow-[0_35px_140px_rgba(2,8,23,0.52)] md:p-8">
      <div className="pointer-events-none absolute -right-10 top-0 h-52 w-52 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100">
            <Sparkles className="h-3.5 w-3.5" />
            Quick Play
          </div>
          <h2 className="max-w-2xl text-3xl font-medium tracking-tight text-white md:text-4xl">
            Build your salon avatar before the live agent starts riffing.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400 md:text-base">
            This is the fun, game-like way in. Pick a face shape, texture, and
            vibe, then drop straight into the live stylist session with a custom
            mannequin setup. You can still switch to portrait mode later.
          </p>

          <div className="mt-8 grid gap-6">
            <ChoiceGroup
              label="Face Shape"
              value={faceShape}
              options={FACE_SHAPES}
              onChange={(value) => setFaceShape(value)}
            />
            <ChoiceGroup
              label="Hair Texture"
              value={hairTexture}
              options={TEXTURES}
              onChange={(value) => setHairTexture(value)}
            />
            <ChoiceGroup
              label="Skin Tone"
              value={skinTone}
              options={SKIN_TONES}
              onChange={(value) => setSkinTone(value)}
            />
            <ChoiceGroup
              label="Keep About This Much Length"
              value={desiredLength}
              options={LENGTHS}
              onChange={(value) => setDesiredLength(value)}
            />
            <ChoiceGroup
              label="Session Vibe"
              value={vibe}
              options={VIBES}
              onChange={(value) => setVibe(value)}
            />
            <ChoiceGroup
              label="Maintenance"
              value={maintenance}
              options={MAINTENANCE_LEVELS}
              onChange={(value) => setMaintenance(value)}
            />
          </div>

          <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm leading-relaxed text-slate-400">
              The live agent will inherit this setup, speak back, and keep
              refining from your voice or typed direction.
            </div>
            <button
              type="button"
              onClick={() =>
                onStart({
                  suggestions: starterSuggestions,
                  faceProfile: {
                    faceShape,
                    hairTexture,
                    skinTone,
                  },
                  initialStyle,
                })
              }
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-100"
            >
              <Wand2 className="h-4 w-4" />
              Start quick play
            </button>
          </div>
        </div>

        <div className="rounded-[2.35rem] border border-white/10 bg-slate-950/50 p-4 backdrop-blur md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Preview mannequin
              </div>
              <div className="mt-1 text-2xl font-medium text-white">
                {initialStyle}
              </div>
            </div>
            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Live agent ready
            </div>
          </div>

          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.18),transparent_45%),linear-gradient(180deg,rgba(17,24,39,0.98),rgba(8,12,22,1))]">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-[78%] w-[66%] rounded-[44%] border border-white/10 bg-slate-900/70">
                <div className="absolute left-1/2 top-[14%] h-[18%] w-[31%] -translate-x-1/2 rounded-full bg-slate-800/90" />
                <div className="absolute left-1/2 top-[28%] h-[40%] w-[44%] -translate-x-1/2 rounded-[42%] bg-slate-800/72" />
              </div>
            </div>
            <div className="absolute left-5 top-5 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100 backdrop-blur">
              {formatFaceShape(faceShape)} face
            </div>
            <HairstyleOverlay config={previewOverlay} />
            <div className="absolute inset-x-4 bottom-4 rounded-[1.6rem] border border-white/10 bg-slate-950/78 px-4 py-3 backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Starting brief
              </div>
              <div className="mt-1 text-sm text-white">
                {hairTexture} texture, {desiredLength} length, {maintenance} upkeep.
              </div>
              <div className="mt-1 text-sm text-slate-400">
                {VIBES.find((option) => option.value === vibe)?.label} with a{" "}
                {skinTone} profile.
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Starter looks
            </div>
            <div className="mt-3 space-y-3">
              {starterSuggestions.map((suggestion, index) => (
                <div
                  key={suggestion.name}
                  className={`rounded-[1.4rem] border px-4 py-3 ${
                    index === 0
                      ? "border-amber-300/20 bg-amber-300/10"
                      : "border-white/10 bg-slate-950/60"
                  }`}
                >
                  <div className="text-sm font-medium text-white">
                    {suggestion.name}
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-400">
                    {suggestion.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

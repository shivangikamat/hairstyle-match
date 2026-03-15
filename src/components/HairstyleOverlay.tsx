"use client";

import { useId } from "react";
import type { HairOverlayConfig } from "@/lib/types";
import { getOverlayPalette } from "@/lib/styleStudio";
import { cn } from "@/lib/utils";

type Props = {
  config: HairOverlayConfig;
  compact?: boolean;
  className?: string;
  mirrored?: boolean;
};

function BobShape({
  gradientId,
  glowId,
  config,
}: {
  gradientId: string;
  glowId: string;
  config: HairOverlayConfig;
}) {
  const fringe =
    config.fringe === "full"
      ? "M28 36 C37 31 63 31 72 36 L70 48 C61 43 39 43 30 48 Z"
      : config.fringe === "curtain"
        ? "M32 33 C40 41 44 50 45 60 L37 57 C35 47 33 41 28 36 Z M68 33 C60 41 56 50 55 60 L63 57 C65 47 67 41 72 36 Z"
        : "M35 37 C42 34 58 34 65 37";

  return (
    <>
      <ellipse cx="50" cy="24" rx="26" ry="13" fill={`url(#${glowId})`} opacity="0.36" />
      <path
        d="M18 42 C19 17 81 17 82 42 L82 85 C76 100 66 110 50 112 C34 110 24 100 18 85 Z"
        fill={`url(#${gradientId})`}
        opacity="0.92"
      />
      <path
        d="M24 42 C28 25 72 25 76 42 C68 54 59 60 50 62 C41 60 32 54 24 42 Z"
        fill="rgba(255,255,255,0.12)"
      />
      <path d={fringe} stroke="rgba(255,255,255,0.18)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </>
  );
}

function CurtainShape({
  gradientId,
  glowId,
  config,
}: {
  gradientId: string;
  glowId: string;
  config: HairOverlayConfig;
}) {
  const leftPart = config.part === "side" ? 46 : 50;
  const rightPart = config.part === "side" ? 60 : 50;

  return (
    <>
      <ellipse cx="50" cy="26" rx="30" ry="15" fill={`url(#${glowId})`} opacity="0.34" />
      <path
        d={`M18 36 C24 12 44 10 ${leftPart} 26 C40 45 34 78 28 114 C24 124 20 128 14 128 C16 112 18 84 18 36 Z`}
        fill={`url(#${gradientId})`}
        opacity="0.9"
      />
      <path
        d={`M82 36 C76 12 56 10 ${rightPart} 26 C60 45 66 78 72 114 C76 124 80 128 86 128 C84 112 82 84 82 36 Z`}
        fill={`url(#${gradientId})`}
        opacity="0.9"
      />
      <path
        d="M26 28 C34 18 66 18 74 28 C67 38 61 48 58 58 C54 64 46 64 42 58 C39 48 33 38 26 28 Z"
        fill="rgba(255,255,255,0.1)"
      />
      {config.fringe !== "none" && (
        <path
          d="M35 34 C41 44 45 55 45 70 M65 34 C59 44 55 55 55 70"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      )}
    </>
  );
}

function ShagShape({
  gradientId,
  glowId,
  config,
}: {
  gradientId: string;
  glowId: string;
  config: HairOverlayConfig;
}) {
  const volume = config.volume === "high" ? 1 : config.volume === "medium" ? 0.92 : 0.86;

  return (
    <g transform={`translate(${(1 - volume) * 7} ${(1 - volume) * 10}) scale(${volume})`}>
      <ellipse cx="50" cy="24" rx="32" ry="16" fill={`url(#${glowId})`} opacity="0.38" />
      <path
        d="M14 42 C20 14 80 12 86 42 L78 55 L86 68 L75 78 L82 91 L68 97 L60 114 L48 110 L34 118 L28 101 L16 94 L22 76 L12 63 L20 52 Z"
        fill={`url(#${gradientId})`}
        opacity="0.92"
      />
      <path
        d="M26 32 C35 24 65 24 74 32 L69 45 L74 54 L63 57 L58 68 L50 64 L40 70 L36 58 L26 54 L31 44 Z"
        fill="rgba(255,255,255,0.1)"
      />
      {config.fringe !== "none" && (
        <path
          d={
            config.fringe === "full"
              ? "M28 38 C36 31 64 31 72 38"
              : "M31 37 C37 42 42 48 44 55 M69 37 C63 42 58 48 56 55"
          }
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </g>
  );
}

export default function HairstyleOverlay({
  config,
  compact = false,
  className,
  mirrored = false,
}: Props) {
  const id = useId().replace(/:/g, "");
  const gradientId = `${id}-hair-gradient`;
  const glowId = `${id}-hair-glow`;
  const palette = getOverlayPalette(config.colorName);

  return (
    <div
      style={{
        width: `${config.fit.width * 100}%`,
        height: `${config.fit.height * 100}%`,
        top: `calc(6% + ${config.fit.offsetY}px)`,
        transform: `translateX(${config.fit.offsetX}px) scaleX(${mirrored ? -config.fit.scale : config.fit.scale}) scaleY(${config.fit.scale}) rotate(${config.fit.rotation}deg)`,
        opacity: config.fit.opacity,
      }}
      className={cn(
        "pointer-events-none absolute inset-x-0 top-[6%] mx-auto transition-[width,height,top,transform,opacity] duration-200 ease-out will-change-transform",
        compact && "max-h-[78%] max-w-[74%]",
        !compact && "max-h-[84%] max-w-[82%]",
        className
      )}
    >
      <svg
        viewBox="0 0 100 140"
        className="h-full w-full drop-shadow-[0_12px_24px_rgba(15,23,42,0.45)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.shine} />
            <stop offset="45%" stopColor={palette.mid} />
            <stop offset="100%" stopColor={palette.base} />
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor={palette.shine} stopOpacity="0.88" />
            <stop offset="60%" stopColor={palette.mid} stopOpacity="0.24" />
            <stop offset="100%" stopColor={palette.shadow} stopOpacity="0" />
          </radialGradient>
        </defs>

        {config.silhouette === "bob" && (
          <BobShape gradientId={gradientId} glowId={glowId} config={config} />
        )}
        {config.silhouette === "curtain" && (
          <CurtainShape
            gradientId={gradientId}
            glowId={glowId}
            config={config}
          />
        )}
        {config.silhouette === "shag" && (
          <ShagShape gradientId={gradientId} glowId={glowId} config={config} />
        )}
      </svg>
    </div>
  );
}

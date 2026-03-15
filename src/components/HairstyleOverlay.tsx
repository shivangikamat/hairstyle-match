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

function renderPresetLayers(
  config: HairOverlayConfig,
  gradientId: string,
  shineId: string
) {
  const soft = 1 + config.tuning.softness * 0.16;
  const volume = 1 + config.tuning.crownVolume * 0.18;
  const wave = 1 + config.tuning.waveBoost * 0.18;
  const density = 1 + config.tuning.density * 0.1;
  const fringeDrop = 40 + config.tuning.fringeStrength * 7;
  const partShift = config.part === "side" ? 8 : 0;

  switch (config.presetId) {
    case "precision-bob":
      return (
        <>
          <path
            d="M14 44 C18 18 82 18 86 44 L82 78 C74 104 64 114 50 116 C36 114 26 104 18 78 Z"
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d={`M22 36 C30 24 70 23 78 36 C72 ${52 + partShift * 0.35} 62 61 50 65 C38 61 28 ${52 - partShift * 0.2} 22 36 Z`}
            fill={`url(#${shineId})`}
            opacity="0.34"
          />
          <path
            d={`M27 ${fringeDrop - 5} C35 ${fringeDrop - 12} 65 ${fringeDrop - 12} 73 ${fringeDrop - 5} L70 53 C62 49 38 49 30 53 Z`}
            fill="rgba(255,255,255,0.12)"
            opacity={config.fringe === "none" ? 0 : 1}
          />
        </>
      );
    case "italian-bob":
      return (
        <>
          <path
            d="M14 42 C18 18 82 18 86 42 L84 82 C76 106 64 118 50 120 C36 118 24 106 16 82 Z"
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d={`M20 34 C28 22 72 22 80 34 C73 ${50 + partShift * 0.35} 64 63 50 67 C36 63 27 ${50 - partShift * 0.25} 20 34 Z`}
            fill={`url(#${shineId})`}
            opacity="0.34"
          />
          <path
            d="M22 82 C32 88 40 92 50 92 C60 92 68 88 78 82"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M26 ${fringeDrop} C34 ${fringeDrop - 7} 66 ${fringeDrop - 7} 74 ${fringeDrop} L72 58 C64 51 36 51 28 58 Z`}
            fill="rgba(255,255,255,0.12)"
            opacity={config.fringe === "none" ? 0.28 : 1}
          />
        </>
      );
    case "soft-lob":
      return (
        <>
          <path
            d={`M16 38 C20 14 80 13 84 38 L82 98 C72 118 60 130 50 132 C40 130 28 118 18 98 Z`}
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d={`M24 31 C34 19 66 19 76 31 C70 ${52 + partShift * 0.4} 61 64 50 69 C39 64 30 ${52 - partShift * 0.2} 24 31 Z`}
            fill={`url(#${shineId})`}
            opacity="0.28"
          />
          <path
            d={`M28 ${fringeDrop} C36 ${fringeDrop - 5} 40 ${fringeDrop + 6} 42 ${fringeDrop + 16} L34 62 C31 54 29 47 26 ${fringeDrop + 2} Z M72 ${fringeDrop} C64 ${fringeDrop - 5} 60 ${fringeDrop + 6} 58 ${fringeDrop + 16} L66 62 C69 54 71 47 74 ${fringeDrop + 2} Z`}
            fill="rgba(255,255,255,0.14)"
            opacity={config.fringe === "none" ? 0.35 : 1}
          />
        </>
      );
    case "face-frame-flip":
      return (
        <>
          <path
            d={`M16 36 C20 13 80 13 84 36 L81 104 C71 123 60 136 50 138 C40 136 29 123 19 104 Z`}
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d={`M25 29 C34 19 66 19 75 29 C70 ${49 + partShift * 0.4} 61 61 50 67 C39 61 30 ${49 - partShift * 0.25} 25 29 Z`}
            fill={`url(#${shineId})`}
            opacity="0.27"
          />
          <path
            d="M18 108 C30 101 35 120 26 129 M82 108 C70 101 65 120 74 129"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={3.2 * wave}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M29 ${fringeDrop + 2} C35 ${fringeDrop - 4} 39 ${fringeDrop + 6} 42 ${fringeDrop + 17} L34 61 C31 54 29 47 27 ${fringeDrop + 3} Z M71 ${fringeDrop + 2} C65 ${fringeDrop - 4} 61 ${fringeDrop + 6} 58 ${fringeDrop + 17} L66 61 C69 54 71 47 73 ${fringeDrop + 3} Z`}
            fill="rgba(255,255,255,0.14)"
            opacity={config.fringe === "none" ? 0.24 : 1}
          />
        </>
      );
    case "curtain-cloud":
      return (
        <>
          <path
            d={`M14 36 C18 12 38 8 ${50 - partShift * 0.35} 28 C37 46 32 83 28 128 C22 134 16 136 10 132 C12 116 14 84 14 36 Z`}
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d={`M86 36 C82 12 62 8 ${50 + partShift * 0.15} 28 C63 46 68 83 72 128 C78 134 84 136 90 132 C88 116 86 84 86 36 Z`}
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d="M25 27 C34 16 66 16 75 27 C67 37 61 47 58 58 C54 64 46 64 42 58 C39 47 33 37 25 27 Z"
            fill={`url(#${shineId})`}
            opacity="0.3"
          />
          <path
            d={`M33 ${fringeDrop - 5} C40 ${fringeDrop + 8} 44 ${fringeDrop + 20} 46 ${fringeDrop + 34} M67 ${fringeDrop - 5} C60 ${fringeDrop + 8} 56 ${fringeDrop + 20} 54 ${fringeDrop + 34}`}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={2.6 * soft}
            strokeLinecap="round"
            fill="none"
            opacity={config.fringe === "none" ? 0.2 : 1}
          />
        </>
      );
    case "curtain-gloss":
      return (
        <>
          <path
            d="M16 36 C19 12 39 9 50 28 C37 47 31 86 26 130 C20 135 14 135 10 131 C13 113 14 79 16 36 Z"
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d="M84 36 C81 12 61 9 50 28 C63 47 69 86 74 130 C80 135 86 135 90 131 C87 113 86 79 84 36 Z"
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d={`M24 28 C32 18 68 18 76 28 C69 40 63 52 58 66 C54 71 46 71 42 66 C37 52 31 40 24 28 Z`}
            fill={`url(#${shineId})`}
            opacity="0.34"
          />
          <path
            d={`M34 ${fringeDrop - 8} C39 ${fringeDrop + 8} 44 ${fringeDrop + 26} 47 ${fringeDrop + 42} M66 ${fringeDrop - 8} C61 ${fringeDrop + 8} 56 ${fringeDrop + 26} 53 ${fringeDrop + 42}`}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
            opacity={config.fringe === "none" ? 0.3 : 1}
          />
        </>
      );
    case "butterfly-blowout":
      return (
        <>
          <path
            d={`M12 34 C18 10 42 8 ${50 - partShift * 0.28} 28 C35 50 26 90 22 136 C16 140 8 138 8 130 C10 118 10 80 12 34 Z`}
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d={`M88 34 C82 10 58 8 ${50 + partShift * 0.14} 28 C65 50 74 90 78 136 C84 140 92 138 92 130 C90 118 90 80 88 34 Z`}
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d="M22 28 C34 15 66 15 78 28 C72 45 64 63 58 82 C54 91 46 91 42 82 C36 63 28 45 22 28 Z"
            fill={`url(#${shineId})`}
            opacity="0.28"
          />
          <path
            d={`M32 ${fringeDrop - 10} C39 ${fringeDrop + 6} 44 ${fringeDrop + 24} 47 ${fringeDrop + 45} M68 ${fringeDrop - 10} C61 ${fringeDrop + 6} 56 ${fringeDrop + 24} 53 ${fringeDrop + 45}`}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={2.8 * soft}
            strokeLinecap="round"
            fill="none"
            opacity={config.fringe === "none" ? 0.22 : 1}
          />
          <path
            d="M14 76 C30 73 32 94 22 110 M86 76 C70 73 68 94 78 110"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={3.2 * wave}
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case "sleek-midi":
      return (
        <>
          <path
            d="M18 34 C22 14 42 10 50 26 C58 10 78 14 82 34 L78 126 C68 136 58 140 50 140 C42 140 32 136 22 126 Z"
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d="M24 27 C31 18 69 18 76 27 C68 40 61 52 56 70 C53 76 47 76 44 70 C39 52 32 40 24 27 Z"
            fill={`url(#${shineId})`}
            opacity="0.35"
          />
          <path
            d="M26 32 L24 120 M74 32 L76 120"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case "modern-shag":
      return (
        <g transform={`translate(${(1 - volume) * 4} ${(1 - volume) * 8}) scale(${volume})`}>
          <path
            d={`M12 42 C18 12 82 12 88 42 L81 57 L88 72 L76 82 L84 97 L69 101 L62 116 L48 110 L34 120 L28 104 L16 98 L22 80 L10 66 L18 55 Z`}
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d="M25 33 C35 24 65 24 75 33 L69 45 L74 56 L61 60 L56 72 L48 67 L39 74 L35 61 L25 56 L31 44 Z"
            fill={`url(#${shineId})`}
            opacity="0.24"
          />
          <path
            d={`M28 ${fringeDrop - 2} C37 ${fringeDrop - 10} 63 ${fringeDrop - 10} 72 ${fringeDrop - 2}`}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={config.fringe === "full" ? 3.4 : 2.2}
            strokeLinecap="round"
            fill="none"
            opacity={config.fringe === "none" ? 0.25 : 1}
          />
        </g>
      );
    case "bixie-air":
      return (
        <g transform={`translate(${(1 - volume) * 3} ${(1 - volume) * 6}) scale(${volume})`}>
          <path
            d="M16 48 C20 20 80 20 84 48 L76 58 L84 69 L70 76 L66 90 L52 84 L40 94 L34 82 L20 78 L24 64 L14 57 Z"
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d="M28 37 C37 28 63 28 72 37 L65 48 L70 56 L58 60 L52 68 L45 64 L36 70 L33 60 L23 56 L28 47 Z"
            fill={`url(#${shineId})`}
            opacity="0.28"
          />
          <path
            d={`M29 ${fringeDrop - 4} C39 ${fringeDrop - 12} 61 ${fringeDrop - 10} 71 ${fringeDrop - 4}`}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={config.fringe === "full" ? 3.2 : 2.2}
            strokeLinecap="round"
            fill="none"
            opacity={config.fringe === "none" ? 0.22 : 1}
          />
        </g>
      );
    case "volume-waves":
      return (
        <g transform={`translate(${(1 - wave) * 4} ${(1 - wave) * 8}) scale(${wave})`}>
          <path
            d={`M14 34 C18 12 38 10 50 30 C35 49 26 86 22 132 C16 138 10 138 8 132 C10 118 11 82 14 34 Z`}
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d={`M86 34 C82 12 62 10 50 30 C65 49 74 86 78 132 C84 138 90 138 92 132 C90 118 89 82 86 34 Z`}
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d={`M24 25 C36 16 64 16 76 25 C71 42 65 58 58 74 C54 81 46 81 42 74 C35 58 29 42 24 25 Z`}
            fill={`url(#${shineId})`}
            opacity="0.28"
          />
          <path
            d={`M18 62 C28 58 31 82 22 96 C14 107 18 121 27 126 M82 62 C72 58 69 82 78 96 C86 107 82 121 73 126`}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={3.2 * density}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      );
    case "ribbon-waves":
      return (
        <g transform={`translate(${(1 - wave) * 3} ${(1 - wave) * 8}) scale(${wave})`}>
          <path
            d={`M16 34 C20 11 40 10 50 29 C36 48 29 88 26 138 C20 142 12 140 11 132 C12 118 13 81 16 34 Z`}
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d={`M84 34 C80 11 60 10 50 29 C64 48 71 88 74 138 C80 142 88 140 89 132 C88 118 87 81 84 34 Z`}
            fill={`url(#${gradientId})`}
            opacity={config.layerOpacity.back}
          />
          <path
            d="M23 26 C35 16 65 16 77 26 C71 42 65 58 58 78 C54 86 46 86 42 78 C35 58 29 42 23 26 Z"
            fill={`url(#${shineId})`}
            opacity="0.28"
          />
          <path
            d="M19 70 C31 70 32 90 22 105 C14 117 17 131 28 136 M81 70 C69 70 68 90 78 105 C86 117 83 131 72 136"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={3.4 * density}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      );
  }
}

export default function HairstyleOverlay({
  config,
  compact = false,
  className,
  mirrored = false,
}: Props) {
  const id = useId().replace(/:/g, "");
  const gradientId = `${id}-hair-gradient`;
  const shineId = `${id}-hair-shine`;
  const shadowId = `${id}-hair-shadow`;
  const palette = getOverlayPalette(config.colorName);
  const glossStrength = 0.45 + Math.max(0, config.tuning.sleekness) * 0.25;
  const shadowSpread = 24 + config.tuning.crownVolume * 4;

  return (
    <div
      style={{
        width: `${config.fit.width * 100}%`,
        height: `${config.fit.height * 100}%`,
        top: `calc(5% + ${config.fit.offsetY}px)`,
        transform: `translateX(${config.fit.offsetX}px) scaleX(${mirrored ? -config.fit.scale : config.fit.scale}) scaleY(${config.fit.scale}) rotate(${config.fit.rotation}deg)`,
        opacity: config.fit.opacity,
      }}
      className={cn(
        "pointer-events-none absolute inset-x-0 top-[5%] mx-auto transition-[width,height,top,transform,opacity] duration-200 ease-out will-change-transform",
        compact && "max-h-[82%] max-w-[78%]",
        !compact && "max-h-[92%] max-w-[86%]",
        className
      )}
    >
      <svg
        viewBox="0 0 100 140"
        className="h-full w-full drop-shadow-[0_18px_36px_rgba(15,23,42,0.48)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.shine} />
            <stop offset={`${28 + glossStrength * 18}%`} stopColor={palette.mid} />
            <stop offset="100%" stopColor={palette.base} />
          </linearGradient>
          <linearGradient id={shineId} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.58)" />
            <stop offset="45%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <radialGradient id={shadowId} cx="50%" cy="26%" r="62%">
            <stop offset="0%" stopColor={palette.shadow} stopOpacity="0.52" />
            <stop offset={`${shadowSpread}%`} stopColor={palette.shadow} stopOpacity="0.16" />
            <stop offset="100%" stopColor={palette.shadow} stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse
          cx="50"
          cy="24"
          rx={28 + config.tuning.crownVolume * 6}
          ry={13 + config.tuning.crownVolume * 2}
          fill={`url(#${shadowId})`}
          opacity={config.layerOpacity.shadow}
        />

        {renderPresetLayers(config, gradientId, shineId)}
      </svg>
    </div>
  );
}

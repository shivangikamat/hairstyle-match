"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Scissors, Sparkles, Star } from "lucide-react";
import type { HairstyleSuggestion } from "@/lib/types";
import { getHeroPreset, inferPresetIdFromStyleName } from "@/lib/styleStudio";
import { cn } from "@/lib/utils";

type LobbyPanel = "stylists" | "lookbook" | null;

type Props = {
  suggestions: HairstyleSuggestion[];
  onEnterStudio: () => void;
};

const STYLIST_ROSTER = [
  {
    name: "Maya",
    specialty: "Luxury bob polish",
    copy: "Precision lines, clean shape memory, and camera-ready finishing.",
  },
  {
    name: "Rina",
    specialty: "Face-framing layers",
    copy: "Soft movement, dimensional color melts, and wearable glam consulting.",
  },
  {
    name: "Theo",
    specialty: "Editorial texture",
    copy: "Shag, bixie, and directional silhouette work with a modern salon edge.",
  },
];

export default function SalonLobby({ suggestions, onEnterStudio }: Props) {
  const [panel, setPanel] = useState<LobbyPanel>(null);
  const lookbook = useMemo(
    () =>
      suggestions.slice(0, 6).map((suggestion) => {
        const presetId =
          suggestion.presetId || inferPresetIdFromStyleName(suggestion.name);
        return {
          suggestion,
          preset: getHeroPreset(presetId),
        };
      }),
    [suggestions]
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#5b315f_0%,#7a4d72_13%,#ebb6a8_13.2%,#ebb6a8_84%,#7a5b91_100%)] px-4 py-4 text-slate-900 md:px-8 md:py-6">
      <div className="mx-auto max-w-[1600px]">
        <nav className="relative z-20 mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 rounded-full border border-white/25 bg-[#2e1737]/92 px-4 py-2 text-white shadow-[0_18px_40px_rgba(35,14,44,0.24)] backdrop-blur">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-sky-500">
              <Scissors className="h-4 w-4 text-slate-950" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">HairMatch</div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/60">
                Salon Lobby
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-3 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white/90 backdrop-blur md:flex">
            <button
              type="button"
              onClick={() => setPanel(null)}
              className={cn(
                "rounded-full px-4 py-2 transition-colors",
                panel === null ? "bg-white/14 text-white" : "hover:bg-white/10"
              )}
            >
              Mirror Room
            </button>
            <button
              type="button"
              onClick={() => setPanel("stylists")}
              className={cn(
                "rounded-full px-4 py-2 transition-colors",
                panel === "stylists"
                  ? "bg-white/14 text-white"
                  : "hover:bg-white/10"
              )}
            >
              Stylists
            </button>
            <button
              type="button"
              onClick={() => setPanel("lookbook")}
              className={cn(
                "rounded-full px-4 py-2 transition-colors",
                panel === "lookbook"
                  ? "bg-white/14 text-white"
                  : "hover:bg-white/10"
              )}
            >
              Lookbook
            </button>
            <button
              type="button"
              onClick={onEnterStudio}
              className="rounded-full bg-white px-5 py-2.5 text-slate-950 shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition-colors hover:bg-cyan-100"
            >
              Book Appointment
            </button>
          </div>
        </nav>

        <div className="relative overflow-hidden rounded-[2.8rem] border border-white/20 bg-[linear-gradient(180deg,rgba(98,53,101,0.52),rgba(235,182,168,0.08))] shadow-[0_40px_120px_rgba(55,18,48,0.24)]">
          <div className="absolute inset-x-0 top-0 h-[22%] bg-[#5a2f5d]" />
          <div className="absolute inset-x-0 top-0 h-[22%] opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:48px_28px]" />
          <div className="absolute inset-x-0 bottom-0 h-[30%] bg-[repeating-linear-gradient(90deg,#866095_0_68px,#7b558a_68px_136px)] opacity-65" />

          {[22, 42, 61, 80].map((left, index) => (
            <div
              key={left}
              className="absolute top-0 z-10 h-[25%] w-16 -translate-x-1/2"
              style={{ left: `${left}%` }}
            >
              <div className="mx-auto h-14 w-[2px] bg-white/35" />
              <motion.div
                animate={{ opacity: [0.9, 1, 0.88] }}
                transition={{
                  duration: 2.4 + index * 0.2,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                }}
                className="mx-auto h-12 w-12 rounded-b-[1.4rem] bg-[linear-gradient(180deg,#873a7c,#5a245f)] shadow-[0_14px_30px_rgba(0,0,0,0.3)]"
              />
              <motion.div
                animate={{ opacity: [0.42, 0.72, 0.42] }}
                transition={{
                  duration: 1.8 + index * 0.15,
                  repeat: Infinity,
                  repeatType: "mirror",
                }}
                className="mx-auto mt-2 h-3 w-12 rounded-full bg-yellow-100/60 blur-sm"
              />
            </div>
          ))}

          <div className="relative min-h-[820px] overflow-hidden">
            <div className="absolute left-[3%] top-[18%] h-[24%] w-[10%] rounded-[1.4rem] border border-[#7a5268] bg-[#b8e0e8]/75 shadow-[inset_0_0_0_4px_rgba(157,84,100,0.35)]" />
            <div className="absolute left-[4.2%] top-[19.5%] h-[21%] w-[7.5%] [background-image:linear-gradient(rgba(157,84,100,0.42)_2px,transparent_2px),linear-gradient(90deg,rgba(157,84,100,0.42)_2px,transparent_2px)] [background-size:100%_25%,25%_100%]" />

            <div className="absolute left-[10.5%] top-[24%] h-[33%] w-[11%] rounded-[1.8rem] border border-[#486573] bg-[#2f5563]/92 shadow-[0_24px_40px_rgba(14,22,30,0.28)]">
              <div className="absolute left-2 top-2 h-[30%] w-[72%] rotate-[-8deg] rounded-[1rem] border border-white/20 bg-[#416877]" />
              <div className="absolute right-2 top-[20%] h-[26%] w-[68%] rotate-[2deg] rounded-[1rem] border border-white/20 bg-[#4f7484]" />
              <div className="absolute left-3 bottom-3 h-[17%] w-[62%] rounded-[0.9rem] border border-white/20 bg-[#7a6f3f]" />
              <div className="absolute right-2 bottom-[10%] h-[20%] w-[60%] rounded-[0.9rem] border border-white/20 bg-[#59643d]" />
              {[18, 40, 62, 84].map((top, index) => (
                <span
                  key={`cabinet-dot-${index}`}
                  className="absolute h-2.5 w-2.5 rounded-full bg-white/80"
                  style={{
                    top: `${top}%`,
                    left: index < 2 ? "20%" : "52%",
                  }}
                />
              ))}
            </div>

            <div className="absolute left-[26%] bottom-[20%] h-[24%] w-[10%]">
              <motion.div
                animate={{ rotate: [-2, 2, -2] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-6 left-0 h-[76%] w-[46%] rounded-t-full rounded-b-[1.2rem] bg-[#5da65f]/90"
              />
              <motion.div
                animate={{ rotate: [1, -3, 1] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-8 right-0 h-[86%] w-[46%] rounded-t-full rounded-b-[1.2rem] bg-[#70b56a]/90"
              />
              <div className="absolute bottom-0 left-1/2 h-10 w-16 -translate-x-1/2 rounded-[1.1rem] bg-[#f4f0df]" />
            </div>

            <div className="absolute left-[42%] bottom-[22%] z-10 h-[16%] w-[9%] rounded-[2.2rem] bg-[#eb6e76] shadow-[0_18px_30px_rgba(68,22,32,0.18)]">
              <div className="absolute bottom-[-12%] left-1/2 h-[28%] w-[30%] -translate-x-1/2 rounded-full bg-[#244a4d]" />
            </div>

            <div className="absolute left-[41%] top-[28%] z-10 h-[34%] w-[22%] rounded-[1.6rem_1.6rem_1.1rem_1.1rem] bg-[#743f71]/95 shadow-[0_24px_50px_rgba(0,0,0,0.18)]">
              <div className="absolute left-[12%] top-[12%] h-[54%] w-[34%] rounded-[1.5rem] border-[6px] border-[#8f6550] bg-[linear-gradient(180deg,#e4f7f5,#9ed5d2)] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.2)]" />
              <div className="absolute right-[12%] top-[12%] h-[54%] w-[34%] rounded-[1.5rem] border-[6px] border-[#8f6550] bg-[linear-gradient(180deg,#e4f7f5,#9ed5d2)] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.2)]" />
              <div className="absolute left-[18%] top-[20%] h-[36%] w-[22%] rotate-[14deg] bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.45),transparent)]" />
              <div className="absolute right-[18%] top-[20%] h-[36%] w-[22%] rotate-[14deg] bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.45),transparent)]" />
              <div className="absolute inset-x-[10%] bottom-[18%] h-[10%] rounded-[0.8rem] bg-[#5a2f57]" />
              <div className="absolute inset-x-[18%] bottom-[28%] flex items-end justify-between">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={`bottle-${index}`}
                    className={cn(
                      "rounded-t-[0.6rem] rounded-b-[0.35rem] bg-white/85",
                      index % 2 === 0 ? "h-10 w-4" : "h-8 w-5"
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="absolute right-[11%] bottom-[18%] z-20 h-[22%] w-[14%] rotate-[-12deg] rounded-[2rem_2rem_1.6rem_1.6rem] bg-[#8b4f8c] shadow-[0_24px_40px_rgba(30,12,33,0.28)]">
              <div className="absolute bottom-[-14%] left-[50%] h-[34%] w-[28%] -translate-x-1/2 rounded-full bg-[#2b4b59]" />
            </div>

            <div className="absolute right-[6%] top-[18%] h-[32%] w-[15%] rounded-[1.6rem] border border-[#637a73] bg-[#6e8d7a]/84 shadow-[0_24px_40px_rgba(14,22,30,0.2)]">
              <div className="absolute left-[12%] top-[10%] right-[12%] h-[2px] bg-[#44584e]/55" />
              <div className="absolute left-[12%] top-[37%] right-[12%] h-[2px] bg-[#44584e]/55" />
              <div className="absolute left-[12%] top-[64%] right-[12%] h-[2px] bg-[#44584e]/55" />
              <div className="absolute left-[12%] top-[14%] grid w-[76%] grid-cols-3 gap-2">
                {[0, 1, 2, 3, 4, 5, 6].map((index) => (
                  <div
                    key={`shelf-${index}`}
                    className={cn(
                      "rounded-[0.35rem]",
                      index % 3 === 0
                        ? "h-10 bg-[#9d5e70]"
                        : index % 2 === 0
                          ? "h-8 bg-[#dcc7b1]"
                          : "h-9 bg-[#7f567b]"
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="absolute left-[6%] bottom-[12%] h-20 w-20 rounded-[1.3rem] bg-[#d39b56]/90 shadow-[0_20px_30px_rgba(70,34,18,0.2)]" />
            <div className="absolute right-[8%] bottom-[11%] h-16 w-16 rounded-[1.2rem] bg-[#d47f6a]/88 shadow-[0_20px_30px_rgba(70,34,18,0.16)]" />
            <div className="absolute right-[12%] bottom-[14%] h-16 w-12 rounded-t-full rounded-b-[1.2rem] bg-[#63aa63]/88" />

            <button
              type="button"
              onClick={onEnterStudio}
              className="absolute left-[39%] top-[25%] z-30 h-[30%] w-[26%] rounded-[2.2rem] border border-cyan-200/40 bg-cyan-300/8 shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_30px_80px_rgba(0,0,0,0.16)] transition-transform hover:scale-[1.015]"
            >
              <motion.div
                animate={{ opacity: [0.28, 0.72, 0.28] }}
                transition={{ duration: 2.2, repeat: Infinity, repeatType: "mirror" }}
                className="absolute inset-0 rounded-[2.2rem] border border-cyan-200/50"
              />
              <div className="absolute inset-x-0 bottom-6 flex justify-center">
                <div className="rounded-full border border-cyan-100/35 bg-[#101924]/80 px-5 py-3 text-center text-white backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                    Tap The Mirror
                  </div>
                  <div className="mt-2 text-lg font-medium">
                    Enter your private stylist suite
                  </div>
                </div>
              </div>
            </button>

            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-4 px-6 pb-8">
              <div className="rounded-full border border-white/18 bg-[#101924]/72 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200 backdrop-blur">
                Premium AI Salon
              </div>
              <div className="max-w-3xl text-center">
                <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
                  Walk into the salon, then step into the mirror.
                </h1>
                <p className="mt-4 text-base leading-relaxed text-white/78 md:text-lg">
                  Start in the illustrated lobby, explore stylists or the lookbook, then click the mirror to enter your personal hair studio with live webcam try-on, portrait renders, and Gemini-guided memory.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Interactive Mirror",
                  "Live Webcam Try-On",
                  "Portrait Memory",
                  "Gemini Finish",
                ].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-white/14 bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {panel && (
              <motion.div
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
                className="absolute right-6 top-24 z-40 w-[360px] rounded-[2rem] border border-white/18 bg-[#101924]/88 p-5 text-white shadow-[0_30px_90px_rgba(0,0,0,0.3)] backdrop-blur"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                      {panel === "stylists" ? "Resident stylists" : "Salon lookbook"}
                    </div>
                    <div className="mt-2 text-2xl font-medium text-white">
                      {panel === "stylists" ? "Meet the floor team" : "Preview the mood board"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPanel(null)}
                    className="rounded-full border border-white/10 p-2 text-slate-300 transition-colors hover:border-white/20 hover:text-white"
                  >
                    <Scissors className="h-4 w-4" />
                  </button>
                </div>

                {panel === "stylists" ? (
                  <div className="mt-5 space-y-3">
                    {STYLIST_ROSTER.map((stylist) => (
                      <div
                        key={stylist.name}
                        className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-lg font-medium text-white">{stylist.name}</div>
                          <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200">
                            {stylist.specialty}
                          </div>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300">
                          {stylist.copy}
                        </p>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={onEnterStudio}
                      className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200"
                    >
                      <Calendar className="h-4 w-4" />
                      Enter mirror suite
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {lookbook.map(({ suggestion, preset }) => (
                      <div
                        key={preset.id}
                        className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-lg font-medium text-white">
                            {preset.label}
                          </div>
                          <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-200">
                            <Star className="mr-1 inline h-3 w-3" />
                            {preset.maintenance}
                          </div>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300">
                          {suggestion.reason}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {preset.vibes.slice(0, 3).map((vibe) => (
                            <span
                              key={`${preset.id}-${vibe}`}
                              className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-400"
                            >
                              {vibe}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={onEnterStudio}
                      className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200"
                    >
                      <Sparkles className="h-4 w-4" />
                      Try looks in the mirror
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

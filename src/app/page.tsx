"use client";

import { useRef, useState } from "react";
import {
  ChevronRight,
  MapPin,
  Menu,
  Scissors,
  Sparkles,
  Wand2,
} from "lucide-react";
import { motion } from "framer-motion";
import type {
  FaceProfile,
  HairstyleSuggestion,
  Salon,
  SalonSearchResponse,
} from "@/lib/types";
import LiveStyleStudio from "@/components/LiveStyleStudio";
import { HERO_PRESET_SUGGESTIONS } from "@/lib/styleStudio";

const STARTER_SUGGESTIONS: HairstyleSuggestion[] = HERO_PRESET_SUGGESTIONS;

export default function Page() {
  const [suggestions, setSuggestions] = useState<HairstyleSuggestion[]>([]);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [faceProfile, setFaceProfile] = useState<FaceProfile | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [salons, setSalons] = useState<Salon[]>([]);
  const [salonLoading, setSalonLoading] = useState(false);
  const [salonError, setSalonError] = useState<string | null>(null);
  const [hasSearchedSalons, setHasSearchedSalons] = useState(false);

  const studioRef = useRef<HTMLDivElement | null>(null);
  const salonsRef = useRef<HTMLDivElement | null>(null);
  const activeSuggestions =
    suggestions.length > 0 ? suggestions : STARTER_SUGGESTIONS;
  const resolvedSelectedStyle =
    selectedStyle || activeSuggestions[0]?.name || null;

  const handleResults = (payload: {
    suggestions: HairstyleSuggestion[];
    imageUrl: string;
    faceProfile: FaceProfile | null;
  }) => {
    setSuggestions(payload.suggestions || []);
    setSelfieUrl(payload.imageUrl);
    setFaceProfile(payload.faceProfile);
    setSelectedStyle(null);
    setSalons([]);
    setSalonError(null);
    setHasSearchedSalons(false);
  };

  const handleScrollToUpload = () => {
    if (studioRef.current) {
      studioRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleChooseStyle = (
    styleName: string,
    options?: { scrollToSalons?: boolean }
  ) => {
    setSelectedStyle(styleName);
    setSalons([]);
    setSalonError(null);
    setHasSearchedSalons(false);

    if (options?.scrollToSalons && salonsRef.current) {
      salonsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleFindSalons = async () => {
    if (!resolvedSelectedStyle) {
      setSalonError("Choose one of your AI hairstyles first.");
      return;
    }

    if (!locationQuery.trim()) {
      setSalonError("Add a city, neighborhood, or postal code to search.");
      return;
    }

    setSalonLoading(true);
    setSalonError(null);
    setHasSearchedSalons(true);

    try {
      const response = await fetch(
        `/api/salons?style=${encodeURIComponent(resolvedSelectedStyle)}&location=${encodeURIComponent(
          locationQuery.trim()
        )}`
      );

      const data = (await response.json()) as
        | SalonSearchResponse
        | { error?: string };

      if (!response.ok || !("salons" in data)) {
        const message =
          "error" in data ? data.error : "Unable to load salon matches.";
        throw new Error(message || "Unable to load salon matches.");
      }

      setSalons(data.salons);
    } catch (error) {
      setSalons([]);
      setSalonError(
        error instanceof Error ? error.message : "Unable to load salon matches."
      );
    } finally {
      setSalonLoading(false);

      if (salonsRef.current) {
        salonsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#4d2658_0%,#8f6078_14%,#f1c2b1_14.2%,#f1c2b1_82%,#85639a_100%)] text-slate-900 selection:bg-cyan-300/40">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(42,18,52,0.96),rgba(42,18,52,0.24))]" />

      <nav className="sticky top-0 z-50 mx-auto flex max-w-[1580px] items-center justify-between px-4 py-5 md:px-8">
        <div className="flex items-center gap-3 rounded-full border border-white/20 bg-[#2e1838]/90 px-4 py-2 text-white shadow-[0_18px_40px_rgba(41,16,49,0.28)] backdrop-blur">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-sky-500">
            <Scissors className="h-4 w-4 text-slate-950" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight">HairMatch</div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/60">
              Ai Salon Room
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-8 rounded-full border border-white/15 bg-white/15 px-6 py-3 text-sm font-medium text-white/90 backdrop-blur md:flex">
          <span>Mirror Room</span>
          <span>Stylists</span>
          <span>Lookbook</span>
          <button className="rounded-full bg-[#2e1838] px-5 py-2 text-white shadow-[0_10px_24px_rgba(41,16,49,0.24)]">
            Book Appointment
          </button>
        </div>

        <button className="rounded-full border border-white/20 bg-[#2e1838]/90 p-3 text-white md:hidden">
          <Menu className="h-5 w-5" />
        </button>
      </nav>

      <main className="mx-auto max-w-[1580px] px-4 pb-8 pt-2 md:px-8">
        <div className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
          <motion.aside
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[2.6rem] border border-white/25 bg-[linear-gradient(180deg,rgba(50,22,58,0.92),rgba(63,28,68,0.82))] p-6 text-white shadow-[0_30px_90px_rgba(67,24,69,0.26)]"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Premium Ai Salon
            </div>

            <h1 className="mt-5 text-4xl font-medium tracking-tight md:text-5xl">
              Enter the salon and try your next cut in the mirror.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/74">
              This is no longer a landing page. You step straight into the dressing
              room, open the mirror, talk to the stylist, try on looks from the
              bottom drawer, and finish with Gemini renders plus salon handoff.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={handleScrollToUpload}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cyan-300 px-6 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200"
              >
                Enter Salon
                <ChevronRight className="h-4 w-4" />
              </button>
              <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 px-6 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/10">
                Explore Lookbook
              </button>
            </div>

            <div className="mt-8 grid gap-3">
              {[
                {
                  icon: Wand2,
                  title: "Interactive mirror",
                  body: "Click into the salon mirror to start webcam mode and live face tracking.",
                },
                {
                  icon: Sparkles,
                  title: "Bottom style drawer",
                  body: "Browse cuts, shift the color melt, and keep the try-on in one continuous scene.",
                },
                {
                  icon: MapPin,
                  title: "Real handoff",
                  body: "Generate the Gemini finish, save it, and move directly into salon matching.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.8rem] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12">
                      <item.icon className="h-4 w-4 text-cyan-100" />
                    </div>
                    <div className="text-sm font-semibold text-white">{item.title}</div>
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-white/68">
                    {item.body}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[2rem] border border-white/12 bg-[#f6e2d7] px-5 py-5 text-slate-900">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6a4c65]">
                Session Snapshot
              </div>
              <div className="mt-3 grid gap-3 text-sm text-[#5f4b5d]">
                <div className="flex items-center justify-between gap-3 rounded-[1.2rem] bg-white/70 px-4 py-3">
                  <span>Looks available</span>
                  <span className="font-semibold text-[#40273f]">
                    {activeSuggestions.length}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[1.2rem] bg-white/70 px-4 py-3">
                  <span>Portrait status</span>
                  <span className="font-semibold text-[#40273f]">
                    {selfieUrl ? "Synced" : "Optional"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[1.2rem] bg-white/70 px-4 py-3">
                  <span>Salon handoff</span>
                  <span className="font-semibold text-[#40273f]">
                    {hasSearchedSalons ? "In progress" : "Ready"}
                  </span>
                </div>
              </div>
            </div>
          </motion.aside>

          <motion.section
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            ref={studioRef}
            className="relative"
          >
            <LiveStyleStudio
              faceProfile={faceProfile}
              suggestions={activeSuggestions}
              selfieUrl={selfieUrl}
              selectedStyle={resolvedSelectedStyle}
              onSelectStyle={(styleName) => handleChooseStyle(styleName)}
              onPortraitAnalyzed={handleResults}
              location={locationQuery}
              onLocationChange={setLocationQuery}
              onFindSalons={handleFindSalons}
              salonLoading={salonLoading}
              salonError={salonError}
              salons={salons}
              hasSearchedSalons={hasSearchedSalons}
            />
          </motion.section>
        </div>
      </main>
    </div>
  );
}

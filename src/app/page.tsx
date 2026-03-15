"use client";

import { useRef, useState } from "react";
import { Scissors, Sparkles, ChevronRight, Menu } from "lucide-react";
import { motion } from "framer-motion";
import { LampContainer } from "@/components/ui/lamp";
import type {
  FaceProfile,
  HairstyleSuggestion,
  Salon,
  SalonSearchResponse,
} from "@/lib/types";
import SelfieUploader from "@/components/SelfieUploader";
import SalonList from "@/components/SalonList";
import LiveStyleStudio from "@/components/LiveStyleStudio";
import HairstyleOverlay from "@/components/HairstyleOverlay";
import { createOverlayFromStyle } from "@/lib/styleStudio";

const STARTER_SUGGESTIONS: HairstyleSuggestion[] = [
  {
    name: "Textured Bob",
    reason: "A sharp but wearable starter look with clean lines and easy polish.",
  },
  {
    name: "Curtain Layers",
    reason:
      "A face-framing option that keeps movement, softness, and length in play.",
  },
  {
    name: "Modern Shag",
    reason:
      "A more directional cut with texture and crown lift for instant camera energy.",
  },
];

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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 bg-slate-950/50 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center">
            <Scissors className="h-4 w-4 text-slate-950" />
          </div>
          <span className="text-xl font-medium tracking-tight text-white">HairMatch</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <a href="#" className="hover:text-cyan-400 transition-colors">Services</a>
          <a href="#" className="hover:text-cyan-400 transition-colors">Stylists</a>
          <a href="#" className="hover:text-cyan-400 transition-colors">Lookbook</a>
          <button className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm">
            Book Appointment
          </button>
        </div>
        <button className="md:hidden p-2 text-slate-400 hover:text-white">
          <Menu className="h-6 w-6" />
        </button>
      </nav>

      {/* Hero Section */}
      <LampContainer className="pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.8, ease: "easeInOut" }}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-cyan-300 -mt-8 mb-8"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Premium AI Salon</span>
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0.5, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
          className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-center text-5xl font-medium tracking-tight text-transparent md:text-7xl lg:text-8xl"
        >
          Find your perfect <br /> <span className="text-cyan-400">aesthetic.</span>
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-6 max-w-2xl text-center text-base md:text-lg text-slate-400 leading-relaxed px-4"
        >
          Talk to the stylist immediately, switch on the webcam if you want,
          then drop in a portrait only when you want more personalized analysis.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-10 flex flex-col sm:flex-row gap-4 items-center"
        >
          <button
            onClick={handleScrollToUpload}
            className="group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full bg-cyan-500 px-8 text-sm font-medium text-slate-950 transition-all hover:bg-cyan-400 hover:shadow-[0_0_40px_rgba(34,211,238,0.4)] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2">
              Analyze Face <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
          <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-slate-700 px-8 text-sm font-medium text-slate-300 transition-all hover:border-slate-500 hover:bg-slate-800/50 hover:text-white">
            Explore Lookbook
          </button>
        </motion.div>
      </LampContainer>

      {/* Content Section */}
      <main className="relative z-10 mx-auto max-w-7xl px-6 py-24 md:px-12 lg:px-24 border-t border-white/5 bg-slate-950">
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          ref={studioRef}
          className="relative overflow-hidden rounded-[3rem] border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.08),transparent_24%),linear-gradient(180deg,rgba(8,18,31,0.86),rgba(4,9,17,0.96))] p-8 shadow-2xl shadow-cyan-900/20 md:p-12"
        >
          <div className="pointer-events-none absolute -left-16 top-12 h-60 w-60 rounded-full bg-cyan-500/8 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-fuchsia-500/8 blur-3xl" />
          <div className="relative">
              <div className="mb-10 flex flex-col items-start gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-3xl font-medium tracking-tight text-white mb-2">
                    Your Live Salon Agent
                  </h2>
                  <p className="max-w-2xl text-slate-400">
                    Talk to the stylist from the first second, keep the webcam
                    on if you want a live framing loop, then add a portrait for
                    stronger personalization without leaving the main stage.
                  </p>
                </div>
                <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100">
                  {selfieUrl
                    ? "Portrait synced into the session"
                    : "Start with webcam or mannequin mode"}
                </div>
              </div>

              <LiveStyleStudio
                faceProfile={faceProfile}
                suggestions={activeSuggestions}
                selfieUrl={selfieUrl}
                selectedStyle={resolvedSelectedStyle}
                onSelectStyle={(styleName) => handleChooseStyle(styleName)}
              />

              <div className="mb-10">
                <SelfieUploader onResults={handleResults} />
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {activeSuggestions.map((style, i) => (
                  <motion.article
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    key={style.name}
                    className={`group overflow-hidden rounded-2xl border bg-slate-950/50 transition-colors ${
                      resolvedSelectedStyle === style.name
                        ? "border-cyan-400/60 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]"
                        : "border-white/10 hover:bg-slate-900/80"
                    }`}
                  >
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-800">
                      {selfieUrl ? (
                        <>
                          <div
                            aria-label="Your selfie with hairstyle overlay"
                            className="h-full w-full bg-cover bg-center opacity-90"
                            style={{ backgroundImage: `url(${selfieUrl})` }}
                          />
                          <HairstyleOverlay
                            compact
                            config={createOverlayFromStyle(style.name)}
                          />
                        </>
                      ) : (
                        <div
                          aria-label={style.name}
                          className="h-full w-full bg-cover bg-center opacity-80 transition-transform duration-700 group-hover:scale-105 group-hover:opacity-100"
                          style={{
                            backgroundImage:
                              "url(https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80)",
                          }}
                        />
                      )}
                    </div>
                    <div className="p-6">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-lg font-medium text-white">{style.name}</h3>
                        {resolvedSelectedStyle === style.name && (
                          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed">{style.reason}</p>
                      <button
                        onClick={() =>
                          handleChooseStyle(style.name, { scrollToSalons: true })
                        }
                        className={`mt-6 w-full rounded-xl py-2.5 text-sm font-medium transition-colors ${
                          resolvedSelectedStyle === style.name
                            ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                            : "bg-white/5 text-white hover:bg-white/10"
                        }`}
                      >
                        {resolvedSelectedStyle === style.name
                          ? "Style selected"
                          : "Use this look"}
                      </button>
                    </div>
                  </motion.article>
                ))}
              </div>

              <div ref={salonsRef}>
                <SalonList
                  selectedStyle={resolvedSelectedStyle}
                  location={locationQuery}
                  onLocationChange={setLocationQuery}
                  onSearch={handleFindSalons}
                  loading={salonLoading}
                  error={salonError}
                  salons={salons}
                  hasSearched={hasSearchedSalons}
                />
              </div>
          </div>
        </motion.section>
      </main>
      
      {/* Super minimal footer */}
      <footer className="border-t border-white/5 py-12 px-6 text-center text-slate-500 text-sm">
        <p>© 2026 HairMatch by Antigravity. Premium Style AI.</p>
      </footer>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Scissors, Sparkles, MapPin, ChevronRight, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LampContainer } from "@/components/ui/lamp";
import type { HairstyleSuggestion } from "@/lib/types";

export default function Page() {
  const [suggestions, setSuggestions] = useState<HairstyleSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);

    const res = await fetch("/api/analyze-selfie", {
      method: "POST",
    });

    const data = await res.json();
    setSuggestions(data.suggestions || []);

    setLoading(false);
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
          className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-cyan-300 mb-8"
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
          Upload your portrait, let our AI analyze your face shape and texture, 
          and discover tailored hairstyle suggestions that you can take straight to our master stylists.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-10 flex flex-col sm:flex-row gap-4 items-center"
        >
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full bg-cyan-500 px-8 text-sm font-medium text-slate-950 transition-all hover:bg-cyan-400 hover:shadow-[0_0_40px_rgba(34,211,238,0.4)] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-r-transparent"></div>
                Analyzing profile...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Analyze Face <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            )}
          </button>
          <button className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-slate-700 px-8 text-sm font-medium text-slate-300 transition-all hover:border-slate-500 hover:bg-slate-800/50 hover:text-white">
            Explore Lookbook
          </button>
        </motion.div>
      </LampContainer>

      {/* Content Section */}
      <main className="relative z-10 mx-auto max-w-7xl px-6 py-24 md:px-12 lg:px-24 border-t border-white/5 bg-slate-950">
        
        <div className="mb-20 grid gap-8 md:grid-cols-3">
          <div className="group rounded-3xl border border-white/5 bg-white/[0.02] p-8 transition-colors hover:bg-white/[0.04]">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20 transition-transform group-hover:scale-110">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="mb-3 text-lg font-medium text-white">Smart Match</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              Styles mathematically tailored to your face shape, bone structure, and texture. No more guessing in the styling chair.
            </p>
          </div>
          
          <div className="group rounded-3xl border border-white/5 bg-white/[0.02] p-8 transition-colors hover:bg-white/[0.04]">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20 transition-transform group-hover:scale-110">
              <Scissors className="h-5 w-5" />
            </div>
            <h3 className="mb-3 text-lg font-medium text-white">Stylist Ready</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              Export professional technical briefs to share with your stylist, ensuring they know the precise cut, angle, and finish required.
            </p>
          </div>

          <div className="group rounded-3xl border border-white/5 bg-white/[0.02] p-8 transition-colors hover:bg-white/[0.04]">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20 transition-transform group-hover:scale-110">
              <MapPin className="h-5 w-5" />
            </div>
            <h3 className="mb-3 text-lg font-medium text-white">Premium Salons</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              Seamlessly book appointments with curated master stylists in your area who specialize in your matched hair textures.
            </p>
          </div>
        </div>

        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[2.5rem] border border-cyan-500/20 bg-gradient-to-b from-cyan-950/20 to-slate-900/40 p-8 md:p-12 shadow-2xl shadow-cyan-900/20"
            >
              <div className="mb-10 flex flex-col items-start gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-3xl font-medium tracking-tight text-white mb-2">
                    Your Curated Looks
                  </h2>
                  <p className="text-slate-400 max-w-lg">
                    Based on your facial structure analysis, our AI recommends these precise cuts. Show these directly to your stylist.
                  </p>
                </div>
                <button className="text-sm font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  View full analysis <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {suggestions.map((style, i) => (
                  <motion.article
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    key={style.name}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50 hover:bg-slate-900/80 transition-colors"
                  >
                    <div className="aspect-[4/5] w-full overflow-hidden bg-slate-800">
                      <img 
                        src={`https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80`} 
                        alt={style.name}
                        className="h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105 group-hover:opacity-100"
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="text-lg font-medium text-white mb-2">{style.name}</h3>
                      <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed">{style.reason}</p>
                      <button className="mt-6 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-white transition-colors">
                        Book this style
                      </button>
                    </div>
                  </motion.article>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
      
      {/* Super minimal footer */}
      <footer className="border-t border-white/5 py-12 px-6 text-center text-slate-500 text-sm">
        <p>© 2026 HairMatch by Antigravity. Premium Style AI.</p>
      </footer>
    </div>
  );
}


"use client";

import { useState } from "react";
import { Scissors, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { HairstyleSuggestion } from "@/lib/types";
import SelfieUploader from "@/components/SelfieUploader";
import SalonList from "@/components/SalonList";
import InteractiveSalonBackground from "@/components/InteractiveSalonBackground";

type ModalState = 'none' | 'selfie' | 'salons' | 'hairstyles';

export default function Page() {
  const [activeModal, setActiveModal] = useState<ModalState>('none');
  const [suggestions, setSuggestions] = useState<HairstyleSuggestion[]>([]);

  const handleResults = (payload: {
    suggestions: HairstyleSuggestion[];
    selfieBase64: string;
    mimeType: string;
  }) => {
    setSuggestions(payload.suggestions || []);
    setActiveModal('hairstyles');
  };

  const closeModal = () => setActiveModal('none');

  return (
    <div className="min-h-screen text-slate-100 font-sans flex flex-col overflow-hidden relative">
      
      {/* Interactive Background */}
      <InteractiveSalonBackground 
        onOpenSelfie={() => setActiveModal('selfie')}
        onOpenSalons={() => setActiveModal('salons')}
        onOpenHairstyles={() => setActiveModal('hairstyles')}
      />

      {/* Navigation Layered on Top */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav flex items-center justify-between px-8 py-5 md:px-16 transition-all pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary-purple/20 border border-primary-purple/30 flex items-center justify-center shadow-[0_0_15px_rgba(178,134,194,0.3)]">
            <Scissors className="h-5 w-5 text-primary-purple" />
          </div>
          <span className="text-2xl font-black tracking-tight text-white drop-shadow-md">HairMatch</span>
        </div>
        <div className="hidden md:flex items-center gap-10 text-sm font-bold tracking-wide text-white drop-shadow-md">
          <button onClick={() => setActiveModal('selfie')} className="hover:text-primary-purple transition-colors">Analyzer</button>
          <button onClick={() => setActiveModal('hairstyles')} className="hover:text-primary-purple transition-colors">Lookbook</button>
          <button onClick={() => setActiveModal('salons')} className="hover:text-primary-purple transition-colors">Salons</button>
        </div>
        <button className="md:hidden p-2 text-white hover:text-primary-purple transition-colors">
          <Menu className="h-7 w-7" />
        </button>
      </nav>

      {/* Centered Instructions when no modal is open */}
      <AnimatePresence>
        {activeModal === 'none' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-1/4 left-1/2 -translate-x-1/2 flex flex-col items-center text-center pointer-events-none z-10 w-full px-4"
          >
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-4 drop-shadow-2xl">
              Welcome to the <span className="text-gradient">Salon</span>.
            </h1>
            <p className="text-lg md:text-xl text-white/90 font-medium drop-shadow-lg max-w-lg">
              Interact with the scene to begin shaping your perfect aesthetic. Click the mirror to analyze your look.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals Container */}
      <AnimatePresence>
        {activeModal !== 'none' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 md:p-8 overflow-y-auto"
            onClick={closeModal}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              className="relative w-full max-w-5xl glass-panel rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] my-auto max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()} 
            >
              {/* Close Button */}
              <button 
                onClick={closeModal}
                className="absolute top-6 right-6 z-50 p-2 rounded-full bg-black/50 hover:bg-white/20 text-white transition-colors border border-white/20 backdrop-blur-md"
              >
                <X className="h-6 w-6" />
              </button>

              <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar flex-grow">
                {activeModal === 'selfie' && (
                   <SelfieUploader onResults={handleResults} />
                )}

                {activeModal === 'salons' && (
                   <div className="pt-4">
                     <SalonList />
                   </div>
                )}

                {activeModal === 'hairstyles' && (
                  <div className="w-full pt-4">
                    <div className="mb-10 flex flex-col items-start gap-2">
                      <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                        Your Curated Looks
                      </h2>
                      <p className="text-slate-300 font-medium leading-relaxed">
                        {suggestions.length > 0 
                          ? "Artisan-level recommendations based on your analysis."
                          : "Explore our lookbook or upload a selfie for personalized recommendations."}
                      </p>
                    </div>

                    {suggestions.length > 0 ? (
                      <div className="grid gap-6 md:grid-cols-2">
                        {suggestions.map((style, i) => (
                          <motion.article
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            key={style.name}
                            className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors"
                          >
                            <h3 className="text-xl font-bold text-gradient mb-3">{style.name}</h3>
                            <p className="text-sm text-slate-300 font-medium leading-relaxed">{style.reason}</p>
                          </motion.article>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-slate-400 mb-6 font-medium">No personalized suggestions yet.</p>
                        <button onClick={() => setActiveModal('selfie')} className="btn-primary mx-auto">
                          Analyze My Look
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Minimal Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-6 px-6 text-center z-30 pointer-events-none">
        <p className="text-white/60 font-medium tracking-wide text-xs drop-shadow-md">
          © 2026 HairMatch by Antigravity. Interactive Aesthetic AI.
        </p>
      </footer>
    </div>
  );
}

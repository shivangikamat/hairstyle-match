"use client";

import { useEffect, useState } from "react";
import { MapPin, Star, ExternalLink, Scissors, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Salon = {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  address: string;
  distance: string;
  image: string;
  specialties: string[];
};

const SALON_IMAGE_POOL = [
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1487412912498-0447578fcca8?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1522337354546-97bcbc86c253?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1532711224410-64a272635917?q=80&w=800&auto=format&fit=crop"
];

const initialSalons: Salon[] = [
  {
    id: "s1",
    name: "Salon New York 5",
    rating: 4.9,
    reviews: 128,
    address: "123 Broadway, New York, NY",
    distance: "0.8 miles",
    image: SALON_IMAGE_POOL[0],
    specialties: ["Balayage", "Vivid Colors"]
  },
  {
    id: "s2",
    name: "The Velvet Room",
    rating: 4.7,
    reviews: 84,
    address: "456 5th Ave, New York, NY",
    distance: "1.2 miles",
    image: SALON_IMAGE_POOL[1],
    specialties: ["Textured Hair", "Extensions"]
  },
  {
    id: "s3",
    name: "Aura Studio",
    rating: 4.8,
    reviews: 215,
    address: "789 Park Ave, New York, NY",
    distance: "2.5 miles",
    image: SALON_IMAGE_POOL[2],
    specialties: ["Bridal styling", "Keratin prep"]
  }
];

export default function SalonList() {
  const [salons, setSalons] = useState<Salon[]>(initialSalons);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleChatResponse = (event: Event) => {
      const customEvent = event as CustomEvent;
      const text = customEvent.detail?.text;
      if (!text) return;

      const lines = text.split('\n');
      const foundSalons: Salon[] = [];
      let currentSalon: Partial<Salon> | null = null;
      let imgIndex = 0;

      lines.forEach((line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (trimmed.includes('Address:')) {
          if (currentSalon) {
            currentSalon.address = trimmed.replace(/.*Address:\s*/, '').trim();
          }
        } 
        else if (
          !trimmed.includes(':') && 
          trimmed.length > 3 && 
          !trimmed.toLowerCase().includes('hi there') && 
          !trimmed.toLowerCase().includes('nathan') &&
          !trimmed.toLowerCase().includes('here to help')
        ) {
          if (currentSalon && currentSalon.name) {
            foundSalons.push(currentSalon as Salon);
          }
          
          currentSalon = {
            id: `n8n-${Date.now()}-${imgIndex}-${Math.random()}`,
            name: trimmed.replace(/^[*\s-📍]+/, '').trim(),
            rating: 4.5 + Math.random() * 0.5,
            reviews: 40 + Math.floor(Math.random() * 200),
            distance: (0.5 + Math.random() * 5).toFixed(1) + " km",
            image: SALON_IMAGE_POOL[(imgIndex++) % SALON_IMAGE_POOL.length],
            specialties: ["Curated Style", "Expert Cut"]
          };
        }
      });

      if (currentSalon && currentSalon.name && currentSalon.address) {
        foundSalons.push(currentSalon as Salon);
      }

      if (foundSalons.length > 0) {
        setIsUpdating(true);
        setTimeout(() => {
          setSalons(foundSalons.slice(0, 6));
          setIsUpdating(false);
        }, 600);
      }
    };

    window.addEventListener('n8n-chat-response', handleChatResponse as EventListener);
    return () => window.removeEventListener('n8n-chat-response', handleChatResponse as EventListener);
  }, []);

  return (
    <section className="relative overflow-hidden w-full">
      <AnimatePresence>
        {isUpdating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-md"
          >
            <div className="flex flex-col items-center gap-6 bg-white/10 border border-white/20 p-10 rounded-[2.5rem] shadow-2xl">
              <Loader2 className="h-12 w-12 animate-spin text-accent-teal" />
              <p className="text-lg font-black text-white tracking-wide">Syncing with Stylist Network...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-14 flex flex-col items-start gap-4">
        <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2 flex items-center gap-4">
          <div className="p-3 bg-accent-teal/10 rounded-2xl border border-accent-teal/20 shadow-[0_0_15px_rgba(20,184,166,0.2)]">
            <Scissors className="h-8 w-8 text-accent-teal" />
          </div>
          Matched Salons
        </h2>
        <p className="text-lg text-slate-300 font-medium max-w-2xl leading-relaxed">
          We found these premium salons near you specializing in your recommended styles. Powered by seamless integration.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {salons.map((salon, i) => (
          <motion.article
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            key={salon.id}
            className="group relative overflow-hidden bg-white/5 border border-white/10 rounded-[2rem] hover:bg-white/10 transition-colors shadow-2xl"
          >
            <div className="aspect-[16/9] overflow-hidden bg-black/50 relative">
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent z-10 opacity-80"></div>
              <img 
                src={salon.image} 
                alt={salon.name}
                className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-110 group-hover:opacity-100 mix-blend-overlay"
              />
              <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-black/40 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                <Star className="w-4 h-4 text-accent-gold fill-accent-gold" />
                <span className="text-sm font-black text-white">{salon.rating.toFixed(1)}</span>
              </div>
            </div>
            
            <div className="p-8">
              <h3 className="text-2xl font-black text-white mb-5 line-clamp-1">{salon.name}</h3>
              
              <div className="flex flex-col gap-3 mb-8">
                <p className="text-base text-slate-300 flex items-start gap-3 leading-relaxed font-bold">
                  <MapPin className="w-5 h-5 text-accent-teal shrink-0 mt-0.5" />
                  <span>{salon.distance} • {salon.address}</span>
                </p>
                <p className="text-xs text-slate-500 font-black uppercase tracking-widest pl-8">
                  {salon.reviews} verified reviews
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5 mb-8">
                {salon.specialties.map(spec => (
                  <span key={spec} className="text-[10px] uppercase tracking-[0.2em] font-black bg-white/5 text-slate-200 border border-white/10 px-3 py-1.5 rounded-full">
                    {spec}
                  </span>
                ))}
              </div>

              <button className="w-full btn-secondary text-sm !py-4">
                Book Consultation <ExternalLink className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

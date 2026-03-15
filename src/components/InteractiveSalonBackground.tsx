"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface HotspotProps {
  id: string;
  top: string;
  left: string;
  width: string;
  height: string;
  label: string;
  onClick: () => void;
}

const Hotspot: React.FC<HotspotProps> = ({ top, left, width, height, label, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="absolute cursor-pointer transition-all duration-300"
      style={{ top, left, width, height }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div 
        className={`w-full h-full rounded-2xl border-2 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px] ${
          isHovered 
            ? 'border-white/40 bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.2)]' 
            : 'border-transparent bg-transparent'
        }`}
      >
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute -top-12 bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-medium tracking-wide border border-white/20 shadow-xl whitespace-nowrap"
            >
              {label}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

interface InteractiveSalonBackgroundProps {
  onOpenSelfie: () => void;
  onOpenSalons: () => void;
  onOpenHairstyles: () => void;
}

const InteractiveSalonBackground: React.FC<InteractiveSalonBackgroundProps> = ({
  onOpenSelfie,
  onOpenSalons,
  onOpenHairstyles,
}) => {
  return (
    <div className="fixed inset-0 w-full h-full z-0 overflow-hidden bg-[#0f0518]">
      <div className="relative w-full h-full">
        {/* The background image */}
        <div 
          className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/salon_scene.svg)' }}
        />
        
        {/* Semi-transparent dark overlay to make hotspots and modals pop slightly more */}
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />

        {/* Hotspots */}
        {/* Mirror Area - Maps to Selfie Upload */}
        <Hotspot
          id="mirror"
          top="15%"
          left="35%"
          width="30%"
          height="45%"
          label="Try New Looks (Mirror)"
          onClick={onOpenSelfie}
        />

        {/* Product Shelf / Desk Left - Maps to Hairstyles */}
        <Hotspot
          id="shelf-left"
          top="40%"
          left="10%"
          width="20%"
          height="35%"
          label="Browse Hairstyles"
          onClick={onOpenHairstyles}
        />

        {/* Desk Right / Seating - Maps to Salons */}
        <Hotspot
          id="desk-right"
          top="50%"
          left="70%"
          width="20%"
          height="30%"
          label="Find Salons"
          onClick={onOpenSalons}
        />
      </div>
    </div>
  );
};

export default InteractiveSalonBackground;

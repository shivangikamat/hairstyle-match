"use client";

import { useState } from "react";
import type {
  FaceProfile,
  HairstyleSuggestion,
  PageStage,
  Salon,
  SalonSearchResponse,
} from "@/lib/types";
import LiveStyleStudio from "@/components/LiveStyleStudio";
import SalonLobby from "@/components/SalonLobby";
import { HERO_PRESET_SUGGESTIONS } from "@/lib/styleStudio";

const STARTER_SUGGESTIONS: HairstyleSuggestion[] = HERO_PRESET_SUGGESTIONS;

export default function Page() {
  const [stage, setStage] = useState<PageStage>("lobby");
  const [suggestions, setSuggestions] = useState<HairstyleSuggestion[]>([]);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [faceProfile, setFaceProfile] = useState<FaceProfile | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [salons, setSalons] = useState<Salon[]>([]);
  const [salonLoading, setSalonLoading] = useState(false);
  const [salonError, setSalonError] = useState<string | null>(null);
  const [hasSearchedSalons, setHasSearchedSalons] = useState(false);

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

  const handleChooseStyle = (styleName: string) => {
    setSelectedStyle(styleName);
    setSalons([]);
    setSalonError(null);
    setHasSearchedSalons(false);
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
        `/api/salons?style=${encodeURIComponent(
          resolvedSelectedStyle
        )}&location=${encodeURIComponent(locationQuery.trim())}`
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
    }
  };

  if (stage === "lobby") {
    return (
      <SalonLobby
        suggestions={activeSuggestions}
        onEnterStudio={() => setStage("studio")}
      />
    );
  }

  return (
    <LiveStyleStudio
      faceProfile={faceProfile}
      suggestions={activeSuggestions}
      selfieUrl={selfieUrl}
      selectedStyle={resolvedSelectedStyle}
      onSelectStyle={handleChooseStyle}
      onPortraitAnalyzed={handleResults}
      location={locationQuery}
      onLocationChange={setLocationQuery}
      onFindSalons={handleFindSalons}
      salonLoading={salonLoading}
      salonError={salonError}
      salons={salons}
      hasSearchedSalons={hasSearchedSalons}
      onBackToLobby={() => setStage("lobby")}
    />
  );
}

export type FaceProfile = {
  faceShape: string;
  hairTexture: string;
  skinTone: string;
};

export type HairstyleSuggestion = {
  name: string;
  reason: string;
};

export type Salon = {
  name: string;
  address?: string;
  rating?: number;
  website?: string;
  matchedServices?: string[];
};
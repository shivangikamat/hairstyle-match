"use client";

import { useState, useEffect } from "react";
import type { FaceProfile } from "@/lib/types";

type Suggestion = {
  name: string;
  reason: string;
};

type Props = {
  onResults?: (payload: {
    suggestions: Suggestion[];
    imageUrl: string;
    faceProfile: FaceProfile | null;
  }) => void;
};

export default function SelfieUploader({ onResults }: Props) {
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  // Clean up object URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleAnalyze = async () => {
    if (!selectedFile) {
      alert("Please upload a selfie first.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/analyze-selfie", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        suggestions?: Suggestion[];
        faceProfile?: FaceProfile;
      };

      if (previewUrl && data.suggestions) {
        onResults?.({
          suggestions: data.suggestions,
          imageUrl: previewUrl,
          faceProfile: data.faceProfile || null,
        });
      }
    } catch (error) {
      console.error("Error analyzing selfie:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-[2.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.15),transparent_30%),linear-gradient(145deg,rgba(7,11,19,0.96),rgba(9,17,30,0.88))] p-6 shadow-[0_30px_120px_rgba(2,8,23,0.48)] md:p-8">
      <div className="pointer-events-none absolute -left-16 top-12 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-56 w-56 rounded-full bg-pink-400/10 blur-3xl" />

      <div className="relative grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <div className="mb-4 inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Step 01 Portrait Scan
          </div>
          <h2 className="max-w-md text-3xl font-medium tracking-tight text-white md:text-4xl">
            Start with a portrait that feels like a cover shot.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-400 md:text-base">
            Upload one clear, front-facing photo and we&apos;ll use it as the
            live base for every hairstyle mashup, salon recommendation, and
            agent conversation.
          </p>

          <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <input
              id="selfie-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-slate-950/60 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Selected portrait
              </div>
              <div className="mt-2 text-sm text-white">
                {selectedFile ? selectedFile.name : "No image selected yet"}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Best with a straight-on angle, soft lighting, and visible hairline.
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <label
                  htmlFor="selfie-upload"
                  className="inline-flex h-12 cursor-pointer items-center justify-center rounded-full border border-white/10 px-5 text-sm font-medium text-white transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                >
                  Choose portrait
                </label>
                <button
                  onClick={handleAnalyze}
                  disabled={loading || !selectedFile}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Analyzing portrait..." : "Analyze with Gemini"}
                </button>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              We only use this image inside the session to power the preview and
              recommendation flow.
            </p>
          </div>
        </div>

        <div className="relative min-h-[320px] overflow-hidden rounded-[2.25rem] border border-white/10 bg-slate-950/60 sm:min-h-[420px]">
          {previewUrl ? (
            <>
              <div
                aria-label="Uploaded selfie preview"
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${previewUrl})` }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.05),rgba(2,6,23,0.55))]" />
              <div className="absolute left-5 top-5 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200 backdrop-blur">
                Portrait Loaded
              </div>
              <div className="absolute bottom-5 left-5 max-w-xs rounded-[1.5rem] border border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Ready For Live Try-On
                </div>
                <div className="mt-1 text-sm text-white">
                  Your image will feed the overlay studio and the stylist agent.
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative flex h-[80%] w-[72%] items-center justify-center rounded-[42%] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.12),transparent_55%),rgba(15,23,42,0.88)]">
                <div className="absolute top-[14%] h-20 w-20 rounded-full border border-white/10 bg-slate-900/80" />
                <div className="absolute top-[30%] h-40 w-32 rounded-[40%] border border-white/10 bg-slate-900/60" />
                <div className="absolute bottom-8 text-center text-sm text-slate-500">
                  Your portrait stage will appear here.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { UploadCloud, Camera, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

type Suggestion = {
  name: string;
  reason: string;
};

type Props = {
  onResults?: (payload: {
    suggestions: Suggestion[];
    imageUrl: string;
    selfieBase64: string;
    mimeType: string;
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

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const analyzeFile = async (file: File) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analyze-selfie", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.suggestions && data.selfie?.data) {
        const fileUrl = URL.createObjectURL(file);
        setPreviewUrl(fileUrl);
        
        onResults?.({
          suggestions: data.suggestions,
          imageUrl: fileUrl,
          selfieBase64: data.selfie.data,
          mimeType: data.selfie.mimeType || "image/jpeg",
        });
      } else {
        alert("Failed to analyze selfie. Check server logs.");
      }
    } catch (error) {
      console.error("Error analyzing selfie:", error);
      alert("Error calling analysis API.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = () => {
    if (selectedFile) {
      analyzeFile(selectedFile);
    }
  };

  const handleUseSample = async () => {
    try {
      setLoading(true);
      const res = await fetch("/sample-face.jpg");
      const blob = await res.blob();
      const file = new File([blob], "sample-face.jpg", { type: "image/jpeg" });
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      analyzeFile(file);
    } catch (error) {
      console.error("Failed to load sample image:", error);
      setLoading(false);
    }
  };

  return (
    <section className="w-full">
      <div className="max-w-3xl">
        <h2 className="mb-4 text-3xl md:text-5xl font-black text-white tracking-tight">Upload Portrait</h2>
        <p className="mb-10 text-base md:text-xl text-slate-300 font-medium leading-relaxed">
          Upload a clear front-facing photo. Our AI will precisely map your facial features
          and construct visually stunning styles meant to elevate your aesthetic.
        </p>

        <div className="mb-10 relative">
          <label className={`flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 ${previewUrl ? 'border-primary-purple bg-primary-purple/10' : 'border-white/20 bg-black/20 hover:bg-black/40 hover:border-white/40'}`}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {previewUrl ? (
                <CheckCircle2 className="w-14 h-14 text-primary-purple mb-4" />
              ) : (
                <UploadCloud className="w-14 h-14 text-slate-400 mb-4" />
              )}
              <p className="mb-3 text-lg font-bold text-white">
                <span className="text-primary-purple">Click to upload</span> or drag and drop
              </p>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">High Res JPG/PNG</p>
            </div>
            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <button
            onClick={handleAnalyze}
            disabled={loading || !selectedFile}
            className="btn-primary"
          >
            {loading ? "Analyzing Geometry..." : "Analyze Portrait"} <Camera className="w-5 h-5 shrink-0" />
          </button>

          <button
            onClick={handleUseSample}
            disabled={loading}
            className="btn-secondary"
          >
            Use Sample Model
          </button>
        </div>

        {previewUrl && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 flex flex-col sm:flex-row items-center gap-8 p-8 rounded-3xl bg-white/5 border border-white/10"
          >
            <div className="relative w-28 h-28 overflow-hidden rounded-2xl border border-primary-purple shadow-[0_0_20px_rgba(178,134,194,0.3)] shrink-0">
              <img
                src={previewUrl}
                alt="Selected portrait"
                className="w-full h-full object-cover saturate-110"
              />
            </div>
            <div>
              <h4 className="text-white font-black text-xl mb-2">Portrait Secured</h4>
              <p className="text-base font-medium text-slate-400 leading-relaxed">
                Your features are mapped. Press &quot;Analyze Portrait&quot; to find your mathematically perfect hairstyles.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
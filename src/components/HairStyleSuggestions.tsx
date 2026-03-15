import type { HairstyleSuggestion } from "../lib/types";

type Props = {
  suggestions: HairstyleSuggestion[];
  onChoose: (hairstyle: string) => void;
};

export default function HairstyleSuggestions({ suggestions, onChoose }: Props) {
  if (suggestions.length === 0) {
    return (
      <p className="mt-8 text-sm font-medium text-slate-400">
        No suggestions available. Please upload a portrait to analyze.
      </p>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="mb-6 text-2xl font-black text-white">Suggested Hairstyles</h2>
      <div className="space-y-4">
        {suggestions.map((style) => (
          <div
            key={style.name}
            className="rounded-[1.5rem] bg-white/5 border border-white/10 p-6 shadow-xl cursor-pointer hover:bg-white/10 transition-colors"
            onClick={() => onChoose(style.name)}
          >
            <h3 className="text-xl font-bold text-accent-teal mb-2">{style.name}</h3>
            <p className="text-sm font-medium text-slate-300 leading-relaxed">{style.reason}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
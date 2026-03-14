import type { HairstyleSuggestion } from "@/lib/types";

type Props = {
  suggestions: HairstyleSuggestion[];
};

export default function HairstyleSuggestions({ suggestions }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold mb-4">Suggested Hairstyles</h2>
      <div className="space-y-4">
        {suggestions.map((style) => (
          <div key={style.name} className="rounded-xl border p-4 shadow-sm">
            <h3 className="text-lg font-medium">{style.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{style.reason}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
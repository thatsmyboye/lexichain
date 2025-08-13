import { useEffect } from "react";
import WordPathGame from "@/components/game/WordPathGame";

const Index = () => {
  useEffect(() => {
    document.title = "Lexichain | Build word chains by reusing tiles";
    const desc = "Draw paths to make words. Each new word must reuse at least one tile. Keep chaining until no valid word remains.";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", desc);
    const og = document.querySelector('meta[property="og:title"]');
    if (og) og.setAttribute("content", "Lexichain");
    const ogd = document.querySelector('meta[property="og:description"]');
    if (ogd) ogd.setAttribute("content", desc);
  }, []);

  return (
    <main>
      <header className="container mx-auto pt-10 pb-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">Lexichain</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">Make as many valid words as you can by drawing paths through the letter grid. Each new word must reuse at least one tile from the previous word.</p>
      </header>
      <WordPathGame />
    </main>
  );
};

export default Index;

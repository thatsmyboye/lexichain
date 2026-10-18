import { useEffect, useState } from "react";
import type React from "react";
import { BookOpen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchDefinition, type WordDefinition as Definition } from "@/lib/definitions";

type State = { status: "loading" } | { status: "ok"; def: Definition } | { status: "missing" } | { status: "error" };

// Fetches and renders a definition. Mount it only when it's visible (e.g.
// inside an opened popover or accordion) so we don't fetch eagerly.
export function DefinitionContent({ word }: { word: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    fetchDefinition(word)
      .then(def => active && setState(def ? { status: "ok", def } : { status: "missing" }))
      .catch(() => active && setState({ status: "error" }));
    return () => {
      active = false;
    };
  }, [word]);

  if (state.status === "loading") return <p className="text-xs text-foreground/70">Looking up {word.toUpperCase()}…</p>;
  if (state.status === "missing") return <p className="text-xs text-foreground/75">No definition found for {word.toUpperCase()} — it's in the game's word list, but not in the dictionary we look up.</p>;
  if (state.status === "error") return <p className="text-xs text-foreground/75">Couldn't load a definition. Check your connection.</p>;
  const { def } = state;
  return (
    <div className="space-y-1.5 text-xs">
      <div>
        <span className="font-bold uppercase">{def.word}</span>
        {def.phonetic && <span className="ml-2 text-foreground/70">{def.phonetic}</span>}
      </div>
      <ol className="space-y-1">
        {def.meanings.map(m => (
          <li key={m.partOfSpeech}>
            <span className="italic text-foreground/75">{m.partOfSpeech}</span> {m.definition}
            {m.example && <span className="block text-foreground/70">“{m.example}”</span>}
          </li>
        ))}
      </ol>
      <p className="text-[10px] text-foreground/60">From Wiktionary via dictionaryapi.dev</p>
    </div>
  );
}

// A word chip that opens its definition in a popover
export function DefinableWord({ word, className = "", children }: { word: string; className?: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex min-h-8 items-center gap-1 rounded px-2 py-0.5 text-xs font-medium uppercase underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-500))] ${className}`}
          aria-label={`Define ${word}`}
        >
          {children ?? word}
          <BookOpen aria-hidden="true" className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        {open && <DefinitionContent word={word} />}
      </PopoverContent>
    </Popover>
  );
}

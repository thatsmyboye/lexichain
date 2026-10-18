// Word definitions from the free Dictionary API (dictionaryapi.dev, sourced
// from Wiktionary, CC BY-SA). Results are cached per session; only the word
// itself is sent.
export interface WordDefinition {
  word: string;
  phonetic?: string;
  meanings: { partOfSpeech: string; definition: string; example?: string }[];
  sourceUrl?: string;
}

type ApiEntry = {
  word: string;
  phonetic?: string;
  sourceUrls?: string[];
  meanings?: { partOfSpeech: string; definitions?: { definition: string; example?: string }[] }[];
};

const cache = new Map<string, Promise<WordDefinition | null>>();

export function fetchDefinition(word: string): Promise<WordDefinition | null> {
  const key = word.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const request = (async () => {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const entries = (await res.json()) as ApiEntry[];
      const meanings: WordDefinition["meanings"] = [];
      for (const entry of entries) {
        for (const meaning of entry.meanings ?? []) {
          const first = meaning.definitions?.[0];
          if (first && meanings.length < 3 && !meanings.some(m => m.partOfSpeech === meaning.partOfSpeech)) {
            meanings.push({ partOfSpeech: meaning.partOfSpeech, definition: first.definition, example: first.example });
          }
        }
      }
      if (!meanings.length) return null;
      return {
        word: key,
        phonetic: entries.find(e => e.phonetic)?.phonetic,
        meanings,
        sourceUrl: entries[0]?.sourceUrls?.[0],
      };
    } catch (err) {
      // Network failure: allow a retry next time
      cache.delete(key);
      throw err;
    }
  })();
  cache.set(key, request);
  return request;
}

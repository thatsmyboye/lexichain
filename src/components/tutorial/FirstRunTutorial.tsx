import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------------ */
/* First-run persistence                                                     */
/* ------------------------------------------------------------------------ */

const SEEN_KEY = "lexichain-tutorial-seen";

/** True until the player has finished or skipped the first-run tutorial. */
export function shouldShowFirstRunTutorial(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === null;
  } catch {
    // Storage blocked (private mode, sandboxed iframe): don't nag every visit.
    return false;
  }
}

export function markFirstRunTutorialSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, new Date().toISOString());
  } catch {
    /* storage unavailable; nothing to persist */
  }
}

/* ------------------------------------------------------------------------ */
/* Practice board                                                            */
/* ------------------------------------------------------------------------ */

// Every letter is unique, so a typed word maps to exactly one set of tiles.
//   C A T S
//   R N E P
//   O I L D
//   U G M Y
const SIZE = 4;
const LETTERS = "CATSRNEPOILDUGMY".split("");
const T_TILE = 2;
const CAT_TILES = [0, 1, 2];
const SUGGESTED_TILES = [2, 6, 5]; // T → E → N

// Every dictionary word (public/words.txt) traceable on this board that
// passes through the T. Generated offline by walking all paths.
const WORDS_WITH_T = new Set(
  ("AET ANET ANLET ANT ANTE ANTED ANTES ANTS AROINT AROINTED AROINTS ATE ATED ATELY ATEN " +
    "ATES CANT CANTED CANTEL CANTS CARNET CARNETS CATE CATEL CATES CATNEP CATS CRANET " +
    "CRANTS CRATE CRATED CRATES CRINATE CRINATED CRINET CRONET DELINT DELIRANT DENAT DENT " +
    "DENTS DEPT DET DETAR DETN DPT EAT EATS EST ETA ETNA GILET GIMLET GIMLETS GLENT GLINT " +
    "GLINTED GLINTS GORIEST INEPT INLET INLETS INT INTA INTEL IRATE IRATELY LEANT LEARNT " +
    "LEAT LENT LEPTA LEST LET LETS LIEST LINET LINT LINTS LIONET LIRATE MILDEST MINORATE " +
    "MINT MINTED MINTS MIRATE NAT NATE NATES NEAT NEATS NEST NET NETS NORATE OINT ONLIEST " +
    "ONT ORANT ORANTE ORANTES ORATE ORATED ORATES ORCANET ORIENT ORIENTS ORNATE ORNATELY " +
    "PEAT PEATS PENT PENTA PEST PET PETS PLEAT PLEATS PST PTA PTE PTS RANT RANTED RANTS RAT " +
    "RATE RATED RATEL RATES RATS RIGLET SEAT SENT SEPT SEPTA SEPTAN SET SETA SPENT SPET " +
    "SPLENT SPLET SPLINT SPLINTED SPT STA STAN STANE STANED STANIEL STANLY STAR STARN " +
    "STARNEL STARNIE STEAN STEARIN STEIN STEN STENAR STENO STENOG STEP TAE TAEL TAEN TAN " +
    "TANE TANO TAR TARI TARIE TARIN TARN TARO TEA TEAN TEAR TEARILY TED TEIL TEL TELI TEN " +
    "TENIO TENOR TPD TPS TSP UGLIEST UINTA").split(" "),
);

// Dictionary words on this board that miss the T, so a wrong answer can be
// explained precisely ("that's a word, but it doesn't reuse the T").
const WORDS_WITHOUT_T = new Set(
  ("ACNE ACNED ACNES ACRON AES ANC ANE ANES ANI ANIL ANILE ANIM ANOIL ARC ARIEL ARIES ARIL " +
    "ARILED ARION ARN ARNE ARNI ARO CAN CANE CANED CANEL CANES CANLI CAR CARIED CARIEN " +
    "CARIES CARN CARNE CARNEL CARNIE CARNIED CARNIES CARO CARONE CRAN CRANE CRANED CRANELY " +
    "CRANES CRIED CRIES CRIG CRILE CRIM CRIN CRINE CRINED CRINEL CRO CRONE CRONEL CRONES " +
    "CRONIE CRONIED CRONIES DEA DEAN DEAR DEARN DEI DEIL DEINO DEL DELI DELIM DELY DEN " +
    "DENAR DENARI DENARO DENIM DEP DES EAN EAR EARN EDP EILD EIR ELD ELI ELINOR ELM ELMY " +
    "ELYMI ENC ENL ENOIL ESP GIE GIED GIEN GIES GIL GILD GILDEN GILE GILENO GILES GIM GIN " +
    "GINEP GIO GIRN GIRNED GIRNEL GIRO GIRON GLD GLEAN GLED GLEDY GLEIR GLEN GLIM GOI GON " +
    "GONA GONE GOR GORA GORAN GORILY GOU GUILD GUILE GUILED GUILES GUILY GUINEA GUIRO ILE " +
    "ILEA ILEAC INC INCA INCR INCRA INLY INO INRO ION IONE IOU IRA IRAN IRON IRONE IRONED " +
    "IRONES IRONLY LEA LEAN LEAR LEARN LED LEI LEN LENA LENCA LENO LENORA LEP LES LIE LIED " +
    "LIEN LIENOR LIES LIG LIM LIMY LIN LINA LINAC LINE LINEA LINEAR LINED LINES LINO LION " +
    "LIR LIRA LNR LYM MIEN MIG MIL MILD MILDEN MILE MILES MIN MINA MINAE MINAR MINE MINED " +
    "MINES MINO MINOR MINORA MINORCA MIR MIRA MIRAC MIRO NAE NAEL NAR NARC NEA NEAR NED NEI " +
    "NEIL NEP NIES NIL NILE NIM NIOG NOG NOIL NOILY NOIR NOR NORA NORI NORIE NOU OGLE OGLED " +
    "OGLES OIE OIL OILED OILY ONA ONCA ONE ONES ONI ONLY ORA ORAE ORC ORCA ORIEL ORIG ORNA " +
    "ORNES OUI PDL PEA PEAN PEAR PED PEIN PEN PES PLEA PLED PLEION PLENA PLI PLIE PLIED " +
    "PLIES PLIM PLY RAN RANE RANI RANLI RIE RIEL RIES RIG RILE RILED RILES RIM RIMY RIN " +
    "RINE RIO ROG ROI ROIL ROILED ROILY ROIN RON RONE SEA SEAN SEAR SED SEI SEL SELD SELINA " +
    "SELION SEN SENA SENIOR SENOR SENORA SEP SEPD SPEAN SPEAR SPED SPEIL SPEIR SPL SPLINE " +
    "SPLINED UGLI UGLY UILY").split(" "),
);

const rowOf = (i: number) => Math.floor(i / SIZE);
const colOf = (i: number) => i % SIZE;
const adjacent = (a: number, b: number) =>
  a !== b && Math.abs(rowOf(a) - rowOf(b)) <= 1 && Math.abs(colOf(a) - colOf(b)) <= 1;
const spell = (path: number[]) => path.map((i) => LETTERS[i]).join("");

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ------------------------------------------------------------------------ */
/* Component                                                                 */
/* ------------------------------------------------------------------------ */

type Step = "cat" | "chain" | "done";
type Tone = "info" | "ok" | "bad";

const STEP_NUMBER: Record<Step, number> = { cat: 1, chain: 2, done: 3 };

interface Flash {
  tone: "ok" | "bad";
  path: number[];
}

interface DragState {
  pointerId: number;
  moved: boolean;
  tapSubmit: boolean;
}

export interface FirstRunTutorialProps {
  open: boolean;
  /** Called with `true` after "Start playing", `false` on Skip/Escape. */
  onClose: (completed: boolean) => void;
}

export function FirstRunTutorial({ open, onClose }: FirstRunTutorialProps) {
  const reducedMotion = useReducedMotion();

  const [step, setStep] = useState<Step>("cat");
  const [path, setPathState] = useState<number[]>([]);
  const [chainWord, setChainWord] = useState<number[]>([]);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [feedback, setFeedback] = useState<{ tone: Tone; text: string }>({ tone: "info", text: "" });
  const [misses, setMisses] = useState(0);
  const [focusIdx, setFocusIdx] = useState(0);

  const pathRef = useRef<number[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const flashTimer = useRef<number>();
  const announceToggle = useRef(false);

  const setPath = useCallback((next: number[]) => {
    pathRef.current = next;
    setPathState(next);
  }, []);

  // Fresh run each time the dialog opens.
  useLayoutEffect(() => {
    if (!open) return;
    setStep("cat");
    setPath([]);
    setChainWord([]);
    setFlash(null);
    setFeedback({ tone: "info", text: "" });
    setMisses(0);
    setFocusIdx(0);
  }, [open, setPath]);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const say = useCallback((tone: Tone, text: string) => {
    // Alternate a trailing no-break space so repeating the same message is
    // still a DOM change and gets announced again.
    announceToggle.current = !announceToggle.current;
    setFeedback({ tone, text: announceToggle.current ? text : `${text}\u00a0` });
  }, []);

  const showFlash = useCallback(
    (tone: Flash["tone"], p: number[]) => {
      window.clearTimeout(flashTimer.current);
      setFlash({ tone, path: p });
      flashTimer.current = window.setTimeout(() => setFlash(null), reducedMotion ? 1400 : 900);
    },
    [reducedMotion],
  );

  const close = useCallback(
    (completed: boolean) => {
      markFirstRunTutorialSeen();
      onClose(completed);
    },
    [onClose],
  );

  const submit = useCallback(() => {
    const p = pathRef.current;
    if (step === "done" || p.length === 0) return;
    const word = spell(p);
    setPath([]);

    const fail = (text: string) => {
      showFlash("bad", p);
      say("bad", text);
      if (step === "chain") setMisses((m) => m + 1);
    };

    if (p.length < 3) {
      fail(`${word} is too short. Words need at least 3 letters.`);
      return;
    }

    if (step === "cat") {
      if (word === "CAT") {
        showFlash("ok", p);
        setStep("chain");
        setFocusIdx(T_TILE);
        say("ok", "CAT! That's your first word.");
      } else if (word === "CATS") {
        fail("So close! Stop on the T: just C, A, T.");
      } else {
        fail(`That spelled ${word}. Trace C, then A, then T.`);
      }
      return;
    }

    // step === "chain"
    const usesT = p.includes(T_TILE);
    const reusesCat = p.some((i) => CAT_TILES.includes(i));
    if (word === "CAT") {
      fail("You already played CAT. Make a new word that uses the T.");
    } else if (usesT && WORDS_WITH_T.has(word)) {
      showFlash("ok", p);
      setChainWord(p);
      setStep("done");
      say("ok", `${word} reuses the T. You made a chain!`);
    } else if (usesT) {
      fail(`${word} isn't in the word list. Try a real word through the T, like TEN or EAT.`);
    } else if (WORDS_WITHOUT_T.has(word) && reusesCat) {
      fail(`${word} reuses a tile from CAT, so it would chain in a real game! For this practice, use the T.`);
    } else if (WORDS_WITHOUT_T.has(word)) {
      fail(`${word} is a word, but it doesn't touch CAT. Each word must reuse a tile from the last one. Use the T.`);
    } else {
      fail(`${word} isn't a word, and it doesn't reuse the T. Start from or pass through the glowing T.`);
    }
  }, [step, setPath, showFlash, say]);

  const submitRef = useRef(submit);
  submitRef.current = submit;

  // Returns true when the tile was already the last one selected (a second
  // tap on it, or Space on it, means "play this word").
  const pressTile = useCallback(
    (idx: number): boolean => {
      const p = pathRef.current;
      const last = p[p.length - 1];
      if (p.length > 0 && idx === last) return true;
      const at = p.indexOf(idx);
      if (at >= 0) setPath(p.slice(0, at + 1));
      else if (p.length === 0 || adjacent(last, idx)) setPath([...p, idx]);
      else setPath([idx]);
      return false;
    },
    [setPath],
  );

  /* ---------------------------- pointer input ---------------------------- */

  const onTilePointerDown = (e: React.PointerEvent<HTMLButtonElement>, idx: number) => {
    if (step === "done") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Touch pointers are implicitly captured by the pressed tile; release so
    // the drag can be hit-tested across the board.
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    window.clearTimeout(flashTimer.current);
    setFlash(null);
    const tapSubmit = pressTile(idx);
    dragRef.current = { pointerId: e.pointerId, moved: false, tapSubmit };
  };

  useEffect(() => {
    if (!open) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-tut-tile]");
      if (!el) return;
      // Only count the inner part of a tile so diagonal drags don't clip
      // the corners of neighbouring tiles.
      const r = el.getBoundingClientRect();
      if (Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) > r.width * 0.46) return;
      const idx = Number(el.dataset.tutTile);
      const p = pathRef.current;
      const last = p[p.length - 1];
      if (idx === last) return;
      if (p.length >= 2 && idx === p[p.length - 2]) {
        setPath(p.slice(0, -1));
        d.moved = true;
      } else if (!p.includes(idx) && (p.length === 0 || adjacent(last, idx))) {
        setPath([...p, idx]);
        d.moved = true;
      }
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      if (d.moved ? pathRef.current.length >= 2 : d.tapSubmit) submitRef.current();
    };
    const onCancel = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [open, setPath]);

  /* --------------------------- keyboard input ---------------------------- */

  const focusTile = (idx: number) => {
    setFocusIdx(idx);
    tileRefs.current[idx]?.focus();
  };

  const typeLetter = (letter: string) => {
    const idx = LETTERS.indexOf(letter);
    if (idx < 0) {
      say("bad", `There's no ${letter} on this board.`);
      return;
    }
    const p = pathRef.current;
    const last = p[p.length - 1];
    if (p.includes(idx)) {
      if (idx !== last) say("bad", `${letter} is already in this word. Each tile can be used once per word.`);
      return;
    }
    if (p.length > 0 && !adjacent(last, idx)) {
      say("bad", `${letter} isn't next to ${LETTERS[last]}. Letters must touch; diagonals count.`);
      return;
    }
    setFlash(null);
    setPath([...p, idx]);
    focusTile(idx);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (step === "done" || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement;
    const tileIdx = target.dataset.tutTile !== undefined ? Number(target.dataset.tutTile) : -1;
    const onOtherButton = tileIdx < 0 && target.closest("button") !== null;

    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      if (!e.repeat) typeLetter(e.key.toUpperCase());
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      if (pathRef.current.length) setPath(pathRef.current.slice(0, -1));
      return;
    }
    if (e.key === "Enter" && !onOtherButton) {
      e.preventDefault();
      if (pathRef.current.length) submit();
      else if (tileIdx >= 0) pressTile(tileIdx);
      return;
    }
    if (tileIdx >= 0) {
      const moves: Record<string, [number, number]> = {
        ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
      };
      const m = moves[e.key];
      if (m) {
        e.preventDefault();
        const r = Math.min(SIZE - 1, Math.max(0, rowOf(tileIdx) + m[0]));
        const c = Math.min(SIZE - 1, Math.max(0, colOf(tileIdx) + m[1]));
        focusTile(r * SIZE + c);
      }
    }
  };

  /* --------------------------- focus management -------------------------- */

  useEffect(() => {
    if (!open) return;
    if (step === "done") startRef.current?.focus();
    else if (step === "chain") titleRef.current?.focus();
  }, [step, open]);

  /* -------------------------------- render ------------------------------- */

  const flashPath = path.length === 0 && flash ? flash.path : [];
  const linePath = path.length ? path : flashPath;
  const lineTone: "build" | Flash["tone"] = path.length ? "build" : flash?.tone ?? "build";
  const lastWord = step === "cat" ? [] : CAT_TILES;
  const hintTiles =
    step === "cat" ? CAT_TILES : step === "chain" ? (misses >= 2 ? SUGGESTED_TILES : [T_TILE]) : [];
  const currentWord = spell(path);

  const title =
    step === "cat" ? "Draw CAT" : step === "chain" ? "Now make a word that reuses the T" : "That's the chain!";

  const description =
    step === "cat"
      ? "Drag across C, A, T, or tap each letter, then tap the T again to play it. Letters must touch; diagonals count."
      : step === "chain"
        ? misses >= 2
          ? "Every word must reuse a tile from the last one. Try TEN: start on the glowing T, then E, then N."
          : "Every word must reuse a tile from the last one (marked ⛓). Start from or pass through the glowing T: TEN, EAT and PET all work."
        : "Every word must reuse a tile from the last one.";

  const pointsFor = (p: number[]) =>
    p.map((i) => `${colOf(i) * 25 + 12.5},${rowOf(i) * 25 + 12.5}`).join(" ");

  const lineColor =
    lineTone === "ok" ? "hsl(var(--ok))" : lineTone === "bad" ? "hsl(var(--bad))" : "hsl(var(--brand-500))";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close(false)}>
      <DialogPortal>
        <DialogOverlay className="bg-background/95" />
        <DialogPrimitive.Content
          data-game-session
          onKeyDown={onKeyDown}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            titleRef.current?.focus();
          }}
          onEscapeKeyDown={(e) => {
            // Escape clears a selection first; with nothing selected it skips.
            if (pathRef.current.length) {
              e.preventDefault();
              setPath([]);
              say("info", "Selection cleared.");
            }
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
          className={cn(
            "fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-y-auto overscroll-contain bg-background text-foreground outline-none",
            !reducedMotion && "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          )}
        >
          <header className="flex shrink-0 items-center justify-between gap-2 px-4 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span aria-hidden="true" className="flex gap-1.5">
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={cn(
                      "h-2 w-2 rounded-full",
                      n <= STEP_NUMBER[step] ? "bg-[hsl(var(--brand-500))]" : "bg-muted-foreground/40",
                    )}
                  />
                ))}
              </span>
              <span>Step {STEP_NUMBER[step]} of 3</span>
            </div>
            {step !== "done" && (
              <Button variant="ghost" size="sm" onClick={() => close(false)} className="text-muted-foreground hover:text-foreground">
                Skip
              </Button>
            )}
          </header>

          <div
            className={cn(
              "mx-auto grid w-full max-w-md flex-1 content-center justify-items-center gap-x-6 gap-y-2.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
              "[grid-template-areas:'text'_'word'_'board'_'feedback'_'controls']",
              "landscape-phone:max-w-3xl landscape-phone:grid-cols-[auto_minmax(0,22rem)] landscape-phone:content-center landscape-phone:justify-items-start",
              "landscape-phone:[grid-template-areas:'board_text'_'board_word'_'board_feedback'_'board_controls']",
            )}
          >
            <div className="w-full text-center [grid-area:text] landscape-phone:self-end landscape-phone:text-left">
              <DialogTitle
                ref={titleRef}
                tabIndex={-1}
                className="text-xl font-bold leading-tight tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-500))] focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm sm:text-2xl"
              >
                {title}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">{description}</DialogDescription>
              <p className="sr-only">
                Keyboard: type letters to pick tiles, or use the arrow keys and Space. Enter plays the word, Backspace
                removes a letter, Escape clears.
              </p>
            </div>

            {step !== "done" && (
              <div
                aria-hidden="true"
                className="flex h-9 items-center justify-center [grid-area:word] landscape-phone:justify-self-start"
              >
                {currentWord ? (
                  <span className="text-2xl font-bold tracking-[0.2em] text-foreground">{currentWord}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Drag, tap, or type</span>
                )}
              </div>
            )}

            {/* Board */}
            <div
              role="group"
              aria-label="Practice board, 4 by 4"
              className={cn(
                "relative grid aspect-square touch-none select-none grid-cols-4 [grid-area:board] landscape-phone:self-center",
                "w-[max(12rem,min(calc(100vw_-_2rem),24rem,calc(100dvh_-_20.5rem)))]",
                "landscape-phone:w-[max(11rem,min(calc(100dvh_-_4.5rem),22rem))]",
              )}
            >
              {LETTERS.map((letter, i) => {
                const sel = path.indexOf(i);
                const inFlash = flashPath.includes(i);
                const inLast = lastWord.includes(i);
                const inChain = chainWord.includes(i);
                const isHint = hintTiles.includes(i) && sel < 0;
                const glowT = i === T_TILE && step !== "cat";
                const labelParts = [letter, `row ${rowOf(i) + 1}, column ${colOf(i) + 1}`];
                if (step === "done" && inChain) {
                  labelParts.push(inLast ? `shared by CAT and ${spell(chainWord)}` : `in ${spell(chainWord)}`);
                } else if (inLast) {
                  labelParts.push("in CAT, your last word");
                }
                if (isHint && step !== "done") labelParts.push("suggested");
                if (sel >= 0) labelParts.push(`selected ${ordinal(sel + 1)}`);
                return (
                  <div key={i} className="p-[7%]">
                    <button
                      ref={(el) => (tileRefs.current[i] = el)}
                      type="button"
                      data-tut-tile={i}
                      tabIndex={i === focusIdx ? 0 : -1}
                      aria-label={labelParts.join(", ")}
                      aria-pressed={step === "done" ? undefined : sel >= 0}
                      aria-disabled={step === "done" || undefined}
                      onPointerDown={(e) => onTilePointerDown(e, i)}
                      onFocus={() => setFocusIdx(i)}
                      onClick={(e) => {
                        // Pointer input is handled on pointerdown/up. Only
                        // keyboard / assistive-tech activations land here.
                        const pointerType = (e.nativeEvent as PointerEvent).pointerType;
                        if (step === "done" || e.detail !== 0 || pointerType) return;
                        if (pressTile(i)) submit();
                      }}
                      style={{ touchAction: "none" }}
                      className={cn(
                        "relative flex h-full w-full items-center justify-center rounded-xl border-2 border-border bg-card text-card-foreground shadow-sm outline-none",
                        "transition-[transform,box-shadow,background-color,border-color] duration-150",
                        "focus-visible:ring-4 focus-visible:ring-[hsl(var(--brand-500))] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        inLast && "border-[hsl(var(--brand-500)/0.6)] bg-[hsl(var(--brand-500)/0.08)]",
                        step === "done" && inChain && !inLast && "border-[hsl(var(--ok))] bg-[hsl(var(--ok)/0.12)]",
                        isHint && "ring-4 ring-[hsl(var(--brand-500))]",
                        isHint && !reducedMotion && "animate-tile-pulse",
                        glowT && "border-[hsl(var(--brand-500))] shadow-[0_0_0_3px_hsl(var(--brand-500)/0.35),0_0_18px_4px_hsl(var(--brand-500)/0.55)]",
                        sel >= 0 && "scale-[0.97] border-[hsl(var(--ok))] bg-[hsl(var(--ok)/0.14)] ring-2 ring-[hsl(var(--ok))]",
                        inFlash && flash?.tone === "bad" && "border-[hsl(var(--bad))] bg-[hsl(var(--bad)/0.12)]",
                        inFlash && flash?.tone === "bad" && !reducedMotion && "animate-shake",
                        inFlash && flash?.tone === "ok" && "border-[hsl(var(--ok))] bg-[hsl(var(--ok)/0.14)]",
                      )}
                    >
                      <span aria-hidden="true" className="relative z-10 text-[clamp(1.25rem,7vmin,2.25rem)] font-semibold">
                        {letter}
                      </span>
                      {inLast && sel < 0 && (
                        <span aria-hidden="true" className="absolute bottom-0.5 left-1 z-10 text-[11px] leading-none">
                          ⛓
                        </span>
                      )}
                      {sel >= 0 && (
                        <span
                          aria-hidden="true"
                          className="absolute right-1 top-1 z-20 min-w-[18px] rounded-full bg-foreground px-1 text-center text-[11px] font-bold leading-[18px] text-background"
                        >
                          {sel + 1}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}

              <svg
                aria-hidden="true"
                viewBox="0 0 100 100"
                className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible"
              >
                {step === "done" && (
                  <>
                    <polyline points={pointsFor(CAT_TILES)} fill="none" stroke="hsl(var(--brand-500))" strokeOpacity={0.45} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points={pointsFor(chainWord)} fill="none" stroke="hsl(var(--ok))" strokeOpacity={0.55} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                  </>
                )}
                {step !== "done" && linePath.length >= 2 && (
                  <polyline
                    points={pointsFor(linePath)}
                    fill="none"
                    stroke={lineColor}
                    strokeOpacity={0.5}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={lineTone === "bad" ? "0.8 5" : undefined}
                  />
                )}
              </svg>
            </div>

            <p
              role="status"
              aria-live="polite"
              className={cn(
                "min-h-[2.5rem] w-full text-center text-sm font-medium [grid-area:feedback] landscape-phone:text-left",
                feedback.tone === "ok" && "text-[hsl(var(--ok))]",
                feedback.tone === "bad" && "text-[hsl(var(--bad))]",
                feedback.tone === "info" && "text-muted-foreground",
              )}
            >
              {feedback.text}
            </p>

            <div className="flex w-full justify-center gap-2 [grid-area:controls] landscape-phone:justify-start">
              {step === "done" ? (
                <div className="w-full space-y-3">
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>
                      You played <strong className="text-foreground">CAT</strong> ⛓{" "}
                      <strong className="text-foreground">{spell(chainWord)}</strong>, sharing the T.
                    </li>
                    <li>Longer words score more.</li>
                    <li>Special tiles appear as you play and shake things up.</li>
                  </ul>
                  <Button
                    ref={startRef}
                    size="lg"
                    onClick={() => close(true)}
                    className={cn("w-full", !reducedMotion && "animate-in zoom-in-95 fade-in-0 duration-300")}
                  >
                    Start playing
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPath([]);
                      say("info", "Selection cleared.");
                    }}
                    disabled={path.length === 0}
                    className="flex-1"
                  >
                    Clear
                  </Button>
                  <Button onClick={submit} disabled={path.length === 0} className="flex-1">
                    Submit
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

export default FirstRunTutorial;

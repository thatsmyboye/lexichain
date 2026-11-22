"""Render Lexichain's sound effects from the Ocular Sounds "Vector" construction kit.

The stems are a licensed library and are NOT in this repo. Point the script at
the folder that contains "Source Recordings" and "Synthetic Source":

    python scripts/sfx/render_sfx.py "<path>/Vector - Construction Kits" [--sheet out.png]

Requires numpy, scipy and soundfile (libsndfile >= 1.1 for MP3 writing).
Output: public/sounds/*.mp3 (mono, 44.1 kHz).

Palette: marimba for anything pitched, woodblock / wood box for taps, metal
chimes for sparkle, cards and paper for handling. Everything pitched sits in
C major so sounds that overlap in play (tile taps, word chime, tier-up) agree.
"""
from __future__ import annotations

import glob
import os
import sys

import numpy as np
import soundfile as sf
from scipy import signal

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "public", "sounds")

ROOT = ""

# Note name -> frequency (A4 = 440)
_NAMES = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(note: str) -> float:
    name, octave = note[:-1], int(note[-1])
    midi = 12 * (octave + 1) + _NAMES[name]
    return 440.0 * 2 ** ((midi - 69) / 12)


# --------------------------------------------------------------------------
# Stem loading and basic DSP
# --------------------------------------------------------------------------

def _find(name: str) -> str:
    hits = glob.glob(os.path.join(ROOT, "**", f"*{name}_Ocular_Vector*.wav"), recursive=True)
    if not hits:
        raise FileNotFoundError(f"stem not found: {name}")
    return sorted(hits)[0]


def measure_f0(x: np.ndarray, sr: int) -> float:
    """Strongest partial between 60 Hz and 3 kHz just after the onset."""
    seg = x[int(0.01 * sr): int(0.4 * sr)]
    n = 1 << 17
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), n))
    freqs = np.fft.rfftfreq(n, 1 / sr)
    band = (freqs > 60) & (freqs < 3000)
    return float(freqs[band][np.argmax(spec[band])])


def stem(name: str, semitones: float = 0.0, to: float | None = None, length: float | None = None) -> np.ndarray:
    """Load a stem as mono 44.1 kHz, trimmed to its onset and peak-normalised.

    `semitones` repitches by resampling (tape-style, so duration changes too).
    `to` repitches so the stem's measured fundamental lands on that frequency.
    `length` cuts the result to that many seconds with a short fade.
    """
    x, sr = sf.read(_find(name), always_2d=True)
    x = x.mean(axis=1)
    peak = np.max(np.abs(x))
    start = max(0, int(np.argmax(np.abs(x) > 0.02 * peak)) - int(0.002 * sr))
    x = x[start:]

    ratio = 2 ** (semitones / 12)
    if to is not None:
        ratio *= to / measure_f0(x, sr)

    pad = int(0.02 * sr)
    x = np.concatenate([x, np.zeros(pad)])
    x = signal.resample(x, max(16, int(round(len(x) * SR / sr / ratio))))
    x /= np.max(np.abs(x)) + 1e-12
    x = fade(x, fade_in=0.001, fade_out=0.01)
    if length is not None:
        x = cut(x, length)
    return x


def fade(x: np.ndarray, fade_in: float = 0.0, fade_out: float = 0.0) -> np.ndarray:
    x = x.copy()
    a, b = int(fade_in * SR), int(fade_out * SR)
    if a:
        a = min(a, len(x))
        x[:a] *= np.linspace(0, 1, a)
    if b:
        b = min(b, len(x))
        x[-b:] *= np.cos(np.linspace(0, np.pi / 2, b)) ** 2
    return x


def cut(x: np.ndarray, seconds: float, fade_out: float | None = None) -> np.ndarray:
    n = int(seconds * SR)
    if len(x) <= n:
        return x
    return fade(x[:n], fade_out=fade_out if fade_out is not None else min(0.06, seconds / 2))


def decay(x: np.ndarray, t60: float) -> np.ndarray:
    """Impose an extra exponential decay (seconds to fall 60 dB) to tighten tails."""
    t = np.arange(len(x)) / SR
    return x * 10 ** (-3 * t / t60)


def _filt(x: np.ndarray, kind: str, freq: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, freq, kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def hp(x, freq, order=2):
    return _filt(x, "highpass", freq, order)


def lp(x, freq, order=2):
    return _filt(x, "lowpass", freq, order)


def db(value: float) -> float:
    return 10 ** (value / 20)


def mix(*layers: tuple[float, float, np.ndarray]) -> np.ndarray:
    """Mix (start_seconds, gain_db, samples) layers into one buffer."""
    end = max(int(t * SR) + len(x) for t, _, x in layers)
    out = np.zeros(end)
    for t, gain, x in layers:
        i = int(t * SR)
        out[i:i + len(x)] += x * db(gain)
    return out


_rng = np.random.default_rng(7)


def room(x: np.ndarray, wet_db: float = -16.0, t60: float = 0.35, tail: float = 0.4) -> np.ndarray:
    """A small, bright synthetic room so layered stems read as one object."""
    n = int(tail * SR)
    ir = _rng.standard_normal(n) * 10 ** (-3 * np.arange(n) / SR / t60)
    ir[: int(0.004 * SR)] = 0  # pre-delay keeps transients dry
    ir = lp(hp(ir, 500), 7000)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = signal.fftconvolve(x, ir)
    dry = np.concatenate([x, np.zeros(len(wet) - len(x))])
    return dry + wet * db(wet_db)


def finish(x: np.ndarray, peak_db: float, max_len: float | None = None) -> np.ndarray:
    """DC/rumble removal, gentle saturation on peaks, clean ends, peak level."""
    x = hp(x, 70)
    x /= np.max(np.abs(x)) + 1e-12
    x = np.tanh(1.4 * x) / np.tanh(1.4)
    if max_len is not None:
        x = cut(x, max_len, fade_out=0.08)
    # trim tail below -60 dB
    loud = np.where(np.abs(x) > 1e-3)[0]
    x = x[: min(len(x), loud[-1] + int(0.02 * SR))]
    x = fade(x, fade_in=0.0005, fade_out=0.015)
    return x / np.max(np.abs(x)) * db(peak_db)


# --------------------------------------------------------------------------
# Instruments
# --------------------------------------------------------------------------

# (stem, measured fundamental in Hz). Notes are built from whichever recording
# is closest in pitch, so nothing is stretched further than it has to be.
SOFT = [
    ("Marimba Single Hit Soft 03", 818.8), ("Marimba Single Hit Soft 04", 818.1),
    ("Marimba Single Hit Soft 05", 818.1), ("Marimba Single Hit Soft 06", 818.8),
    ("Marimba Single Hit Soft 01", 1224.6),
]
SHARP = [
    ("Marimba Single Hit Sharp 04", 819.6), ("Marimba Single Hit Sharp 03", 907.5),
    ("Marimba Single Hit Sharp 02", 999.8), ("Marimba Single Hit Sharp 01", 1097.9),
]  # the "Hammered Hit" stems bounce after the strike, which smears fast runs


def marimba(note: str, i: int = 0, sharp: bool = False) -> np.ndarray:
    bank = SHARP if sharp else SOFT
    target = hz(note)
    dist = [abs(np.log2(target / f0)) for _, f0 in bank]
    near = [name for (name, _), d in zip(bank, dist) if d - min(dist) < 0.5 / 12]
    return stem(near[i % len(near)], to=target)


def chime(note: str, length: float = 1.2, source: str = "Tonal Chinese Balls Resonant Single Hit Long 05") -> np.ndarray:
    x = stem(source, to=hz(note))
    return cut(decay(hp(x, 600), length * 1.6), length, fade_out=length * 0.4)


def run(notes: list[str], gap: float, sharp: bool = False, start: float = 0.0, gain: float = 0.0, swell: float = 0.0):
    """Layers for a run of marimba notes; `swell` dB is added across the run."""
    layers = []
    for i, note in enumerate(notes):
        g = gain + swell * (i / max(1, len(notes) - 1)) - swell
        layers.append((start + i * gap, g, marimba(note, i, sharp)))
    return layers


# --------------------------------------------------------------------------
# The sounds
# --------------------------------------------------------------------------

def tile_select(variant: int) -> np.ndarray:
    # One marimba tap at A5 with a wooden tick on the front. The game repitches
    # it up a pentatonic scale as the word grows (see TILE_SCALE in SoundSystem).
    taps = ["Wood Box Impact 05", "Wood Box Impact 09", "Wood Box Impact 10"]
    body = marimba("A5", variant)
    tick = hp(stem(taps[variant], length=0.03), 1500)
    return finish(mix((0, 0, body), (0, -13, tick)), -5, max_len=0.32)


def word_complete() -> np.ndarray:
    # Card lands, quick rising C-major arpeggio, chime on the top note.
    return finish(room(mix(
        (0.0, -9, lp(stem("Card Thump 01"), 2500)),
        *run(["C6", "E6", "G6", "C7"], 0.055, sharp=True, start=0.01, swell=3),
        (0.175, -11, chime("C7", 0.7)),
    )), -3, max_len=1.0)


def word_invalid() -> np.ndarray:
    # Two dull, falling knocks: "nope" without a buzzer.
    k1 = lp(stem("Woodblock Single Hit 02", to=hz("A4")), 3500)
    k2 = lp(stem("Woodblock Single Hit 04", to=hz("E4")), 3000)
    thud = lp(stem("Polystyrene Thump Hit 03"), 900)
    return finish(mix((0.0, -2, k1), (0.0, -8, thud), (0.115, 0, k2), (0.115, -6, thud)), -5, max_len=0.45)


def tier_up() -> np.ndarray:
    # Real marimba gliss into a bright landing with shimmer.
    gliss = stem("Marimba Gliss Ascending 01")
    return finish(room(mix(
        (0.0, -5, gliss),
        (0.20, -1, marimba("G6", 0, sharp=True)),
        (0.27, 0, marimba("C7", 1, sharp=True)),
        (0.27, -9, chime("C7", 0.9)),
        (0.33, -13, chime("G7", 0.8, "Tonal Chinese Balls Resonant Single Hit Long 03")),
    ), wet_db=-14), -3, max_len=1.2)


def achievement() -> np.ndarray:
    # Three-note pickup into a held chord, chimes ringing over the top.
    sparkle = hp(stem("Tonal Particles 02", length=1.3), 1800)
    sparkle = fade(sparkle, fade_in=0.25, fade_out=0.6)
    return finish(room(mix(
        *run(["G5", "C6", "E6"], 0.085, sharp=True, swell=2),
        (0.30, 0, marimba("G6", 0, sharp=True)),
        (0.30, -1, marimba("C7", 1, sharp=True)),
        (0.30, -3, marimba("E6", 2, sharp=True)),
        (0.30, -8, chime("C7", 1.4)),
        (0.38, -11, chime("E7", 1.3, "Tonal Chinese Balls Resonant Single Hit Long 03")),
        (0.46, -12, chime("G7", 1.2, "Tonal Chinese Balls Resonant Single Hit Long 07")),
        (0.30, -22, sparkle),
    ), wet_db=-13, t60=0.5, tail=0.6), -3, max_len=2.0)


def game_start() -> np.ndarray:
    # Cards are dealt, then an open fifth rising to the octave: "ready".
    shuffle = np.tanh(4 * hp(stem("Card Shuffle Fast 03"), 300))  # even out the one loud card
    return finish(room(mix(
        (0.0, -9, shuffle),
        (0.24, -3, marimba("C5", 0)),
        (0.36, -2, marimba("G5", 1)),
        (0.48, 0, marimba("C6", 2, sharp=True)),
        (0.48, -14, chime("C7", 0.6)),
    )), -4, max_len=1.2)


def game_over() -> np.ndarray:
    # Unhurried descent that lands low and soft, then the book closes.
    bell = stem("Tonal Chinese Balls Hollow Resonant Single Hit Long 04", to=hz("C5"))
    bell = cut(decay(bell, 1.6), 1.3, fade_out=0.6)
    return finish(room(mix(
        (0.00, -3, marimba("G5", 0)),
        (0.17, -3, marimba("E5", 1)),
        (0.34, -2, marimba("D5", 2)),
        (0.56, 0, marimba("C5", 3)),
        (0.56, -5, marimba("C4", 0)),  # octave below for weight; C5 carries it on phone speakers
        (0.56, -12, bell),
        (0.58, -10, lp(stem("Book Thump 01"), 1200)),
    ), wet_db=-13, t60=0.5, tail=0.6), -4, max_len=1.9)


def hint_used() -> np.ndarray:
    # Small glassy two-note sparkle.
    shake = hp(stem("Maracas Single Shake 01", length=0.2), 3000)
    return finish(room(mix(
        (0.0, -3, chime("E7", 0.5, "Tonal Chinese Balls Resonant Single Hit Long 03")),
        (0.07, 0, chime("A7", 0.6, "Tonal Chinese Balls Resonant Single Hit Long 07")),
        (0.0, -10, marimba("E6", 0)),
        (0.0, -20, shake),
    ), wet_db=-15), -6, max_len=0.8)


def tick() -> np.ndarray:
    # Dry woodblock: readable every second for ten seconds without grating.
    x = stem("Woodblock Single Hit 05", semitones=5, length=0.09)
    return finish(hp(x, 400), -8, max_len=0.09)


def button_click() -> np.ndarray:
    click = stem("Controller Button Click 01", length=0.05)
    wood = lp(stem("Wood Box Impact 06", length=0.07), 5000)
    return finish(mix((0, -4, click), (0, 0, wood)), -8, max_len=0.09)


def button_hover() -> np.ndarray:
    x = hp(stem("Wood Box Impact 02", semitones=4, length=0.04), 900)
    return finish(x, -16, max_len=0.05)


def level_up() -> np.ndarray:
    # Pentatonic run to a held top chord.
    return finish(room(mix(
        *run(["C5", "D5", "E5", "G5", "A5"], 0.06, swell=4),
        (0.30, 0, marimba("C6", 0, sharp=True)),
        (0.30, -2, marimba("E6", 1, sharp=True)),
        (0.30, -2, marimba("G6", 2, sharp=True)),
        (0.30, -10, chime("C7", 1.0)),
        (0.36, -13, chime("G7", 0.9, "Tonal Chinese Balls Resonant Single Hit Long 03")),
    ), wet_db=-14), -3, max_len=1.4)


def success() -> np.ndarray:
    return finish(room(mix(
        (0.0, -2, marimba("G6", 0, sharp=True)),
        (0.09, 0, marimba("C7", 1, sharp=True)),
        (0.09, -10, chime("C7", 0.6)),
    )), -5, max_len=0.8)


def notification() -> np.ndarray:
    bell = cut(decay(stem("Tonal Chinese Balls Hollow Hit 02", to=hz("E6")), 0.7), 0.5)
    return finish(room(mix((0.0, -4, bell), (0.0, 0, marimba("E6", 1)))), -7, max_len=0.6)


def error() -> np.ndarray:
    drum = stem("Drum Single Hit Low 01", length=0.3)
    knock = lp(stem("Woodblock Single Hit 02", to=hz("E4")), 3000)
    return finish(mix((0, -3, drum), (0, 0, knock)), -5, max_len=0.35)


def page_turn() -> np.ndarray:
    return finish(hp(stem("Single Page Turn 04"), 250), -8, max_len=0.4)


SOUNDS = {
    "tile_select_1": lambda: tile_select(0),
    "tile_select_2": lambda: tile_select(1),
    "tile_select_3": lambda: tile_select(2),
    "word_complete": word_complete,
    "word_invalid": word_invalid,
    "tier_up": tier_up,
    "achievement": achievement,
    "game_start": game_start,
    "game_over": game_over,
    "hint_used": hint_used,
    "tick": tick,
    "button_click": button_click,
    "button_hover": button_hover,
    "level_up": level_up,
    "success": success,
    "notification": notification,
    "error": error,
    "page_turn": page_turn,
}


def contact_sheet(rendered: dict[str, np.ndarray], path: str) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    names = list(rendered)
    fig, axes = plt.subplots(len(names), 2, figsize=(13, 1.5 * len(names)))
    for row, name in zip(axes, names):
        x = rendered[name]
        t = np.arange(len(x)) / SR
        row[0].plot(t, x, lw=0.4)
        row[0].set_ylim(-1, 1)
        row[0].set_ylabel(name, rotation=0, ha="right", fontsize=8)
        row[1].specgram(x + 1e-9, NFFT=1024, Fs=SR, noverlap=768, vmin=-110)
        row[1].set_ylim(0, 12000)
        for ax in row:
            ax.tick_params(labelsize=6)
    fig.tight_layout()
    fig.savefig(path, dpi=70)


def main() -> None:
    global ROOT
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    ROOT = args[0]
    sheet = sys.argv[sys.argv.index("--sheet") + 1] if "--sheet" in sys.argv else None

    os.makedirs(OUT_DIR, exist_ok=True)
    rendered = {}
    total = 0
    for name, build in SOUNDS.items():
        x = build()
        rendered[name] = x
        path = os.path.join(OUT_DIR, f"{name}.mp3")
        sf.write(path, x.astype(np.float32), SR, format="MP3", subtype="MPEG_LAYER_III",
                 compression_level=0.1, bitrate_mode="VARIABLE")
        size = os.path.getsize(path)
        total += size
        rms = 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
        print(f"{name:16s} {len(x) / SR:5.2f}s  peak {20 * np.log10(np.max(np.abs(x))):5.1f} dB  rms {rms:6.1f} dB  {size / 1024:5.1f} KB")
    print(f"total {total / 1024:.0f} KB")
    if sheet:
        contact_sheet(rendered, sheet)


if __name__ == "__main__":
    main()

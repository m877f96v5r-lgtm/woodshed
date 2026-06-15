import { useState, useCallback, useRef, useMemo, useEffect } from "react";

// ════════════════════════════════════════════════════════════════════════════
//  THE WOODSHED — a personal guitar practice & theory tool
//  Single-file React app. Vite + React, Web Audio API only.
// ════════════════════════════════════════════════════════════════════════════

// ── Music Theory Data ─────────────────────────────────────────────────────────

const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const NOTE_DISPLAY = {"C#":"C#","D#":"Eb","F#":"F#","G#":"Ab","A#":"Bb"};
const FLAT_TO_SHARP = {"Db":"C#","Eb":"D#","Gb":"F#","Ab":"G#","Bb":"A#"};
const dn = (n) => NOTE_DISPLAY[n] || n;
const getNoteIdx = (n) => NOTES.indexOf(n);

const SCALE_INTERVALS = { major:[0,2,4,5,7,9,11], minor:[0,2,3,5,7,8,10] };
const PENTA_INTERVALS = {
  "Major Pentatonic":[0,2,4,7,9], "Minor Pentatonic":[0,3,5,7,10],
  "Blues":[0,3,5,6,7,10], "Dorian":[0,2,3,5,7,9,10], "Mixolydian":[0,2,4,5,7,9,10],
};
const CHORD_Q = { major:["maj","min","min","maj","maj","min","dim"], minor:["min","dim","maj","min","maj","maj","maj"] };
const ROMAN = { major:["I","ii","iii","IV","V","vi","vii°"], minor:["i","ii°","III","iv","V","VI","VII"] };
const ROLES = {
  major:[{role:"Home",feel:"Stable, resolved"},{role:"Tension",feel:"Uneasy, wants to move"},{role:"Color",feel:"Melancholic, soft"},{role:"Lift",feel:"Bright, uplifting"},{role:"Drive",feel:"Strong pull home"},{role:"Warmth",feel:"Bittersweet, nostalgic"},{role:"Edge",feel:"Unstable, dissonant"}],
  minor:[{role:"Home",feel:"Dark, brooding"},{role:"Edge",feel:"Unstable, dissonant"},{role:"Lift",feel:"Bright contrast"},{role:"Shadow",feel:"Heavy, melancholic"},{role:"Drive",feel:"Intense pull home"},{role:"Warmth",feel:"Bittersweet"},{role:"Release",feel:"Cinematic, open"}],
};

const EXT_VARIANTS = {
  maj:["maj","maj7","maj9","add9","6","sus2","sus4"],
  min:["min","m7","m9","madd9","msus2"],
  dim:["dim","dim7","m7b5"],
};
const VARIANT_FEEL = {
  maj:"Solid, direct", maj7:"Dreamy, sophisticated", maj9:"Lush, open", add9:"Airy, modern",
  "6":"Sweet, vintage", sus2:"Floating, unresolved", sus4:"Suspenseful", min:"Melancholic",
  m7:"Smooth, jazzy", m9:"Rich, emotional", madd9:"Haunting", msus2:"Ethereal",
  dim:"Tense", dim7:"Very dramatic", "m7b5":"Dark, jazzy",
  "7":"Bluesy, restless — begs to move", "9":"Funky, widescreen", aug:"Floating, unsettled — film noir",
};
function getVarName(root, q, v) {
  const r = dn(root);
  const map = { maj:r, min:r+"m", dim:r+"dim", maj7:r+"maj7", maj9:r+"maj9", add9:r+"add9", "6":r+"6",
    sus2:r+"sus2", sus4:r+"sus4", m7:r+"m7", m9:r+"m9", madd9:r+"madd9", msus2:r+"msus2", dim7:r+"dim7", "m7b5":r+"m7b5",
    "7":r+"7", "9":r+"9", aug:r+"aug" };
  return map[v] || r;
}

// "Spice It Up" — root-based transformations, organized as musical guidance
const SPICE_CATEGORIES = [
  { label:"Add color",   hint:"sweeten what's already there",  variants:["maj7","add9","6"] },
  { label:"Add tension", hint:"make it want to move somewhere", variants:["7","9","sus4"] },
  { label:"Go darker",   hint:"turn the lights down",           variants:["m7","m9"] },
  { label:"Go stranger", hint:"step off the map",               variants:["dim7","m7b5","aug"] },
];

// ── Chord Voicing Database ────────────────────────────────────────────────────
// Format: frets[low E, A, D, G, B, high e], -1=muted, 0=open, N=fret number
const VOICINGS = {
  // ── A ──
  "A":      [{ name:"Open",     frets:[-1,0,2,2,2,0], fingers:[0,0,1,2,3,0], baseFret:1 },
             { name:"Barre 5",  frets:[5,7,7,6,5,5],  fingers:[1,3,4,2,1,1], baseFret:5, barre:5 }],
  "Am":     [{ name:"Open",     frets:[-1,0,2,2,1,0], fingers:[0,0,2,3,1,0], baseFret:1 },
             { name:"Barre 5",  frets:[5,7,7,5,5,5],  fingers:[1,3,4,1,1,1], baseFret:5, barre:5 }],
  "A6":     [{ name:"Open",     frets:[-1,0,2,2,2,2], fingers:[0,0,1,2,3,4], baseFret:1 }],
  "Am6":    [{ name:"Open",     frets:[-1,0,2,2,1,2], fingers:[0,0,2,3,1,4], baseFret:1 }],
  "A7":     [{ name:"Open",     frets:[-1,0,2,0,2,0], fingers:[0,0,2,0,3,0], baseFret:1 }],
  "Am7":    [{ name:"Open",     frets:[-1,0,2,0,1,0], fingers:[0,0,2,0,1,0], baseFret:1 },
             { name:"Barre 5",  frets:[5,7,5,5,5,5],  fingers:[1,3,1,1,1,1], baseFret:5, barre:5 }],
  "Amaj7":  [{ name:"Open",     frets:[-1,0,2,1,2,0], fingers:[0,0,2,1,3,0], baseFret:1 }],
  "Am9":    [{ name:"Open",     frets:[-1,0,2,0,1,3], fingers:[0,0,2,0,1,4], baseFret:1 }],
  "Amaj9":  [{ name:"Open",     frets:[-1,0,2,1,0,0], fingers:[0,0,2,1,0,0], baseFret:1 }],
  "Aadd9":  [{ name:"Open",     frets:[-1,0,2,4,2,0], fingers:[0,0,1,3,2,0], baseFret:1 }],
  "Asus2":  [{ name:"Open",     frets:[-1,0,2,2,0,0], fingers:[0,0,1,2,0,0], baseFret:1 }],
  "Asus4":  [{ name:"Open",     frets:[-1,0,2,2,3,0], fingers:[0,0,1,2,3,0], baseFret:1 }],
  "Amadd9": [{ name:"Open",     frets:[-1,0,2,2,1,3], fingers:[0,0,2,3,1,4], baseFret:1 }],
  "Amsus2": [{ name:"Open",     frets:[-1,0,2,2,0,0], fingers:[0,0,1,2,0,0], baseFret:1 }],
  "Adim":   [{ name:"Open",     frets:[-1,0,1,2,1,-1],fingers:[0,0,1,3,2,0], baseFret:1 }],
  "Adim7":  [{ name:"Pos 1",    frets:[-1,0,1,2,1,2], fingers:[0,0,1,3,2,4], baseFret:1 }],
  "Am7b5":  [{ name:"Pos 1",    frets:[-1,0,1,2,1,3], fingers:[0,0,1,2,1,4], baseFret:1 }],

  // ── B ──
  "B":      [{ name:"Barre 2",  frets:[2,2,4,4,4,2],  fingers:[1,1,2,3,4,1], baseFret:2, barre:2 }],
  "Bm":     [{ name:"Barre 2",  frets:[2,2,4,4,3,2],  fingers:[1,1,3,4,2,1], baseFret:2, barre:2 },
             { name:"Mini",     frets:[-1,2,4,4,3,2],  fingers:[0,1,3,4,2,1], baseFret:2 }],
  "B7":     [{ name:"Open",     frets:[-1,2,1,2,0,2],  fingers:[0,2,1,3,0,4], baseFret:1 }],
  "Bm7":    [{ name:"Barre 2",  frets:[2,2,4,2,3,2],  fingers:[1,1,3,1,2,1], baseFret:2, barre:2 }],
  "Bmaj7":  [{ name:"Barre 2",  frets:[2,2,4,3,4,2],  fingers:[1,1,3,2,4,1], baseFret:2, barre:2 }],
  "Bsus2":  [{ name:"Barre 2",  frets:[2,2,4,4,2,2],  fingers:[1,1,3,4,1,1], baseFret:2, barre:2 }],
  "Bsus4":  [{ name:"Barre 2",  frets:[2,2,4,4,5,2],  fingers:[1,1,2,3,4,1], baseFret:2, barre:2 }],
  "Bdim":   [{ name:"Open",     frets:[-1,2,3,4,-1,-1],fingers:[0,1,2,3,0,0], baseFret:1 }],
  "Bdim7":  [{ name:"Pos 1",    frets:[-1,2,0,1,0,1],  fingers:[0,2,0,1,0,1], baseFret:1 }],
  "Bm7b5":  [{ name:"Pos 1",    frets:[-1,2,3,2,3,-1], fingers:[0,1,3,2,4,0], baseFret:1 }],
  "Bmadd9": [{ name:"Barre 2",  frets:[2,2,4,4,3,4],  fingers:[1,1,2,3,1,4], baseFret:2, barre:2 }],

  // ── C ──
  "C":      [{ name:"Open",     frets:[-1,3,2,0,1,0],  fingers:[0,3,2,0,1,0], baseFret:1 },
             { name:"Barre 8",  frets:[8,10,10,9,8,8],  fingers:[1,3,4,2,1,1], baseFret:8, barre:8 }],
  "Cm":     [{ name:"Barre 3",  frets:[3,3,5,5,4,3],   fingers:[1,1,3,4,2,1], baseFret:3, barre:3 }],
  "C6":     [{ name:"Open",     frets:[-1,3,2,2,1,0],  fingers:[0,4,3,2,1,0], baseFret:1 }],
  "C7":     [{ name:"Open",     frets:[-1,3,2,3,1,0],  fingers:[0,3,2,4,1,0], baseFret:1 }],
  "Cm7":    [{ name:"Barre 3",  frets:[3,3,5,3,4,3],   fingers:[1,1,3,1,2,1], baseFret:3, barre:3 }],
  "Cmaj7":  [{ name:"Open",     frets:[-1,3,2,0,0,0],  fingers:[0,3,2,0,0,0], baseFret:1 }],
  "Cm9":    [{ name:"Barre 3",  frets:[3,3,5,3,4,5],   fingers:[1,1,3,1,2,4], baseFret:3, barre:3 }],
  "Cmaj9":  [{ name:"Open",     frets:[-1,3,0,0,0,0],  fingers:[0,2,0,0,0,0], baseFret:1 }],
  "Cadd9":  [{ name:"Open",     frets:[-1,3,2,0,3,0],  fingers:[0,3,2,0,4,0], baseFret:1 }],
  "Csus2":  [{ name:"Open",     frets:[-1,3,0,0,1,0],  fingers:[0,3,0,0,1,0], baseFret:1 }],
  "Csus4":  [{ name:"Open",     frets:[-1,3,3,0,1,1],  fingers:[0,3,4,0,1,1], baseFret:1 }],
  "Cmadd9": [{ name:"Barre 3",  frets:[3,3,5,5,4,5],   fingers:[1,1,2,3,1,4], baseFret:3, barre:3 }],
  "Cdim":   [{ name:"Open",     frets:[-1,3,4,5,-1,-1], fingers:[0,1,2,3,0,0], baseFret:1 }],
  "Cdim7":  [{ name:"Pos 2",    frets:[-1,3,1,2,1,2],  fingers:[0,4,1,2,1,3], baseFret:1 }],
  "Cm7b5":  [{ name:"Barre 3",  frets:[3,3,4,5,4,-1],  fingers:[1,1,2,4,3,0], baseFret:3, barre:3 }],

  // ── D ──
  "D":      [{ name:"Open",     frets:[-1,-1,0,2,3,2], fingers:[0,0,0,1,3,2], baseFret:1 },
             { name:"Barre 5",  frets:[5,5,7,7,7,5],   fingers:[1,1,2,3,4,1], baseFret:5, barre:5 }],
  "Dm":     [{ name:"Open",     frets:[-1,-1,0,2,3,1], fingers:[0,0,0,2,3,1], baseFret:1 },
             { name:"Barre 5",  frets:[5,5,7,7,6,5],   fingers:[1,1,3,4,2,1], baseFret:5, barre:5 }],
  "D6":     [{ name:"Open",     frets:[-1,-1,0,2,0,2], fingers:[0,0,0,1,0,2], baseFret:1 }],
  "D7":     [{ name:"Open",     frets:[-1,-1,0,2,1,2], fingers:[0,0,0,2,1,3], baseFret:1 }],
  "Dm7":    [{ name:"Open",     frets:[-1,-1,0,2,1,1], fingers:[0,0,0,2,1,1], baseFret:1 }],
  "Dmaj7":  [{ name:"Open",     frets:[-1,-1,0,2,2,2], fingers:[0,0,0,1,1,1], baseFret:1 }],
  "Dm9":    [{ name:"Open",     frets:[-1,-1,0,2,1,3], fingers:[0,0,0,2,1,4], baseFret:1 }],
  "Dadd9":  [{ name:"Open",     frets:[-1,-1,0,2,3,0], fingers:[0,0,0,1,2,0], baseFret:1 }],
  "Dsus2":  [{ name:"Open",     frets:[-1,-1,0,2,3,0], fingers:[0,0,0,1,2,0], baseFret:1 }],
  "Dsus4":  [{ name:"Open",     frets:[-1,-1,0,2,3,3], fingers:[0,0,0,1,2,3], baseFret:1 }],
  "Dmadd9": [{ name:"Open",     frets:[-1,-1,0,2,3,3], fingers:[0,0,0,1,2,3], baseFret:1 }],
  "Dmsus2": [{ name:"Open",     frets:[-1,-1,0,2,3,0], fingers:[0,0,0,1,2,0], baseFret:1 }],
  "Ddim":   [{ name:"Open",     frets:[-1,-1,0,1,3,1], fingers:[0,0,0,1,3,2], baseFret:1 }],
  "Ddim7":  [{ name:"Open",     frets:[-1,-1,0,1,0,1], fingers:[0,0,0,1,0,2], baseFret:1 }],
  "Dm7b5":  [{ name:"Open",     frets:[-1,-1,0,1,1,1], fingers:[0,0,0,1,1,1], baseFret:1 }],

  // ── E ──
  "E":      [{ name:"Open",     frets:[0,2,2,1,0,0],   fingers:[0,2,3,1,0,0], baseFret:1 },
             { name:"Barre 7",  frets:[7,9,9,8,7,7],   fingers:[1,3,4,2,1,1], baseFret:7, barre:7 }],
  "Em":     [{ name:"Open",     frets:[0,2,2,0,0,0],   fingers:[0,2,3,0,0,0], baseFret:1 },
             { name:"Barre 7",  frets:[7,9,9,7,7,7],   fingers:[1,3,4,1,1,1], baseFret:7, barre:7 }],
  "E6":     [{ name:"Open",     frets:[0,2,2,1,2,0],   fingers:[0,2,3,1,4,0], baseFret:1 }],
  "E7":     [{ name:"Open",     frets:[0,2,0,1,0,0],   fingers:[0,2,0,1,0,0], baseFret:1 }],
  "Em7":    [{ name:"Open",     frets:[0,2,2,0,3,0],   fingers:[0,2,3,0,4,0], baseFret:1 },
             { name:"Open v2",  frets:[0,2,0,0,0,0],   fingers:[0,1,0,0,0,0], baseFret:1 }],
  "Emaj7":  [{ name:"Open",     frets:[0,2,1,1,0,0],   fingers:[0,3,1,2,0,0], baseFret:1 }],
  "Em9":    [{ name:"Open",     frets:[0,2,0,0,0,2],   fingers:[0,2,0,0,0,1], baseFret:1 }],
  "Eadd9":  [{ name:"Open",     frets:[0,2,2,1,0,2],   fingers:[0,2,3,1,0,4], baseFret:1 }],
  "Esus2":  [{ name:"Open",     frets:[0,2,2,4,0,0],   fingers:[0,1,2,4,0,0], baseFret:1 }],
  "Esus4":  [{ name:"Open",     frets:[0,2,2,2,0,0],   fingers:[0,1,2,3,0,0], baseFret:1 }],
  "Emadd9": [{ name:"Open",     frets:[0,2,2,0,0,2],   fingers:[0,2,3,0,0,1], baseFret:1 }],
  "Emsus2": [{ name:"Open",     frets:[0,2,2,4,0,0],   fingers:[0,1,2,4,0,0], baseFret:1 }],
  "Edim":   [{ name:"Open",     frets:[0,1,2,3,-1,-1], fingers:[0,1,2,3,0,0], baseFret:1 }],
  "Edim7":  [{ name:"Open",     frets:[0,1,2,0,2,0],   fingers:[0,1,2,0,3,0], baseFret:1 }],
  "Em7b5":  [{ name:"Open",     frets:[0,1,2,0,3,0],   fingers:[0,1,2,0,4,0], baseFret:1 }],

  // ── F ──
  "F":      [{ name:"Barre 1",  frets:[1,3,3,2,1,1],   fingers:[1,3,4,2,1,1], baseFret:1, barre:1 },
             { name:"Mini",     frets:[-1,-1,3,2,1,1],  fingers:[0,0,3,2,1,1], baseFret:1 }],
  "Fm":     [{ name:"Barre 1",  frets:[1,3,3,1,1,1],   fingers:[1,3,4,1,1,1], baseFret:1, barre:1 }],
  "F7":     [{ name:"Barre 1",  frets:[1,3,1,2,1,1],   fingers:[1,3,1,2,1,1], baseFret:1, barre:1 }],
  "Fm7":    [{ name:"Barre 1",  frets:[1,3,1,1,1,1],   fingers:[1,3,1,1,1,1], baseFret:1, barre:1 }],
  "Fmaj7":  [{ name:"Open",     frets:[-1,-1,3,2,1,0], fingers:[0,0,3,2,1,0], baseFret:1 },
             { name:"Barre 1",  frets:[1,3,3,2,1,0],   fingers:[1,3,4,2,1,0], baseFret:1, barre:1 }],
  "Fadd9":  [{ name:"Barre 1",  frets:[1,3,3,2,1,3],   fingers:[1,2,3,1,1,4], baseFret:1, barre:1 }],
  "Fsus2":  [{ name:"Barre 1",  frets:[1,3,3,3,1,1],   fingers:[1,2,3,4,1,1], baseFret:1, barre:1 }],
  "Fsus4":  [{ name:"Barre 1",  frets:[1,3,3,3,1,1],   fingers:[1,2,3,4,1,1], baseFret:1, barre:1 }],
  "Fmadd9": [{ name:"Barre 1",  frets:[1,3,3,1,1,3],   fingers:[1,2,3,1,1,4], baseFret:1, barre:1 }],
  "Fdim":   [{ name:"Pos 1",    frets:[-1,-1,3,4,3,-1],fingers:[0,0,1,3,2,0], baseFret:1 }],
  "Fdim7":  [{ name:"Pos 1",    frets:[-1,-1,3,4,3,4], fingers:[0,0,1,3,2,4], baseFret:1 }],
  "Fm7b5":  [{ name:"Pos 1",    frets:[1,2,3,4,-1,-1], fingers:[1,2,3,4,0,0], baseFret:1 }],

  // ── G ──
  "G":      [{ name:"Open",     frets:[3,2,0,0,0,3],   fingers:[2,1,0,0,0,3], baseFret:1 },
             { name:"Open v2",  frets:[3,2,0,0,3,3],   fingers:[2,1,0,0,3,4], baseFret:1 }],
  "Gm":     [{ name:"Barre 3",  frets:[3,5,5,3,3,3],   fingers:[1,3,4,1,1,1], baseFret:3, barre:3 }],
  "G6":     [{ name:"Open",     frets:[3,2,0,0,0,0],   fingers:[2,1,0,0,0,0], baseFret:1 }],
  "G7":     [{ name:"Open",     frets:[3,2,0,0,0,1],   fingers:[3,2,0,0,0,1], baseFret:1 }],
  "Gm7":    [{ name:"Barre 3",  frets:[3,5,3,3,3,3],   fingers:[1,3,1,1,1,1], baseFret:3, barre:3 }],
  "Gmaj7":  [{ name:"Open",     frets:[3,2,0,0,0,2],   fingers:[3,2,0,0,0,1], baseFret:1 }],
  "Gm9":    [{ name:"Barre 3",  frets:[3,5,3,3,3,5],   fingers:[1,3,1,1,1,4], baseFret:3, barre:3 }],
  "Gadd9":  [{ name:"Open",     frets:[3,2,0,2,0,3],   fingers:[3,2,0,1,0,4], baseFret:1 }],
  "Gsus2":  [{ name:"Open",     frets:[3,0,0,0,3,3],   fingers:[2,0,0,0,3,4], baseFret:1 }],
  "Gsus4":  [{ name:"Open",     frets:[3,3,0,0,1,1],   fingers:[3,4,0,0,1,1], baseFret:1 }],
  "Gmadd9": [{ name:"Barre 3",  frets:[3,5,5,3,3,5],   fingers:[1,2,3,1,1,4], baseFret:3, barre:3 }],
  "Gdim":   [{ name:"Open",     frets:[-1,-1,5,6,5,-1],fingers:[0,0,1,3,2,0], baseFret:1 }],
  "Gdim7":  [{ name:"Pos 3",    frets:[3,4,5,3,-1,-1], fingers:[1,2,3,1,0,0], baseFret:3, barre:3 }],
  "Gm7b5":  [{ name:"Barre 3",  frets:[3,4,5,3,3,-1],  fingers:[1,2,3,1,1,0], baseFret:3, barre:3 }],

  // ── Sharps & flats — movable barre shapes (additive, nothing above changed) ──
  "C#":     [{ name:"Barre 4",  frets:[-1,4,6,6,6,4],  fingers:[0,1,2,3,4,1], baseFret:4 }],
  "C#m":    [{ name:"Barre 4",  frets:[-1,4,6,6,5,4],  fingers:[0,1,3,4,2,1], baseFret:4 }],
  "C#7":    [{ name:"Barre 4",  frets:[-1,4,6,4,6,4],  fingers:[0,1,3,1,4,1], baseFret:4 }],
  "C#m7":   [{ name:"Barre 4",  frets:[-1,4,6,4,5,4],  fingers:[0,1,3,1,2,1], baseFret:4 }],
  "C#maj7": [{ name:"Barre 4",  frets:[-1,4,6,5,6,4],  fingers:[0,1,3,2,4,1], baseFret:4 }],
  "D#":     [{ name:"Barre 6",  frets:[-1,6,8,8,8,6],  fingers:[0,1,2,3,4,1], baseFret:6 }],
  "D#m":    [{ name:"Barre 6",  frets:[-1,6,8,8,7,6],  fingers:[0,1,3,4,2,1], baseFret:6 }],
  "D#7":    [{ name:"Barre 6",  frets:[-1,6,8,6,8,6],  fingers:[0,1,3,1,4,1], baseFret:6 }],
  "D#m7":   [{ name:"Barre 6",  frets:[-1,6,8,6,7,6],  fingers:[0,1,3,1,2,1], baseFret:6 }],
  "D#maj7": [{ name:"Barre 6",  frets:[-1,6,8,7,8,6],  fingers:[0,1,3,2,4,1], baseFret:6 }],
  "F#":     [{ name:"Barre 2",  frets:[2,4,4,3,2,2],   fingers:[1,3,4,2,1,1], baseFret:2, barre:2 }],
  "F#m":    [{ name:"Barre 2",  frets:[2,4,4,2,2,2],   fingers:[1,3,4,1,1,1], baseFret:2, barre:2 }],
  "F#7":    [{ name:"Barre 2",  frets:[2,4,2,3,2,2],   fingers:[1,3,1,2,1,1], baseFret:2, barre:2 }],
  "F#m7":   [{ name:"Barre 2",  frets:[2,4,2,2,2,2],   fingers:[1,3,1,1,1,1], baseFret:2, barre:2 }],
  "F#maj7": [{ name:"Barre 2",  frets:[2,4,3,3,2,2],   fingers:[1,4,2,3,1,1], baseFret:2, barre:2 }],
  "G#":     [{ name:"Barre 4",  frets:[4,6,6,5,4,4],   fingers:[1,3,4,2,1,1], baseFret:4, barre:4 }],
  "G#m":    [{ name:"Barre 4",  frets:[4,6,6,4,4,4],   fingers:[1,3,4,1,1,1], baseFret:4, barre:4 }],
  "G#7":    [{ name:"Barre 4",  frets:[4,6,4,5,4,4],   fingers:[1,3,1,2,1,1], baseFret:4, barre:4 }],
  "G#m7":   [{ name:"Barre 4",  frets:[4,6,4,4,4,4],   fingers:[1,3,1,1,1,1], baseFret:4, barre:4 }],
  "G#maj7": [{ name:"Barre 4",  frets:[4,6,5,5,4,4],   fingers:[1,4,2,3,1,1], baseFret:4, barre:4 }],
  "A#":     [{ name:"Barre 1",  frets:[-1,1,3,3,3,1],  fingers:[0,1,2,3,4,1], baseFret:1 }],
  "A#m":    [{ name:"Barre 1",  frets:[-1,1,3,3,2,1],  fingers:[0,1,3,4,2,1], baseFret:1 }],
  "A#7":    [{ name:"Barre 1",  frets:[-1,1,3,1,3,1],  fingers:[0,1,3,1,4,1], baseFret:1 }],
  "A#m7":   [{ name:"Barre 1",  frets:[-1,1,3,1,2,1],  fingers:[0,1,3,1,2,1], baseFret:1 }],
  "A#maj7": [{ name:"Barre 1",  frets:[-1,1,3,2,3,1],  fingers:[0,1,3,2,4,1], baseFret:1 }],

  // ── Dominant 9 voicings (additive) ──
  "A9":     [{ name:"Open",     frets:[-1,0,2,4,2,3],  fingers:[0,0,1,3,2,4], baseFret:1 }],
  "B9":     [{ name:"Pos 1",    frets:[-1,2,1,2,2,2],  fingers:[0,2,1,3,3,3], baseFret:1 }],
  "C9":     [{ name:"Pos 2",    frets:[-1,3,2,3,3,3],  fingers:[0,2,1,3,3,3], baseFret:2 }],
  "D9":     [{ name:"Pos 4",    frets:[-1,5,4,5,5,5],  fingers:[0,2,1,3,3,3], baseFret:4 }],
  "E9":     [{ name:"Open",     frets:[0,2,0,1,0,2],   fingers:[0,2,0,1,0,3], baseFret:1 }],
  "F9":     [{ name:"Pos 7",    frets:[-1,8,7,8,8,8],  fingers:[0,2,1,3,3,3], baseFret:7 }],
  "G9":     [{ name:"Open",     frets:[3,2,0,2,0,1],   fingers:[3,2,0,4,0,1], baseFret:1 }],

  // ── Augmented voicings (additive) ──
  "Aaug":   [{ name:"Open",     frets:[-1,0,3,2,2,1],  fingers:[0,0,4,2,3,1], baseFret:1 }],
  "Baug":   [{ name:"Open",     frets:[-1,2,1,0,0,3],  fingers:[0,2,1,0,0,4], baseFret:1 }],
  "Caug":   [{ name:"Open",     frets:[-1,3,2,1,1,0],  fingers:[0,4,3,1,2,0], baseFret:1 }],
  "Daug":   [{ name:"Open",     frets:[-1,-1,0,3,3,2], fingers:[0,0,0,2,3,1], baseFret:1 }],
  "Eaug":   [{ name:"Open",     frets:[0,3,2,1,1,0],   fingers:[0,4,3,1,2,0], baseFret:1 }],
  "Faug":   [{ name:"Pos 1",    frets:[-1,-1,3,2,2,1], fingers:[0,0,4,2,3,1], baseFret:1 }],
  "Gaug":   [{ name:"Open",     frets:[3,2,1,0,0,3],   fingers:[3,2,1,0,0,4], baseFret:1 }],
};

// Smart voicing lookup — tries exact match, then enharmonic, then simplified root
function getVoicings(chordName) {
  if (VOICINGS[chordName]) return VOICINGS[chordName];
  // Try display-name version (e.g. "Eb" instead of "D#")
  const root = chordName.match(/^[A-G][b#]?/)?.[0];
  if (!root) return null;
  const suffix = chordName.slice(root.length);
  // Try all enharmonic equivalents
  const enharmonics = { "Db":"C#","Eb":"D#","Gb":"F#","Ab":"G#","Bb":"A#","C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb" };
  const alt = enharmonics[root];
  if (alt && VOICINGS[alt + suffix]) return VOICINGS[alt + suffix];
  // Fallback to plain major/minor
  const simple = root + (suffix.startsWith("m") && !suffix.startsWith("maj") ? "m" : "");
  if (VOICINGS[simple]) return VOICINGS[simple];
  const altSimple = alt ? alt + (suffix.startsWith("m") && !suffix.startsWith("maj") ? "m" : "") : null;
  return (altSimple && VOICINGS[altSimple]) || null;
}

// ── Common Progressions ───────────────────────────────────────────────────────
const COMMON_PROGRESSIONS = [
  { name:"I–V–vi–IV", desc:"The most popular progression ever", mode:"major", degrees:[0,4,5,3], examples:"Let It Be, No Woman No Cry" },
  { name:"i–VII–VI–VII", desc:"Dark, cinematic drive", mode:"minor", degrees:[0,6,5,6], examples:"Stairway to Heaven, Sultans of Swing" },
  { name:"I–IV–V", desc:"Blues, country, rock backbone", mode:"major", degrees:[0,3,4], examples:"Johnny B. Goode, La Bamba" },
  { name:"i–VI–III–VII", desc:"Emotional, anthemic minor", mode:"minor", degrees:[0,5,2,6], examples:"Creep, Mad World" },
  { name:"I–vi–IV–V", desc:"50s pop, nostalgic", mode:"major", degrees:[0,5,3,4], examples:"Stand By Me, Every Breath You Take" },
  { name:"i–iv–V", desc:"Classic minor resolution", mode:"minor", degrees:[0,3,4], examples:"Hit The Road Jack, Fly Me" },
  { name:"I–V–vi–iii–IV", desc:"Epic, grand feel", mode:"major", degrees:[0,4,5,2,3], examples:"Canon in D, Pachelbel" },
  { name:"i–VII–VI–V", desc:"Andalusian cadence, Spanish feel", mode:"minor", degrees:[0,6,5,4], examples:"Smoke on the Water, Hit The Road" },
  { name:"I–IV–vi–V", desc:"Uplifting pop anthem", mode:"major", degrees:[0,3,5,4], examples:"With or Without You, Africa" },
  { name:"i–VI–VII", desc:"Simple moody loop", mode:"minor", degrees:[0,5,6], examples:"Losing My Religion, use it everywhere" },
];

// ── Chord name parsing (flat-aware) ───────────────────────────────────────────
function parseChordName(chordName) {
  if (!chordName) return null;
  const m = chordName.match(/^([A-G])([#b]?)/);
  if (!m) return null;
  const raw = m[1] + m[2];
  const root = FLAT_TO_SHARP[raw] || raw;
  return { root, suffix: chordName.slice(raw.length) };
}

// ── Audio Engine ──────────────────────────────────────────────────────────────
const NOTE_FREQS = { C:261.63,"C#":277.18,D:293.66,"D#":311.13,E:329.63,F:349.23,"F#":369.99,G:392.00,"G#":415.30,A:440.00,"A#":466.16,B:493.88 };
const AUDIO_INTERVALS = {
  maj:[0,4,7], min:[0,3,7], dim:[0,3,6], maj7:[0,4,7,11], m7:[0,3,7,10],
  sus2:[0,2,7], sus4:[0,5,7], add9:[0,4,7,14], "6":[0,4,7,9], m9:[0,3,7,10,14],
  maj9:[0,4,7,11,14], madd9:[0,3,7,14], dim7:[0,3,6,9], "m7b5":[0,3,6,10], msus2:[0,2,7],
  "7":[0,4,7,10], "9":[0,4,7,10,14], aug:[0,4,8], m6:[0,3,7,9],
};
const AUDIO_QMAP = { "":"maj","m":"min","dim":"dim","maj7":"maj7","m7":"m7","sus2":"sus2","sus4":"sus4",
  "add9":"add9","6":"6","m9":"m9","maj9":"maj9","madd9":"madd9","dim7":"dim7","m7b5":"m7b5","msus2":"msus2",
  "7":"7","9":"9","aug":"aug","m6":"m6" };

function getChordFreqs(chordName) {
  const parsed = parseChordName(chordName);
  if (!parsed) return [];
  const intervals = AUDIO_INTERVALS[AUDIO_QMAP[parsed.suffix] || "maj"] || [0,4,7];
  const rootFreq = NOTE_FREQS[parsed.root] || 440;
  return intervals.map(i => rootFreq * Math.pow(2, i/12));
}

function playChord(chordName, audioCtxRef) {
  if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
  const ctx = audioCtxRef.current;
  if (ctx.state === "suspended") ctx.resume();
  const freqs = getChordFreqs(chordName);
  const now = ctx.currentTime;
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 2000;
    osc.type = "triangle";
    osc.frequency.value = freq / 2; // octave down for guitar feel
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02 + i * 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    osc.start(now + i * 0.03);
    osc.stop(now + 2.5);
  });
}

// ── Fretboard data ────────────────────────────────────────────────────────────
const OPEN_STRINGS = [4,11,7,2,9,4]; // low E, A, D, G, B, high e — pitch classes
const STRING_NAMES = ["E","A","D","G","B","e"];
const FRET_MARKERS = [3,5,7,9,12,15];
const MAX_FRET = 15;

function getFretboard(root, scaleNotes) {
  return OPEN_STRINGS.map(open =>
    Array.from({length:13},(_,f) => {
      const name = NOTES[(open+f)%12];
      return { inScale: scaleNotes.includes(name), isRoot: name===root, noteName: name };
    })
  );
}

// ── Chord Tone Calculator ─────────────────────────────────────────────────────
const CHORD_TONE_INTERVALS = {
  "":    [0,4,7],        // major
  "m":   [0,3,7],        // minor
  "dim": [0,3,6],        // diminished
  "maj7":[0,4,7,11],     // major 7
  "m7":  [0,3,7,10],     // minor 7
  "7":   [0,4,7,10],     // dominant 7
  "sus2":[0,2,7],
  "sus4":[0,5,7],
  "add9":[0,4,7,14],
  "6":   [0,4,7,9],
  "m9":  [0,3,7,10,14],
  "maj9":[0,4,7,11,14],
  "madd9":[0,3,7,14],
  "msus2":[0,2,7],
  "dim7":[0,3,6,9],
  "m7b5":[0,3,6,10],
  "9":   [0,4,7,10,14],
  "aug": [0,4,8],
  "m6":  [0,3,7,9],
};

function getChordTones(chordName) {
  if (!chordName) return [];
  const parsed = parseChordName(chordName);
  if (!parsed) return [];
  const intervals = CHORD_TONE_INTERVALS[parsed.suffix] || CHORD_TONE_INTERVALS[""];
  const rootIdx = getNoteIdx(parsed.root);
  return intervals.map(i => NOTES[(rootIdx + i) % 12]);
}

function getChordRoot(chordName) {
  return parseChordName(chordName)?.root || null;
}

// Build per-fret data with all layers (0..numFrets inclusive)
function getLayeredFretboard(scaleNotes, pentaNotes, chordTones, chordRoot, numFrets = MAX_FRET) {
  return OPEN_STRINGS.map(open =>
    Array.from({length: numFrets + 1}, (_,f) => {
      const noteName = NOTES[(open+f)%12];
      return {
        noteName,
        isChordTone:  chordTones.includes(noteName),
        isChordRoot:  noteName === chordRoot,
        isScaleTone:  scaleNotes.includes(noteName),
        isPentaTone:  pentaNotes.includes(noteName),
        isScaleRoot:  noteName === scaleNotes[0],
      };
    })
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getScaleNotes(root, mode) {
  const ri = getNoteIdx(root);
  return SCALE_INTERVALS[mode].map(i => NOTES[(ri+i)%12]);
}
function getPentaNotes(root, s) {
  const ri = getNoteIdx(root);
  return PENTA_INTERVALS[s].map(i => NOTES[(ri+i)%12]);
}
function getChordsInKey(root, mode) {
  const sc = getScaleNotes(root, mode);
  return sc.map((note,i) => ({
    name: note+(CHORD_Q[mode][i]==="min"?"m":CHORD_Q[mode][i]==="dim"?"dim":""),
    root: note, quality: CHORD_Q[mode][i],
    numeral: ROMAN[mode][i], role: ROLES[mode][i].role, feel: ROLES[mode][i].feel, degree: i,
  }));
}
function qColors(q) {
  if (q==="maj") return {bg:"rgba(52,152,219,0.13)",border:"rgba(52,152,219,0.3)",dot:"#3498db"};
  if (q==="min") return {bg:"rgba(142,68,173,0.13)",border:"rgba(142,68,173,0.3)",dot:"#8e44ad"};
  return {bg:"rgba(231,76,60,0.1)",border:"rgba(231,76,60,0.3)",dot:"#e74c3c"};
}

const MOODS = [
  {label:"Dark & Brooding",key:"A",mode:"minor",emoji:"🌑"},
  {label:"Melancholic",key:"D",mode:"minor",emoji:"🌧"},
  {label:"Cinematic",key:"E",mode:"minor",emoji:"🎬"},
  {label:"Hopeful",key:"G",mode:"major",emoji:"🌤"},
  {label:"Bright & Uplifting",key:"C",mode:"major",emoji:"☀️"},
  {label:"Bittersweet",key:"A",mode:"major",emoji:"🍂"},
];
const ALL_KEYS = NOTES;

// ── Capo helpers ──────────────────────────────────────────────────────────────
// With a capo at fret N, you finger shapes N semitones below the sounding pitch.
function transposeChordName(chordName, semitones) {
  const parsed = parseChordName(chordName);
  if (!parsed) return chordName;
  const idx = (getNoteIdx(parsed.root) + semitones + 120) % 12;
  return dn(NOTES[idx]) + parsed.suffix;
}
function fingeredName(chordName, capo) {
  return capo > 0 ? transposeChordName(chordName, -capo) : chordName;
}

// ── Scale suggestion per chord ────────────────────────────────────────────────
function scaleTipFor(chordName) {
  const parsed = parseChordName(chordName);
  if (!parsed) return null;
  const r = dn(parsed.root);
  const s = parsed.suffix;
  if (s === "7" || s === "9") return `try ${r} Mixolydian or the ${r} Blues scale`;
  if (s === "maj7" || s === "maj9") return `try ${r} Major Pentatonic — let that 7 ring`;
  if (s === "dim" || s === "dim7" || s === "m7b5") return `outline the chord tones — arpeggios shine here`;
  if (s === "aug") return `chord tones + whole-tone color — tread lightly`;
  if (s.startsWith("m")) return `try ${r} Minor Pentatonic, or ${r} Dorian for brightness`;
  if (s.startsWith("sus")) return `either pentatonic works — the sus keeps it open`;
  return `try ${r} Major Pentatonic — it can't miss`;
}

// ── CAGED pentatonic position boxes ───────────────────────────────────────────
// Classic five boxes, two notes per string, computed for any key.
// posIdx 0–4 → Positions 1–5. Position 1 anchors on the root, low E string.
function getPentaBox(rootIdx, boxType /* "major" | "minor" */, posIdx) {
  const degs = boxType === "major" ? [0,2,4,7,9] : [0,3,5,7,10];
  const openP = [0,5,10,15,19,24]; // semitones of each open string above low E
  const rootOnE = ((rootIdx - 4) + 12) % 12;
  const seq = (n) => rootOnE + degs[n % 5] + 12 * Math.floor(n / 5);
  let cells = [];
  for (let s = 0; s < 6; s++) {
    for (let k = 0; k < 2; k++) {
      const n = posIdx + s * 2 + k;
      cells.push({ s, fret: seq(n) - openP[s] });
    }
  }
  let minF = Math.min(...cells.map(c => c.fret));
  let maxF = Math.max(...cells.map(c => c.fret));
  if (maxF > MAX_FRET && minF - 12 >= 0) { cells = cells.map(c => ({...c, fret: c.fret - 12})); minF -= 12; maxF -= 12; }
  if (minF < 0) { cells = cells.map(c => ({...c, fret: c.fret + 12})); minF += 12; maxF += 12; }
  const set = new Set(cells.map(c => `${c.s}-${c.fret}`));
  const rootCells = cells.filter(c => (OPEN_STRINGS[c.s] + c.fret) % 12 === rootIdx);
  return { set, min: minF, max: maxF, rootCells };
}
function boxTypeForScale(activeScale) {
  return activeScale.includes("Major") || activeScale === "Mixolydian" ? "major" : "minor";
}

// ── Drum & bass synthesis for generated backing ───────────────────────────────
let _noiseBuf = null;
function noiseBuffer(ctx) {
  if (_noiseBuf && _noiseBuf.sampleRate === ctx.sampleRate) return _noiseBuf;
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  _noiseBuf = buf;
  return buf;
}
function drumKick(ctx, t, out) {
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(130, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.11);
  g.gain.setValueAtTime(0.85, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(g); g.connect(out);
  osc.start(t); osc.stop(t + 0.16);
}
function drumSnare(ctx, t, out) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.45, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  src.connect(bp); bp.connect(g); g.connect(out);
  src.start(t); src.stop(t + 0.14);
  const osc = ctx.createOscillator(); const og = ctx.createGain();
  osc.type = "triangle"; osc.frequency.value = 185;
  og.gain.setValueAtTime(0.18, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(og); og.connect(out);
  osc.start(t); osc.stop(t + 0.07);
}
function drumHat(ctx, t, vel, out) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx);
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
  src.connect(hp); hp.connect(g); g.connect(out);
  src.start(t); src.stop(t + 0.04);
}
function bassNote(ctx, t, freq, dur, out) {
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420;
  osc.type = "sawtooth"; osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.28, t + 0.012);
  g.gain.setValueAtTime(0.24, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(lp); lp.connect(g); g.connect(out);
  osc.start(t); osc.stop(t + dur + 0.02);
}
function metroClick(ctx, t, isDownbeat, out) {
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.frequency.value = isDownbeat ? 1000 : 800;
  osc.type = "square";
  g.gain.setValueAtTime(isDownbeat ? 0.15 : 0.08, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  osc.connect(g); g.connect(out);
  osc.start(t); osc.stop(t + 0.05);
}
function strumChord(ctx, chordName, t, dur, out) {
  const freqs = getChordFreqs(chordName);
  const ring = Math.min(dur, 3);
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 2200;
    osc.type = "triangle";
    osc.frequency.value = freq / 2;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.02 + i * 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, t + ring - 0.05);
    osc.connect(filter); filter.connect(gain); gain.connect(out);
    osc.start(t + i * 0.025);
    osc.stop(t + ring);
  });
}

// Generated backing patterns — 8 eighth-note steps per bar
const BACKING_STYLES = ["Straight","Shuffle","Rock","Blues"];
const BACKING_PATTERNS = {
  Straight: { kick:[0,4], snare:[2,6], swing:0,    bass:[[0,"R"],[4,"5"]] },
  Shuffle:  { kick:[0,4], snare:[2,6], swing:0.32, bass:[[0,"R"],[4,"5"]] },
  Rock:     { kick:[0,4,7], snare:[2,6], swing:0,  bass:[[0,"R"],[2,"R"],[4,"R"],[6,"R"]] },
  Blues:    { kick:[0,4], snare:[2,6], swing:0.32, bass:[[0,"R"],[2,"3"],[4,"5"],[6,"6"]] },
};
function bassFreqFor(chordName, degree) {
  const parsed = parseChordName(chordName);
  if (!parsed) return 55;
  const rootIdx = getNoteIdx(parsed.root);
  const isMinor = parsed.suffix.startsWith("m") && !parsed.suffix.startsWith("maj");
  const semis = degree === "R" ? 0 : degree === "3" ? (isMinor ? 3 : 4) : degree === "5" ? 7 : 9;
  return (440 * Math.pow(2, ((rootIdx + semis) - 9) / 12)) / 4;
}

// ── Playback engine — lookahead scheduler ─────────────────────────────────────
// Respects per-chord bar lengths, drives the timeline beat dots, and layers the
// backing track (generated or uploaded loop) underneath the progression.
function usePlaybackEngine(audioCtxRef, progRef, bpmRef, backingRef, backingVolRef) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const timerRef = useRef(null);
  const stepRef = useRef(0);
  const nextTimeRef = useRef(0);
  const uiIdsRef = useRef([]);
  const busRef = useRef(null);
  const loopSrcRef = useRef(null);

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    uiIdsRef.current.forEach(id => clearTimeout(id));
    uiIdsRef.current = [];
    if (loopSrcRef.current) { try { loopSrcRef.current.stop(); } catch {} loopSrcRef.current = null; }
    const ctx = audioCtxRef.current;
    if (busRef.current && ctx) {
      const m = busRef.current.master;
      try {
        m.gain.setValueAtTime(m.gain.value, ctx.currentTime);
        m.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
        setTimeout(() => { try { m.disconnect(); } catch {} }, 150);
      } catch {}
      busRef.current = null;
    }
    setIsPlaying(false);
    setCurrentIdx(-1);
    setCurrentBeat(-1);
  }, [audioCtxRef]);

  const play = useCallback(() => {
    const prog = progRef.current;
    if (!prog.length) return;
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    const master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    const backGain = ctx.createGain(); backGain.gain.value = backingVolRef.current; backGain.connect(master);
    busRef.current = { master, backGain };

    const bk = backingRef.current;
    if (bk.on && bk.mode === "upload" && bk.buffer) {
      const src = ctx.createBufferSource();
      src.buffer = bk.buffer; src.loop = true;
      src.connect(backGain);
      src.start(ctx.currentTime + 0.09);
      loopSrcRef.current = src;
    }

    stepRef.current = 0;
    nextTimeRef.current = ctx.currentTime + 0.09;
    setIsPlaying(true);

    const schedule = () => {
      const c = audioCtxRef.current;
      if (!c || !busRef.current) return;
      while (nextTimeRef.current < c.currentTime + 0.12) {
        const p = progRef.current;
        if (!p.length) { stop(); return; }
        const beatDur = 60 / bpmRef.current;
        const stepDur = beatDur / 2;
        const back = backingRef.current;
        const genOn = back.on && back.mode === "gen";
        const pattern = BACKING_PATTERNS[back.style] || BACKING_PATTERNS.Straight;
        const swing = genOn ? pattern.swing : 0;

        const step = stepRef.current;
        const isOff = step % 2 === 1;
        const t = nextTimeRef.current + (isOff ? swing * stepDur : 0);

        const beats = p.map(ch => (ch.bars || 2) * 4);
        const total = beats.reduce((a, b) => a + b, 0);
        const gBeat = Math.floor(step / 2) % total;
        let acc = 0, idx = 0, startBeat = 0;
        for (let i = 0; i < p.length; i++) {
          if (gBeat < acc + beats[i]) { idx = i; startBeat = acc; break; }
          acc += beats[i];
        }
        const ch = p[idx];
        const name = ch.playName || ch.displayName || ch.name;
        const beatInChord = gBeat - startBeat;
        const barStep = (gBeat % 4) * 2 + (isOff ? 1 : 0);

        if (!isOff) {
          if (beatInChord === 0) strumChord(c, name, t, beats[idx] * beatDur, busRef.current.master);
          if (!genOn) metroClick(c, t, gBeat % 4 === 0, busRef.current.master);
          const delay = Math.max(0, (t - c.currentTime) * 1000);
          const id = setTimeout(() => { setCurrentIdx(idx); setCurrentBeat(gBeat); }, delay);
          uiIdsRef.current.push(id);
          if (uiIdsRef.current.length > 64) uiIdsRef.current.splice(0, 32);
        }

        if (genOn) {
          const bus = busRef.current.backGain;
          if (pattern.kick.includes(barStep)) drumKick(c, t, bus);
          if (pattern.snare.includes(barStep)) drumSnare(c, t, bus);
          drumHat(c, t, barStep % 2 === 0 ? 0.22 : 0.12, bus);
          const bassHit = pattern.bass.find(b => b[0] === barStep);
          if (bassHit) bassNote(c, t, bassFreqFor(name, bassHit[1]), beatDur * 0.85, bus);
        }

        stepRef.current = step + 1;
        nextTimeRef.current += stepDur;
      }
    };

    schedule();
    timerRef.current = setInterval(schedule, 25);
  }, [audioCtxRef, progRef, bpmRef, backingRef, backingVolRef, stop]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    uiIdsRef.current.forEach(id => clearTimeout(id));
    if (loopSrcRef.current) { try { loopSrcRef.current.stop(); } catch {} }
  }, []);

  const setBackingVolume = useCallback((v) => {
    backingVolRef.current = v;
    if (busRef.current) busRef.current.backGain.gain.value = v;
  }, [backingVolRef]);

  return { isPlaying, play, stop, currentIdx, currentBeat, setBackingVolume };
}

// ── Reverse chord lookup ──────────────────────────────────────────────────────
const QUALITY_TOKENS = [
  ["m7b5", {triad:"dim", dom:false}], ["ø7", {triad:"dim", dom:false}], ["ø", {triad:"dim", dom:false}],
  ["dim7", {triad:"dim", dom:false}], ["dim", {triad:"dim", dom:false}], ["°7", {triad:"dim", dom:false}], ["°", {triad:"dim", dom:false}], ["o7", {triad:"dim", dom:false}], ["o", {triad:"dim", dom:false}],
  ["maj7", {triad:"maj", dom:false}], ["maj9", {triad:"maj", dom:false}], ["maj", {triad:"maj", dom:false}], ["Δ7", {triad:"maj", dom:false}], ["Δ", {triad:"maj", dom:false}], ["M7", {triad:"maj", dom:false}],
  ["madd9", {triad:"min", dom:false}], ["add9", {triad:"maj", dom:false}],
  ["msus2", {triad:"sus", dom:false}], ["sus2", {triad:"sus", dom:false}], ["sus4", {triad:"sus", dom:false}], ["sus", {triad:"sus", dom:false}],
  ["aug", {triad:"aug", dom:false}], ["+", {triad:"aug", dom:false}],
  ["min7", {triad:"min", dom:false}], ["min", {triad:"min", dom:false}],
  ["m9", {triad:"min", dom:false}], ["m7", {triad:"min", dom:false}], ["m6", {triad:"min", dom:false}], ["m", {triad:"min", dom:false}],
  ["13", {triad:"maj", dom:true}], ["11", {triad:"maj", dom:true}], ["9", {triad:"maj", dom:true}], ["7", {triad:"maj", dom:true}],
  ["6", {triad:"maj", dom:false}], ["5", {triad:"sus", dom:false}],
  ["", {triad:"maj", dom:false}],
];
function parseChordToken(token) {
  const m = token.match(/^([A-Ga-g])([#♯b♭]?)(.*)$/);
  if (!m) return null;
  let root = m[1].toUpperCase();
  const acc = m[2] === "♯" ? "#" : m[2] === "♭" ? "b" : m[2];
  root = FLAT_TO_SHARP[root + acc] || (root + acc);
  if (getNoteIdx(root) === -1) return null;
  const rawSuffix = m[3].trim();
  const found = QUALITY_TOKENS.find(([q]) => rawSuffix === q || rawSuffix.toLowerCase() === q.toLowerCase());
  const qual = found ? found[1] : QUALITY_TOKENS.find(([q]) => rawSuffix.startsWith(q) && q !== "")?.[1];
  if (rawSuffix !== "" && !qual) return { root, triad:"maj", dom:false, token, unsure:true };
  const q = qual || {triad:"maj", dom:false};
  return { root, triad:q.triad, dom:q.dom, token };
}
function parseChordInput(text) {
  const tokens = text.split(/[\s,|>•·–—-]+/).map(t => t.trim()).filter(Boolean);
  const parsed = [], failed = [];
  tokens.forEach(tk => {
    const p = parseChordToken(tk);
    if (p) parsed.push(p); else failed.push(tk);
  });
  return { parsed, failed };
}
function detectKeys(parsed) {
  const results = [];
  for (const mode of ["major","minor"]) {
    for (let r = 0; r < 12; r++) {
      const scale = getScaleNotes(NOTES[r], mode);
      let score = 0;
      parsed.forEach((c, i) => {
        const deg = scale.indexOf(c.root);
        if (deg === -1) return;
        const dq = CHORD_Q[mode][deg];
        let pts = 0;
        if (c.triad === "sus") pts = 1.2;
        else if (c.dom) {
          if (mode === "major" && deg === 4) pts = 2.2;
          else if (mode === "minor" && deg === 4) pts = 1.9;
          else if (mode === "minor" && deg === 6) pts = 1.7;
          else if (dq === "maj") pts = 1.1;
          else pts = 0.4;
        }
        else if (c.triad === dq) pts = 2;
        else if (c.triad === "aug") pts = 0.3;
        else pts = 0.4;
        if (deg === 0 && i === 0 && pts >= 1.2) pts += 0.6;
        score += pts;
      });
      results.push({ root: NOTES[r], mode, score });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}
function analyzeProgression(text) {
  const { parsed, failed } = parseChordInput(text);
  if (parsed.length < 2) return { error: "give me at least two chords", failed };
  const ranked = detectKeys(parsed);
  const best = ranked[0];
  if (best.score < parsed.length * 0.9) {
    return { error: "these chords don't settle into one key — which usually means something interesting is going on. Try a smaller chunk of the progression.", failed };
  }
  const scale = getScaleNotes(best.root, best.mode);
  const diatonic = getChordsInKey(best.root, best.mode);
  const perChord = parsed.map(c => {
    const deg = scale.indexOf(c.root);
    if (deg === -1) return { ...c, deg: -1, numeral: "—", role: "Borrowed", feel: "outside the key — that's the spice" };
    const base = diatonic[deg];
    let numeral = base.numeral;
    if (c.dom) numeral = numeral.replace("°","") + "7";
    return { ...c, deg, numeral, role: base.role, feel: base.feel, matches: c.triad === base.quality || c.dom || c.triad === "sus" };
  });
  const usedRoots = new Set(parsed.map(c => c.root));
  const fits = diatonic.filter(ch => !usedRoots.has(ch.root));
  // relative key note
  const relIdx = best.mode === "minor" ? (getNoteIdx(best.root) + 3) % 12 : (getNoteIdx(best.root) + 9) % 12;
  const relMode = best.mode === "minor" ? "major" : "minor";
  const rel = ranked.find(k => k.root === NOTES[relIdx] && k.mode === relMode);
  const relativeClose = rel && best.score - rel.score < 1.2;
  // alternates beyond the relative
  const alts = ranked.slice(1, 4).filter(k => best.score - k.score < 0.5 && !(k.root === NOTES[relIdx] && k.mode === relMode));
  return { key: best.root, mode: best.mode, perChord, fits, failed,
    relative: relativeClose ? { root: NOTES[relIdx], mode: relMode } : null,
    alt: alts.length ? alts[0] : null };
}
function scalesForKey(root, mode) {
  const r = dn(root);
  if (mode === "minor") return [
    { name: `${r} Minor Pentatonic`, why: "can't-miss — five notes, zero clunkers", scale: "Minor Pentatonic" },
    { name: `${r} natural minor (Aeolian)`, why: "the full palette of the key", scale: null },
    { name: `${r} Blues`, why: "same shape plus the gritty ♭5", scale: "Blues" },
    { name: `${r} Dorian`, why: "raise one note, get instant brightness", scale: "Dorian" },
  ];
  return [
    { name: `${r} Major Pentatonic`, why: "sunny and safe everywhere", scale: "Major Pentatonic" },
    { name: `${r} major scale`, why: "all seven notes of the key", scale: null },
    { name: `${dn(NOTES[(getNoteIdx(root)+9)%12])} Minor Pentatonic`, why: "the relative minor — same notes, moodier angle", scale: null },
  ];
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:"#0c0c0e", line:"#201b14", lineSoft:"#181510",
  text:"#e6ded2", dim:"#8d8475", faint:"#5a5244",
  amber:"#d99a3d", amberBright:"#eebb66", amberSoft:"rgba(217,154,61,0.13)", amberBorder:"rgba(217,154,61,0.4)",
  plum:"#8e44ad",
  chord:"#d9de7d", chordDeep:"#a8ae45",
  scaleTone:"#cf8a62", penta:"#6494d8", ghost:"rgba(228,221,202,0.35)",
  card:"rgba(255,255,255,0.03)",
};
const SANS = "'Outfit','Inter',system-ui,sans-serif";
const SERIF = "'Playfair Display',serif";
const ITAL = "'Crimson Text',Georgia,serif";

function pluckNote(audioCtxRef, freq) {
  if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
  const ctx = audioCtxRef.current;
  if (ctx.state === "suspended") ctx.resume();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
  osc.type = "triangle"; osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.18, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  osc.connect(lp); lp.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + 1.25);
}
const OPEN_FREQS = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63];

// ── Chord diagram (SVG) ───────────────────────────────────────────────────────
function ChordDiagram({ voicing, chordName }) {
  if (!voicing) return <div style={{fontSize:12,color:"#555",fontStyle:"italic",padding:"8px 0"}}>No diagram available</div>;
  const { frets, fingers, baseFret, barre, name } = voicing;
  const minFret = Math.min(...frets.filter(f=>f>0));
  const maxFret = Math.max(...frets);
  const displayBase = baseFret || Math.max(1, minFret);
  const numFrets = 4;
  const cols = 6;
  const cellW = 36, cellH = 30;
  const padL = 20, padT = 28, padR = 10;
  const w = padL + cellW * (cols-1) + padR;
  const h = padT + cellH * numFrets + 20;

  return (
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:11,color:"#8e44ad",letterSpacing:1,marginBottom:6,textTransform:"uppercase"}}>{name}</div>
      <svg width={w} height={h} style={{display:"block",margin:"0 auto"}}>
        {/* Nut or base fret */}
        {displayBase === 1
          ? <rect x={padL} y={padT-4} width={cellW*(cols-1)} height={5} fill="#e0d8d0" rx={2}/>
          : <text x={padL-14} y={padT+cellH*0.6} fill="#888" fontSize={10} textAnchor="middle">{displayBase}</text>
        }
        {/* Fret lines */}
        {Array.from({length:numFrets+1},(_,i)=>(
          <line key={i} x1={padL} y1={padT+i*cellH} x2={padL+cellW*(cols-1)} y2={padT+i*cellH} stroke="#2a2a2a" strokeWidth={i===0?2:1}/>
        ))}
        {/* String lines */}
        {Array.from({length:cols},(_,i)=>(
          <line key={i} x1={padL+i*cellW} y1={padT} x2={padL+i*cellW} y2={padT+numFrets*cellH} stroke="#3a3a3a" strokeWidth={1.5}/>
        ))}
        {/* Barre */}
        {barre && (
          <rect x={padL} y={padT+(barre-displayBase)*cellH+cellH*0.2} width={cellW*(cols-1)} height={cellH*0.55} fill="#8e44ad" rx={cellH*0.25} opacity={0.85}/>
        )}
        {/* Dots */}
        {frets.map((f,si) => {
          const x = padL + si*cellW;
          if (f === -1) return <text key={si} x={x} y={padT-8} fill="#e74c3c" fontSize={13} textAnchor="middle">✕</text>;
          if (f === 0) return <circle key={si} cx={x} cy={padT-10} r={5} fill="none" stroke="#666" strokeWidth={1.5}/>;
          const fretRow = f - displayBase;
          if (fretRow < 0 || fretRow >= numFrets) return null;
          const y = padT + fretRow*cellH + cellH*0.5;
          const isBarreDot = barre && f===barre;
          return <circle key={si} cx={x} cy={y} r={10} fill={isBarreDot?"transparent":"#8e44ad"} stroke="none"/>;
        })}
        {/* Finger numbers */}
        {fingers && frets.map((f,si) => {
          if (f <= 0 || !fingers[si]) return null;
          const fretRow = f - displayBase;
          if (fretRow < 0 || fretRow >= numFrets) return null;
          const x = padL + si*cellW;
          const y = padT + fretRow*cellH + cellH*0.5;
          return <text key={si} x={x} y={y+4} fill="#fff" fontSize={9} textAnchor="middle" fontWeight="bold">{fingers[si]}</text>;
        })}
      </svg>
    </div>
  );
}

// ── The Wood Fretboard — AlphaJams-style layered solo map ─────────────────────
function WoodFretboard({ grid, layers, onToggleLayer, fretWindow, boxData, capo,
                         chordName, scaleLabel, pentaLabel, audioCtxRef }) {
  const [startFret, endFret] = fretWindow;
  const hasOpen = startFret === 0;
  const woodFrets = [];
  for (let f = Math.max(1, startFret); f <= endFret; f++) woodFrets.push(f);

  const labelW = 22, openW = 42, nutW = 5, fretW = 46, rowH = 36;
  const woodW = woodFrets.length * fretW;
  const woodX = labelW + (hasOpen ? openW + nutW : 14);
  const totalW = woodX + woodW + 8;
  const boardH = rowH * 6;
  const boxActive = !!boxData;

  // display rows top→bottom: high e → low E (like looking at the neck)
  const displayOrder = [5,4,3,2,1,0];

  const renderMarker = (si, fret) => {
    const fd = grid[si][fret];
    const inBox = boxActive && boxData.set.has(`${si}-${fret}`);
    const capoDead = capo > 0 && fret < capo;
    const isChord = layers.chord && fd.isChordTone;
    const isScale = layers.scale && fd.isScaleTone && !isChord;
    const isPenta = layers.penta && fd.isPentaTone;
    const isColor = layers.color && !fd.isScaleTone && !fd.isChordTone && !fd.isPentaTone;
    if (!isChord && !isScale && !(isPenta && !fd.isScaleTone && !fd.isChordTone) && !isColor) {
      if (!isPenta) return null;
    }
    const dimOut = boxActive && !inBox && !isChord;
    const wrapOpacity = capoDead ? 0.13 : dimOut ? 0.28 : 1;
    const freq = OPEN_FREQS[si] * Math.pow(2, fret / 12);

    return (
      <div onClick={() => !capoDead && pluckNote(audioCtxRef, freq)}
        style={{position:"relative", width:30, height:30, display:"flex", alignItems:"center",
          justifyContent:"center", opacity:wrapOpacity, cursor:capoDead?"default":"pointer",
          transition:"opacity 0.25s"}}>
        {/* Pentatonic membership — blue rounded-square outline */}
        {isPenta && (
          <div style={{position:"absolute", width:27, height:27, borderRadius:7,
            border:`2px solid ${T.penta}`, boxSizing:"border-box",
            boxShadow: inBox && boxActive ? `0 0 7px rgba(100,148,216,0.55)` : "none",
            opacity: boxActive ? (inBox ? 1 : 0.4) : 0.9}}/>
        )}
        {isChord ? (
          fd.isChordRoot ? (
            <div style={{width:24, height:24, borderRadius:"50%",
              background:"radial-gradient(circle at 38% 32%, #eef095, #c5cb5d)",
              boxShadow:"0 0 0 3px rgba(26,19,9,0.92), 0 0 9px rgba(217,222,125,0.45)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:8, fontWeight:800, color:"#23230c", fontFamily:SANS}}>
              {dn(fd.noteName)}
            </div>
          ) : (
            <div style={{width:19, height:19, transform:"rotate(45deg)", borderRadius:3,
              background:"linear-gradient(135deg, #e0e489, #b9c052)",
              border:"1px solid #99a039", boxShadow:"0 1px 3px rgba(0,0,0,0.35)",
              display:"flex", alignItems:"center", justifyContent:"center"}}>
              <span style={{transform:"rotate(-45deg)", fontSize:7, fontWeight:800,
                color:"#23230c", fontFamily:SANS}}>{dn(fd.noteName)}</span>
            </div>
          )
        ) : isScale ? (
          <div style={{width:17, height:17, borderRadius:"50%",
            background:"radial-gradient(circle at 38% 32%, #dd9a72, #bd7449)",
            border:"1px solid rgba(64,32,14,0.55)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:6.5, fontWeight:700, color:"#fff6ee", fontFamily:SANS,
            opacity: boxActive && !inBox ? 0.85 : 1}}>
            {dn(fd.noteName)}
          </div>
        ) : isPenta ? (
          <div style={{width:9, height:9, borderRadius:"50%", background:T.penta, opacity:0.85}}/>
        ) : isColor ? (
          <div style={{width:7, height:7, borderRadius:"50%", background:T.ghost}}/>
        ) : null}
      </div>
    );
  };

  const LegendChip = ({ active, onTap, swatch, label, value, color }) => (
    <button onClick={onTap} style={{
      display:"flex", alignItems:"center", gap:7, padding:"6px 10px", borderRadius:9,
      border:`1px solid ${active ? color+"66" : T.line}`,
      background: active ? color+"14" : "rgba(255,255,255,0.02)",
      cursor:"pointer", fontFamily:SANS, transition:"all 0.15s", flexShrink:0,
    }}>
      <span style={{opacity:active?1:0.3, display:"flex"}}>{swatch}</span>
      <span style={{textAlign:"left"}}>
        <span style={{display:"block", fontSize:8.5, letterSpacing:1.5, textTransform:"uppercase",
          color: active ? color : T.faint}}>{label} {active ? "" : "· off"}</span>
        <span style={{display:"block", fontSize:11, color: active ? T.text : T.faint, fontWeight:500}}>{value}</span>
      </span>
    </button>
  );

  return (
    <div>
      <div style={{overflowX:"auto", paddingBottom:4, WebkitOverflowScrolling:"touch"}}>
        <div style={{width:totalW, position:"relative"}}>
          {/* The wood */}
          <div style={{position:"absolute", left:woodX, top:0, width:woodW, height:boardH,
            borderRadius:3,
            background:`
              repeating-linear-gradient(90deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 9px),
              repeating-linear-gradient(0deg, rgba(38,26,16,0.10) 0px, rgba(38,26,16,0.10) 2px, transparent 2px, transparent 13px),
              linear-gradient(180deg, #8a7560 0%, #7c6753 45%, #6d5945 100%)`,
            boxShadow:"inset 0 0 22px rgba(20,10,4,0.5), 0 2px 10px rgba(0,0,0,0.5)"}}>
            {/* Inlay markers */}
            {woodFrets.map((f, i) => {
              if (![3,5,7,9,15].includes(f) && f !== 12) return null;
              const cx = i * fretW + fretW / 2;
              const dot = (cy, k) => (
                <div key={k} style={{position:"absolute", left:cx-9, top:cy-9, width:18, height:18,
                  borderRadius:"50%", background:"radial-gradient(circle, rgba(22,13,6,0.4), rgba(22,13,6,0.06) 70%)"}}/>
              );
              return f === 12
                ? [dot(rowH*1.5, `i${f}a`), dot(rowH*4.5, `i${f}b`)]
                : dot(boardH/2, `i${f}`);
            })}
            {/* Fret wires */}
            {woodFrets.map((f, i) => i === 0 ? null : (
              <div key={f} style={{position:"absolute", left:i*fretW-1, top:0, width:2, height:boardH,
                background:"linear-gradient(90deg, rgba(255,245,225,0.45), rgba(120,105,85,0.55))",
                boxShadow:"1px 0 2px rgba(0,0,0,0.4)"}}/>
            ))}
            {/* Strings */}
            {displayOrder.map((si, row) => (
              <div key={si} style={{position:"absolute", left:0, right:0, top:rowH*(row+0.5)-1,
                height: 1 + row*0.38,
                background:"linear-gradient(180deg, #d9d0bd, #847a66)",
                boxShadow:"0 1px 2px rgba(0,0,0,0.55)", opacity:0.92}}/>
            ))}
            {/* Capo bar */}
            {capo > 0 && capo >= Math.max(1,startFret) && capo <= endFret && (
              <div style={{position:"absolute", left:(capo - woodFrets[0])*fretW + 3, top:-5,
                width:10, height:boardH+10, borderRadius:6,
                background:"linear-gradient(180deg, #33271a, #181006)",
                border:`1px solid ${T.amberBorder}`, boxShadow:"0 0 9px rgba(0,0,0,0.7)", zIndex:3}}/>
            )}
          </div>

          {/* Nut */}
          {hasOpen && (
            <div style={{position:"absolute", left:labelW+openW, top:-2, width:nutW, height:boardH+4,
              borderRadius:2, background:"linear-gradient(90deg,#efe7d6,#b8ad94)",
              boxShadow:"1px 0 4px rgba(0,0,0,0.6)"}}/>
          )}

          {/* Rows of note cells */}
          <div style={{position:"relative", zIndex:2}}>
            {displayOrder.map((si) => (
              <div key={si} style={{display:"flex", alignItems:"center", height:rowH}}>
                <div style={{width:labelW, fontSize:10, color:T.faint, textAlign:"right",
                  paddingRight:6, fontFamily:SANS}}>{STRING_NAMES[si]}</div>
                {hasOpen ? (
                  <div style={{width:openW+nutW, display:"flex", alignItems:"center", justifyContent:"center"}}>
                    {renderMarker(si, 0)}
                  </div>
                ) : (
                  <div style={{width:14}}/>
                )}
                {woodFrets.map(f => (
                  <div key={f} style={{width:fretW, height:rowH, display:"flex",
                    alignItems:"center", justifyContent:"center"}}>
                    {renderMarker(si, f)}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Fret numbers */}
          <div style={{display:"flex", marginTop:5}}>
            <div style={{width:labelW}}/>
            {hasOpen ? (
              <div style={{width:openW+nutW, textAlign:"center", fontSize:9, color:T.faint, fontFamily:SANS}}>open</div>
            ) : <div style={{width:14}}/>}
            {woodFrets.map(f => (
              <div key={f} style={{width:fretW, textAlign:"center", fontFamily:SANS}}>
                <span style={{fontSize:10, color:FRET_MARKERS.includes(f) ? T.amber : T.faint,
                  fontWeight:FRET_MARKERS.includes(f) ? 700 : 400,
                  borderBottom:FRET_MARKERS.includes(f) ? `2px solid ${T.amber}` : "none",
                  paddingBottom:1}}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend — doubles as layer toggles */}
      <div style={{display:"flex", gap:7, marginTop:12, flexWrap:"wrap"}}>
        <LegendChip active={layers.chord} onTap={() => onToggleLayer("chord")} color={T.chord}
          label="Chord" value={chordName || "—"}
          swatch={<span style={{width:13, height:13, display:"inline-block", transform:"rotate(45deg)",
            borderRadius:2, background:"linear-gradient(135deg,#e0e489,#b9c052)"}}/>}/>
        <LegendChip active={layers.scale} onTap={() => onToggleLayer("scale")} color={T.scaleTone}
          label="Scale" value={scaleLabel}
          swatch={<span style={{width:13, height:13, display:"inline-block", borderRadius:"50%",
            background:"radial-gradient(circle at 38% 32%, #dd9a72, #bd7449)"}}/>}/>
        <LegendChip active={layers.penta} onTap={() => onToggleLayer("penta")} color={T.penta}
          label="Penta" value={pentaLabel}
          swatch={<span style={{width:14, height:14, display:"inline-block", borderRadius:4,
            border:`2px solid ${T.penta}`, boxSizing:"border-box"}}/>}/>
        <LegendChip active={layers.color} onTap={() => onToggleLayer("color")} color={"#b6ae9c"}
          label="Color tones" value="passing notes"
          swatch={<span style={{width:8, height:8, display:"inline-block", borderRadius:"50%",
            background:T.ghost}}/>}/>
      </div>
    </div>
  );
}

// ── Chord Timeline — DAW-style blocks with beat dots ──────────────────────────
function ChordTimeline({ progression, currentIdx, currentBeat, startBeats, isPlaying,
                         selectedIdx, onSelect, onOpen, onCycleBars, onRemove, capo }) {
  if (!progression.length) {
    return (
      <div style={{border:`1px dashed ${T.line}`, borderRadius:12, padding:"18px 14px",
        fontSize:13, color:T.faint, fontStyle:"italic", textAlign:"center", fontFamily:ITAL}}>
        Tap chords in Build to start — they'll land here as your timeline.
      </div>
    );
  }
  return (
    <div style={{overflowX:"auto", paddingBottom:4, WebkitOverflowScrolling:"touch"}}>
      <div style={{display:"flex", gap:7, minWidth:"min-content"}}>
        {progression.map((ch, i) => {
          const bars = ch.bars || 2;
          const beats = bars * 4;
          const isActive = isPlaying && currentIdx === i;
          const isSelected = !isPlaying && selectedIdx === i;
          const beatInChord = isActive ? currentBeat - startBeats[i] : -1;
          const name = ch.displayName || ch.name;
          const fingered = capo > 0 ? fingeredName(ch.playName || name, capo) : null;
          return (
            <div key={i}
              onClick={() => { if (isSelected || isPlaying) onOpen(ch, i); else onSelect(i); }}
              style={{
                position:"relative", flexShrink:0,
                minWidth: Math.max(96, beats * 11 + 22),
                background: isActive ? "rgba(217,154,61,0.10)" : isSelected ? "rgba(217,154,61,0.06)" : "rgba(255,255,255,0.025)",
                border:`1px solid ${isActive ? T.amberBorder : isSelected ? "rgba(217,154,61,0.28)" : T.line}`,
                borderRadius:11, padding:"9px 11px 8px", cursor:"pointer",
                boxShadow: isActive ? "0 0 16px rgba(217,154,61,0.16)" : "none",
                transition:"border-color 0.15s, background 0.15s, box-shadow 0.2s",
              }}>
              <button onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                aria-label={`Remove ${name}`}
                style={{position:"absolute", top:5, right:6, background:"transparent", border:"none",
                  color:T.faint, fontSize:11, cursor:"pointer", padding:2, lineHeight:1}}>✕</button>
              <div style={{fontFamily:SERIF, fontSize:16, fontWeight:700, lineHeight:1.1,
                color: isActive ? "#f4e6cd" : T.text, paddingRight:14}}>{name}</div>
              <div style={{fontSize:10, color: isActive ? T.amber : T.dim, fontFamily:SANS, marginTop:1}}>
                {ch.numeral || "·"}{fingered ? <span style={{color:T.faint}}> · play {fingered}</span> : null}
              </div>
              {/* Beat dots */}
              <div style={{display:"flex", alignItems:"center", gap:0, marginTop:6, height:12}}>
                {Array.from({length: beats}, (_, b) => {
                  const elapsed = beatInChord >= b;
                  const isNow = beatInChord === b;
                  const barStart = b % 4 === 0;
                  return (
                    <span key={b} style={{
                      width:11, textAlign:"center", lineHeight:"12px",
                      fontSize: barStart ? 9 : 13,
                      color: isNow ? "#f2f6a4" : elapsed ? "#c9d06b" : "#3b372c",
                      textShadow: isNow ? "0 0 7px rgba(217,222,125,0.8)" : "none",
                      transform: isNow ? "scale(1.35)" : "scale(1)",
                      transition:"color 0.1s, transform 0.1s",
                    }}>{barStart ? "✱" : "•"}</span>
                  );
                })}
              </div>
              {/* Bar-length control: tap to cycle 1 / 2 / 4 */}
              <button onClick={(e) => { e.stopPropagation(); onCycleBars(i); }}
                style={{marginTop:6, background:"rgba(255,255,255,0.04)", border:`1px solid ${T.line}`,
                  borderRadius:6, color: isActive ? T.amber : T.dim, fontSize:9.5, fontFamily:SANS,
                  letterSpacing:0.5, padding:"2px 7px", cursor:"pointer"}}>
                {bars} {bars === 1 ? "bar" : "bars"} ⟳
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Spice modal — voicings + "Spice It Up" explorer ───────────────────────────
function SpiceModal({ chord, capo, onClose, onAdd, audioCtxRef }) {
  const baseName = chord.displayName || chord.name;
  const [activeName, setActiveName] = useState(baseName);
  const [voicingIdx, setVoicingIdx] = useState(0);
  const shapeName = fingeredName(activeName, capo);
  const voicings = getVoicings(shapeName);
  const tones = getChordTones(activeName);

  const pick = (vName) => { setActiveName(vName); setVoicingIdx(0); };

  return (
    <div style={{position:"fixed", inset:0, background:"rgba(5,4,2,0.86)", zIndex:100,
      display:"flex", alignItems:"flex-end", justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"#14110c", borderRadius:"18px 18px 0 0", width:"100%", maxWidth:520,
        padding:"22px 18px 42px", border:`1px solid rgba(217,154,61,0.16)`, borderBottom:"none",
        maxHeight:"88vh", overflowY:"auto"}} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6}}>
          <div>
            <div style={{fontFamily:SERIF, fontSize:27, fontWeight:900, color:T.text}}>{activeName}</div>
            <div style={{fontSize:12, color:T.dim, fontFamily:ITAL, fontStyle:"italic"}}>
              {chord.numeral} · {chord.role} · {chord.feel}
            </div>
            {tones.length > 0 && (
              <div style={{fontSize:10.5, color:T.faint, fontFamily:SANS, marginTop:3}}>
                tones: {tones.map(dn).join(" · ")}
              </div>
            )}
          </div>
          <div style={{display:"flex", gap:7, alignItems:"center", flexShrink:0}}>
            <button onClick={() => playChord(activeName, audioCtxRef)} style={{
              background:`linear-gradient(135deg, ${T.amber}, #a8702a)`, border:"none", borderRadius:10,
              color:"#1a1206", padding:"9px 14px", fontSize:13, cursor:"pointer",
              fontFamily:SERIF, fontWeight:700}}>▶ Play</button>
            <button onClick={() => { onAdd(activeName, chord); onClose(); }} style={{
              background:"rgba(217,154,61,0.12)", border:`1px solid ${T.amberBorder}`, borderRadius:10,
              color:T.amberBright, padding:"9px 12px", fontSize:13, cursor:"pointer",
              fontFamily:SANS, fontWeight:600}}>＋ Add</button>
            <button onClick={onClose} aria-label="Close" style={{background:"rgba(255,255,255,0.05)",
              border:`1px solid ${T.line}`, borderRadius:8, color:T.dim, padding:"8px 11px",
              cursor:"pointer", fontSize:15}}>✕</button>
          </div>
        </div>

        {capo > 0 && (
          <div style={{fontSize:11.5, color:T.amber, fontFamily:SANS, marginBottom:10,
            background:T.amberSoft, border:`1px solid rgba(217,154,61,0.25)`, borderRadius:8,
            padding:"6px 10px"}}>
            Capo {capo} — sound a {activeName} by playing a <b>{shapeName}</b> shape:
          </div>
        )}

        {/* Voicings */}
        {voicings ? (
          <>
            <div style={{fontSize:9.5, letterSpacing:2.5, color:T.faint, textTransform:"uppercase",
              marginBottom:10, fontFamily:SANS}}>Guitar voicings{capo > 0 ? ` — ${shapeName} shape` : ""}</div>
            {voicings.length > 1 && (
              <div style={{display:"flex", gap:6, marginBottom:12, flexWrap:"wrap"}}>
                {voicings.map((v, i) => (
                  <button key={i} onClick={() => setVoicingIdx(i)} style={{
                    padding:"5px 12px", borderRadius:7, fontSize:12, fontFamily:SANS,
                    border:`1px solid ${voicingIdx===i ? T.amber : T.line}`,
                    background: voicingIdx===i ? T.amberSoft : "rgba(255,255,255,0.03)",
                    color: voicingIdx===i ? T.text : T.faint, cursor:"pointer"}}>{v.name}</button>
                ))}
              </div>
            )}
            <div style={{background:"rgba(255,255,255,0.02)", borderRadius:12, padding:"14px 10px",
              border:`1px solid ${T.lineSoft}`, marginBottom:8}}>
              <ChordDiagram voicing={voicings[Math.min(voicingIdx, voicings.length-1)]} chordName={shapeName}/>
            </div>
            <div style={{fontSize:11, color:T.faint, fontFamily:ITAL, fontStyle:"italic",
              marginBottom:18, textAlign:"center"}}>
              ✕ = mute · ○ = open · numbers = fingers (1=index, 4=pinky)
            </div>
          </>
        ) : (
          <div style={{fontSize:13, color:T.faint, fontStyle:"italic", margin:"14px 0 20px",
            textAlign:"center", fontFamily:ITAL}}>No diagram for this one yet — trust your ears</div>
        )}

        {/* Spice It Up */}
        <div style={{fontSize:9.5, letterSpacing:2.5, color:T.amber, textTransform:"uppercase",
          marginBottom:3, fontFamily:SANS, fontWeight:600}}>Spice it up</div>
        <div style={{fontSize:12, color:T.dim, fontFamily:ITAL, fontStyle:"italic", marginBottom:12}}>
          Same root, different weather. Tap one to see its shape, ▶ to hear it.
        </div>

        {/* As written */}
        <div style={{display:"flex", gap:7, marginBottom:12, alignItems:"center"}}>
          <button onClick={() => pick(baseName)} style={{
            background: activeName === baseName ? T.amberSoft : "rgba(255,255,255,0.04)",
            border:`1px solid ${activeName === baseName ? T.amberBorder : T.line}`,
            borderRadius:8, padding:"7px 12px", cursor:"pointer", fontFamily:SERIF,
            fontWeight:700, fontSize:13, color:T.text}}>{baseName}</button>
          <span style={{fontSize:10.5, color:T.faint, fontFamily:SANS}}>as written</span>
        </div>

        {SPICE_CATEGORIES.map(cat => (
          <div key={cat.label} style={{marginBottom:14}}>
            <div style={{display:"flex", alignItems:"baseline", gap:8, marginBottom:7}}>
              <div style={{fontFamily:SERIF, fontSize:14, fontWeight:700, color:T.text}}>{cat.label}</div>
              <div style={{fontSize:11, color:T.faint, fontFamily:ITAL, fontStyle:"italic"}}>{cat.hint}</div>
            </div>
            <div style={{display:"flex", flexWrap:"wrap", gap:7}}>
              {cat.variants.map(v => {
                const vName = getVarName(chord.root, chord.quality, v);
                const isActive = vName === activeName;
                const hasShape = !!getVoicings(fingeredName(vName, capo));
                return (
                  <div key={v} onClick={() => pick(vName)} style={{
                    background: isActive ? T.amberSoft : "rgba(255,255,255,0.035)",
                    border:`1px solid ${isActive ? T.amberBorder : T.line}`,
                    borderRadius:9, padding:"8px 11px", minWidth:104, cursor:"pointer",
                    transition:"border-color 0.12s"}}>
                    <div style={{display:"flex", alignItems:"center", justifyContent:"space-between",
                      gap:8, marginBottom:2}}>
                      <div style={{fontFamily:SERIF, fontSize:13.5, fontWeight:700, color:T.text}}>{vName}</div>
                      <button onClick={(e) => { e.stopPropagation(); playChord(vName, audioCtxRef); }}
                        aria-label={`Play ${vName}`}
                        style={{background:"rgba(217,154,61,0.14)", border:`1px solid rgba(217,154,61,0.3)`,
                          borderRadius:5, color:T.amber, padding:"2px 7px", fontSize:11,
                          cursor:"pointer", flexShrink:0}}>▶</button>
                    </div>
                    <div style={{fontSize:10, color:T.dim, fontFamily:ITAL, fontStyle:"italic"}}>
                      {VARIANT_FEEL[v]}
                    </div>
                    {hasShape && <div style={{fontSize:8.5, color:T.faint, marginTop:2, fontFamily:SANS}}>tap for shape</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI analysis (Anthropic API) ───────────────────────────────────────────────
function AIAnalysis({ progression, root, mode }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const analyze = useCallback(async () => {
    if (!progression.length) return;
    setLoading(true); setAnalysis(null);
    const names = progression.map(c => c.displayName || c.name).join(" – ");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6", max_tokens:1000,
          system:"You are a music theory expert and guitar teacher. Be conversational, exciting, practical. Relate theory to emotion and feel. Keep it punchy.",
          messages:[{role:"user", content:`Analyze this guitar chord progression: ${names} (key of ${dn(root)} ${mode}).
1. Why does this work emotionally? (2–3 sentences)
2. What is the listener feeling at each chord? (one punchy phrase per chord: "ChordName: feeling")
3. Two specific ways to spice it up (swap or add a chord)
4. One famous song with a similar vibe.
Short, punchy, exciting.`}],
        }),
      });
      const data = await res.json();
      setAnalysis(data.content?.find(b => b.type === "text")?.text || "No response.");
    } catch { setAnalysis("API connection failed — this feature needs the app running where the Anthropic API is reachable."); }
    setLoading(false);
  }, [progression, root, mode]);

  return (
    <div style={{marginTop:16}}>
      <button onClick={analyze} disabled={loading || !progression.length} style={{
        width:"100%", padding:"13px 0",
        background: progression.length ? `linear-gradient(135deg, #b3742a, ${T.plum})` : "#1a1812",
        border:"none", borderRadius:10, color:"#fff",
        fontFamily:SERIF, fontSize:15, fontWeight:700, letterSpacing:1,
        cursor: progression.length ? "pointer" : "not-allowed", opacity: progression.length ? 1 : 0.4,
      }}>{loading ? "Listening closely..." : "✦ Analyze My Progression"}</button>
      {analysis && (
        <div style={{marginTop:12, background:"rgba(255,255,255,0.04)",
          border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:16,
          fontSize:13, color:"#ccc", lineHeight:1.75, whiteSpace:"pre-wrap", fontFamily:SANS}}>{analysis}</div>
      )}
    </div>
  );
}

// ── Backing track panel ───────────────────────────────────────────────────────
function BackingPanel({ backing, setBacking, onVolume, audioCtxRef, isPlaying }) {
  const fileRef = useRef(null);
  const [loadingFile, setLoadingFile] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingFile(true);
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const buf = await file.arrayBuffer();
      const decoded = await audioCtxRef.current.decodeAudioData(buf);
      setBacking(b => ({...b, buffer: decoded, fileName: file.name, mode:"upload", on:true}));
    } catch {
      setBacking(b => ({...b, buffer:null, fileName:"couldn't read that file — try MP3 or WAV"}));
    }
    setLoadingFile(false);
  };

  return (
    <div style={{background:T.card, border:`1px solid ${T.lineSoft}`, borderRadius:12,
      padding:"11px 13px", marginBottom:14}}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <div style={{fontSize:9.5, letterSpacing:2.5, color:T.faint, textTransform:"uppercase",
          fontFamily:SANS}}>Backing track</div>
        <button onClick={() => setBacking(b => ({...b, on: !b.on}))} style={{
          padding:"4px 13px", borderRadius:20, fontSize:11, fontFamily:SANS, fontWeight:600,
          border:`1px solid ${backing.on ? T.amberBorder : T.line}`,
          background: backing.on ? T.amberSoft : "rgba(255,255,255,0.03)",
          color: backing.on ? T.amberBright : T.faint, cursor:"pointer"}}>
          {backing.on ? "On" : "Off"}
        </button>
      </div>

      {backing.on && (
        <div style={{marginTop:10}}>
          <div style={{display:"flex", gap:6, marginBottom:10}}>
            {[["gen","Generated loop"],["upload","Upload audio"]].map(([m, label]) => (
              <button key={m} onClick={() => setBacking(b => ({...b, mode:m}))} style={{
                flex:1, padding:"7px 0", borderRadius:8, fontSize:12, fontFamily:SANS,
                border:`1px solid ${backing.mode===m ? T.amberBorder : T.line}`,
                background: backing.mode===m ? T.amberSoft : "rgba(255,255,255,0.02)",
                color: backing.mode===m ? T.text : T.faint, cursor:"pointer", fontWeight:500}}>{label}</button>
            ))}
          </div>

          {backing.mode === "gen" ? (
            <>
              <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:8}}>
                {BACKING_STYLES.map(s => (
                  <button key={s} onClick={() => setBacking(b => ({...b, style:s}))} style={{
                    padding:"5px 13px", borderRadius:7, fontSize:11.5, fontFamily:SANS,
                    border:`1px solid ${backing.style===s ? T.amberBorder : T.line}`,
                    background: backing.style===s ? T.amberSoft : "rgba(255,255,255,0.02)",
                    color: backing.style===s ? T.amberBright : T.faint, cursor:"pointer"}}>{s}</button>
                ))}
              </div>
              <div style={{fontSize:11, color:T.faint, fontFamily:ITAL, fontStyle:"italic"}}>
                Drums and bass under your chords — replaces the metronome click.
                {isPlaying ? " Changes apply on the next beat." : ""}
              </div>
            </>
          ) : (
            <>
              <input ref={fileRef} type="file" accept="audio/*" onChange={handleFile} style={{display:"none"}}/>
              <div style={{display:"flex", gap:9, alignItems:"center", marginBottom:8}}>
                <button onClick={() => fileRef.current?.click()} style={{
                  padding:"7px 14px", borderRadius:8, fontSize:12, fontFamily:SANS,
                  border:`1px solid ${T.amberBorder}`, background:T.amberSoft,
                  color:T.amberBright, cursor:"pointer", fontWeight:600, flexShrink:0}}>
                  {loadingFile ? "Reading…" : "Choose audio…"}
                </button>
                <div style={{fontSize:11.5, color: backing.buffer ? T.text : T.faint, fontFamily:SANS,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                  {backing.fileName || "MP3 or WAV — a GarageBand loop works great"}
                </div>
              </div>
              <div style={{fontSize:11, color:T.faint, fontFamily:ITAL, fontStyle:"italic"}}>
                Loops while you play. Tap Tempo to match your loop's BPM so the chords land with it.
              </div>
            </>
          )}

          <div style={{display:"flex", alignItems:"center", gap:10, marginTop:10}}>
            <span style={{fontSize:10, color:T.faint, fontFamily:SANS, letterSpacing:1,
              textTransform:"uppercase", flexShrink:0}}>Level</span>
            <input type="range" min="0" max="100" value={Math.round(backing.volume * 100)}
              onChange={(e) => { const v = Number(e.target.value) / 100;
                setBacking(b => ({...b, volume:v})); onVolume(v); }}
              style={{flex:1, accentColor:T.amber, height:4}}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Decode tab — reverse chord lookup ─────────────────────────────────────────
function DecodeTab({ audioCtxRef, onApply, onSoloScale }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);

  const run = (text) => {
    const t = (text ?? input).trim();
    if (!t) return;
    setInput(t);
    setResult(analyzeProgression(t));
  };

  const EXAMPLES = ["Em G D C", "Am F C G", "A D E", "Dm Bb F C"];

  return (
    <div>
      <div style={{fontFamily:SERIF, fontSize:19, fontWeight:700, marginBottom:4}}>What key am I in?</div>
      <div style={{fontSize:13, color:T.dim, fontFamily:ITAL, fontStyle:"italic", marginBottom:14}}>
        Already jamming on some chords but don't know why they work? Type 2–4 of them and I'll decode it.
      </div>

      <div style={{display:"flex", gap:8, marginBottom:10}}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") run(); }}
          placeholder="e.g. Em G D C"
          style={{flex:1, background:"rgba(255,255,255,0.04)", border:`1px solid ${T.line}`,
            borderRadius:10, padding:"11px 13px", color:T.text, fontSize:15, fontFamily:SANS,
            outline:"none"}}/>
        <button onClick={() => run()} style={{
          background:`linear-gradient(135deg, ${T.amber}, #a8702a)`, border:"none", borderRadius:10,
          color:"#1a1206", padding:"0 18px", fontSize:14, fontWeight:700, fontFamily:SERIF,
          cursor:"pointer"}}>Decode</button>
      </div>
      <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:18}}>
        {EXAMPLES.map(ex => (
          <button key={ex} onClick={() => run(ex)} style={{
            background:"rgba(255,255,255,0.03)", border:`1px solid ${T.line}`, borderRadius:7,
            padding:"4px 11px", fontSize:11.5, color:T.dim, fontFamily:SANS, cursor:"pointer"}}>{ex}</button>
        ))}
      </div>

      {result && result.error && (
        <div style={{background:"rgba(255,255,255,0.03)", border:`1px solid ${T.line}`, borderRadius:12,
          padding:"14px 16px", fontSize:13.5, color:T.dim, fontFamily:ITAL, fontStyle:"italic"}}>
          Hmm — {result.error}
          {result.failed?.length > 0 && <span> (couldn't read: {result.failed.join(", ")})</span>}
        </div>
      )}

      {result && !result.error && (
        <div style={{background:T.card, border:`1px solid rgba(217,154,61,0.2)`, borderRadius:14,
          padding:"16px 16px 18px"}}>
          {/* Verdict */}
          <div style={{fontSize:9.5, letterSpacing:2.5, color:T.amber, textTransform:"uppercase",
            fontFamily:SANS, fontWeight:600, marginBottom:4}}>The verdict</div>
          <div style={{fontFamily:SERIF, fontSize:23, fontWeight:900, color:T.text}}>
            You're in {dn(result.key)} {result.mode}
          </div>
          {result.relative && (
            <div style={{fontSize:12.5, color:T.dim, fontFamily:ITAL, fontStyle:"italic", marginTop:3}}>
              …or its relative, {dn(result.relative.root)} {result.relative.mode} — same notes, different home base.
              {result.mode === "minor" ? " Starting on the minor chord tips it minor." : ""}
            </div>
          )}
          {result.alt && (
            <div style={{fontSize:12, color:T.faint, fontFamily:ITAL, fontStyle:"italic", marginTop:2}}>
              ({dn(result.alt.root)} {result.alt.mode} is also a defensible read.)
            </div>
          )}
          {result.failed?.length > 0 && (
            <div style={{fontSize:11.5, color:T.faint, fontFamily:SANS, marginTop:5}}>
              Skipped what I couldn't read: {result.failed.join(", ")}
            </div>
          )}

          {/* Per-chord breakdown */}
          <div style={{fontSize:9.5, letterSpacing:2.5, color:T.faint, textTransform:"uppercase",
            fontFamily:SANS, margin:"16px 0 8px"}}>What each chord is doing</div>
          {result.perChord.map((c, i) => (
            <div key={i} style={{display:"flex", alignItems:"center", gap:10, padding:"7px 0",
              borderBottom: i < result.perChord.length-1 ? `1px solid ${T.lineSoft}` : "none"}}>
              <button onClick={() => playChord(c.token, audioCtxRef)} style={{
                background:"rgba(217,154,61,0.1)", border:`1px solid rgba(217,154,61,0.25)`,
                borderRadius:6, color:T.amber, width:26, height:26, fontSize:11, cursor:"pointer",
                flexShrink:0}}>▶</button>
              <div style={{fontFamily:SERIF, fontSize:15.5, fontWeight:700, minWidth:52}}>{c.token}</div>
              <div style={{fontSize:11.5, fontFamily:SANS, color: c.deg === -1 ? T.amber : T.dim,
                minWidth:34, fontWeight:600}}>{c.numeral}</div>
              <div style={{fontSize:12, color:T.dim, fontFamily:ITAL, fontStyle:"italic", flex:1}}>
                {c.role} — {c.feel}
              </div>
            </div>
          ))}

          {/* Chords that fit */}
          {result.fits.length > 0 && (
            <>
              <div style={{fontSize:9.5, letterSpacing:2.5, color:T.faint, textTransform:"uppercase",
                fontFamily:SANS, margin:"16px 0 8px"}}>More chords that'll fit right in</div>
              <div style={{display:"flex", flexWrap:"wrap", gap:7}}>
                {result.fits.map(ch => (
                  <div key={ch.name} style={{display:"flex", alignItems:"center", gap:6,
                    background:"rgba(255,255,255,0.035)", border:`1px solid ${T.line}`,
                    borderRadius:8, padding:"6px 9px"}}>
                    <span style={{fontFamily:SERIF, fontSize:13.5, fontWeight:700}}>{dn(ch.root)}{ch.quality==="min"?"m":ch.quality==="dim"?"dim":""}</span>
                    <span style={{fontSize:10, color:T.faint, fontFamily:SANS}}>{ch.numeral}</span>
                    <button onClick={() => playChord(ch.name, audioCtxRef)} style={{
                      background:"transparent", border:"none", color:T.amber, fontSize:11,
                      cursor:"pointer", padding:"0 2px"}}>▶</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Scales */}
          <div style={{fontSize:9.5, letterSpacing:2.5, color:T.faint, textTransform:"uppercase",
            fontFamily:SANS, margin:"16px 0 8px"}}>Scales to solo with</div>
          {scalesForKey(result.key, result.mode).map((s, i) => (
            <div key={i} style={{display:"flex", alignItems:"baseline", gap:8, padding:"3px 0"}}>
              <span style={{fontSize:13, fontFamily:SANS, fontWeight:600, color:T.text}}>{s.name}</span>
              <span style={{fontSize:11.5, color:T.faint, fontFamily:ITAL, fontStyle:"italic", flex:1}}>— {s.why}</span>
              {s.scale && (
                <button onClick={() => onSoloScale(result.key, result.mode, s.scale)} style={{
                  background:"transparent", border:`1px solid ${T.line}`, borderRadius:6,
                  color:T.dim, fontSize:10, fontFamily:SANS, padding:"2px 8px", cursor:"pointer",
                  flexShrink:0}}>map it →</button>
              )}
            </div>
          ))}

          <button onClick={() => onApply(result)} style={{
            width:"100%", marginTop:16, padding:"12px 0",
            background:`linear-gradient(135deg, ${T.amber}, #a8702a)`, border:"none", borderRadius:10,
            color:"#1a1206", fontFamily:SERIF, fontSize:14.5, fontWeight:700, letterSpacing:0.5,
            cursor:"pointer"}}>
            Use {dn(result.key)} {result.mode} — load these chords →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Capo strip ────────────────────────────────────────────────────────────────
function CapoStrip({ capo, setCapo, keyRoot, mode }) {
  const fingerKey = NOTES[((getNoteIdx(keyRoot) - capo) % 12 + 12) % 12];
  return (
    <div style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap",
      background:T.card, border:`1px solid ${T.lineSoft}`, borderRadius:10, padding:"8px 12px"}}>
      <div style={{fontSize:9.5, letterSpacing:2.5, color:T.faint, textTransform:"uppercase", fontFamily:SANS}}>Capo</div>
      <div style={{display:"flex", alignItems:"center", gap:6}}>
        <button onClick={() => setCapo(c => Math.max(0, c - 1))} aria-label="Capo down" style={{
          background:"transparent", border:`1px solid ${T.line}`, borderRadius:6, color:T.dim,
          width:24, height:24, fontSize:14, cursor:"pointer", lineHeight:1, fontFamily:SANS}}>−</button>
        <div style={{minWidth:22, textAlign:"center", fontFamily:SERIF, fontSize:17, fontWeight:700,
          color: capo > 0 ? T.amberBright : T.faint}}>{capo}</div>
        <button onClick={() => setCapo(c => Math.min(7, c + 1))} aria-label="Capo up" style={{
          background:"transparent", border:`1px solid ${T.line}`, borderRadius:6, color:T.dim,
          width:24, height:24, fontSize:14, cursor:"pointer", lineHeight:1, fontFamily:SANS}}>+</button>
      </div>
      <div style={{fontSize:11.5, color: capo > 0 ? T.dim : T.faint, fontFamily:ITAL, fontStyle:"italic", flex:1, minWidth:150}}>
        {capo > 0
          ? <>sounding <span style={{color:T.text}}>{dn(keyRoot)} {mode}</span> · play <span style={{color:T.amberBright}}>{dn(fingerKey)} {mode}</span> shapes</>
          : "no capo — shapes as written"}
      </div>
    </div>
  );
}

// ── Transport — play, tap tempo, fine-tune ────────────────────────────────────
function Transport({ isPlaying, onPlay, onStop, bpm, setBpm, onTap, tapFlash, hasChords }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
      <button onClick={isPlaying ? onStop : onPlay} disabled={!hasChords} style={{
        background: isPlaying ? "rgba(231,76,60,0.16)" : hasChords ? `linear-gradient(135deg, ${T.amber}, #a8702a)` : "#17140f",
        border: isPlaying ? "1px solid rgba(231,76,60,0.5)" : "none",
        borderRadius:9, color: isPlaying ? "#e88" : hasChords ? "#1a1206" : T.faint,
        padding:"9px 18px", fontSize:13.5, cursor: hasChords ? "pointer" : "not-allowed",
        fontFamily:SERIF, fontWeight:700, letterSpacing:0.5, opacity: hasChords ? 1 : 0.6}}>
        {isPlaying ? "■ Stop" : "▶ Play All"}
      </button>
      <button onPointerDown={onTap} style={{
        background: tapFlash ? T.amberSoft : "rgba(255,255,255,0.04)",
        border: `1px solid ${tapFlash ? T.amberBorder : T.line}`,
        borderRadius:9, color: tapFlash ? T.amberBright : T.dim,
        padding:"9px 16px", fontSize:11.5, cursor:"pointer", fontFamily:SANS,
        letterSpacing:2, fontWeight:600, transition:"all 0.08s", touchAction:"manipulation",
        transform: tapFlash ? "scale(1.05)" : "scale(1)"}}>
        TAP
      </button>
      <div style={{display:"flex", alignItems:"center", gap:5}}>
        <button onClick={() => setBpm(b => Math.max(40, b - 5))} aria-label="Slower" style={{
          background:"transparent", border:`1px solid ${T.line}`, borderRadius:5, color:T.dim,
          width:24, height:24, fontSize:13, cursor:"pointer", lineHeight:1}}>−</button>
        <div style={{fontSize:11.5, color:T.dim, minWidth:52, textAlign:"center", fontFamily:SANS}}>
          <span style={{color:T.text, fontWeight:600}}>{bpm}</span> bpm
        </div>
        <button onClick={() => setBpm(b => Math.min(220, b + 5))} aria-label="Faster" style={{
          background:"transparent", border:`1px solid ${T.line}`, borderRadius:5, color:T.dim,
          width:24, height:24, fontSize:13, cursor:"pointer", lineHeight:1}}>+</button>
      </div>
    </div>
  );
}

// ── Solo Map view windows ─────────────────────────────────────────────────────
const VIEWS = {
  "Open (0–4)":   [0, 4],
  "2nd (2–6)":    [2, 6],
  "5th (4–8)":    [4, 8],
  "7th (7–11)":   [7, 11],
  "Full neck":    [0, MAX_FRET],
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("mood");
  const [tab, setTab] = useState("build"); // build | library | solo | decode
  const [key, setKey] = useState("A");
  const [mode, setMode] = useState("minor");
  const [progression, setProgression] = useState([]);
  const [activeScale, setActiveScale] = useState("Minor Pentatonic");
  const [customKey, setCustomKey] = useState(false);
  const [modalChord, setModalChord] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [capo, setCapo] = useState(0);
  const [bpm, setBpm] = useState(80);
  const [backing, setBacking] = useState({ on:false, mode:"gen", style:"Straight", buffer:null, fileName:null, volume:0.55 });
  const [tapFlash, setTapFlash] = useState(false);
  const [view, setView] = useState("Open (0–4)");
  const [pentaPos, setPentaPos] = useState(0); // 0 = off, 1–5 = CAGED box
  const [layers, setLayers] = useState({ chord:true, scale:true, penta:true, color:false });

  const audioCtxRef = useRef(null);
  const progRef = useRef(progression);
  const bpmRef = useRef(bpm);
  const backingRef = useRef(backing);
  const backingVolRef = useRef(0.55);
  const tapsRef = useRef([]);

  useEffect(() => { progRef.current = progression; }, [progression]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { backingRef.current = backing; }, [backing]);

  const { isPlaying, play, stop, currentIdx, currentBeat, setBackingVolume } =
    usePlaybackEngine(audioCtxRef, progRef, bpmRef, backingRef, backingVolRef);

  const chords = getChordsInKey(key, mode);

  const startBeats = useMemo(() => {
    let acc = 0;
    return progression.map(c => { const s = acc; acc += (c.bars || 2) * 4; return s; });
  }, [progression]);

  // Active chord for Solo Map — follows playback, else the selected block
  const activeIdx = progression.length === 0 ? -1
    : (isPlaying && currentIdx >= 0 ? currentIdx : Math.min(selectedIdx, progression.length - 1));
  const activeChord = activeIdx >= 0 ? progression[activeIdx] : null;
  const currentChordName = activeChord?.playName || activeChord?.displayName || activeChord?.name || null;
  const currentChordTones = currentChordName ? getChordTones(currentChordName) : [];
  const currentChordRoot  = currentChordName ? getChordRoot(currentChordName) : null;

  // ── progression edits ──
  const addChord = (chord, nameOverride) => {
    if (progression.length >= 8) return;
    const playName = nameOverride || chord.displayName || chord.name;
    setProgression(p => [...p, { ...chord, displayName: playName, playName, bars: 2 }]);
  };
  const addSpiced = (name, baseChord) => addChord(baseChord, name);
  const removeChord = (i) => {
    stop();
    setProgression(p => p.filter((_, x) => x !== i));
    setSelectedIdx(s => Math.max(0, s >= i ? s - 1 : s));
  };
  const cycleBars = (i) =>
    setProgression(p => p.map((c, x) => x === i ? { ...c, bars: c.bars === 1 ? 2 : c.bars === 2 ? 4 : 1 } : c));

  const loadCommonProgression = (prog) => {
    const baseChords = getChordsInKey(key, prog.mode === mode ? mode : prog.mode);
    const newProg = prog.degrees.map(d => {
      const base = baseChords[d % baseChords.length];
      return { ...base, displayName: base?.name, playName: base?.name, bars: 2 };
    });
    stop();
    setProgression(newProg);
    if (prog.mode !== mode) setMode(prog.mode);
    setSelectedIdx(0);
    setTab("build");
  };

  const selectMood = (mood) => {
    stop();
    setKey(mood.key); setMode(mood.mode);
    setProgression([]); setScreen("build");
    setActiveScale(mood.mode === "minor" ? "Minor Pentatonic" : "Major Pentatonic");
    setSelectedIdx(0); setPentaPos(0);
    setTab("build");
  };

  // ── tap tempo ──
  const handleTap = () => {
    const now = performance.now();
    const taps = tapsRef.current;
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 6) taps.shift();
    if (taps.length >= 2) {
      const diffs = taps.slice(1).map((t, i) => t - taps[i]);
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      setBpm(Math.max(40, Math.min(220, Math.round(60000 / avg))));
    }
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 130);
  };

  const onVolume = (v) => setBackingVolume(v);

  // ── decode handoffs ──
  const applyDecode = (result) => {
    stop();
    setKey(result.key); setMode(result.mode);
    const diatonic = getChordsInKey(result.key, result.mode);
    const newProg = result.perChord.slice(0, 8).map(c => {
      if (c.deg >= 0) {
        const base = diatonic[c.deg];
        return { ...base, displayName: c.token, playName: c.token, bars: 2 };
      }
      return { name: c.token, root: c.root,
        quality: c.triad === "min" ? "min" : c.triad === "dim" ? "dim" : "maj",
        numeral: "—", role: "Borrowed", feel: "outside the key — the spice", degree: -1,
        displayName: c.token, playName: c.token, bars: 2 };
    });
    setProgression(newProg);
    setActiveScale(result.mode === "minor" ? "Minor Pentatonic" : "Major Pentatonic");
    setSelectedIdx(0); setPentaPos(0);
    setTab("build");
  };
  const soloScaleFromDecode = (root, kmode, scaleName) => {
    setKey(root); setMode(kmode);
    setActiveScale(scaleName || (kmode === "minor" ? "Minor Pentatonic" : "Major Pentatonic"));
    setPentaPos(0);
    setTab("solo");
  };

  // ── solo map derivations ──
  const scaleNotes = getScaleNotes(key, mode);
  const pentaNotes = getPentaNotes(key, activeScale);
  const boxData = pentaPos > 0 ? getPentaBox(getNoteIdx(key), boxTypeForScale(activeScale), pentaPos - 1) : null;
  const fretWindow = boxData
    ? [Math.max(0, boxData.min - 1), Math.min(MAX_FRET, boxData.max + 1)]
    : VIEWS[view];
  const grid = getLayeredFretboard(scaleNotes, pentaNotes, currentChordTones, currentChordRoot);
  const scaleLabel = `${dn(key)} ${mode === "major" ? "Ionian" : "Aeolian"}`;
  const pentaLabel = `${dn(key)} ${activeScale}`;
  const boxRootStrings = boxData ? [...new Set(boxData.rootCells.map(c => STRING_NAMES[c.s]))].join(" & ") : "";
  const tip = currentChordName ? scaleTipFor(currentChordName) : null;

  return (
    <div style={{minHeight:"100vh", background:T.bg, fontFamily:SANS, color:T.text, paddingBottom:64}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        button{font-family:inherit}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#2a2620;border-radius:3px}
        button:focus-visible, input:focus-visible{outline:2px solid ${T.amber};outline-offset:2px}
        input[type=range]{-webkit-appearance:none;appearance:none;height:3px;background:#2a2620;border-radius:2px}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;border-radius:50%;background:${T.amber};cursor:pointer;border:none}
        input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:${T.amber};cursor:pointer;border:none}
        @media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important}}
      `}</style>

      {/* ── Header ── */}
      <div style={{padding:"22px 20px 14px", borderBottom:`1px solid ${T.lineSoft}`,
        background:`linear-gradient(180deg, rgba(217,154,61,0.06) 0%, transparent 100%)`}}>
        <div style={{fontSize:9.5, letterSpacing:4, color:T.amber, textTransform:"uppercase", marginBottom:4, fontFamily:SANS, fontWeight:600}}>
          Guitar practice &amp; theory
        </div>
        <div style={{fontFamily:SERIF, fontSize:28, fontWeight:900, lineHeight:1.08,
          background:`linear-gradient(135deg, ${T.text} 30%, ${T.amber})`,
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"}}>
          The Woodshed
        </div>
        <div style={{width:64, height:3, marginTop:7, borderRadius:2,
          background:`repeating-linear-gradient(90deg, ${T.amber} 0 6px, rgba(217,154,61,0.25) 6px 9px)`}}/>
        {screen === "build" && (
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10}}>
            <div style={{fontSize:12.5, color:T.dim, fontStyle:"italic", fontFamily:ITAL}}>{dn(key)} {mode}</div>
            <button onClick={() => { stop(); setScreen("mood"); setProgression([]); }} style={{
              background:"transparent", border:`1px solid ${T.line}`, borderRadius:6, color:T.faint,
              padding:"4px 10px", fontSize:11, cursor:"pointer"}}>
              ← Change key
            </button>
          </div>
        )}
      </div>

      <div style={{padding:"0 20px", maxWidth:760, margin:"0 auto"}}>

        {/* ── MOOD SCREEN ── */}
        {screen === "mood" && (
          <div style={{marginTop:24}}>
            <div style={{fontFamily:SERIF, fontSize:20, fontWeight:700, marginBottom:4}}>What mood are you going for?</div>
            <div style={{fontSize:13, color:T.faint, marginBottom:18, fontStyle:"italic", fontFamily:ITAL}}>Pick a vibe or choose your own key below.</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:16}}>
              {MOODS.map(m => (
                <button key={m.label} onClick={() => selectMood(m)} style={{
                  background:T.card, border:`1px solid rgba(255,255,255,0.07)`,
                  borderRadius:12, padding:"13px 11px", color:T.text, textAlign:"left", cursor:"pointer"}}>
                  <div style={{fontSize:20, marginBottom:3}}>{m.emoji}</div>
                  <div style={{fontFamily:SERIF, fontSize:13, fontWeight:700}}>{m.label}</div>
                  <div style={{fontSize:11, color:T.faint, marginTop:1}}>{dn(m.key)} {m.mode}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setCustomKey(!customKey)} style={{
              width:"100%", padding:"11px 0", background:T.card, border:`1px solid ${T.lineSoft}`,
              borderRadius:10, color:T.dim, fontSize:13, cursor:"pointer"}}>
              {customKey ? "▾" : "▸"} Choose any key manually
            </button>
            {customKey && (
              <div style={{marginTop:10, background:"rgba(255,255,255,0.02)", borderRadius:10, padding:14, border:`1px solid ${T.lineSoft}`}}>
                <div style={{fontSize:10, color:T.faint, letterSpacing:2, textTransform:"uppercase", marginBottom:8}}>Key</div>
                <div style={{display:"flex", flexWrap:"wrap", gap:6, marginBottom:12}}>
                  {ALL_KEYS.map(n => (
                    <button key={n} onClick={() => setKey(n)} style={{
                      padding:"5px 11px", borderRadius:7, border:`1px solid ${key === n ? T.amber : T.lineSoft}`,
                      background: key === n ? T.amberSoft : "rgba(255,255,255,0.02)",
                      color: key === n ? T.text : T.faint, fontSize:13, cursor:"pointer",
                      fontFamily:SERIF, fontWeight:700}}>{dn(n)}</button>
                  ))}
                </div>
                <div style={{fontSize:10, color:T.faint, letterSpacing:2, textTransform:"uppercase", marginBottom:8}}>Mode</div>
                <div style={{display:"flex", gap:8, marginBottom:12}}>
                  {["major","minor"].map(m => (
                    <button key={m} onClick={() => setMode(m)} style={{
                      flex:1, padding:"8px 0", borderRadius:8, border:`1px solid ${mode === m ? T.amber : T.lineSoft}`,
                      background: mode === m ? T.amberSoft : "rgba(255,255,255,0.02)",
                      color: mode === m ? T.text : T.faint, fontSize:13, cursor:"pointer",
                      fontFamily:SERIF, fontWeight:700, textTransform:"capitalize"}}>{m}</button>
                  ))}
                </div>
                <button onClick={() => { setProgression([]); setScreen("build"); setActiveScale(mode === "minor" ? "Minor Pentatonic" : "Major Pentatonic"); setTab("build"); }} style={{
                  width:"100%", padding:"11px 0", background:`linear-gradient(135deg, ${T.amber}, #a8702a)`,
                  border:"none", borderRadius:9, color:"#1a1206", fontSize:14, fontWeight:700,
                  fontFamily:SERIF, cursor:"pointer", letterSpacing:1}}>Go → {dn(key)} {mode}</button>
              </div>
            )}
          </div>
        )}

        {/* ── BUILD SCREEN ── */}
        {screen === "build" && (
          <div style={{marginTop:14}}>

            {/* Capo */}
            <div style={{marginBottom:10}}>
              <CapoStrip capo={capo} setCapo={setCapo} keyRoot={key} mode={mode}/>
            </div>

            {/* Timeline */}
            <div style={{marginBottom:10}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:7}}>
                <div style={{fontSize:9.5, letterSpacing:3, color:T.faint, textTransform:"uppercase"}}>Timeline</div>
                {progression.length > 0 && (
                  <div style={{fontSize:10, color:T.faint, fontFamily:ITAL, fontStyle:"italic"}}>
                    tap a block to preview · tap again for shapes · tap bars to resize
                  </div>
                )}
              </div>
              <ChordTimeline
                progression={progression} currentIdx={currentIdx} currentBeat={currentBeat}
                startBeats={startBeats} isPlaying={isPlaying}
                selectedIdx={activeIdx} onSelect={setSelectedIdx}
                onOpen={(ch) => setModalChord(ch)}
                onCycleBars={cycleBars} onRemove={removeChord} capo={capo}/>
            </div>

            {/* Transport */}
            <div style={{marginBottom:10}}>
              <Transport isPlaying={isPlaying} onPlay={play} onStop={stop}
                bpm={bpm} setBpm={setBpm} onTap={handleTap} tapFlash={tapFlash}
                hasChords={progression.length > 0}/>
            </div>

            {/* Backing track */}
            <div style={{marginBottom:16}}>
              <BackingPanel backing={backing} setBacking={setBacking}
                onVolume={onVolume} audioCtxRef={audioCtxRef} isPlaying={isPlaying}/>
            </div>

            {/* Tabs */}
            <div style={{display:"flex", gap:0, marginBottom:18, background:T.card, borderRadius:10, padding:3, border:`1px solid ${T.lineSoft}`}}>
              {[{id:"build",label:"Build"},{id:"library",label:"Library"},{id:"solo",label:"Solo Map"},{id:"decode",label:"Decode"}].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  flex:1, padding:"9px 0", borderRadius:8, border:"none",
                  background: tab === t.id ? T.amberSoft : "transparent",
                  color: tab === t.id ? T.amberBright : T.faint,
                  fontSize:12.5, cursor:"pointer", fontWeight: tab === t.id ? 600 : 400,
                  transition:"all 0.15s", fontFamily:SANS}}>{t.label}</button>
              ))}
            </div>

            {/* ── TAB: BUILD ── */}
            {tab === "build" && (
              <>
                <div style={{fontSize:9.5, letterSpacing:3, color:T.faint, textTransform:"uppercase", marginBottom:10}}>
                  {dn(key)} {mode} · ▶ hear it · ⬡ shapes &amp; spice · + add to timeline
                </div>
                {chords.map(chord => {
                  const colors = qColors(chord.quality);
                  const variants = EXT_VARIANTS[chord.quality] || [chord.quality];
                  return (
                    <div key={chord.name} style={{border:`1px solid ${colors.border}`, borderRadius:10, overflow:"hidden", marginBottom:7}}>
                      <div style={{background:colors.bg, padding:"10px 12px", display:"flex", alignItems:"center", gap:8}}>
                        <div style={{width:7, height:7, borderRadius:"50%", background:colors.dot, flexShrink:0}}/>
                        <div style={{minWidth:70}}>
                          <span style={{fontFamily:SERIF, fontSize:16, fontWeight:700}}>{dn(chord.root)}{chord.quality === "min" ? "m" : chord.quality === "dim" ? "dim" : ""}</span>
                          <span style={{fontSize:10, color:T.faint, marginLeft:5}}>{chord.numeral}</span>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11, color:T.dim, fontWeight:600}}>{chord.role}</div>
                          <div style={{fontSize:11, color:T.faint, fontStyle:"italic", fontFamily:ITAL}}>{chord.feel}</div>
                        </div>
                        <div style={{display:"flex", gap:5}}>
                          <button onClick={() => playChord(chord.name, audioCtxRef)} style={{
                            background:"rgba(255,255,255,0.07)", border:`1px solid ${colors.border}`, borderRadius:7,
                            color:colors.dot, width:30, height:30, fontSize:13, cursor:"pointer"}}>▶</button>
                          <button onClick={() => setModalChord(chord)} style={{
                            background:"rgba(255,255,255,0.07)", border:`1px solid ${colors.border}`, borderRadius:7,
                            color:T.dim, width:30, height:30, fontSize:12, cursor:"pointer"}}>⬡</button>
                          <button onClick={() => addChord(chord)} style={{
                            background:colors.dot, border:"none", borderRadius:7,
                            color:"#fff", width:30, height:30, fontSize:18, cursor:"pointer"}}>+</button>
                        </div>
                      </div>
                      {/* Mini variant row */}
                      <div style={{background:"rgba(0,0,0,0.25)", padding:"7px 12px", display:"flex", gap:5, flexWrap:"wrap", borderTop:`1px solid ${colors.border}`}}>
                        {variants.slice(1).map(v => {
                          const vName = getVarName(chord.root, chord.quality, v);
                          return (
                            <button key={v} onClick={() => addChord(chord, vName)} style={{
                              background:"rgba(255,255,255,0.04)", border:`1px solid ${colors.border}`, borderRadius:6,
                              padding:"3px 9px", color:T.dim, fontSize:12, cursor:"pointer"}}>
                              <span style={{fontFamily:SERIF, fontWeight:700}}>{vName}</span>
                              <span style={{fontSize:10, color:T.faint, marginLeft:5}}>{VARIANT_FEEL[v]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <AIAnalysis progression={progression} root={key} mode={mode}/>
              </>
            )}

            {/* ── TAB: LIBRARY ── */}
            {tab === "library" && (
              <div>
                <div style={{fontSize:13, color:T.faint, fontStyle:"italic", fontFamily:ITAL, marginBottom:16}}>
                  Classic progressions adapted to {dn(key)} {mode}. Tap to load.
                </div>
                {COMMON_PROGRESSIONS.map((prog, i) => (
                  <button key={i} onClick={() => loadCommonProgression(prog)} style={{
                    width:"100%", background:T.card, border:`1px solid ${T.lineSoft}`,
                    borderRadius:10, padding:"12px 14px", marginBottom:8, cursor:"pointer", textAlign:"left", color:T.text}}>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8}}>
                      <div>
                        <div style={{fontFamily:SERIF, fontSize:15, fontWeight:700, marginBottom:2}}>{prog.name}</div>
                        <div style={{fontSize:12, color:T.dim, fontStyle:"italic", fontFamily:ITAL, marginBottom:4}}>{prog.desc}</div>
                        <div style={{fontSize:11, color:T.faint}}>e.g. {prog.examples}</div>
                      </div>
                      <div style={{background:T.amberSoft, border:`1px solid ${T.amberBorder}`, borderRadius:6,
                        padding:"4px 10px", fontSize:11, color:T.amberBright, flexShrink:0}}>
                        Load
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ── TAB: SOLO MAP ── */}
            {tab === "solo" && (
              <div>
                {/* Active chord */}
                <div style={{background:"rgba(217,222,125,0.06)", border:"1px solid rgba(217,222,125,0.18)",
                  borderRadius:10, padding:"10px 14px", marginBottom:6,
                  display:"flex", alignItems:"center", justifyContent:"space-between", gap:10}}>
                  <div>
                    <div style={{fontSize:9.5, color:T.faint, letterSpacing:2.5, textTransform:"uppercase", marginBottom:2}}>Active chord</div>
                    <div style={{fontFamily:SERIF, fontSize:22, fontWeight:900, color: currentChordName ? T.chord : T.faint}}>
                      {currentChordName || "—"}
                    </div>
                    {currentChordTones.length > 0 && (
                      <div style={{fontSize:11, color:T.dim, marginTop:2}}>
                        Tones: {currentChordTones.map(dn).join(" · ")}
                      </div>
                    )}
                  </div>
                  <div style={{fontSize:11, color:T.faint, textAlign:"right", fontStyle:"italic", fontFamily:ITAL, maxWidth:150}}>
                    {currentChordName
                      ? (isPlaying ? "following playback" : "from the timeline — hit Play to watch it move")
                      : "add chords in Build and they'll light up here"}
                  </div>
                </div>
                {tip && (
                  <div style={{fontSize:12, color:T.dim, fontFamily:ITAL, fontStyle:"italic", margin:"0 2px 12px"}}>
                    Over <span style={{color:T.chord, fontStyle:"normal", fontFamily:SERIF, fontWeight:700}}>{currentChordName}</span>
                    <span style={{color:T.amber}}> → </span>{tip}
                  </div>
                )}

                {/* Scale overlay */}
                <div style={{fontSize:9.5, letterSpacing:3, color:T.faint, textTransform:"uppercase", marginBottom:8}}>Scale overlay</div>
                <div style={{display:"flex", flexWrap:"wrap", gap:5, marginBottom:12}}>
                  {Object.keys(PENTA_INTERVALS).map(s => (
                    <button key={s} onClick={() => setActiveScale(s)} style={{
                      padding:"4px 10px", borderRadius:6, fontSize:11,
                      border:`1px solid ${activeScale === s ? T.penta : T.lineSoft}`,
                      background: activeScale === s ? "rgba(100,148,216,0.14)" : "rgba(255,255,255,0.02)",
                      color: activeScale === s ? T.penta : T.faint, cursor:"pointer"}}>{s}</button>
                  ))}
                </div>

                {/* View window */}
                <div style={{fontSize:9.5, letterSpacing:3, color:T.faint, textTransform:"uppercase", marginBottom:8}}>View</div>
                <div style={{display:"flex", flexWrap:"wrap", gap:5, marginBottom:10}}>
                  {Object.keys(VIEWS).map(p => (
                    <button key={p} onClick={() => { setView(p); setPentaPos(0); }} style={{
                      padding:"4px 10px", borderRadius:6, fontSize:11,
                      border:`1px solid ${(!boxData && view === p) ? T.amber : T.lineSoft}`,
                      background: (!boxData && view === p) ? T.amberSoft : "rgba(255,255,255,0.02)",
                      color: (!boxData && view === p) ? T.amberBright : T.faint, cursor:"pointer"}}>{p}</button>
                  ))}
                </div>

                {/* CAGED pentatonic boxes */}
                <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap"}}>
                  <div style={{fontSize:9.5, letterSpacing:3, color:T.faint, textTransform:"uppercase"}}>Penta box</div>
                  <div style={{display:"flex", gap:5}}>
                    {[0,1,2,3,4,5].map(p => (
                      <button key={p} onClick={() => setPentaPos(p)} style={{
                        width: p === 0 ? "auto" : 30, padding: p === 0 ? "4px 10px" : "4px 0",
                        borderRadius:6, fontSize:11,
                        border:`1px solid ${pentaPos === p ? T.penta : T.lineSoft}`,
                        background: pentaPos === p ? "rgba(100,148,216,0.16)" : "rgba(255,255,255,0.02)",
                        color: pentaPos === p ? "#9dbdf0" : T.faint, cursor:"pointer", fontWeight: pentaPos === p ? 600 : 400}}>
                        {p === 0 ? "Off" : p}
                      </button>
                    ))}
                  </div>
                </div>
                {boxData && (
                  <div style={{fontSize:11.5, color:T.dim, fontFamily:ITAL, fontStyle:"italic", marginBottom:10}}>
                    Position {pentaPos} · frets {boxData.min}–{boxData.max} · root on the {boxRootStrings} string{boxRootStrings.includes("&") ? "s" : ""} — ringed in blue
                  </div>
                )}

                <WoodFretboard
                  grid={grid} layers={layers}
                  onToggleLayer={(k) => setLayers(l => ({ ...l, [k]: !l[k] }))}
                  fretWindow={fretWindow} boxData={boxData} capo={capo}
                  chordName={currentChordName} scaleLabel={scaleLabel} pentaLabel={pentaLabel}
                  audioCtxRef={audioCtxRef}/>
              </div>
            )}

            {/* ── TAB: DECODE ── */}
            {tab === "decode" && (
              <DecodeTab audioCtxRef={audioCtxRef} onApply={applyDecode} onSoloScale={soloScaleFromDecode}/>
            )}
          </div>
        )}
      </div>

      {/* Spice modal */}
      {modalChord && (
        <SpiceModal chord={modalChord} capo={capo}
          onClose={() => setModalChord(null)} onAdd={addSpiced} audioCtxRef={audioCtxRef}/>
      )}
    </div>
  );
}

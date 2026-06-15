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

// ── Free Play browser data ─────────────────────────────────────────────────────
const FREE_PLAY_NOTES = [
  {display:"A",  internal:"A"},   {display:"Bb", internal:"A#"},
  {display:"B",  internal:"B"},   {display:"C",  internal:"C"},
  {display:"C#", internal:"C#"},  {display:"D",  internal:"D"},
  {display:"Eb", internal:"D#"},  {display:"E",  internal:"E"},
  {display:"F",  internal:"F"},   {display:"F#", internal:"F#"},
  {display:"G",  internal:"G"},   {display:"Ab", internal:"G#"},
];
const FREE_PLAY_VARIANT_GROUPS = [
  { label:"Major family", variants:[
    {v:"maj",   feel:"Solid, direct"},
    {v:"maj7",  feel:"Dreamy, sophisticated"},
    {v:"add9",  feel:"Airy, modern"},
    {v:"6",     feel:"Sweet, vintage"},
    {v:"maj9",  feel:"Lush, open"},
    {v:"sus2",  feel:"Floating, unresolved"},
    {v:"sus4",  feel:"Suspenseful"},
    {v:"7",     feel:"Bluesy, restless"},
    {v:"9",     feel:"Funky, widescreen"},
    {v:"aug",   feel:"Film noir, unsettled"},
  ]},
  { label:"Minor family", variants:[
    {v:"min",   feel:"Melancholic"},
    {v:"m7",    feel:"Smooth, jazzy"},
    {v:"m9",    feel:"Rich, emotional"},
    {v:"madd9", feel:"Haunting"},
    {v:"msus2", feel:"Ethereal"},
  ]},
  { label:"Diminished", variants:[
    {v:"dim",   feel:"Tense"},
    {v:"dim7",  feel:"Very dramatic"},
    {v:"m7b5",  feel:"Dark, jazzy"},
  ]},
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

// ── Progression Generator Data ───────────────────────────────────────────────

const PROG_GENRES = [
  { id:"Blues",    label:"Blues",    desc:"I–IV–V backbone with b7 grit",
    major:[ [0,3,4], [0,3,0,4], [0,3,4,3], [0,0,3,4] ],
    minor:[ [0,3,4], [0,3,0,4], [0,6,3,4] ] },
  { id:"Rock",     label:"Rock",     desc:"Riff-ready power chord territory",
    major:[ [0,4,5,3], [0,3,4], [0,5,3,4], [0,3,5,4] ],
    minor:[ [0,6,5,4], [0,6,5,6], [0,3,4], [0,2,5,6] ] },
  { id:"Country",  label:"Country",  desc:"Twangy Nashville I–IV–V",
    major:[ [0,3,4], [0,5,3,4], [0,3,4,3], [1,4,0,3] ],
    minor:[ [0,3,4], [0,6,3,4] ] },
  { id:"Grunge",   label:"Grunge",   desc:"Heavy borrowed chord weight",
    major:[ [0,-1,-2], [0,-1,3,-2], [0,5,-1,3], [0,3,-1,-2] ],
    minor:[ [0,6,5,4], [0,2,5,6], [0,6,5,6], [0,3,6,5] ] },
  { id:"Alt-Rock", label:"Alt-Rock", desc:"Unexpected emotional turns",
    major:[ [0,5,3,4], [0,-1,-2,3], [0,2,5,4], [0,3,-1,4] ],
    minor:[ [0,5,2,6], [0,6,5,4], [0,3,6], [0,2,6,5] ] },
  { id:"Ambient",  label:"Ambient",  desc:"Floating spacious landscapes",
    major:[ [0,4,3], [0,5,3,4], [0,2,4,3], [3,0,5,4] ],
    minor:[ [0,5,6], [0,5,2,6], [0,6,5], [0,2,6,5] ] },
  { id:"Jazz",     label:"Jazz",     desc:"ii–V–I vocabulary and extensions",
    major:[ [1,4,0], [1,4,0,5], [5,1,4,0], [0,5,1,4] ],
    minor:[ [3,1,4,0], [0,5,1,4], [0,6,3,4], [3,6,0,4] ] },
  { id:"Pop",      label:"Pop",      desc:"Catchy crowd-pleasing hooks",
    major:[ [0,4,5,3], [0,3,5,4], [5,3,0,4], [0,5,3,4] ],
    minor:[ [0,5,6], [0,5,2,6], [0,6,3,5], [0,3,5,6] ] },
];

const PROG_MOODS = [
  { id:"Dark",        label:"Dark",        templatePref:[0,2] },
  { id:"Uplifting",   label:"Uplifting",   templatePref:[0,1] },
  { id:"Tense",       label:"Tense",       templatePref:[1,2] },
  { id:"Melancholic", label:"Melancholic", templatePref:[0,1] },
  { id:"Anthemic",    label:"Anthemic",    templatePref:[0,3] },
  { id:"Chill",       label:"Chill",       templatePref:[1,2] },
];

// ── Progression of the Day ────────────────────────────────────────────────────
const POTD_VIBES = {
  "Blues:Dark":         "Midnight Delta Blues",
  "Blues:Uplifting":    "Soul Revival",
  "Blues:Tense":        "Two A.M. Highway",
  "Blues:Melancholic":  "Weeping Bottleneck",
  "Blues:Anthemic":     "Floodwater Gospel",
  "Blues:Chill":        "Front Porch Blues",
  "Rock:Dark":          "Descending Into the Riff",
  "Rock:Uplifting":     "Hands in the Air",
  "Rock:Tense":         "Before the Storm Breaks",
  "Rock:Melancholic":   "Fading Distortion",
  "Rock:Anthemic":      "Arena-Ready Anthem",
  "Rock:Chill":         "Sunday Afternoon Power Chords",
  "Country:Dark":       "Broken Down South",
  "Country:Uplifting":  "Wide Open Road",
  "Country:Tense":      "Dust Storm Rising",
  "Country:Melancholic":"Old Town Goodbye",
  "Country:Anthemic":   "Hometown Hero",
  "Country:Chill":      "Porch Sunset Strum",
  "Grunge:Dark":        "Pacific Northwest Gloom",
  "Grunge:Uplifting":   "Breaking Through the Haze",
  "Grunge:Tense":       "Coiled & Ready to Snap",
  "Grunge:Melancholic": "Everything Hurts & That's OK",
  "Grunge:Anthemic":    "Loud & Alive",
  "Grunge:Chill":       "Flannel & Coffee",
  "Alt-Rock:Dark":      "Neon Signs & Rain",
  "Alt-Rock:Uplifting": "Running From Something Good",
  "Alt-Rock:Tense":     "Static on the Line",
  "Alt-Rock:Melancholic":"Driving Nowhere in Particular",
  "Alt-Rock:Anthemic":  "The Moment Everything Changed",
  "Alt-Rock:Chill":     "Late Night Drive",
  "Ambient:Dark":       "Submerged",
  "Ambient:Uplifting":  "First Light Through the Blinds",
  "Ambient:Tense":      "The Space Between Thoughts",
  "Ambient:Melancholic":"Something You Almost Remembered",
  "Ambient:Anthemic":   "Expanding Into It",
  "Ambient:Chill":      "Drifting on a Saturday",
  "Jazz:Dark":          "Smoke & Minor Seconds",
  "Jazz:Uplifting":     "Blue Sky Changes",
  "Jazz:Tense":         "Tritone Substitution Blues",
  "Jazz:Melancholic":   "Ballad for a Rainy November",
  "Jazz:Anthemic":      "The Big Band Feeling",
  "Jazz:Chill":         "After Hours at the Club",
  "Pop:Dark":           "Sad Song in a Major Key",
  "Pop:Uplifting":      "Radio-Ready Summer",
  "Pop:Tense":          "The Bridge Before the Drop",
  "Pop:Melancholic":    "Nostalgia Bait",
  "Pop:Anthemic":       "Lighter in the Air",
  "Pop:Chill":          "Weekend Mood",
};

function dateSeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededRand(seed) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = (s ^ (s >>> 16)) >>> 0;
    return s / 0xffffffff;
  };
}

function generatePOTDProgression(seed) {
  const r = seededRand(seed);
  const keyRoot = NOTES[Math.floor(r() * 12)];
  const mode = r() < 0.5 ? "major" : "minor";
  const genrePool = ["Blues","Rock","Rock","Country","Grunge","Alt-Rock","Alt-Rock","Ambient","Jazz","Jazz","Pop","Pop"];
  const genreId = genrePool[Math.floor(r() * genrePool.length)];
  const moodId = PROG_MOODS[Math.floor(r() * PROG_MOODS.length)].id;
  const complexityRoll = r();
  const complexity = complexityRoll < 0.5 ? "simple" : complexityRoll < 0.85 ? "intermediate" : "advanced";
  const genreData = PROG_GENRES.find(g => g.id === genreId);
  const moodData = PROG_MOODS.find(m => m.id === moodId);
  const templates = genreData[mode] || genreData.major;
  const biasPref = moodData?.templatePref || [];
  const biasedPool = biasPref.map(i => templates[i % templates.length]).filter(Boolean);
  const pool = (r() < 0.35 || !biasedPool.length) ? templates : biasedPool;
  const template = pool[Math.floor(r() * pool.length)];
  const diatonic = getChordsInKey(keyRoot, mode);
  const progression = template.map(deg => {
    const chord = deg >= 0
      ? { ...diatonic[deg % diatonic.length] }
      : (getBorrowedChord(keyRoot, mode, deg) || { ...diatonic[0] });
    const variant = pickComplexityVariant(chord.quality, chord.degree, genreId, complexity, r());
    const displayName = variant ? getVarName(chord.root, chord.quality, variant) : chord.name;
    return { ...chord, displayName, playName: displayName, bars: 2 };
  });
  return { progression, genreId, moodId, keyRoot, mode };
}

// ── Suggestion Templates ──────────────────────────────────────────────────────
// Keyed by mode → startingDegree → array of {label, tag, degrees[]}
// degrees[] starts with the starting chord's degree, followed by continuations
// negative = borrowed: -1=♭VII, -2=♭VI, -3=♭III

const TAG_COLORS = {
  Pop:        {bg:"rgba(85,130,185,0.11)",  border:"rgba(85,130,185,0.32)",  text:"#7aa0c4"},
  Rock:       {bg:"rgba(175,70,55,0.12)",   border:"rgba(175,70,55,0.35)",   text:"#c06858"},
  Blues:      {bg:"rgba(38,148,142,0.11)",  border:"rgba(38,148,142,0.32)",  text:"#3a9e9a"},
  Jazz:       {bg:"rgba(112,52,78,0.14)",   border:"rgba(112,52,78,0.36)",   text:"#9a6275"},
  Country:    {bg:"rgba(195,138,50,0.11)",  border:"rgba(195,138,50,0.35)",  text:"#c9913a"},
  Cinematic:  {bg:"rgba(95,88,78,0.14)",    border:"rgba(95,88,78,0.36)",    text:"#857a6c"},
  Melancholic:{bg:"rgba(82,80,148,0.12)",   border:"rgba(82,80,148,0.33)",   text:"#8280b8"},
  Dark:       {bg:"rgba(95,38,38,0.16)",    border:"rgba(148,52,52,0.34)",   text:"#a86060"},
  "Alt-Rock": {bg:"rgba(172,95,40,0.12)",   border:"rgba(172,95,40,0.34)",   text:"#b87840"},
  Ambient:    {bg:"rgba(48,142,162,0.10)",  border:"rgba(48,142,162,0.30)",  text:"#48a0b8"},
  Classical:  {bg:"rgba(178,148,48,0.12)",  border:"rgba(178,148,48,0.34)",  text:"#b09030"},
  Nostalgic:  {bg:"rgba(162,122,68,0.13)",  border:"rgba(162,122,68,0.34)",  text:"#a88050"},
  Grunge:     {bg:"rgba(88,84,68,0.15)",    border:"rgba(118,112,88,0.34)",  text:"#888068"},
  Gospel:     {bg:"rgba(192,158,28,0.12)",  border:"rgba(192,158,28,0.34)",  text:"#c09818"},
  Tense:      {bg:"rgba(148,50,40,0.13)",   border:"rgba(148,50,40,0.35)",   text:"#b05850"},
  Flamenco:   {bg:"rgba(162,68,18,0.13)",   border:"rgba(162,68,18,0.35)",   text:"#b86828"},
};

const SUGGESTION_TEMPLATES = {
  major: {
    0: [
      { label:"Classic Hit",        tag:"Pop",        degrees:[0,4,5,3] },
      { label:"Country Hook",       tag:"Country",    degrees:[0,3,4] },
      { label:"50s Nostalgic",      tag:"Nostalgic",  degrees:[0,5,3,4] },
      { label:"Jazz Circle",        tag:"Jazz",       degrees:[0,5,1,4] },
      { label:"Borrowed Power",     tag:"Grunge",     degrees:[0,-1,-2] },
    ],
    1: [
      { label:"ii–V–I",             tag:"Jazz",       degrees:[1,4,0] },
      { label:"Verse to Chorus",    tag:"Pop",        degrees:[1,4,5,3] },
      { label:"Gospel Move",        tag:"Gospel",     degrees:[1,3,4,0] },
      { label:"Melancholic Drop",   tag:"Melancholic",degrees:[1,5,3,0] },
      { label:"Alt-Rock Drift",     tag:"Alt-Rock",   degrees:[1,5,0,4] },
    ],
    2: [
      { label:"Descending 3rds",    tag:"Classical",  degrees:[2,1,0,4] },
      { label:"Circle of 5ths",     tag:"Jazz",       degrees:[2,5,1,4] },
      { label:"Bittersweet",        tag:"Melancholic",degrees:[2,5,3,0] },
      { label:"Country Build",      tag:"Country",    degrees:[2,3,4,0] },
      { label:"Alt Motion",         tag:"Alt-Rock",   degrees:[2,5,0,3] },
    ],
    3: [
      { label:"Classic Lift",       tag:"Rock",       degrees:[3,4,0] },
      { label:"Country Loop",       tag:"Country",    degrees:[3,0,4,0] },
      { label:"Gospel Resolve",     tag:"Gospel",     degrees:[3,4,5,0] },
      { label:"Anthemic Chorus",    tag:"Pop",        degrees:[3,0,5,4] },
      { label:"Borrowed Grit",      tag:"Grunge",     degrees:[3,-2,-1,0] },
    ],
    4: [
      { label:"Strong Resolution",  tag:"Classical",  degrees:[4,0] },
      { label:"Deceptive Cadence",  tag:"Cinematic",  degrees:[4,5,3,0] },
      { label:"Country Resolve",    tag:"Country",    degrees:[4,0,3,4] },
      { label:"Looping Anthem",     tag:"Rock",       degrees:[4,0,5,3] },
      { label:"Jazz Return",        tag:"Jazz",       degrees:[4,0,5,1] },
    ],
    5: [
      { label:"Indie Classic",      tag:"Pop",        degrees:[5,3,0,4] },
      { label:"Melancholic Fall",   tag:"Melancholic",degrees:[5,3,4,0] },
      { label:"Circle Descent",     tag:"Cinematic",  degrees:[5,1,4,0] },
      { label:"Brooding Verse",     tag:"Alt-Rock",   degrees:[5,2,1,4] },
      { label:"Anthemic Shift",     tag:"Rock",       degrees:[5,4,3,4] },
    ],
    6: [
      { label:"Strong Resolve",     tag:"Classical",  degrees:[6,0] },
      { label:"Dramatic Arc",       tag:"Cinematic",  degrees:[6,0,5,3] },
      { label:"Jazz Diminished",    tag:"Jazz",       degrees:[6,0,1,4] },
      { label:"Dark Resolve",       tag:"Dark",       degrees:[6,5,4,0] },
      { label:"Baroque Line",       tag:"Classical",  degrees:[6,0,4,5] },
    ],
  },
  minor: {
    0: [
      { label:"Natural Minor",      tag:"Rock",       degrees:[0,6,5,4] },
      { label:"Emotional Arc",      tag:"Alt-Rock",   degrees:[0,5,2,6] },
      { label:"Moody Loop",         tag:"Cinematic",  degrees:[0,5,6] },
      { label:"Blues Minor",        tag:"Blues",      degrees:[0,3,4] },
      { label:"Dark Anthem",        tag:"Dark",       degrees:[0,6,5,6] },
    ],
    1: [
      { label:"Minor ii–V–i",       tag:"Jazz",       degrees:[1,4,0] },
      { label:"Tension Hold",       tag:"Tense",      degrees:[1,4,0,5] },
      { label:"Dramatic Fall",      tag:"Cinematic",  degrees:[1,5,4,0] },
      { label:"Melancholic",        tag:"Melancholic",degrees:[1,6,5,0] },
      { label:"Dark Resolution",    tag:"Dark",       degrees:[1,5,3,0] },
    ],
    2: [
      { label:"Bright Contrast",    tag:"Cinematic",  degrees:[2,6,5,0] },
      { label:"Alt-Rock Flow",      tag:"Alt-Rock",   degrees:[2,5,4,0] },
      { label:"Modal Float",        tag:"Ambient",    degrees:[2,6,0,5] },
      { label:"Rock Drive",         tag:"Rock",       degrees:[2,6,0,4] },
      { label:"Spanish Hint",       tag:"Flamenco",   degrees:[2,1,6,5] },
    ],
    3: [
      { label:"Minor Blues",        tag:"Blues",      degrees:[3,0,4,0] },
      { label:"Dorian Groove",      tag:"Blues",      degrees:[3,0,6,5] },
      { label:"Melancholic Loop",   tag:"Melancholic",degrees:[3,6,0,5] },
      { label:"Dark Rock",          tag:"Dark",       degrees:[3,6,5,0] },
      { label:"Jazz Minor",         tag:"Jazz",       degrees:[3,1,4,0] },
    ],
    4: [
      { label:"Harmonic Pull",      tag:"Classical",  degrees:[4,0] },
      { label:"Rock Resolution",    tag:"Rock",       degrees:[4,0,6,5] },
      { label:"Cinematic Descent",  tag:"Cinematic",  degrees:[4,3,2,1] },
      { label:"Drama Build",        tag:"Cinematic",  degrees:[4,5,6,0] },
      { label:"Tension Hold",       tag:"Tense",      degrees:[4,0,3,4] },
    ],
    5: [
      { label:"Pop Minor",          tag:"Pop",        degrees:[5,6,0] },
      { label:"Cinematic Fall",     tag:"Cinematic",  degrees:[5,2,6,0] },
      { label:"Rock Minor Loop",    tag:"Rock",       degrees:[5,6,3,0] },
      { label:"Bittersweet",        tag:"Melancholic",degrees:[5,3,0,4] },
      { label:"Float",              tag:"Ambient",    degrees:[5,0,3,6] },
    ],
    6: [
      { label:"Anthemic Minor",     tag:"Rock",       degrees:[6,5,0] },
      { label:"Cinematic Build",    tag:"Cinematic",  degrees:[6,5,4,0] },
      { label:"Alt-Rock Cycle",     tag:"Alt-Rock",   degrees:[6,5,2,0] },
      { label:"Dorian Loop",        tag:"Blues",      degrees:[6,3,0,5] },
      { label:"Dark Resolution",    tag:"Dark",       degrees:[6,0,5,4] },
    ],
  },
};

// Returns which key a chord most naturally belongs to (for inference when out-of-key)
function inferKeyFromChord(chordName) {
  const parsed = parseChordName(chordName);
  if (!parsed) return null;
  const isMinor = parsed.suffix.startsWith("m") && !parsed.suffix.startsWith("maj");
  return { root: parsed.root, mode: isMinor ? "minor" : "major" };
}

// Returns which EXT_VARIANTS variant to apply (or null for plain triad)
function pickComplexityVariant(quality, degree, genreId, complexity, rand) {
  if (complexity === "simple") {
    if (genreId === "Blues" && quality === "maj") return "7";
    if (genreId === "Ambient" && quality === "maj") return "sus2";
    return null;
  }
  if (complexity === "intermediate") {
    if (genreId === "Blues") return quality === "maj" ? "7" : quality === "min" ? "m7" : null;
    if (genreId === "Jazz") {
      if (quality === "min") return "m7";
      if (degree === 0) return "maj7";
      if (degree === 4) return "7";
      return null;
    }
    if (genreId === "Ambient") return quality === "maj" ? "maj7" : quality === "min" ? "m7" : null;
    if (degree === 4 && quality === "maj") return "7";
    if (quality === "min" && rand < 0.6) return "m7";
    return null;
  }
  if (complexity === "advanced") {
    if (genreId === "Blues") return quality === "maj" ? "9" : quality === "min" ? "m9" : null;
    if (genreId === "Jazz") {
      if (quality === "min") return rand < 0.5 ? "m7" : "m9";
      return degree === 0 ? "maj9" : degree === 4 ? "9" : "maj7";
    }
    if (genreId === "Ambient") return quality === "maj" ? "maj9" : quality === "min" ? "m9" : null;
    if (genreId === "Pop") return quality === "maj" ? "add9" : quality === "min" ? "m7" : null;
    if (genreId === "Alt-Rock") return quality === "maj" ? (rand < 0.5 ? "add9" : "sus2") : quality === "min" ? "m9" : null;
    if (genreId === "Country") return quality === "maj" ? (degree === 4 ? "7" : "add9") : quality === "min" ? "m7" : null;
    if (genreId === "Rock" || genreId === "Grunge") return quality === "maj" ? "add9" : quality === "min" ? "m7" : null;
    return null;
  }
  return null;
}

function getBorrowedChord(root, mode, deg) {
  const parallelMode = mode === "major" ? "minor" : "major";
  const parallelChords = getChordsInKey(root, parallelMode);
  const cfg = {"-1":{idx:6, numeral:"♭VII"}, "-2":{idx:5, numeral:"♭VI"}, "-3":{idx:2, numeral:"♭III"}}[String(deg)];
  if (!cfg) return null;
  const base = { ...parallelChords[cfg.idx] };
  return { ...base, numeral: cfg.numeral, role:"Borrowed", feel:`parallel ${parallelMode} color`, degree: deg };
}

function generateChordProgression(root, mode, genreId, moodId, complexity) {
  const genreData = PROG_GENRES.find(g => g.id === genreId);
  if (!genreData) return [];
  const moodData = PROG_MOODS.find(m => m.id === moodId);
  const templates = genreData[mode] || genreData.major;
  const biasPref = moodData?.templatePref || [];
  const biasedPool = biasPref.map(i => templates[i % templates.length]).filter(Boolean);
  const pool = (Math.random() < 0.35 || !biasedPool.length) ? templates : biasedPool;
  const template = pool[Math.floor(Math.random() * pool.length)];
  const diatonic = getChordsInKey(root, mode);
  return template.map(deg => {
    const chord = deg >= 0
      ? { ...diatonic[deg % diatonic.length] }
      : (getBorrowedChord(root, mode, deg) || { ...diatonic[0] });
    const variant = pickComplexityVariant(chord.quality, chord.degree, genreId, complexity, Math.random());
    const displayName = variant ? getVarName(chord.root, chord.quality, variant) : chord.name;
    return { ...chord, displayName, playName: displayName, bars: 2 };
  });
}

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
  if (q==="maj") return {bg:"rgba(201,145,58,0.11)",border:"rgba(201,145,58,0.30)",dot:"#c9913a"};
  if (q==="min") return {bg:"rgba(110,68,88,0.13)",border:"rgba(110,68,88,0.34)",dot:"#9e6a80"};
  return {bg:"rgba(95,78,52,0.13)",border:"rgba(95,78,52,0.34)",dot:"#8a7048"};
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
  bg:"#0e0a07", line:"#261e13", lineSoft:"#1d1610",
  text:"#e8ddd0", dim:"#9a8e7d", faint:"#5e5448",
  amber:"#c9913a", amberBright:"#e8b45a", amberSoft:"rgba(201,145,58,0.12)", amberBorder:"rgba(201,145,58,0.38)",
  plum:"#7a3a50",
  chord:"#d0d45e", chordDeep:"#a2a63c",
  scaleTone:"#c07848", penta:"#5a85c4", ghost:"rgba(218,210,192,0.30)",
  card:"rgba(255,255,255,0.025)",
};
const SANS = "'DM Sans','Inter',system-ui,sans-serif";
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
      <div style={{fontSize:10,color:T.amber,letterSpacing:1.5,marginBottom:6,textTransform:"uppercase",fontFamily:SANS}}>{name}</div>
      <svg width={w} height={h} style={{display:"block",margin:"0 auto"}}>
        {/* Nut or base fret */}
        {displayBase === 1
          ? <rect x={padL} y={padT-4} width={cellW*(cols-1)} height={5} fill="#d8cfc0" rx={2}/>
          : <text x={padL-14} y={padT+cellH*0.6} fill={T.faint} fontSize={10} textAnchor="middle">{displayBase}</text>
        }
        {/* Fret lines */}
        {Array.from({length:numFrets+1},(_,i)=>(
          <line key={i} x1={padL} y1={padT+i*cellH} x2={padL+cellW*(cols-1)} y2={padT+i*cellH} stroke="#2c2418" strokeWidth={i===0?2:1}/>
        ))}
        {/* String lines */}
        {Array.from({length:cols},(_,i)=>(
          <line key={i} x1={padL+i*cellW} y1={padT} x2={padL+i*cellW} y2={padT+numFrets*cellH} stroke="#3a3028" strokeWidth={1.5}/>
        ))}
        {/* Barre */}
        {barre && (
          <rect x={padL} y={padT+(barre-displayBase)*cellH+cellH*0.2} width={cellW*(cols-1)} height={cellH*0.55} fill={T.amber} rx={cellH*0.25} opacity={0.80}/>
        )}
        {/* Dots */}
        {frets.map((f,si) => {
          const x = padL + si*cellW;
          if (f === -1) return <text key={si} x={x} y={padT-8} fill="#a05840" fontSize={13} textAnchor="middle">✕</text>;
          if (f === 0) return <circle key={si} cx={x} cy={padT-10} r={5} fill="none" stroke={T.faint} strokeWidth={1.5}/>;
          const fretRow = f - displayBase;
          if (fretRow < 0 || fretRow >= numFrets) return null;
          const y = padT + fretRow*cellH + cellH*0.5;
          const isBarreDot = barre && f===barre;
          return <circle key={si} cx={x} cy={y} r={10} fill={isBarreDot?"transparent":T.amber} stroke="none"/>;
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
                background: isActive ? "rgba(201,145,58,0.10)" : isSelected ? "rgba(201,145,58,0.06)" : "rgba(255,255,255,0.022)",
                border:`1px solid ${isActive ? T.amberBorder : isSelected ? "rgba(201,145,58,0.28)" : T.line}`,
                borderRadius:13, padding:"10px 12px 9px", cursor:"pointer",
                boxShadow: isActive ? "0 0 18px rgba(201,145,58,0.15)" : "none",
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
      <div style={{background:"#13100c", borderRadius:"22px 22px 0 0", width:"100%", maxWidth:520,
        padding:"26px 20px 48px", border:`1px solid rgba(201,145,58,0.16)`, borderBottom:"none",
        maxHeight:"88vh", overflowY:"auto"}} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6}}>
          <div>
            <div style={{fontFamily:SERIF, fontSize:27, fontWeight:900, color:T.text}}>{activeName}</div>
            <div style={{fontSize:12, color:T.dim, fontFamily:ITAL, fontStyle:"italic"}}>
              {[chord.numeral, chord.role, chord.feel].filter(Boolean).join(" · ")}
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
              background:"rgba(201,145,58,0.12)", border:`1px solid ${T.amberBorder}`, borderRadius:10,
              color:T.amberBright, padding:"9px 12px", fontSize:13, cursor:"pointer",
              fontFamily:SANS, fontWeight:600}}>＋ Add</button>
            <button onClick={onClose} aria-label="Close" style={{background:"rgba(255,255,255,0.05)",
              border:`1px solid ${T.line}`, borderRadius:8, color:T.dim, padding:"8px 11px",
              cursor:"pointer", fontSize:15}}>✕</button>
          </div>
        </div>

        {capo > 0 && (
          <div style={{fontSize:11.5, color:T.amber, fontFamily:SANS, marginBottom:10,
            background:T.amberSoft, border:`1px solid rgba(201,145,58,0.25)`, borderRadius:8,
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
                        style={{background:"rgba(201,145,58,0.14)", border:`1px solid rgba(201,145,58,0.3)`,
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
        background: progression.length ? `linear-gradient(135deg, ${T.amber}, #7a3a50)` : "#1a1610",
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
      <div style={{fontFamily:SERIF, fontSize:20, fontWeight:700, marginBottom:10, letterSpacing:0.1}}>What key am I in?</div>
      <div style={{fontSize:12, color:T.faint, fontFamily:ITAL, fontStyle:"italic", marginBottom:20, opacity:0.75, lineHeight:1.55}}>
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
        <div style={{background:T.card, border:`1px solid rgba(201,145,58,0.2)`, borderRadius:14,
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
                background:"rgba(201,145,58,0.10)", border:`1px solid rgba(201,145,58,0.25)`,
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
        background: isPlaying ? "rgba(201,145,58,0.15)" : hasChords ? `linear-gradient(135deg, ${T.amber}, #a8702a)` : "#17140f",
        border: isPlaying ? `1px solid ${T.amberBorder}` : "none",
        borderRadius:10, color: isPlaying ? T.amberBright : hasChords ? "#1a1206" : T.faint,
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

// ── Free Play chord browser ───────────────────────────────────────────────────
function FreePlayBrowser({
  audioCtxRef,
  onAdd,
  onOpenDiagram,
  capo,
  description = "No key, no rules — just explore every chord from any root.",
  chordRole = "Free Play",
}) {
  const [selectedNote, setSelectedNote] = useState(null);

  if (!selectedNote) {
    return (
      <div>
        <div style={{fontFamily:SERIF, fontSize:17, fontWeight:700, marginBottom:4}}>Pick a root note</div>
        <div style={{fontSize:12, color:T.faint, fontFamily:ITAL, fontStyle:"italic", marginBottom:14}}>
          {description}
        </div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8}}>
          {FREE_PLAY_NOTES.map(note => (
            <button key={note.display} onClick={() => setSelectedNote(note)} style={{
              padding:"14px 0", borderRadius:10, fontFamily:SERIF, fontSize:20, fontWeight:900,
              border:`1px solid ${T.lineSoft}`, background:T.card, color:T.text,
              cursor:"pointer", transition:"border-color 0.12s, background 0.12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.amber; e.currentTarget.style.background = T.amberSoft; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.background = T.card; }}
            >{note.display}</button>
          ))}
        </div>
      </div>
    );
  }

  const root = selectedNote.internal;
  return (
    <div>
      {/* Back + root label */}
      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:16}}>
        <button onClick={() => setSelectedNote(null)} style={{
          background:"transparent", border:`1px solid ${T.line}`, borderRadius:7,
          color:T.dim, padding:"5px 12px", fontSize:12, cursor:"pointer", fontFamily:SANS}}>
          ← Root
        </button>
        <div style={{fontFamily:SERIF, fontSize:24, fontWeight:900,
          background:`linear-gradient(135deg, ${T.text} 30%, ${T.amber})`,
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"}}>
          {selectedNote.display}
        </div>
        <div style={{fontSize:12, color:T.faint, fontFamily:ITAL, fontStyle:"italic"}}>
          — all voicings &amp; variants
        </div>
      </div>

      {FREE_PLAY_VARIANT_GROUPS.map(group => (
        <div key={group.label} style={{marginBottom:20}}>
          <div style={{fontSize:9.5, letterSpacing:2.5, color:T.amber, textTransform:"uppercase",
            fontFamily:SANS, fontWeight:600, marginBottom:10}}>{group.label}</div>
          <div style={{display:"flex", flexDirection:"column", gap:6}}>
            {group.variants.map(({v, feel}) => {
              const chordName = getVarName(root, "maj", v);
              const shapeName = capo > 0 ? fingeredName(chordName, capo) : chordName;
              const hasVoicing = !!getVoicings(shapeName);
              const isMinorish = v.startsWith("m") && !v.startsWith("maj");
              const isDim = v.startsWith("dim") || v === "m7b5";
              const colors = isDim
                ? {bg:"rgba(95,78,52,0.10)", border:"rgba(95,78,52,0.30)", dot:"#8a7048"}
                : isMinorish
                  ? {bg:"rgba(110,68,88,0.10)", border:"rgba(110,68,88,0.30)", dot:"#9e6a80"}
                  : {bg:"rgba(201,145,58,0.09)", border:"rgba(201,145,58,0.26)", dot:"#c9913a"};
              const chordObj = {
                name: chordName, displayName: chordName, playName: chordName,
                root, quality: isDim ? "dim" : isMinorish ? "min" : "maj",
                numeral: null, role: chordRole, feel,
              };
              return (
                <div key={v} style={{
                  background: colors.bg, border:`1px solid ${colors.border}`,
                  borderRadius:10, padding:"9px 12px",
                  display:"flex", alignItems:"center", gap:10}}>
                  <div style={{width:7, height:7, borderRadius:"50%", background:colors.dot, flexShrink:0}}/>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:"flex", alignItems:"baseline", gap:7}}>
                      <span style={{fontFamily:SERIF, fontSize:17, fontWeight:800, color:T.text}}>{chordName}</span>
                      {capo > 0 && shapeName !== chordName && (
                        <span style={{fontSize:10, color:T.amber, fontFamily:SANS}}>play {shapeName}</span>
                      )}
                    </div>
                    <div style={{fontSize:11, color:T.dim, fontFamily:ITAL, fontStyle:"italic", marginTop:1}}>{feel}</div>
                  </div>
                  <div style={{display:"flex", gap:5, flexShrink:0}}>
                    <button onClick={() => playChord(chordName, audioCtxRef)} aria-label={`Play ${chordName}`}
                      style={{background:"rgba(255,255,255,0.07)", border:`1px solid ${colors.border}`,
                        borderRadius:7, color:colors.dot, width:30, height:30, fontSize:13, cursor:"pointer"}}>▶</button>
                    {hasVoicing && (
                      <button onClick={() => onOpenDiagram(chordObj)} aria-label={`Diagram for ${chordName}`}
                        style={{background:"rgba(255,255,255,0.07)", border:`1px solid ${colors.border}`,
                          borderRadius:7, color:T.dim, width:30, height:30, fontSize:12, cursor:"pointer"}}>⬡</button>
                    )}
                    <button onClick={() => onAdd(chordObj)} aria-label={`Add ${chordName} to timeline`}
                      style={{background:colors.dot, border:"none", borderRadius:7,
                        color:"#fff", width:30, height:30, fontSize:18, cursor:"pointer"}}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Spice substitution engine ────────────────────────────────────────────────
function getSpiceOptions(chord, keyRoot, mode) {
  const { root, quality, degree } = chord;
  const diatonic = getChordsInKey(keyRoot, mode);
  const options = [];
  const seen = new Set([chord.name, chord.displayName]);

  const addVariant = (variant, label, feel) => {
    const name = getVarName(root, quality, variant);
    if (!name || name === dn(root) || seen.has(name)) return;
    seen.add(name);
    options.push({ name, displayName:name, playName:name, root, quality, degree, numeral:chord.numeral, label, feel });
  };

  const addDiatonic = (deg, label, feel) => {
    if (deg < 0) {
      const b = getBorrowedChord(keyRoot, mode, deg);
      if (!b || seen.has(b.name)) return;
      seen.add(b.name);
      options.push({ ...b, displayName:b.name, playName:b.name, label, feel });
      return;
    }
    const d = diatonic[deg % 7];
    if (!d || seen.has(d.name)) return;
    seen.add(d.name);
    options.push({ ...d, displayName:d.name, playName:d.name, label, feel });
  };

  // Layer 1: extensions (subtle, ordered by how commonly used they are)
  if (quality === "maj") {
    addVariant("maj7",  "Add warmth",      "Dreamy, sophisticated");
    addVariant("add9",  "Open it up",      "Airy, modern");
    addVariant("6",     "Vintage sheen",   "Sweet, old-school warmth");
    addVariant("sus4",  "Suspend",         "Tension, wants to resolve");
    addVariant("sus2",  "Float",           "Open, unanchored");
    if (degree === 4) addVariant("7", "Dominant push", "Bluesy, strong pull home");
  } else if (quality === "min") {
    addVariant("m7",    "Smooth out",      "Jazzy, relaxed");
    addVariant("m9",    "Open up",         "Rich, emotional");
    addVariant("msus2", "Float it",        "Ethereal, open");
  } else if (quality === "dim") {
    addVariant("dim7",  "Deepen tension",  "Very dramatic, cinematic");
    addVariant("m7b5",  "Soften edge",     "Half-diminished, dark jazz");
  }

  // Layer 2: diatonic function substitutions
  if (degree >= 0) {
    const funcSubs = {
      major: {
        0: [{ deg:5, label:"Relative minor",   feel:"Darker, introspective" }],
        1: [{ deg:3, label:"Subdominant sub",   feel:"Stronger, more grounded" }],
        2: [{ deg:0, label:"Tonic sub",         feel:"Resolved, stable" }],
        3: [{ deg:1, label:"Supertonic sub",    feel:"Mellow, laid-back" },
            { deg:5, label:"Submediant sub",    feel:"Softer resolution" }],
        4: [{ deg:2, label:"Mediant sub",       feel:"Dreamier, less pull" }],
        5: [{ deg:0, label:"Relative major",    feel:"Brighter, more resolved" },
            { deg:3, label:"Subdominant sub",   feel:"More lift, less melancholy" }],
        6: [{ deg:4, label:"Dominant sub",      feel:"More drive, less dissonance" }],
      },
      minor: {
        0: [{ deg:2, label:"Relative major",   feel:"Bright contrast" }],
        1: [{ deg:3, label:"Subdominant sub",  feel:"Heavier, more minor" }],
        2: [{ deg:0, label:"Tonic sub",        feel:"Darker, back to center" }],
        3: [{ deg:5, label:"Submediant sub",   feel:"Warmer, more cinematic" }],
        4: [{ deg:6, label:"Subtonic sub",     feel:"Gentler pull" }],
        5: [{ deg:3, label:"Subdominant sub",  feel:"Darker, heavier" }],
        6: [{ deg:4, label:"Dominant sub",     feel:"Stronger resolution pull" }],
      },
    };
    (funcSubs[mode]?.[degree] || []).forEach(s => addDiatonic(s.deg, s.label, s.feel));
  }

  // Layer 3: borrowed chords (bold color)
  if (mode === "major") {
    if (degree === 4)              addDiatonic(-1, "Borrowed ♭VII", "Rock lift, unexpected");
    if (degree === 0 || degree === 3) addDiatonic(-2, "Dark borrowed",  "Cinematic weight");
    if (degree === 5)              addDiatonic(-3, "Borrowed ♭III",  "Unexpected turn");
  } else {
    if (degree === 0)              addDiatonic(-1, "Borrowed ♭VII",  "Brightness burst");
  }

  return options.slice(0, 4);
}

// ── Saved Progressions persistence ───────────────────────────────────────────
const SAVED_KEY = "woodshed_saved_progressions";
const SAVED_MAX = 50;

function useSavedProgressions() {
  const [saved, setSaved] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); }
    catch { return []; }
  });
  const persist = (items) => {
    setSaved(items);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(items)); } catch {}
  };
  const saveProgression = (prog, progKey, progMode, vibe) => {
    if (saved.length >= SAVED_MAX) return "limit";
    const dedupKey = prog.map(c => c.displayName || c.name).join(",");
    if (saved.some(s => s.dedupKey === dedupKey)) return "duplicate";
    const rootDisplay = dn(prog[0]?.root || progKey || "?");
    const sameRoot = saved.filter(s => s.chords[0] === (prog[0]?.displayName || prog[0]?.name)).length;
    const name = `${rootDisplay} Progression${sameRoot > 0 ? " #" + (sameRoot + 1) : ""}`;
    const entry = {
      id: Date.now().toString(),
      name, keyRoot: progKey, mode: progMode,
      vibe: vibe || null,
      savedAt: new Date().toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }),
      chords: prog.map(c => c.displayName || c.name),
      numerals: prog.map(c => c.numeral || "—"),
      dedupKey,
      rawProgression: prog,
    };
    persist([entry, ...saved]);
    return "ok";
  };
  const removeProgression = (id) => persist(saved.filter(s => s.id !== id));
  return { saved, saveProgression, removeProgression };
}

// Reusable save button with three-state feedback
function SaveButton({ onSave, style }) {
  const [state, setState] = useState("idle");
  const handle = () => {
    if (state !== "idle") return;
    const result = onSave();
    setState(result === "ok" ? "saved" : result === "duplicate" ? "dup" : "limit");
    setTimeout(() => setState("idle"), result === "ok" ? 1600 : 2400);
  };
  const CFG = {
    idle:  { label:"♥ Save",        border:T.lineSoft,              bg:"transparent",           color:T.faint },
    saved: { label:"✓ Saved!",       border:"rgba(74,222,128,0.4)", bg:"rgba(74,222,128,0.08)", color:"#6edd90" },
    dup:   { label:"Already saved",  border:T.amberBorder,          bg:T.amberSoft,             color:T.amber },
    limit: { label:"Library full",   border:"rgba(200,60,60,0.4)",  bg:"rgba(200,60,60,0.08)",  color:"#d07070" },
  };
  const c = CFG[state];
  return (
    <button onClick={handle} style={{
      padding:"6px 12px", borderRadius:7, fontSize:12,
      cursor: state === "idle" ? "pointer" : "default",
      background:c.bg, border:`1px solid ${c.border}`, color:c.color,
      transition:"all 0.18s", whiteSpace:"nowrap", fontFamily:SANS, ...style,
    }}>
      {c.label}
    </button>
  );
}

// ── Spice One Chord component ─────────────────────────────────────────────────
const PLUM  = "#7a3a50";
const PLUM_L = T.amberBright;
const PLUM_D = "#5a2a38";

function SpiceOneChord({ progression, keyRoot, mode, audioCtxRef, onSave }) {
  const [active, setActive] = useState(false);
  const [targetIdx, setTargetIdx] = useState(null);
  const [options, setOptions] = useState([]);

  const launch = (forceIdx) => {
    const idx = forceIdx !== undefined
      ? forceIdx
      : Math.floor(Math.random() * progression.length);
    const opts = getSpiceOptions(progression[idx], keyRoot, mode);
    setTargetIdx(idx);
    setOptions(opts);
    setActive(true);
  };

  const tryAnother = () => {
    let idx = targetIdx;
    if (progression.length > 1) {
      const choices = progression.map((_, i) => i).filter(i => i !== targetIdx);
      idx = choices[Math.floor(Math.random() * choices.length)];
    }
    const opts = getSpiceOptions(progression[idx], keyRoot, mode);
    setTargetIdx(idx);
    setOptions(opts);
  };

  const close = () => { setActive(false); setTargetIdx(null); setOptions([]); };

  const buildSpiced = (opt) =>
    progression.map((ch, i) => i === targetIdx ? { ...opt, bars: ch.bars || 2 } : ch);

  const playSpiced = (opt) => {
    const prog = buildSpiced(opt);
    prog.forEach((ch, i) => setTimeout(() => playChord(ch.playName, audioCtxRef), i * 1700));
  };

  if (!active) {
    return (
      <button onClick={() => launch()} style={{
        marginTop:10,
        padding:"7px 14px", borderRadius:9, fontSize:12, cursor:"pointer",
        background:T.amberSoft,
        border:`1px solid ${T.amberBorder}`,
        color:T.amberBright, fontFamily:SANS, fontWeight:500,
        transition:"all 0.15s",
      }}>
        ✦ Spice One Chord
      </button>
    );
  }

  const target = progression[targetIdx];

  return (
    <div style={{
      marginTop:10,
      background:`rgba(201,145,58,0.05)`,
      border:`1px solid ${T.amberBorder}`,
      borderRadius:13, padding:"14px 15px",
    }}>
      {/* Header */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:11, flexWrap:"wrap", gap:7}}>
        <div style={{fontSize:12, color:T.dim}}>
          Spicing{" "}
          <span style={{color:T.amberBright, fontFamily:SERIF, fontWeight:700}}>
            {target?.displayName || target?.name}
          </span>
          {progression.length > 1 && (
            <span style={{fontSize:10, color:T.faint}}> · chord {targetIdx + 1} of {progression.length}</span>
          )}
        </div>
        <div style={{display:"flex", gap:6}}>
          <button onClick={tryAnother} style={{
            padding:"4px 10px", borderRadius:7, fontSize:11, cursor:"pointer",
            background:T.amberSoft, border:`1px solid ${T.amberBorder}`,
            color:T.amberBright,
          }}>↻ Try Another</button>
          <button onClick={close} style={{
            padding:"4px 10px", borderRadius:7, fontSize:11, cursor:"pointer",
            background:"transparent", border:`1px solid ${T.lineSoft}`, color:T.faint,
          }}>✕ Restore</button>
        </div>
      </div>

      {/* Options */}
      {options.length === 0 ? (
        <div style={{fontSize:12, color:T.faint, fontFamily:ITAL, fontStyle:"italic", textAlign:"center", padding:"10px 0"}}>
          No substitutions available — try another chord.
        </div>
      ) : (
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {options.map((opt, oi) => {
            const spiced = buildSpiced(opt);
            return (
              <div key={oi} style={{
                background:"rgba(255,255,255,0.022)",
                border:`1px solid ${T.line}`,
                borderRadius:10, padding:"10px 12px",
              }}>
                {/* Label */}
                <div style={{marginBottom:7}}>
                  <span style={{fontSize:11.5, color:T.amberBright, fontWeight:600}}>{opt.label}</span>
                  <span style={{fontSize:10.5, color:T.faint, marginLeft:8, fontFamily:ITAL, fontStyle:"italic"}}>{opt.feel}</span>
                </div>
                {/* Full progression with spiced chord highlighted */}
                <div style={{display:"flex", gap:4, flexWrap:"wrap", alignItems:"center", marginBottom:9}}>
                  {spiced.map((ch, ci) => {
                    const isSpiced = ci === targetIdx;
                    const qc = qColors(ch.quality);
                    return (
                      <div key={ci} style={{display:"flex", alignItems:"center", gap:3}}>
                        <button onClick={() => playChord(ch.playName, audioCtxRef)} style={{
                          borderRadius:9, padding:"5px 9px", cursor:"pointer", textAlign:"center",
                          background: isSpiced ? T.amberSoft : qc.bg,
                          border: isSpiced ? `1px solid ${T.amberBorder}` : `1px solid ${qc.border}`,
                          boxShadow: isSpiced ? `0 0 10px rgba(201,145,58,0.22)` : "none",
                          transition:"all 0.15s",
                        }}>
                          <div style={{
                            fontFamily:SERIF, fontSize:13, fontWeight:700,
                            color: isSpiced ? T.amberBright : T.text,
                          }}>{ch.displayName}</div>
                          <div style={{fontSize:9, color: isSpiced ? T.amber : T.amber, marginTop:1}}>
                            {ch.numeral}
                          </div>
                        </button>
                        {ci < spiced.length - 1 && (
                          <span style={{color:T.faint, fontSize:10}}>›</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Actions */}
                <div style={{display:"flex", gap:6}}>
                  <button onClick={() => playSpiced(opt)} style={{
                    padding:"5px 12px", borderRadius:7, fontSize:11, cursor:"pointer",
                    background:"rgba(255,255,255,0.05)", border:`1px solid ${T.lineSoft}`, color:T.dim,
                  }}>▶ Play</button>
                  {onSave && (
                    <SaveButton
                      onSave={() => onSave(spiced, keyRoot, mode, `${opt.label} on ${target?.displayName || target?.name}`)}
                      style={{fontSize:11, padding:"5px 11px"}}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Why This Works — analysis engine ─────────────────────────────────────────
const PROG_EXPLANATIONS = {
  // ── Major 4-chord ─────────────────────────────────────────────────────────
  "I-V-vi-IV":       "The most recorded chord progression in Western music — and for good reason. It starts home, builds tension on V, drops into vi for that emotional gut-punch, then IV lifts you back up. Simple and devastating every time.",
  "vi-IV-I-V":       "The same four chords as I-V-vi-IV, but starting mid-story on vi. That minor opening makes the whole thing feel more searching and melancholic before it opens out and pushes back around.",
  "IV-I-V-vi":       "Opens with lift before settling home — then the V-vi move at the end is a deceptive cadence that sidesteps the expected resolution into something darker. Leaves you leaning forward instead of landing.",
  "V-vi-IV-I":       "The V-vi opener is a deceptive cadence — your ear expects home but gets the emotional vi instead. After that detour, IV breathes and I finally lands with satisfying weight.",
  "I-vi-IV-V":       "The 50s and doo-wop backbone. Home, a touch of wistfulness on vi, lift on IV, then V pushes you right back. Endlessly circular — feels like it was built to loop.",
  "vi-IV-V-I":       "Starts dark on vi, drifts through IV's lift, V builds the drive, and I arrives clean and bright. Moving from minor color to a clear major resolution gives it a hopeful, arriving quality.",
  "I-IV-vi-V":       "IV gives immediate lift away from home, vi pulls it darker, and V creates strong forward momentum before resolving. A little moodier than I-V-vi-IV — the IV opening gives it more upward energy.",
  "I-IV-V-I":        "The original rock and roll formula, closed. Home, lift, drive, home again. Simple, direct, and undeniably satisfying — there's a reason every guitarist learns this first.",
  "I-vi-ii-V":       "A jazz-flavored move. From home through the warm vi, down to ii for jazzy melancholy, and V creates one of the strongest pulls in harmony. That ii-V ending wants to resolve so badly it almost resolves itself.",
  "I-IV-I-V":        "The country and blues bedrock — bouncing between home and the lift of IV, with V as the pivot that kicks it back around. Earthy and natural, feels like it's always existed.",
  "I-V-IV-I":        "Descending from V back through IV to home has a gravitational, inevitable pull. Classic rock and blues — the energy lives in that descent, building intensity before the landing.",
  "I-IV-V-IV":       "Standard I-IV-V with IV at the end instead of a resolution — keeps things looping rather than closing. The IV after V creates a soft, open landing instead of a definitive one.",
  "ii-V-I":          "The most powerful resolution in Western harmony. ii sets the emotional stage, V creates maximum tension, and I delivers the release. Jazz's bread and butter — but it works anywhere you want certainty.",
  "ii-V-I-IV":       "The classic ii-V-I with a IV extension — resolves cleanly on I, then IV keeps it from feeling too final. A breath before the next phrase.",
  "ii-V-vi-IV":      "A jazz-tinged setup that sidesteps from the expected I resolution into vi — a deceptive cadence that adds emotional depth. IV then lifts it back out.",
  "ii-IV-V-I":       "A gospel-inflected lift. ii adds depth and melancholy before IV brightens and V drives home. Warmer than a plain I-IV-V — the ii opening makes it feel more earned.",
  "ii-vi-IV-I":      "Starts on the tension of ii, moves through the minor warmth of vi, IV lifts, and I resolves. A winding path home that feels more emotional than its destination.",
  "ii-vi-I-V":       "Opens on tension, dips through vi, touches home on I, then V launches the whole thing forward. That I isn't a full landing — it's a springboard.",
  "iii-vi-ii-V":     "A chain of falling fifths — each chord pulls the next toward resolution. Jazz guitarists love this. When it finally hits I, the payoff is massive.",
  "iii-vi-IV-I":     "Descending-thirds motion from iii through vi to IV carries a warm, introspective quality. I resolves cleanly at the end — but the journey through the middle is where it lives.",
  "iii-IV-V-I":      "An ascending hopeful arc — iii adds gentle color, IV lifts, V drives, I resolves. Everything here is pointing upward and forward.",
  "iii-ii-I-V":      "Descending from iii through ii to home, then V kicks it back. The stepwise descent has a classical, unhurried quality — like each chord is setting the next one up.",
  "iii-vi-I-IV":     "Color from iii, warm minor on vi, home on I, then IV keeps it open and forward. Meditative and not fully resolved — good for verses that need to stay in motion.",
  "IV-V-I":          "The strongest resolution in the major key — the one you've heard at the end of every hymn and stadium anthem. IV sets the lift, V cranks the tension, and I closes it with finality.",
  "IV-V-vi-I":       "IV and V set up an expected resolution but vi sidesteps it — a deceptive cadence that adds emotional depth. I still lands, but the journey there has a twist.",
  "IV-I-V-I":        "Alternating between IV's lift and I's home, with V as a strong push between them. The repeated resolution to I gives this a grounded, reassuring quality.",
  "IV-I-vi-V":       "Opens with IV's lift before settling to home, then vi adds emotional color and V launches forward. The shift from IV's brightness to vi's minor shadow is the emotional pivot.",
  "IV-♭VI-♭VII-I":   "The ♭VI and ♭VII are borrowed from the parallel minor, piling dramatic weight onto the final I — makes the resolution feel triumphant, like breaking through something. Very cinematic.",
  "V-I":             "The defining cadence of Western music. All the tension of V, all the release of I. In two chords you have a complete harmonic sentence.",
  "V-vi-IV-I":       "V-vi is a deceptive cadence — your ear expects home but gets the emotional vi instead. IV breathes after that detour, and I finally lands.",
  "V-I-IV-V":        "Resolves to I mid-phrase but then IV lifts and V launches it back into motion. That early resolution followed by renewed movement gives this a restless, forward-pushing quality.",
  "V-I-vi-IV":       "Resolves home on I, then immediately dips into the emotional vi before IV lifts out. The quick I-vi move after the V resolution adds a bittersweet turn.",
  "V-I-vi-ii":       "After the V-I resolution there's a journey inward — vi gets emotional, ii adds melancholic tension, and the whole thing points back to V. More complex than it sounds.",
  "vi-ii-V-I":       "A falling-fifths chain leading to a strong resolution. Each chord has a clear job: vi adds color, ii sets up tension, V cranks it, I delivers. Very satisfying close.",
  "vi-IV-V-I":       "Starts dark, lifts with IV, V pushes, I resolves cleanly. Moving from a minor opening to a strong major resolution gives it an arriving, hopeful quality.",
  "vi-iii-ii-V":     "A descending chain of rich chords — all setup without resolution. Everything here is winding tension pointing toward I. Extremely effective in a verse before a chorus.",
  "vi-V-IV-V":       "Opens with minor color, descends through V and IV, then V takes you back. The downward motion followed by V's push creates strong forward momentum — good for riffs and vamps.",
  "vii°-I":          "Leading tone resolution — the vii° wants to resolve to I more than almost anything in the major key. Maximum tension, maximum release in two chords.",
  "vii°-I-vi-IV":    "Opens with the tension of the leading-tone chord and resolves, then journeys through vi and IV. The strong opening resolution gives the rest room to breathe.",
  "vii°-vi-V-I":     "A chromatic descent with maximum tension. The diminished vii° is the most unstable chord in the key, and the sequence drags it step by step to resolution.",
  "I-♭VII-♭VI":      "Borrowing ♭VII and ♭VI from the parallel minor for a cinematic descending feel. These chords don't belong in the major key — that's exactly what gives this weight and drama.",
  "I-♭VII-IV":       "Modal rock territory. The ♭VII shouldn't be here in a major key — that's what gives it the Stonesy, anthemic edge. IV pulls back with lift. Classic rock and Americana.",
  "I-♭VII-♭VI-♭VII": "Borrowed-chord loop. ♭VII and ♭VI from the parallel minor create a cinematic tension that never fully resolves — it just keeps cycling. Hypnotic and heavy.",
  "I-♭VII-♭VI-IV":   "Descending borrowed chords open with drama, then IV pulls back into the major world with lift. The contrast between the borrowed weight and IV's brightness is the whole point.",
  "I-vi-♭VII-IV":    "The vi and ♭VII combo is an unusual pairing — vi sits in the key, ♭VII is borrowed — and together they create an ambiguous emotional space between major brightness and minor weight.",
  "I-IV-♭VII-♭VI":   "Starting in clean major territory then borrowing ♭VII and ♭VI from the parallel minor — the descent into borrowed chord territory gives this a gradually darkening cinematic quality.",
  "I-IV-♭VII-V":     "The ♭VII is an unexpected stop on the way from IV to V — a borrowed detour that adds grit and ambiguity before V drives home. Very effective in rock and alt-rock.",
  "I-iii-vi-V":      "A soft, searching sequence. iii and vi descend through the emotional heart of the major key before V creates the drive back. Melancholic but with forward momentum.",
  "I-V-IV":          "A descending three-chord sequence — the move from V back through IV instead of home is what gives rock and blues that heavy-gravity feel. Great for riff-based music.",
  "I-V-vi":          "Home, drive with V, then a deceptive drop into the emotional vi. V-vi is a classic deceptive cadence — your ear expects I but gets something darker and more interesting.",
  "I-ii-V":          "A compact jazz cadence. Home, then the melancholic pull of ii, and V creates maximum tension toward resolution. Clean, efficient, and purposeful.",
  "I-iii-V-IV":      "Home to iii adds gentle emotional color, V creates drive, IV provides a soft landing without full resolution. Ambient and introspective — good for letting the music breathe.",
  "IV-I-vi-V":       "Leading with lift before settling home on I, vi adds emotional color, and V drives forward. The lift-to-home-to-emotion-to-drive arc is emotionally complete.",
  // ── Major 3-chord ─────────────────────────────────────────────────────────
  "I-IV-V":          "The holy trinity of Western music. Blues, rock, country, punk — everything lives here. IV lifts you from home, V creates maximum forward drive, and back you go. Bone-simple and endlessly powerful.",
  "IV-I-V":          "Reverse triangle — opens with IV's lift, touches home on I, then V pushes forward. More open and searching than a standard I-IV-V — like the middle of a sentence rather than the end.",
  "iii-IV-V":        "Gentle color from iii, open lift on IV, forward push with V — everything here is ascending and pointing forward. A naturally hopeful three-chord sequence.",
  "I-IV-♭VII":       "The ♭VII at the end gives an unexpected rock twist — instead of the expected V resolution you get a borrowed chord that sits heavy and unresolved. Good for riff loops.",
  // ── Minor 4-chord ─────────────────────────────────────────────────────────
  "i-VII-VI-VII":    "The natural minor anthem — circular and hypnotic. Starting dark at home, lifting through VII and VI's brightness, then VII hangs in the air before looping back. Iconic in rock ballads and film scores.",
  "i-VI-III-VII":    "One of the most emotionally effective minor progressions ever written. From darkness on i, warmth on VI, major brightness on III, and VII hangs unresolved at the end. A question that doesn't quite get answered.",
  "i-VII-VI-V":      "The Andalusian cadence — each chord descends by step through the minor scale. Sounds ancient, almost Spanish or Mediterranean in flavor, with a relentless downward pull toward the resolution.",
  "i-VII-VI-IV":     "From minor home through natural minor territory, landing on IV which opens things up with a lift. The motion has gravity — each chord descends in mood before IV gives a moment of air.",
  "i-VII-VI-III":    "Moving from darkness through brighter relatives — VI and III feel like glimpses of warmth before the loop returns. Reaching for something brighter without quite arriving.",
  "i-VI-III-IV":     "Minor with an unexpected IV lift. After the dark i and warmer VI and III, the IV adds a moment of major brightness. One of the most emotionally satisfying minor progressions.",
  "i-VI-III-V":      "From dark home through warmer VI and bright III, then V drives back with tension. The major chords give this a bittersweet quality — minor in key but reaching for the light.",
  "i-VII-III-VI":    "A lush minor loop. The III and VI are major chords that feel like sunlight through clouds — bittersweet and lit from within. Works beautifully in pop and cinematic contexts.",
  "i-III-VI-VII":    "Starting on dark home, III jumps to unexpected brightness, VI warms, and VII hangs open. Big contrasts between i's shadow and the major chords — very emotionally engaging.",
  "i-III-VII-VI":    "Dark i opens, III brings major brightness, VII adds ambiguity, VI warms. Covers a lot of emotional ground in four chords — the major chord color inside a minor key is what makes it interesting.",
  "i-iv-VII-III":    "Minor blues with jazz flavor. iv deepens the shadow, VII opens a door, and III brings surprising major brightness before the loop. Moody but with room to breathe.",
  "i-III-VII-IV":    "An emotional sequence in minor. III brings sudden major brightness from dark i, VII adds drama, and IV opens up. Covers a lot of emotional ground in four chords.",
  "i-iv-V-i":        "The complete minor cadential sequence. iv deepens the shadow, V builds maximum tension — especially dramatic as a major chord — and i closes it cleanly. A full harmonic sentence.",
  "i-iv-i-V":        "Bouncing between dark home and the deeper shadow of iv, then V lifts out with drive. The contrast between the heavy i-iv feel and V's push creates a clear push-and-pull dynamic.",
  "i-VII-iv-V":      "Minor home, VII opens up, iv returns to shadow, V drives forward. The VII-iv move through brightness and back to dark is an unusual detour that adds minor blues character.",
  "i-iv-VII-VI":     "Minor home, iv adds weight, VII opens, VI warms. Moving from dark iv toward brighter VII and VI is a lightening motion inside a minor framework.",
  "i-VI-VII":        "The simplest powerful minor loop — home, warmth on VI, VII hangs unresolved. Keeps the listener leaning forward without creating heavy tension. Perfect for verses that need to stay in motion.",
  "i-iv-V":          "The classic minor cadence. iv deepens the shadow, V builds the drive — especially powerful as a major chord — and i resolves home. Simple and emotionally direct.",
  "i-v-VI-III":      "Bittersweet and searching. v builds mild tension, VI opens with warmth, III adds major color, and the sequence floats rather than resolves cleanly. Very evocative.",
  // ── Minor 3-chord ─────────────────────────────────────────────────────────
  "i-VII-VI":        "The first three chords of the natural minor descent — dark home, through VII, opening on VI. Feels like a long exhale, or the beginning of something that hasn't fully resolved yet.",
  "i-iv-i":          "Simple minor oscillation — dark home and its shadow. The space between these two chords IS the whole emotional point. Everything else is just filling in.",
  "VII-VI-i":        "A descent that resolves to the minor home. Each step pulls downward until i arrives as a relief, not a victory — more exhale than triumph.",
  "VI-VII-i":        "Ascending to home from below — VI lifts, VII builds expectation, and i resolves as a landing, not a release. Very cinematic, very effective at the end of a phrase.",
  "VI-III-VII-i":    "A cinematic build that resolves to minor home. Each chord steps by degree and i at the end feels earned — like a long breath you were holding.",
  "VI-VII-iv-i":     "Opens with major warmth, VII builds, iv darkens, and i resolves into shadow. The major-to-minor emotional shift across the sequence is the whole story.",
  "VI-iv-i-V":       "Major warmth on VI, shadow on iv, home on i, then V launches forward. The home arrival mid-sequence followed by V's push keeps energy moving rather than settling.",
  "VI-i-iv-VII":     "Opens with warmth on VI, drops to dark home, deeper shadow on iv, then VII hangs unresolved. Never fully lands — keeps an open, searching quality throughout.",
  "V-i":             "The strongest resolution in the minor key. V has maximum forward drive — especially as a major chord — and i receives it with dark, satisfying weight.",
  "V-i-VII-VI":      "Resolves to i, then immediately opens up through VII and VI's brightness. The resolution isn't an ending — it's a pivot into something warmer.",
  "V-VI-VII-i":      "Ascending through the minor key toward home. VI and VII are both major chords, giving the climb a lift before i arrives with minor shadow. Very cinematic ascending motion.",
  "V-iv-III-ii°":    "A chromatic descent through minor territory — everything here is winding down, not resolving. Very classical and dramatic.",
  "V-i-iv-V":        "Resolves briefly to i then immediately moves to iv and back to V — an oscillation that never lets you settle. The tension never fully releases.",
  "iv-i-V-i":        "Shadow on iv, home on i, tension from V, then home again. The repeated return to i gives this a grounded, resolved quality — especially effective with a strong V chord.",
  "iv-i-VII-VI":     "From shadow through home, then VII and VI gradually brighten. An upward emotional arc from the darkest part of the key toward something warmer.",
  "iv-VII-i-VI":     "Shadow, then VII opens up, i resolves darkly, and VI warms the landing. Ending on VI instead of i gives this a bittersweet, open quality.",
  "iv-VII-VI-i":     "From shadow through VII's opening and VI's warmth, resolving to dark home on i. The warmth of VII and VI makes the final i feel like a soft landing rather than a dramatic one.",
  "iv-ii°-V-i":      "The jazz minor cadence. ii° adds diminished tension, V creates the drive, and i resolves. A very complete and sophisticated cadential sequence.",
  "ii°-V-i":         "Minor key ii-V-i — the jazz cadence in its pure form. The half-diminished ii° has a particularly dark, jazz-tinged quality that makes the V and i resolution feel even more earned.",
  "ii°-V-i-VI":      "The classic jazz minor cadence doesn't fully close — VI extends things with warmth after the i resolution. A breath after the landing.",
  "ii°-VI-V-i":      "Tension from ii°, warmth from VI, drive from V, resolution on i. The VI adds an unexpected moment of major warmth in the middle of the minor cadential motion.",
  "ii°-VII-VI-i":    "Diminished tension, VII opens, VI warms, and i resolves into minor shadow. The major VII and VI in the middle give this a beautiful bittersweet quality.",
  "ii°-VI-iv-i":     "Tension on ii°, warmth on VI, deep shadow on iv, resolution on i. An unusual emotional arc — from diminished to major to minor to minor.",
  "III-VII-VI-i":    "Opening with the bright contrast of III, descending through VII and VI, resolving to minor home. The major brightness at the start makes the minor landing feel more bittersweet.",
  "III-VI-V-i":      "Starts on the major brightness of III, VI warms, V drives, and i resolves with minor weight. The major opening makes the eventual minor landing feel more settled.",
  "III-VII-i-VI":    "III brings brightness, VII adds drama, i lands darkly, VI warms. The alternation between major brightness and minor shadow is the whole emotional texture here.",
  "III-VII-i-V":     "Major brightness on III, drama on VII, dark landing on i, then V launches forward again. The sequence doesn't rest — it uses i as a pivot, not an ending.",
  "III-ii°-VII-VI":  "Bright III, tense ii°, dramatic VII, then warmth on VI — a lot of emotional movement in four chords. The contrast between III's openness and ii°'s tension is the center of gravity.",
  "VII-VI-V-i":      "The Andalusian descent in minor — stepping down from VII through VI and V to resolve on i. Each step creates more pull toward home. Ancient-sounding and dramatic.",
  "VII-VI-III-i":    "Descending from VII through VI and bright III, then into the minor home. That major III before the minor i creates a bittersweet almost-arrival.",
  "VII-iv-i-VI":     "VII opens, iv deepens, i resolves darkly, VI warms. The move from i's minor weight to VI's major warmth at the end gives this a bittersweet quality.",
  "VII-i-VI-V":      "VII provides ambiguity before home on i, then VI warms and V drives forward. The progression opens darkly, warms up, and points outward — restless by design.",
};

function explainProgression(progression, keyRoot, mode) {
  if (!progression?.length) return null;

  const numerals = progression.map(c => c.numeral || "?");
  const joinedKey = numerals.join("-");

  // 1. Exact match
  if (PROG_EXPLANATIONS[joinedKey]) {
    return { numerals, explanation: PROG_EXPLANATIONS[joinedKey] };
  }

  // 2. Detect structural features for dynamic fallback
  const borrowed = progression.filter(c => (c.degree !== undefined && c.degree < 0) || c.role === "Borrowed");
  const hasBorrowed = borrowed.length > 0;
  const borrowedNumerals = borrowed.map(c => c.numeral).filter(Boolean);

  const isHome = (c) => c?.degree === 0;
  const isV    = (c) => c?.degree === 4;
  const isII   = (c) => c?.degree === 1;

  const first  = progression[0];
  const last   = progression[progression.length - 1];
  const resolvesHome = isHome(last);
  const endsOnV = isV(last);
  const startsHome = isHome(first);

  const hasIIV = progression.some((c, i) =>
    i < progression.length - 1 && isII(c) && isV(progression[i + 1])
  );
  const hasVI = progression.some((c, i) =>
    i < progression.length - 1 && isV(c) && isHome(progression[i + 1])
  );

  let explanation = "";

  if (hasBorrowed) {
    const bLabel = borrowedNumerals.length === 1
      ? `The ${borrowedNumerals[0]} chord is`
      : `The ${borrowedNumerals.join(" and ")} chords are`;
    if (mode === "major") {
      explanation = resolvesHome
        ? `${bLabel} borrowed from the parallel minor — that's what gives this its cinematic weight. Everything resolves back to I, so the borrowed chord feels like a dramatic detour rather than a departure.`
        : `${bLabel} borrowed from the parallel minor, pulling the progression into unexpected emotional territory. In a major context, borrowed chords add drama without fully abandoning the tonal center.`;
    } else {
      explanation = `${bLabel} borrowed outside the natural minor scale, adding an unexpected harmonic twist. That color is what makes the progression feel more dramatic or ambiguous than a straight minor sequence.`;
    }
  } else if (hasIIV && resolvesHome) {
    explanation = "Contains a ii-V-I resolution — one of the strongest harmonic movements in music. The ii sets the emotional stage, V creates maximum tension, and I delivers a clean, satisfying release.";
  } else if (hasVI && !resolvesHome) {
    explanation = "Has a V-I resolution in the middle that creates a moment of clarity, but the progression continues past that landing — keeps the momentum going without letting the energy fully settle.";
  } else if (endsOnV) {
    explanation = mode === "minor"
      ? "Ending on V leaves the progression suspended in mid-air — that pull back toward i never arrives, which creates a lingering forward tension. Loops and verses love this quality."
      : "Ending on V leaves the progression open and unresolved, creating forward momentum. Your ear wants the I but doesn't get it — and that unsatisfied pull is exactly what makes it work as a loop.";
  } else if (resolvesHome && startsHome) {
    const middle = numerals.slice(1, -1).join(" → ");
    explanation = mode === "minor"
      ? `Starts and ends at home in the minor key — the journey through ${middle} is where the emotion lives. The return to i gives closure, but the middle chords carry the feeling.`
      : `Starts and ends at home — the tension and release live entirely in the middle (${middle}). That satisfying home-to-home arc is what makes it feel complete.`;
  } else if (resolvesHome && !startsHome) {
    explanation = mode === "minor"
      ? `Starting on ${first.numeral} rather than i puts you mid-story from bar one. The progression works its way back to minor home, but the journey has more emotional movement than a tonic-first approach.`
      : `Starting on ${first.numeral} rather than home puts you mid-story from the first bar. Everything resolves to I at the end, but the off-tonic opening gives it immediate forward motion.`;
  } else {
    explanation = mode === "minor"
      ? `Moving through ${joinedKey} stays in natural minor territory — each chord reinforces the dark, introspective center without fully closing. That searching, open quality is what makes minor progressions feel continuous.`
      : `The motion through ${joinedKey} covers the major key's emotional range — ${isV(last) ? "V at the end keeps it open and forward-pointing" : "without a strong V-I close, this has a floating, suspended quality"} that's useful when you don't want things to fully resolve.`;
  }

  return { numerals, explanation };
}

function WhyThisWorks({ progression, keyRoot, mode }) {
  const [open, setOpen] = useState(false);
  const analysis = useMemo(
    () => explainProgression(progression, keyRoot, mode),
    [progression, keyRoot, mode]
  );
  if (!analysis) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background:"transparent", border:"none",
        color: open ? T.amber : T.faint,
        fontSize:11.5, cursor:"pointer",
        padding:"2px 0", fontFamily:ITAL, fontStyle:"italic",
        display:"flex", alignItems:"center", gap:5, letterSpacing:0.2,
        transition:"color 0.15s",
      }}>
        <span style={{ fontStyle:"normal", opacity:0.8 }}>?</span>
        {open ? "why this works ↑" : "why this works ↓"}
      </button>
      {open && (
        <div style={{
          marginTop:7, padding:"12px 14px",
          background:"rgba(255,255,255,0.025)",
          border:`1px solid ${T.lineSoft}`,
          borderRadius:10,
        }}>
          <div style={{
            fontSize:10.5, color:T.amber, letterSpacing:1.8,
            textTransform:"uppercase", fontFamily:SANS, fontWeight:600,
            marginBottom:9,
          }}>
            {analysis.numerals.join(" → ")}
          </div>
          <div style={{
            fontFamily:ITAL, fontStyle:"italic",
            fontSize:13.5, color:T.text, lineHeight:1.6,
          }}>
            {analysis.explanation}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Progression of the Day ────────────────────────────────────────────────────
function ProgressionOfTheDay({ audioCtxRef, onLoad, capo, onSave }) {
  const todaySeed = dateSeed();
  const [seed, setSeed] = useState(todaySeed);
  const [glowFlash, setGlowFlash] = useState(false);

  const { progression, genreId, moodId, keyRoot, mode } = useMemo(
    () => generatePOTDProgression(seed), [seed]
  );

  const vibe = POTD_VIBES[`${genreId}:${moodId}`] || `${genreId} · ${moodId}`;
  const isToday = seed === todaySeed;

  const handleRegenerate = () => {
    setSeed(Date.now());
    setGlowFlash(true);
    setTimeout(() => setGlowFlash(false), 350);
  };

  const playSeq = () => {
    progression.forEach((ch, i) =>
      setTimeout(() => playChord(ch.playName, audioCtxRef), i * 1700)
    );
  };

  return (
    <div style={{
      borderRadius:18,
      border:`1px solid ${glowFlash ? T.amber : T.amberBorder}`,
      background:`linear-gradient(145deg, rgba(201,145,58,0.08) 0%, rgba(122,58,80,0.04) 55%, rgba(201,145,58,0.04) 100%)`,
      padding:"22px 20px 20px",
      marginBottom:32,
      boxShadow: glowFlash
        ? `0 0 32px rgba(201,145,58,0.28), inset 0 0 0 1px rgba(201,145,58,0.14)`
        : `0 0 24px rgba(201,145,58,0.10), inset 0 0 0 1px rgba(201,145,58,0.05)`,
      transition:"box-shadow 0.25s, border-color 0.25s",
    }}>
      {/* Header row */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
        <div style={{
          fontSize:8, letterSpacing:3, color:T.amber, textTransform:"uppercase",
          fontWeight:500, fontFamily:SANS, opacity:0.75,
        }}>
          {isToday ? "Today's Progression" : "Fresh Pick"}
        </div>
        <div style={{
          fontSize:9.5, color:T.faint, fontFamily:SANS, opacity:0.65,
        }}>
          {dn(keyRoot)} {mode} · {genreId}
        </div>
      </div>

      {/* Vibe headline — the hero */}
      <div style={{
        fontFamily:SERIF, fontSize:24, fontWeight:900, marginBottom:20, lineHeight:1.12,
        color:T.text,
      }}>
        {vibe}
      </div>

      {/* Chord chips */}
      <div style={{display:"flex", flexWrap:"wrap", gap:6, marginBottom:22}}>
        {progression.map((ch, i) => {
          const qc = qColors(ch.quality);
          const dispName = capo > 0 ? fingeredName(ch.displayName, capo) : ch.displayName;
          return (
            <button key={i} onClick={() => playChord(ch.playName, audioCtxRef)} style={{
              background:qc.bg, border:`1px solid ${qc.border}`,
              borderRadius:9, padding:"6px 12px", cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", gap:2,
              transition:"opacity 0.1s",
            }}>
              <span style={{fontFamily:SERIF, fontSize:14, fontWeight:700, color:T.text}}>{dispName}</span>
              <span style={{fontSize:9, color:T.faint, fontFamily:SANS, opacity:0.8}}>{ch.numeral}</span>
            </button>
          );
        })}
      </div>

      {/* Primary CTA */}
      <button onClick={() => onLoad(keyRoot, mode, progression)} style={{
        width:"100%", padding:"14px 0", borderRadius:10, marginBottom:10,
        background:`linear-gradient(135deg, ${T.amber}, #a8702a)`,
        border:"none", color:"#1a1206",
        fontSize:15, cursor:"pointer", fontWeight:700, fontFamily:SERIF,
        letterSpacing:0.6,
      }}>Start Here →</button>
      {/* Secondary actions */}
      <div style={{display:"flex", gap:7}}>
        <button onClick={handleRegenerate} style={{
          flex:1, padding:"8px 0", borderRadius:8, background:"transparent",
          border:`1px solid ${T.amberBorder}`, color:T.amber,
          fontSize:12, cursor:"pointer", fontWeight:500, fontFamily:SANS,
        }}>↻ New Pick</button>
        <button onClick={playSeq} style={{
          flex:1, padding:"8px 0", borderRadius:8, background:"transparent",
          border:`1px solid ${T.lineSoft}`, color:T.dim,
          fontSize:12, cursor:"pointer", fontFamily:SANS,
        }}>▶ Play</button>
      </div>
      <WhyThisWorks progression={progression} keyRoot={keyRoot} mode={mode}/>
    </div>
  );
}

// ── Suggestions Panel ────────────────────────────────────────────────────────
function SuggestionsPanel({ activeChordName, keyRoot, mode, audioCtxRef, onLoadProgression, onSave }) {
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(null); // null = follow active chord
  const [contextKey, setContextKey] = useState(keyRoot);
  const [contextMode, setContextMode] = useState(mode);
  const [showKeyPicker, setShowKeyPicker] = useState(false);

  useEffect(() => { setContextKey(keyRoot); setContextMode(mode); }, [keyRoot, mode]);

  const effectiveChord = pinned || activeChordName;
  const diatonic = getChordsInKey(contextKey, contextMode);
  const ctxScale  = getScaleNotes(contextKey, contextMode);

  // Resolve starting degree in context key
  const parsed = effectiveChord ? parseChordName(effectiveChord) : null;
  const degreeInCtx = parsed ? ctxScale.indexOf(parsed.root) : -1;

  // If chord not in current key, find its natural home
  const notInKey = parsed && degreeInCtx === -1;
  const naturalHome = notInKey ? inferKeyFromChord(effectiveChord) : null;
  const resolvedKey  = notInKey ? (naturalHome?.root || contextKey)  : contextKey;
  const resolvedMode = notInKey ? (naturalHome?.mode || contextMode) : contextMode;
  const resolvedDiatonic = notInKey ? getChordsInKey(resolvedKey, resolvedMode) : diatonic;
  const resolvedScale    = notInKey ? getScaleNotes(resolvedKey, resolvedMode)  : ctxScale;
  const startDegree = parsed ? resolvedScale.indexOf(parsed.root) : -1;

  const suggestions = startDegree >= 0
    ? (SUGGESTION_TEMPLATES[resolvedMode]?.[startDegree] || []) : [];

  const buildProg = (degrees) => degrees.map(deg => {
    const chord = deg >= 0
      ? { ...resolvedDiatonic[deg % resolvedDiatonic.length] }
      : (getBorrowedChord(resolvedKey, resolvedMode, deg) || { ...resolvedDiatonic[0] });
    return { ...chord, displayName: chord.name, playName: chord.name, bars: 2 };
  });

  const playSeq = (chords) => {
    chords.forEach((ch, i) => setTimeout(() => playChord(ch.playName, audioCtxRef), i * 1700));
  };

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} style={{
        width:"100%", marginTop:10, padding:"11px 14px", textAlign:"left",
        background:T.card, border:`1px solid ${T.lineSoft}`,
        borderRadius:10, color:T.text, cursor:"pointer",
        display:"flex", alignItems:"center", gap:10,
      }}>
        <span style={{fontFamily:SERIF, fontSize:14, fontWeight:700}}>What comes next?</span>
        <span style={{fontSize:11, color:T.faint}}>
          {effectiveChord ? `Suggestions following ${effectiveChord}` : "Chord progression suggestions"}
        </span>
        <span style={{marginLeft:"auto", color:T.amber}}>→</span>
      </button>
    );
  }

  return (
    <div style={{
      marginTop:10, background:"rgba(255,255,255,0.02)",
      border:`1px solid ${T.lineSoft}`, borderRadius:12, padding:16,
    }}>
      {/* Header */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14}}>
        <div>
          <div style={{fontFamily:SERIF, fontSize:16, fontWeight:700}}>What comes next?</div>
          <div style={{fontSize:11, color:T.faint, fontFamily:ITAL, fontStyle:"italic", marginTop:2}}>
            Diatonic suggestions starting from a chosen chord
          </div>
        </div>
        <button onClick={() => setExpanded(false)} style={{
          background:"transparent", border:`1px solid ${T.lineSoft}`, borderRadius:6,
          color:T.faint, padding:"4px 10px", fontSize:11, cursor:"pointer", flexShrink:0,
        }}>✕</button>
      </div>

      {/* Starting chord picker */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:9.5, letterSpacing:3, color:T.faint, textTransform:"uppercase", marginBottom:8}}>
          Starting chord
          {activeChordName && !pinned && (
            <span style={{fontSize:9, color:T.amber, marginLeft:6, letterSpacing:0}}>
              · following timeline
            </span>
          )}
        </div>
        <div style={{display:"flex", flexWrap:"wrap", gap:5}}>
          {activeChordName && (
            <button onClick={() => setPinned(null)} style={{
              padding:"5px 10px", borderRadius:7, cursor:"pointer",
              border:`1px solid ${!pinned ? T.amberBorder : T.lineSoft}`,
              background: !pinned ? T.amberSoft : "rgba(255,255,255,0.02)",
              color: !pinned ? T.amberBright : T.dim,
              fontSize:12, fontFamily:SERIF, fontWeight:700,
            }}>
              {activeChordName}
              <span style={{fontSize:9, marginLeft:4, fontFamily:SANS, fontWeight:400, opacity:0.7}}>active</span>
            </button>
          )}
          {diatonic.map((ch, i) => {
            const isSel = pinned === ch.name;
            return (
              <button key={i} onClick={() => setPinned(ch.name)} style={{
                padding:"5px 10px", borderRadius:7, cursor:"pointer",
                border:`1px solid ${isSel ? T.amberBorder : T.lineSoft}`,
                background: isSel ? T.amberSoft : "rgba(255,255,255,0.02)",
                color: isSel ? T.amberBright : T.dim,
                fontSize:12, fontFamily:SERIF, fontWeight:700,
              }}>
                {ch.name}
                <span style={{fontSize:9, color:T.faint, marginLeft:3, fontFamily:SANS, fontWeight:400}}>{ch.numeral}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Out-of-key notice */}
      {notInKey && naturalHome && (
        <div style={{
          background:"rgba(201,145,58,0.07)", border:`1px solid ${T.amberBorder}`,
          borderRadius:8, padding:"8px 12px", marginBottom:12,
          fontSize:11, color:T.dim, fontFamily:ITAL, fontStyle:"italic",
        }}>
          <span style={{color:T.amber, fontStyle:"normal"}}>{dn(parsed.root)}</span>
          {" isn't in "}{dn(contextKey)} {contextMode}
          {" — suggesting in "}
          <span style={{color:T.text, fontStyle:"normal"}}>{dn(naturalHome.root)} {naturalHome.mode}</span>
        </div>
      )}

      {/* Suggestion cards */}
      {effectiveChord && startDegree >= 0 ? (
        <div style={{display:"flex", flexDirection:"column", gap:9}}>
          {suggestions.map((sugg, si) => {
            const prog = buildProg(sugg.degrees);
            const tc = TAG_COLORS[sugg.tag] || TAG_COLORS.Pop;
            return (
              <div key={si} style={{
                background:"rgba(255,255,255,0.025)", border:`1px solid ${T.lineSoft}`,
                borderRadius:10, padding:"11px 13px",
              }}>
                <div style={{display:"flex", alignItems:"center", gap:7, marginBottom:9}}>
                  <span style={{fontFamily:SERIF, fontSize:13, fontWeight:700, color:T.text}}>
                    {sugg.label}
                  </span>
                  <span style={{
                    fontSize:10, padding:"2px 7px", borderRadius:9,
                    background:tc.bg, border:`1px solid ${tc.border}`,
                    color:tc.text, fontWeight:600, letterSpacing:0.4,
                  }}>{sugg.tag}</span>
                </div>
                <div style={{display:"flex", gap:5, flexWrap:"wrap", alignItems:"center", marginBottom:9}}>
                  {prog.map((ch, ci) => {
                    const cc = qColors(ch.quality);
                    return (
                      <div key={ci} style={{display:"flex", alignItems:"center", gap:4}}>
                        <button onClick={() => playChord(ch.playName, audioCtxRef)} style={{
                          background:cc.bg, border:`1px solid ${cc.border}`,
                          borderRadius:8, padding:"5px 9px", cursor:"pointer", textAlign:"center",
                        }}>
                          <div style={{fontFamily:SERIF, fontSize:14, fontWeight:700, color:T.text, whiteSpace:"nowrap"}}>
                            {ch.displayName}
                          </div>
                          <div style={{fontSize:9.5, color:T.amber, marginTop:1}}>{ch.numeral}</div>
                        </button>
                        {ci < prog.length - 1 && (
                          <span style={{color:T.faint, fontSize:10}}>›</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex", gap:6}}>
                  <button onClick={() => playSeq(prog)} style={{
                    flex:"0 0 auto", padding:"6px 12px",
                    background:"rgba(255,255,255,0.05)", border:`1px solid ${T.lineSoft}`,
                    borderRadius:7, color:T.dim, fontSize:12, cursor:"pointer",
                  }}>▶ Play</button>
                  {onSave && (
                    <SaveButton onSave={() => onSave(prog, resolvedKey, resolvedMode, sugg.tag)} style={{flex:"0 0 auto"}}/>
                  )}
                  <button onClick={() => { onLoadProgression(prog); setExpanded(false); }} style={{
                    flex:1, padding:"6px 12px",
                    background:`linear-gradient(135deg, rgba(201,145,58,0.14), rgba(168,112,42,0.14))`,
                    border:`1px solid ${T.amberBorder}`, borderRadius:7,
                    color:T.amberBright, fontSize:12, cursor:"pointer", fontFamily:SERIF, fontWeight:600,
                  }}>→ Send to Builder</button>
                </div>
                <SpiceOneChord
                  progression={prog}
                  keyRoot={resolvedKey} mode={resolvedMode}
                  audioCtxRef={audioCtxRef}
                  onSave={onSave}
                />
                <WhyThisWorks progression={prog} keyRoot={resolvedKey} mode={resolvedMode}/>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          fontSize:12, color:T.faint, fontFamily:ITAL, fontStyle:"italic",
          textAlign:"center", padding:"18px 0",
        }}>
          {effectiveChord
            ? `${effectiveChord} doesn't fit a standard key — try changing the key context below.`
            : "Select a starting chord above to see suggestions."}
        </div>
      )}

      {/* Key context toggle */}
      <button onClick={() => setShowKeyPicker(v => !v)} style={{
        width:"100%", marginTop:12, padding:"8px 0",
        background:"transparent", border:`1px solid ${T.lineSoft}`, borderRadius:8,
        color:T.faint, fontSize:11, cursor:"pointer",
      }}>
        {showKeyPicker ? "▾" : "▸"} Key context: {dn(contextKey)} {contextMode}
      </button>
      {showKeyPicker && (
        <div style={{
          marginTop:6, background:"rgba(255,255,255,0.02)",
          border:`1px solid ${T.lineSoft}`, borderRadius:8, padding:12,
        }}>
          <div style={{display:"flex", flexWrap:"wrap", gap:4, marginBottom:8}}>
            {NOTES.map(n => (
              <button key={n} onClick={() => setContextKey(n)} style={{
                padding:"3px 9px", borderRadius:6, cursor:"pointer",
                border:`1px solid ${contextKey === n ? T.amber : T.lineSoft}`,
                background: contextKey === n ? T.amberSoft : "rgba(255,255,255,0.02)",
                color: contextKey === n ? T.text : T.faint,
                fontSize:12, fontFamily:SERIF, fontWeight:700,
              }}>{dn(n)}</button>
            ))}
          </div>
          <div style={{display:"flex", gap:6}}>
            {["major","minor"].map(m => (
              <button key={m} onClick={() => setContextMode(m)} style={{
                flex:1, padding:"6px 0", borderRadius:6, cursor:"pointer", textTransform:"capitalize",
                border:`1px solid ${contextMode === m ? T.amber : T.lineSoft}`,
                background: contextMode === m ? T.amberSoft : "rgba(255,255,255,0.02)",
                color: contextMode === m ? T.amberBright : T.faint,
                fontSize:12, fontFamily:SERIF, fontWeight:700,
              }}>{m}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Progression Generator component ──────────────────────────────────────────
function ProgressionGenerator({ keyRoot, mode, audioCtxRef, onLoadProgression, capo, onSave }) {
  const [genre, setGenre] = useState("Rock");
  const [mood, setMood] = useState("Anthemic");
  const [complexity, setComplexity] = useState("simple");
  const [generated, setGenerated] = useState([]);
  const [flash, setFlash] = useState(false);

  const doGenerate = useCallback(() => {
    const prog = generateChordProgression(keyRoot, mode, genre, mood, complexity);
    setGenerated(prog);
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
  }, [keyRoot, mode, genre, mood, complexity]);

  return (
    <div>
      <div style={{fontSize:12, color:T.faint, fontStyle:"italic", fontFamily:ITAL,
        marginBottom:16, textAlign:"center"}}>
        Generating in{" "}
        <span style={{color:T.amberBright, fontStyle:"normal", fontFamily:SERIF, fontWeight:700}}>
          {dn(keyRoot)} {mode}
        </span>
      </div>

      {/* Genre */}
      <div style={{marginBottom:18}}>
        <div style={{fontSize:9, letterSpacing:2.5, color:T.faint, textTransform:"uppercase", marginBottom:10, opacity:0.65}}>Genre / Vibe</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:5}}>
          {PROG_GENRES.map(g => (
            <button key={g.id} onClick={() => setGenre(g.id)} style={{
              padding:"8px 10px", borderRadius:8, textAlign:"left", cursor:"pointer",
              border:`1px solid ${genre === g.id ? T.amberBorder : T.lineSoft}`,
              background: genre === g.id ? T.amberSoft : "rgba(255,255,255,0.02)",
              color: genre === g.id ? T.amberBright : T.dim,
            }}>
              <div style={{fontFamily:SERIF, fontSize:13, fontWeight:700}}>{g.label}</div>
              <div style={{fontSize:10, color:T.faint, marginTop:1}}>{g.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Mood */}
      <div style={{marginBottom:18}}>
        <div style={{fontSize:9, letterSpacing:2.5, color:T.faint, textTransform:"uppercase", marginBottom:10, opacity:0.65}}>Mood</div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:5}}>
          {PROG_MOODS.map(m => (
            <button key={m.id} onClick={() => setMood(m.id)} style={{
              padding:"8px 6px", borderRadius:8, textAlign:"center", cursor:"pointer",
              border:`1px solid ${mood === m.id ? T.amberBorder : T.lineSoft}`,
              background: mood === m.id ? T.amberSoft : "rgba(255,255,255,0.02)",
              color: mood === m.id ? T.amberBright : T.dim,
              fontFamily:SERIF, fontSize:13, fontWeight:700,
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* Complexity */}
      <div style={{marginBottom:28}}>
        <div style={{fontSize:9, letterSpacing:2.5, color:T.faint, textTransform:"uppercase", marginBottom:10, opacity:0.65}}>Complexity</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:5}}>
          {[
            {id:"simple",       label:"Simple",       desc:"Clean triads"},
            {id:"intermediate", label:"Intermediate", desc:"7ths & sus"},
            {id:"advanced",     label:"Advanced",     desc:"Extensions"},
          ].map(c => (
            <button key={c.id} onClick={() => setComplexity(c.id)} style={{
              padding:"9px 6px", borderRadius:8, textAlign:"center", cursor:"pointer",
              border:`1px solid ${complexity === c.id ? T.amberBorder : T.lineSoft}`,
              background: complexity === c.id ? T.amberSoft : "rgba(255,255,255,0.02)",
              color: complexity === c.id ? T.amberBright : T.dim,
            }}>
              <div style={{fontFamily:SERIF, fontSize:12, fontWeight:700}}>{c.label}</div>
              <div style={{fontSize:10, color:T.faint, marginTop:2}}>{c.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button onClick={doGenerate} style={{
        width:"100%", padding:"18px 0", marginBottom:22,
        background: flash
          ? `linear-gradient(135deg, ${T.amberBright}, ${T.amber})`
          : `linear-gradient(135deg, ${T.amber}, #8a5e1a)`,
        border:"none", borderRadius:12, cursor:"pointer",
        fontFamily:SERIF, fontSize:20, fontWeight:900, letterSpacing:2,
        color:"#1a1206",
        boxShadow: flash
          ? `0 0 28px rgba(201,145,58,0.55), 0 4px 20px rgba(0,0,0,0.5)`
          : `0 4px 16px rgba(0,0,0,0.45), 0 0 0 1px rgba(201,145,58,0.18)`,
        transform: flash ? "scale(0.98)" : "scale(1)",
        transition:"all 0.15s",
      }}>
        Generate
      </button>

      {/* Output */}
      {generated.length > 0 && (
        <div style={{
          background:"rgba(201,145,58,0.05)",
          border:`1px solid ${T.amberBorder}`,
          borderRadius:12, padding:16, marginBottom:10,
        }}>
          <div style={{
            fontSize:9.5, letterSpacing:2.5, color:T.amber, textTransform:"uppercase",
            marginBottom:14, textAlign:"center",
          }}>
            {dn(keyRoot)} {mode} · {genre} · {mood} · {complexity}
          </div>

          {/* Chord chips */}
          <div style={{display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center", marginBottom:14}}>
            {generated.map((chord, i) => {
              const colors = qColors(chord.quality);
              return (
                <button key={i} onClick={() => playChord(chord.playName, audioCtxRef)} style={{
                  background:colors.bg, border:`1px solid ${colors.border}`,
                  borderRadius:10, padding:"11px 14px", cursor:"pointer",
                  textAlign:"center", minWidth:60,
                }}>
                  <div style={{fontFamily:SERIF, fontSize:19, fontWeight:900, color:T.text}}>
                    {chord.displayName}
                  </div>
                  <div style={{fontSize:11, color:T.amber, marginTop:3, letterSpacing:0.5}}>
                    {chord.numeral}
                  </div>
                  {capo > 0 && (
                    <div style={{fontSize:9, color:T.faint, marginTop:2}}>
                      {dn(fingeredName(chord.playName, capo))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{fontSize:10, color:T.faint, textAlign:"center", marginBottom:12,
            fontFamily:ITAL, fontStyle:"italic"}}>
            tap a chord to hear it
          </div>

          {/* Actions */}
          <div style={{display:"flex", gap:8}}>
            <button onClick={doGenerate} style={{
              flex:"0 0 auto", padding:"9px 14px",
              background:"rgba(255,255,255,0.05)", border:`1px solid ${T.lineSoft}`,
              borderRadius:8, color:T.dim, fontSize:13, cursor:"pointer", fontFamily:SANS,
            }}>↻ Regenerate</button>
            {onSave && (
              <SaveButton onSave={() => onSave(generated, keyRoot, mode, `${genre} · ${mood}`)}/>
            )}
            <button onClick={() => onLoadProgression(generated)} style={{
              flex:1, padding:"9px 14px",
              background:`linear-gradient(135deg, rgba(201,145,58,0.18), rgba(168,112,42,0.18))`,
              border:`1px solid ${T.amberBorder}`, borderRadius:8,
              color:T.amberBright, fontSize:13, fontWeight:600,
              fontFamily:SERIF, cursor:"pointer",
            }}>Load in Builder →</button>
          </div>
          <SpiceOneChord
            progression={generated}
            keyRoot={keyRoot} mode={mode}
            audioCtxRef={audioCtxRef}
            onSave={onSave}
          />
          <WhyThisWorks progression={generated} keyRoot={keyRoot} mode={mode}/>
        </div>
      )}
    </div>
  );
}

// ── Saved Progressions panel ──────────────────────────────────────────────────
function SavedProgressions({ saved, onRemove, onLoad, audioCtxRef, onSave }) {
  const [playingId, setPlayingId] = useState(null);

  const playSeq = (entry) => {
    setPlayingId(entry.id);
    const prog = entry.rawProgression || [];
    prog.forEach((ch, i) =>
      setTimeout(() => playChord(ch.playName || ch.displayName || ch.name, audioCtxRef), i * 1700)
    );
    setTimeout(() => setPlayingId(null), prog.length * 1700 + 500);
  };

  if (saved.length === 0) {
    return (
      <div style={{
        textAlign:"center", padding:"44px 20px",
        background:"rgba(255,255,255,0.02)", borderRadius:12,
        border:`1px solid ${T.lineSoft}`,
      }}>
        <div style={{fontSize:30, marginBottom:10, opacity:0.6}}>♪</div>
        <div style={{fontFamily:SERIF, fontSize:16, fontWeight:700, marginBottom:6}}>No saved progressions yet</div>
        <div style={{fontSize:13, color:T.faint, fontFamily:ITAL, fontStyle:"italic", lineHeight:1.6}}>
          Hit <span style={{color:T.amber, fontStyle:"normal"}}>♥ Save</span> on any generated or suggested progression<br/>to build your personal library here.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{fontSize:11, color:T.faint, fontFamily:ITAL, fontStyle:"italic", marginBottom:14}}>
        {saved.length} saved · {SAVED_MAX - saved.length} slot{SAVED_MAX - saved.length !== 1 ? "s" : ""} remaining
      </div>
      {saved.map(entry => (
        <div key={entry.id} style={{
          background:"rgba(255,255,255,0.025)", border:`1px solid ${T.lineSoft}`,
          borderRadius:11, padding:"12px 14px", marginBottom:9,
        }}>
          {/* Name + date row */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:7}}>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontFamily:SERIF, fontSize:15, fontWeight:700, color:T.text, marginBottom:4}}>
                {entry.name}
              </div>
              <div style={{display:"flex", gap:7, alignItems:"center", flexWrap:"wrap"}}>
                {entry.vibe && (
                  <span style={{
                    fontSize:10, padding:"2px 7px", borderRadius:8,
                    background:T.amberSoft, border:`1px solid ${T.amberBorder}`,
                    color:T.amber, fontWeight:600, letterSpacing:0.3,
                  }}>{entry.vibe}</span>
                )}
                <span style={{fontSize:10, color:T.faint}}>
                  {dn(entry.keyRoot || "?")} {entry.mode} · {entry.savedAt}
                </span>
              </div>
            </div>
            <button onClick={() => onRemove(entry.id)} style={{
              background:"transparent", border:`1px solid rgba(200,60,60,0.3)`,
              borderRadius:6, color:"rgba(200,80,80,0.65)",
              padding:"3px 9px", fontSize:11, cursor:"pointer", flexShrink:0, marginLeft:8,
            }}>✕</button>
          </div>

          {/* Chord chain */}
          <div style={{display:"flex", gap:4, flexWrap:"wrap", alignItems:"center", marginBottom:10}}>
            {entry.chords.map((ch, ci) => {
              const q = entry.rawProgression?.[ci]?.quality || "maj";
              const qc = qColors(q);
              return (
                <div key={ci} style={{display:"flex", alignItems:"center", gap:3}}>
                  <button onClick={() => playChord(
                    entry.rawProgression?.[ci]?.playName || ch, audioCtxRef
                  )} style={{
                    background:qc.bg, border:`1px solid ${qc.border}`, borderRadius:7,
                    padding:"5px 9px", cursor:"pointer", textAlign:"center",
                  }}>
                    <div style={{fontFamily:SERIF, fontSize:13, fontWeight:700, color:T.text}}>{ch}</div>
                    <div style={{fontSize:9, color:T.amber, marginTop:1}}>{entry.numerals?.[ci] || ""}</div>
                  </button>
                  {ci < entry.chords.length - 1 && (
                    <span style={{color:T.faint, fontSize:10}}>›</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div style={{display:"flex", gap:6}}>
            <button onClick={() => playSeq(entry)} style={{
              padding:"6px 13px", borderRadius:7, fontSize:12, cursor:"pointer",
              background: playingId === entry.id ? T.amberSoft : "rgba(255,255,255,0.05)",
              border:`1px solid ${playingId === entry.id ? T.amberBorder : T.lineSoft}`,
              color: playingId === entry.id ? T.amberBright : T.dim,
              transition:"all 0.2s", fontFamily:SANS,
            }}>
              {playingId === entry.id ? "▶ Playing…" : "▶ Play"}
            </button>
            <button onClick={() => onLoad(entry)} style={{
              flex:1, padding:"6px 13px", borderRadius:7, fontSize:12, cursor:"pointer",
              background:`linear-gradient(135deg, rgba(201,145,58,0.14), rgba(168,112,42,0.14))`,
              border:`1px solid ${T.amberBorder}`, color:T.amberBright,
              fontFamily:SERIF, fontWeight:600,
            }}>→ Load</button>
          </div>
          {entry.rawProgression?.length > 0 && (<>
            <SpiceOneChord
              progression={entry.rawProgression}
              keyRoot={entry.keyRoot} mode={entry.mode}
              audioCtxRef={audioCtxRef}
              onSave={onSave}
            />
            <WhyThisWorks progression={entry.rawProgression} keyRoot={entry.keyRoot} mode={entry.mode}/>
          </>)}
        </div>
      ))}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("mood");
  const [tab, setTab] = useState("build"); // build | library | solo | decode
  const [freePlay, setFreePlay] = useState(false);
  const [showChordLibrary, setShowChordLibrary] = useState(false);
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

  const { saved, saveProgression, removeProgression } = useSavedProgressions();

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
    setProgression([]); setScreen("build"); setFreePlay(false);
    setShowChordLibrary(false);
    setActiveScale(mood.mode === "minor" ? "Minor Pentatonic" : "Major Pentatonic");
    setSelectedIdx(0); setPentaPos(0);
    setTab("build");
  };

  const loadPOTD = (potdKey, potdMode, prog) => {
    stop();
    setKey(potdKey); setMode(potdMode);
    setProgression(prog);
    setFreePlay(false); setShowChordLibrary(false);
    setActiveScale(potdMode === "minor" ? "Minor Pentatonic" : "Major Pentatonic");
    setSelectedIdx(0); setPentaPos(0);
    setScreen("build"); setTab("build");
  };

  const loadSavedEntry = (entry) => {
    stop();
    if (entry.keyRoot) { setKey(entry.keyRoot); }
    if (entry.mode) { setMode(entry.mode); setActiveScale(entry.mode === "minor" ? "Minor Pentatonic" : "Major Pentatonic"); }
    setProgression(entry.rawProgression || []);
    setFreePlay(false); setShowChordLibrary(false);
    setSelectedIdx(0); setPentaPos(0);
    setScreen("build"); setTab("build");
  };

  const enterFreePlay = () => {
    stop();
    setProgression([]); setFreePlay(true);
    setShowChordLibrary(false);
    setKey("C"); setMode("major");
    setActiveScale("Major Pentatonic");
    setSelectedIdx(0); setPentaPos(0);
    setScreen("build"); setTab("build");
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
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
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
      <div style={{padding:"26px 22px 16px", borderBottom:`1px solid ${T.lineSoft}`,
        background:`linear-gradient(180deg, rgba(201,145,58,0.05) 0%, transparent 100%)`}}>
        <div style={{fontSize:9, letterSpacing:5, color:T.amber, textTransform:"uppercase", marginBottom:6, fontFamily:SANS, fontWeight:500, opacity:0.85}}>
          Guitar practice &amp; theory
        </div>
        <div style={{fontFamily:SERIF, fontSize:30, fontWeight:900, lineHeight:1.05, letterSpacing:-0.5,
          color:T.text}}>
          The Woodshed
        </div>
        {screen === "mood" && (
          <div style={{fontSize:13, color:T.dim, fontFamily:ITAL, fontStyle:"italic", marginTop:11, lineHeight:1.55}}>
            Build progressions, explore chord colors, and find what to play over them.
          </div>
        )}
        {screen === "build" && (
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10}}>
            <div style={{fontSize:13, color:T.dim, fontStyle:"italic", fontFamily:ITAL}}>
              {freePlay ? "Free Play — no key" : `${dn(key)} ${mode}`}
            </div>
            <button onClick={() => { stop(); setScreen("mood"); setProgression([]); setFreePlay(false); setShowChordLibrary(false); }} style={{
              background:"transparent", border:`1px solid ${T.line}`, borderRadius:8, color:T.faint,
              padding:"5px 12px", fontSize:11, cursor:"pointer", fontFamily:SANS}}>
              ← {freePlay ? "Back" : "Change key"}
            </button>
          </div>
        )}
      </div>

      <div style={{padding:"0 20px", maxWidth:760, margin:"0 auto"}}>

        {/* ── MOOD SCREEN ── */}
        {screen === "mood" && (
          <div style={{marginTop:36}}>
            <ProgressionOfTheDay
              audioCtxRef={audioCtxRef}
              onLoad={loadPOTD}
              capo={capo}
              onSave={saveProgression}
            />
            <div style={{fontFamily:SERIF, fontSize:20, fontWeight:700, marginBottom:10, letterSpacing:0.1}}>What mood are you going for?</div>
            <div style={{fontSize:12, color:T.faint, marginBottom:28, fontStyle:"italic", fontFamily:ITAL, opacity:0.75}}>Pick a vibe or choose your own key below.</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:11, marginBottom:16}}>
              {MOODS.map(m => (
                <button key={m.label} onClick={() => selectMood(m)} style={{
                  background:T.card, border:`1px solid rgba(255,255,255,0.06)`,
                  borderRadius:14, padding:"22px 18px 18px", color:T.text, textAlign:"left", cursor:"pointer",
                  transition:"border-color 0.15s"}}>
                  <div style={{fontFamily:SERIF, fontSize:15, fontWeight:700, letterSpacing:0.2, marginBottom:8}}>{m.label}</div>
                  <div style={{fontSize:10, color:T.faint, letterSpacing:1.5, textTransform:"uppercase", opacity:0.8}}>{dn(m.key)} {m.mode}</div>
                </button>
              ))}
            </div>
            {/* Free Play */}
            <button onClick={enterFreePlay} style={{
              width:"100%", padding:"16px 18px", marginBottom:14, textAlign:"left",
              background:`rgba(201,145,58,0.07)`,
              border:`1px solid rgba(201,145,58,0.28)`,
              borderRadius:13, color:T.text, cursor:"pointer", display:"flex", alignItems:"center", gap:14}}>
              <div>
                <div style={{fontFamily:SERIF, fontSize:14, fontWeight:700}}>Free Play</div>
                <div style={{fontSize:11, color:T.faint, marginTop:3, opacity:0.75}}>Explore any chord from any root — no key, no rules</div>
              </div>
              <div style={{marginLeft:"auto", fontSize:16, color:T.amber, opacity:0.55}}>→</div>
            </button>
            <button onClick={() => setCustomKey(!customKey)} style={{
              width:"100%", padding:"12px 0", background:T.card, border:`1px solid ${T.lineSoft}`,
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
                <button onClick={() => { setProgression([]); setScreen("build"); setFreePlay(false); setShowChordLibrary(false); setActiveScale(mode === "minor" ? "Minor Pentatonic" : "Major Pentatonic"); setTab("build"); }} style={{
                  width:"100%", padding:"11px 0", background:`linear-gradient(135deg, ${T.amber}, #a8702a)`,
                  border:"none", borderRadius:9, color:"#1a1206", fontSize:14, fontWeight:700,
                  fontFamily:SERIF, cursor:"pointer", letterSpacing:1}}>Go → {dn(key)} {mode}</button>
              </div>
            )}
          </div>
        )}

        {/* ── BUILD SCREEN ── */}
        {screen === "build" && (
          <div style={{marginTop:22}}>

            {/* Capo */}
            <div style={{marginBottom:14}}>
              <CapoStrip capo={capo} setCapo={setCapo} keyRoot={key} mode={mode}/>
            </div>

            {/* Timeline */}
            <div style={{marginBottom:16}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:9}}>
                <div style={{fontSize:9, letterSpacing:2.5, color:T.faint, textTransform:"uppercase", opacity:0.7}}>Timeline</div>
                {progression.length > 0 && (
                  <div style={{fontSize:9.5, color:T.faint, fontFamily:ITAL, fontStyle:"italic", opacity:0.6}}>
                    tap to preview · tap again for shapes
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
            <div style={{marginBottom:16}}>
              <Transport isPlaying={isPlaying} onPlay={play} onStop={stop}
                bpm={bpm} setBpm={setBpm} onTap={handleTap} tapFlash={tapFlash}
                hasChords={progression.length > 0}/>
            </div>

            {/* Backing track */}
            <div style={{marginBottom:22}}>
              <BackingPanel backing={backing} setBacking={setBacking}
                onVolume={onVolume} audioCtxRef={audioCtxRef} isPlaying={isPlaying}/>
            </div>

            {/* Spice One Chord + Why This Works — timeline actions */}
            {progression.length > 0 && (
              <div style={{marginBottom:20}}>
                <SpiceOneChord
                  progression={progression}
                  keyRoot={key} mode={mode}
                  audioCtxRef={audioCtxRef}
                  onSave={saveProgression}
                />
                <WhyThisWorks progression={progression} keyRoot={key} mode={mode}/>
              </div>
            )}

            {/* Tabs */}
            <div style={{display:"flex", gap:0, marginBottom:24, background:T.card, borderRadius:12, padding:3, border:`1px solid ${T.lineSoft}`}}>
              {[{id:"build",label:"Build"},{id:"library",label:"Library"},{id:"generate",label:"Generate"},{id:"solo",label:"Solo"},{id:"decode",label:"Decode"},{id:"saved",label:"Saved"}].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  flex:1, padding:"8px 0", borderRadius:10, border:"none",
                  background: tab === t.id ? T.amberSoft : "transparent",
                  color: tab === t.id ? T.amberBright : T.faint,
                  fontSize:11.5, cursor:"pointer", fontWeight: tab === t.id ? 600 : 400,
                  transition:"all 0.15s", fontFamily:SANS}}>{t.label}</button>
              ))}
            </div>

            {/* ── TAB: BUILD ── */}
            {tab === "build" && (
              <>
                {freePlay ? (
                  <FreePlayBrowser
                    audioCtxRef={audioCtxRef}
                    onAdd={(chordObj) => addChord(chordObj)}
                    onOpenDiagram={(chordObj) => setModalChord(chordObj)}
                    capo={capo}
                  />
                ) : (<>
                <button onClick={() => setShowChordLibrary(open => !open)} style={{
                  width:"100%", padding:"11px 14px", marginBottom:14,
                  background:showChordLibrary ? T.amberSoft : T.card,
                  border:`1px solid ${showChordLibrary ? T.amberBorder : T.lineSoft}`,
                  borderRadius:10, color:showChordLibrary ? T.amberBright : T.text,
                  cursor:"pointer", display:"flex", alignItems:"center", gap:10,
                  textAlign:"left"}}>
                  <span style={{fontFamily:SERIF, fontSize:14, fontWeight:700}}>
                    {showChordLibrary ? "Back to Chords in Key" : "Chord Library"}
                  </span>
                  <span style={{fontSize:11, color:T.faint}}>
                    {showChordLibrary ? `${dn(key)} ${mode}` : "Add any root or chord quality"}
                  </span>
                  <span style={{marginLeft:"auto", color:T.amber}}>
                    {showChordLibrary ? "←" : "→"}
                  </span>
                </button>
                {showChordLibrary ? (
                  <FreePlayBrowser
                    audioCtxRef={audioCtxRef}
                    onAdd={(chordObj) => addChord(chordObj)}
                    onOpenDiagram={(chordObj) => setModalChord(chordObj)}
                    capo={capo}
                    description={`Browse any chord without leaving ${dn(key)} ${mode}.`}
                    chordRole="Chord Library"
                  />
                ) : (<>
                <div style={{fontSize:9, letterSpacing:2, color:T.faint, marginBottom:14, opacity:0.55}}>
                  {dn(key)} {mode} &nbsp;·&nbsp; hear · shapes · add
                </div>
                {chords.map(chord => {
                  const colors = qColors(chord.quality);
                  const variants = EXT_VARIANTS[chord.quality] || [chord.quality];
                  return (
                    <div key={chord.name} style={{border:`1px solid ${colors.border}`, borderRadius:10, overflow:"hidden", marginBottom:7}}>
                      <div style={{background:colors.bg, padding:"10px 12px", display:"flex", alignItems:"center", gap:8}}>
                        <div style={{width:7, height:7, borderRadius:"50%", background:colors.dot, flexShrink:0}}/>
                        <div style={{minWidth:70}}>
                          <span style={{fontFamily:SERIF, fontSize:17, fontWeight:700}}>{dn(chord.root)}{chord.quality === "min" ? "m" : chord.quality === "dim" ? "dim" : ""}</span>
                          <span style={{fontSize:9.5, color:T.faint, marginLeft:6, opacity:0.7}}>{chord.numeral}</span>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11, color:T.dim, fontWeight:500}}>{chord.role}</div>
                          <div style={{fontSize:10.5, color:T.faint, fontStyle:"italic", fontFamily:ITAL, opacity:0.8}}>{chord.feel}</div>
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
                              <span style={{fontSize:9.5, color:T.faint, marginLeft:5, opacity:0.7}}>{VARIANT_FEEL[v]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <AIAnalysis progression={progression} root={key} mode={mode}/>
                <SuggestionsPanel
                  activeChordName={currentChordName}
                  keyRoot={key}
                  mode={mode}
                  audioCtxRef={audioCtxRef}
                  onSave={saveProgression}
                  onLoadProgression={(prog) => {
                    stop();
                    setProgression(prog);
                    setSelectedIdx(0);
                  }}
                />
                </>)}
                </>)}
              </>
            )}

            {/* ── TAB: LIBRARY ── */}
            {tab === "library" && (
              <div>
                <div style={{fontSize:12, color:T.faint, fontStyle:"italic", fontFamily:ITAL, marginBottom:20, opacity:0.75}}>
                  Classic progressions adapted to {dn(key)} {mode}. Tap to load.
                </div>
                {COMMON_PROGRESSIONS.map((prog, i) => (
                  <button key={i} onClick={() => loadCommonProgression(prog)} style={{
                    width:"100%", background:T.card, border:`1px solid ${T.lineSoft}`,
                    borderRadius:11, padding:"14px 16px", marginBottom:9, cursor:"pointer", textAlign:"left", color:T.text}}>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8}}>
                      <div>
                        <div style={{fontFamily:SERIF, fontSize:16, fontWeight:700, marginBottom:4}}>{prog.name}</div>
                        <div style={{fontSize:12, color:T.dim, fontStyle:"italic", fontFamily:ITAL, marginBottom:5}}>{prog.desc}</div>
                        <div style={{fontSize:10.5, color:T.faint, opacity:0.75}}>e.g. {prog.examples}</div>
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
                <div style={{fontSize:9, letterSpacing:2.5, color:T.faint, textTransform:"uppercase", marginBottom:10, opacity:0.65}}>Scale</div>
                <div style={{display:"flex", flexWrap:"wrap", gap:5, marginBottom:16}}>
                  {Object.keys(PENTA_INTERVALS).map(s => (
                    <button key={s} onClick={() => setActiveScale(s)} style={{
                      padding:"4px 10px", borderRadius:6, fontSize:11,
                      border:`1px solid ${activeScale === s ? T.penta : T.lineSoft}`,
                      background: activeScale === s ? "rgba(90,133,196,0.14)" : "rgba(255,255,255,0.02)",
                      color: activeScale === s ? T.penta : T.faint, cursor:"pointer"}}>{s}</button>
                  ))}
                </div>

                {/* View window */}
                <div style={{fontSize:9, letterSpacing:2.5, color:T.faint, textTransform:"uppercase", marginBottom:10, opacity:0.65}}>View</div>
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
                <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap"}}>
                  <div style={{fontSize:9, letterSpacing:2.5, color:T.faint, textTransform:"uppercase", opacity:0.65}}>Position</div>
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

            {/* ── TAB: GENERATE ── */}
            {tab === "generate" && (
              <ProgressionGenerator
                keyRoot={key}
                mode={mode}
                audioCtxRef={audioCtxRef}
                capo={capo}
                onSave={saveProgression}
                onLoadProgression={(prog) => {
                  stop();
                  setProgression(prog);
                  setSelectedIdx(0);
                  setTab("build");
                }}
              />
            )}

            {/* ── TAB: DECODE ── */}
            {tab === "decode" && (
              <DecodeTab audioCtxRef={audioCtxRef} onApply={applyDecode} onSoloScale={soloScaleFromDecode}/>
            )}

            {/* ── TAB: SAVED ── */}
            {tab === "saved" && (
              <div>
                <div style={{fontFamily:SERIF, fontSize:20, fontWeight:700, marginBottom:10, letterSpacing:0.1}}>My Progressions</div>
                <div style={{fontSize:12, color:T.faint, marginBottom:22, fontStyle:"italic", fontFamily:ITAL, opacity:0.75}}>
                  Your personal library — save from anywhere with ♥ Save.
                </div>
                <SavedProgressions
                  saved={saved}
                  onRemove={removeProgression}
                  onLoad={loadSavedEntry}
                  audioCtxRef={audioCtxRef}
                  onSave={saveProgression}
                />
              </div>
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

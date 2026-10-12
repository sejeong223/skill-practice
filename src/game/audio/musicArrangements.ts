import type { MusicKey } from "./audioManifest";

export interface MusicArrangement {
  readonly bpm: number;
  readonly leadWave?: "sine" | "triangle";
  readonly leadVolumeDb?: number;
  readonly harmonyVolumeDb?: number;
  readonly bassVolumeDb?: number;
  readonly leadGate?: "8n" | "16n";
  readonly melody: readonly (string | null)[];
  readonly chords: readonly string[];
  readonly bass: readonly string[];
}

export const CHORD_VOICINGS: Readonly<Record<string, readonly string[]>> = {
  C: ["C4", "E4", "G4"], G: ["G3", "B3", "D4"], Am: ["A3", "C4", "E4"], F: ["F3", "A3", "C4"],
  D: ["D4", "F#4", "A4"], Em: ["E3", "G3", "B3"], Bm: ["B3", "D4", "F#4"], A: ["A3", "C#4", "E4"],
  Fsm: ["F#3", "A3", "C#4"], E: ["E3", "G#3", "B3"], B: ["B3", "D#4", "F#4"], Csm: ["C#4", "E4", "G#4"],
  Dm: ["D4", "F4", "A4"], Bb: ["Bb3", "D4", "F4"],
};

const BASS_VOICINGS: Readonly<Record<string, readonly [string, string]>> = {
  C: ["C2", "G2"], D: ["D2", "A2"], Em: ["E2", "B2"], F: ["F2", "C3"],
  G: ["G2", "D3"], Am: ["A2", "E3"], Dm: ["D2", "A2"], Bm: ["B2", "F#3"],
};

function arrangeWorld01(
  bpm: number,
  leadWave: "sine" | "triangle",
  leadVolumeDb: number,
  leadGate: "8n" | "16n",
  bars: readonly (readonly [melody: string, chord: string])[],
): MusicArrangement {
  return {
    bpm, leadWave, leadVolumeDb, leadGate,
    harmonyVolumeDb: -23,
    bassVolumeDb: -24,
    melody: bars.flatMap(([notes]) => notes.split(" ").map(note => note === "_" ? null : note)),
    chords: bars.flatMap(bar => [bar[1], bar[1]]),
    bass: bars.flatMap(bar => {
      const [root, fifth] = BASS_VOICINGS[bar[1]];
      return [root, fifth, root, fifth];
    }),
  };
}

export const MUSIC_ARRANGEMENTS: Readonly<Record<MusicKey, MusicArrangement>> = {
  "world-01-peaceful": arrangeWorld01(100, "sine", -14, "8n", [
    ["C5 _ E5 G5 E5 _ D5 _","C"],
    ["A5 G5 F5 _ A5 _ G5 _","F"],
    ["B4 D5 G5 A5 G5 _ D5 _","G"],
    ["E5 D5 C5 _ _ _ G4 _","C"],
    ["E5 A5 C6 _ B5 A5 E5 _","Am"],
    ["F5 A5 G5 _ F5 E5 F5 _","F"],
    ["D5 F5 A5 _ G5 F5 E5 _","Dm"],
    ["D5 G5 B5 A5 G5 _ _ _","G"],
    ["G5 _ E5 G5 C6 B5 G5 _","C"],
    ["G5 B5 E5 _ D5 E5 G5 _","Em"],
    ["A5 _ C6 A5 G5 F5 E5 _","F"],
    ["D5 G5 A5 B5 A5 _ G5 _","G"],
    ["A5 C6 B5 A5 E5 _ C5 _","Am"],
    ["F5 A5 G5 F5 D5 _ E5 _","Dm"],
    ["D5 G5 B5 A5 G5 D5 B4 _","G"],
    ["E5 G5 C5 _ _ _ _ _","C"],
  ]),
  "world-01-calico": arrangeWorld01(114, "triangle", -15, "16n", [
    ["G4 D5 G5 _ B5 A5 G5 _","G"],
    ["F#5 A5 D5 _ F#5 E5 D5 _","D"],
    ["E5 G5 B5 _ A5 G5 E5 _","Em"],
    ["E5 G5 C5 _ D5 E5 G5 _","C"],
    ["B4 D5 G5 B5 A5 G5 D5 _","G"],
    ["A4 D5 F#5 A5 G5 F#5 E5 _","D"],
    ["C5 E5 G5 E5 D5 C5 E5 _","C"],
    ["D5 F#5 A5 _ G5 F#5 D5 _","D"],
    ["E5 B4 E5 G5 B5 _ G5 E5","Em"],
    ["F#5 B4 D5 F#5 A5 _ F#5 D5","Bm"],
    ["E5 C5 E5 G5 A5 _ G5 E5","C"],
    ["F#5 D5 F#5 A5 G5 F#5 E5 _","D"],
    ["G5 B5 A5 G5 D5 _ B4 D5","G"],
    ["E5 G5 E5 C5 D5 E5 G5 _","C"],
    ["A5 G5 F#5 E5 D5 _ F#5 A5","D"],
    ["G5 D5 B4 G4 _ _ _ _","G"],
  ]),
  "birthday-warm": {
    bpm: 108,
    melody: ["E5", "G5", "C6", "G5", "E5", "D5", "C5", null, "E5", "G5", "A5", "G5", "F5", "E5", "D5", "C5"],
    chords: ["C", "G", "Am", "F"],
    bass: ["C2", "G2", "A2", "E2", "F2", "C2", "G2", "G2"],
  },
  "world-01-alley": {
    bpm: 116,
    melody: ["D5", "G5", "B5", "A5", "G5", "D5", "E5", null, "D5", "B4", "A4", "B4", "D5", "E5", "D5", "G4"],
    chords: ["G", "D", "Em", "C"],
    bass: ["G2", "D3", "E2", "B2", "C3", "G2", "D3", "D3"],
  },
  "world-02-amusement": {
    bpm: 120,
    melody: ["A5", "C6", "A5", "G5", "F5", "G5", "A5", null, "C6", "A5", "G5", "F5", "A5", "C6", "D6", "C6"],
    chords: ["F", "C", "Dm", "Bb"],
    bass: ["F2", "C3", "D2", "A2", "Bb2", "F2", "C3", "C3"],
  },
  "world-03-factory": {
    bpm: 112,
    melody: ["F#5", "A5", "D6", "A5", "F#5", "E5", "D5", null, "A4", "D5", "F#5", "A5", "B5", "A5", "F#5", "E5"],
    chords: ["D", "A", "Bm", "G"],
    bass: ["D2", "A2", "B2", "F#2", "G2", "D2", "A2", "A2"],
  },
  "world-04-rooftop": {
    bpm: 118,
    melody: ["C#5", "E5", "A5", "E5", "C#5", "B4", "A4", null, "E5", "A5", "B5", "C#6", "B5", "A5", "E5", "D5"],
    chords: ["A", "E", "Fsm", "D"],
    bass: ["A2", "E2", "F#2", "C#3", "D2", "A2", "E2", "E2"],
  },
  "world-05-kingdom": {
    bpm: 124,
    melody: ["G#5", "B5", "E6", "B5", "G#5", "F#5", "E5", null, "B4", "E5", "G#5", "B5", "C#6", "B5", "G#5", "F#5"],
    chords: ["E", "B", "Csm", "A"],
    bass: ["E2", "B2", "C#3", "G#2", "A2", "E2", "B2", "B2"],
  },
  boss: {
    bpm: 132,
    melody: ["G5", "B5", "D6", "B5", "A5", "G5", "D5", null, "B5", "D6", "G6", "D6", "C6", "B5", "A5", "G5"],
    chords: ["G", "D", "C", "D"],
    bass: ["G2", "D2", "G3", "D2", "C3", "G2", "D3", "D3"],
  },
  "ending-credits": {
    bpm: 96,
    melody: ["A5", "C6", "F6", "C6", "A5", "G5", "F5", null, "G5", "A5", "C6", "A5", "F5", "E5", "F5", "C5"],
    chords: ["F", "C", "Dm", "Bb"],
    bass: ["F2", "C3", "D2", "A2", "Bb2", "F2", "C3", "F2"],
  },
};


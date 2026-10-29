export const SOUND_KEYS = [
  "bark", "bite", "whine", "slipper-hit", "sneeze", "bowl-clang", "stray-dog-rush", "coin", "checkpoint", "cat-hiss", "death-cartoon", "stage-clear", "cat-taunt", "rib-reveal", "bag-rustle", "cat-land", "slipper-scrape", "escape-door", "boss-whistle", "magnet-hum", "world-03-drill", "world-03-excavator", "world-03-steel-impact", "world-03-boss-brick", "world-03-boss-trowel", "world-03-boss-cement",
] as const;

export const MUSIC_KEYS = [
  "world-01-peaceful", "world-01-calico",
  "birthday-warm", "world-01-alley", "world-02-amusement", "world-03-factory", "world-04-rooftop", "world-05-kingdom", "boss", "ending-credits",
] as const;

export type SoundKey = (typeof SOUND_KEYS)[number];
export type MusicKey = (typeof MUSIC_KEYS)[number];

export type FeedbackSoundKey = "coin" | "checkpoint" | "bark" | "cat-hiss" | "bite" | "world-03-drill" | "world-03-excavator" | "world-03-steel-impact" | "world-03-boss-brick" | "world-03-boss-trowel" | "world-03-boss-cement";
export const FEEDBACK_AUDIO: Readonly<Record<FeedbackSoundKey, {
  cacheKey: string; url: string; gain: number; duckMusic?: boolean;
}>> = {
  coin: { cacheKey: "feedback-coin", url: "/assets/audio/coin-pickup.wav", gain: 0.36 },
  checkpoint: { cacheKey: "feedback-checkpoint", url: "/assets/audio/checkpoint-chime.wav", gain: 0.42 },
  bark: { cacheKey: "feedback-bark", url: "/assets/audio/corgi-bark.wav", gain: 0.55 },
  bite: { cacheKey: "feedback-bite", url: "/assets/audio/corgi-bite.wav", gain: 0.50 },
  "cat-hiss": { cacheKey: "feedback-cat-hiss", url: "/assets/audio/world-02-cat-hiss.wav", gain: 0.55 },
  "world-03-drill": { cacheKey: "feedback-world-03-drill", url: "/assets/audio/world-03-construction-drill.wav", gain: 0.13, duckMusic: false },
  "world-03-excavator": { cacheKey: "feedback-world-03-excavator", url: "/assets/audio/world-03-construction-excavator.wav", gain: 0.12, duckMusic: false },
  "world-03-steel-impact": { cacheKey: "feedback-world-03-steel-impact", url: "/assets/audio/world-03-steel-impact.wav", gain: 1.0, duckMusic: true },
  "world-03-boss-brick": { cacheKey: "feedback-world-03-boss-brick", url: "/assets/audio/world-03-boss-brick.wav", gain: 0.68, duckMusic: false },
  "world-03-boss-trowel": { cacheKey: "feedback-world-03-boss-trowel", url: "/assets/audio/world-03-boss-trowel.wav", gain: 0.56, duckMusic: false },
  "world-03-boss-cement": { cacheKey: "feedback-world-03-boss-cement", url: "/assets/audio/world-03-boss-cement.wav", gain: 0.52, duckMusic: false },
};

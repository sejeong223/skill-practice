export const SOUND_KEYS = [
  "bark", "whine", "slipper-hit", "sneeze", "bowl-clang", "stray-dog-rush", "coin", "checkpoint", "cat-hiss", "death-cartoon", "stage-clear", "cat-taunt", "rib-reveal", "bag-rustle", "cat-land", "slipper-scrape", "escape-door", "boss-whistle", "magnet-hum",
] as const;

export const MUSIC_KEYS = [
  "world-01-peaceful", "world-01-calico",
  "birthday-warm", "world-01-alley", "world-02-amusement", "world-03-factory", "world-04-rooftop", "world-05-kingdom", "boss", "ending-credits",
] as const;

export type SoundKey = (typeof SOUND_KEYS)[number];
export type MusicKey = (typeof MUSIC_KEYS)[number];

export type FeedbackSoundKey = "coin" | "checkpoint" | "bark" | "cat-hiss";
export const FEEDBACK_AUDIO: Readonly<Record<FeedbackSoundKey, {
  cacheKey: string; url: string; gain: number;
}>> = {
  coin: { cacheKey: "feedback-coin", url: "/assets/audio/coin-pickup.wav", gain: 0.36 },
  checkpoint: { cacheKey: "feedback-checkpoint", url: "/assets/audio/checkpoint-chime.wav", gain: 0.42 },
  bark: { cacheKey: "feedback-bark", url: "/assets/audio/corgi-bark.wav", gain: 0.55 },
  "cat-hiss": { cacheKey: "feedback-cat-hiss", url: "/assets/audio/world-02-cat-hiss.wav", gain: 0.55 },
};

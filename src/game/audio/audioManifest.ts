export const SOUND_KEYS = [
  "bark", "whine", "slipper-hit", "sneeze", "bowl-clang", "stray-dog-rush", "coin", "checkpoint", "death-cartoon", "stage-clear", "cat-taunt", "rib-reveal", "bag-rustle", "cat-land", "slipper-scrape", "escape-door",
] as const;

export const MUSIC_KEYS = [
  "birthday-warm", "world-01-alley", "world-02-amusement", "world-03-factory", "world-04-rooftop", "world-05-kingdom", "boss", "ending-credits",
] as const;

export type SoundKey = (typeof SOUND_KEYS)[number];
export type MusicKey = (typeof MUSIC_KEYS)[number];

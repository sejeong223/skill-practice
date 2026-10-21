const SHOP_LOOP_URL = "/assets/audio/goodboy-shop-loop.wav";
const SHOP_BELL_URL = "/assets/audio/goodboy-shop-bell.wav";

export class ShopAudioController {
  private readonly music: HTMLAudioElement;
  private readonly bell: HTMLAudioElement;
  private open = false;
  private destroyed = false;

  public constructor(
    createAudio: (url: string) => HTMLAudioElement = url => new Audio(url),
    private readonly visibilityTarget: Document = document,
  ) {
    this.music = createAudio(SHOP_LOOP_URL);
    this.music.loop = true;
    this.music.volume = 0.18;
    this.music.preload = "auto";
    this.bell = createAudio(SHOP_BELL_URL);
    this.bell.volume = 0.38;
    this.bell.preload = "auto";
    this.visibilityTarget.addEventListener("visibilitychange", this.onVisibilityChange);
    this.visibilityTarget.addEventListener("pointerdown", this.onUserGesture);
    this.visibilityTarget.addEventListener("keydown", this.onUserGesture);
  }

  public async enter(): Promise<void> {
    if (this.destroyed || this.open) return;
    this.open = true;
    this.bell.currentTime = 0;
    await Promise.all([this.playSafely(this.bell), this.playSafely(this.music)]);
  }

  public async exit(): Promise<void> {
    if (this.destroyed || !this.open) return;
    this.open = false;
    this.music.pause();
    this.music.currentTime = 0;
    this.bell.currentTime = 0;
    await this.playSafely(this.bell);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.open = false;
    this.visibilityTarget.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.visibilityTarget.removeEventListener("pointerdown", this.onUserGesture);
    this.visibilityTarget.removeEventListener("keydown", this.onUserGesture);
    this.music.pause();
    this.bell.pause();
    this.music.removeAttribute("src");
    this.bell.removeAttribute("src");
    this.music.load();
    this.bell.load();
  }

  private readonly onVisibilityChange = (): void => {
    if (!this.open || this.destroyed) return;
    if (this.visibilityTarget.hidden) this.music.pause();
    else void this.playSafely(this.music);
  };

  private readonly onUserGesture = (): void => {
    if (this.open && !this.destroyed && !this.visibilityTarget.hidden && this.music.paused) {
      void this.playSafely(this.music);
    }
  };

  private async playSafely(sound: HTMLAudioElement): Promise<void> {
    try {
      await sound.play();
    } catch {
      // Browser autoplay policy or unavailable audio never blocks the shop UI.
    }
  }
}

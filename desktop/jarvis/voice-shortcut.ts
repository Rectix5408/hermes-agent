export interface VoiceShortcutBridge { register(phrase: string, listener: () => void): () => void }

/** Native shortcut seam; this layer deliberately never starts audio capture. */
export class VoiceShortcut {
  private unregister?: () => void
  constructor(private readonly bridge?: VoiceShortcutBridge) {}
  enable(onWake: () => void): void { this.disable(); this.unregister = this.bridge?.register('Hey Jarvis', onWake) }
  disable(): void { this.unregister?.(); this.unregister = undefined }
}

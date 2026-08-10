/**
 * Tiny WebAudio "interaction sounds" helper. No audio asset files needed —
 * every sound is synthesized on the fly with a short oscillator + gain
 * envelope, so it stays lightweight and works offline.
 *
 * Every call already checks `settingsStore.soundEffects` internally via the
 * `playIfEnabled` wrapper the UI components use, but the raw `playTone` is
 * exported too in case a caller wants to bypass the setting on purpose.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function playTone(frequency = 720, duration = 0.045, volume = 0.05, type: OscillatorType = 'sine') {
  try {
    const audioCtx = getContext();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  } catch {
    /* audio not available (e.g. autoplay policy before first gesture) — no-op */
  }
}

export const playClickSound = () => playTone(680, 0.04, 0.045);
export const playToggleOnSound = () => playTone(880, 0.05, 0.05);
export const playToggleOffSound = () => playTone(420, 0.05, 0.05);

/** Only plays if `enabled` is true — call sites pass `settingsStore.soundEffects`. */
export function playIfEnabled(enabled: boolean, sound: () => void) {
  if (enabled) sound();
}

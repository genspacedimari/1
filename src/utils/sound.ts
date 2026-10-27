/**
 * Tiny WebAudio "interaction sounds" helper. No audio asset files needed —
 * every sound is synthesized on the fly with a short oscillator + gain
 * envelope, so it stays lightweight and works offline.
 *
 * Every call already checks `settingsStore.soundEffects` internally via the
 * `playIfEnabled` wrapper the UI components use, but the raw `playTone` is
 * exported too in case a caller wants to bypass the setting on purpose.
 *
 * `triggerInteractionFeedback` is the main entry point for the global
 * interaction interceptor — it checks both soundEffects AND hapticFeedback
 * from the store itself, with a 35 ms debounce guard to prevent double-
 * firing when a component (like Switch) also triggers feedback.
 */

import { useSettingsStore } from '@/stores/settingsStore';
import { triggerHaptic } from '@/utils/haptics';

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Unlock AudioContext on first user gesture — called once globally. */
export function unlockAudioContext() {
  getContext();
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
export const playTabSound = () => playTone(520, 0.035, 0.04, 'sine');
export const playNavSound = () => playTone(600, 0.04, 0.04, 'sine');
export const playToggleOnSound = () => playTone(880, 0.05, 0.05);
export const playToggleOffSound = () => playTone(420, 0.05, 0.05);

/** Only plays if `enabled` is true — call sites pass `settingsStore.soundEffects`. */
export function playIfEnabled(enabled: boolean, sound: () => void) {
  if (enabled) sound();
}

// ─── Global interaction debounce guard ───────────────────────────────────────
// Prevents double-firing when a component (Switch, Segmented, Button) AND the
// global capture listener both trigger feedback for the same physical event.
let _lastFeedbackAt = 0;
const DEBOUNCE_MS = 35;

export type FeedbackType = 'click' | 'toggle' | 'tab' | 'nav';

/**
 * Single entry-point called by every interactive element AND by the global
 * capture-phase listener.  Reads settings from the store at call time so it
 * always reflects the latest toggle state without prop drilling.
 *
 * Returns `true` if feedback was actually dispatched (not debounced).
 */
export function triggerInteractionFeedback(type: FeedbackType = 'click'): boolean {
  const now = performance.now();
  if (now - _lastFeedbackAt < DEBOUNCE_MS) return false;
  _lastFeedbackAt = now;

  const { soundEffects, hapticFeedback } = useSettingsStore.getState();

  if (soundEffects) {
    switch (type) {
      case 'toggle': break; // Switch handles its own on/off tone
      case 'tab':   playTabSound(); break;
      case 'nav':   playNavSound(); break;
      default:      playClickSound(); break;
    }
  }

  if (hapticFeedback) {
    triggerHaptic(type === 'nav' ? 8 : 10);
  }

  return true;
}

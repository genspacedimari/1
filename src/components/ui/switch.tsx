import { cn } from '@/utils/cn';
import { useSettingsStore } from '@/stores/settingsStore';
import { playToggleOnSound, playToggleOffSound } from '@/utils/sound';
import { triggerHapticIfEnabled } from '@/utils/haptics';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  'aria-label'?: string;
}

export function Switch({ checked, onChange, ...rest }: SwitchProps) {
  // Read directly from the store (not props) so every Switch in the app —
  // including the ones that toggle these settings themselves — reacts to
  // Sound Effects / Haptic Feedback immediately, with no prop drilling.
  const soundEffects = useSettingsStore((s) => s.soundEffects);
  const hapticFeedback = useSettingsStore((s) => s.hapticFeedback);

  const handleClick = () => {
    const next = !checked;
    if (soundEffects) (next ? playToggleOnSound : playToggleOffSound)();
    triggerHapticIfEnabled(hapticFeedback, 10);
    onChange(next);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={handleClick}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200',
        checked ? 'bg-primary' : 'bg-muted dark:bg-white/15'
      )}
      style={{ minWidth: 44 }}
      {...rest}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );
}

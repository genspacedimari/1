import { cn } from '@/utils/cn';
import { triggerInteractionFeedback } from '@/utils/sound';

interface SegmentedProps<T extends string | number> {
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
  'aria-label'?: string;
  className?: string;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
  ...rest
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'inline-flex w-full sm:w-auto items-center gap-1 rounded-2xl bg-muted/70 p-1 dark:bg-white/5',
        className
      )}
      {...rest}
    >
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => {
            // Consume debounce slot so global listener doesn't double-fire
            triggerInteractionFeedback('tab');
            onChange(opt.value);
          }}
          className={cn(
            'flex flex-1 sm:flex-initial min-h-[36px] items-center justify-center rounded-xl px-3.5 py-1.5 text-xs font-medium leading-tight whitespace-nowrap transition-all duration-200 select-none',
            value === opt.value
              ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

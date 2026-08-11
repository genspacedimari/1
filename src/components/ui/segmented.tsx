import { cn } from '@/utils/cn';

interface SegmentedProps<T extends string | number> {
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
  'aria-label'?: string;
}

export function Segmented<T extends string | number>({ value, options, onChange, ...rest }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      className="inline-flex max-w-full flex-wrap gap-0.5 rounded-2xl bg-muted p-1 dark:bg-white/5 sm:flex-nowrap sm:gap-0"
      {...rest}
    >
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex min-h-[44px] items-center justify-center rounded-xl px-2.5 py-1.5 text-xs font-medium leading-tight transition-all duration-200 sm:min-h-[36px] sm:px-3',
            value === opt.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

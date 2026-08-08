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
      className="inline-flex rounded-2xl bg-muted p-1 dark:bg-white/5"
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
            'rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200',
            value === opt.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          style={{ minHeight: 36 }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

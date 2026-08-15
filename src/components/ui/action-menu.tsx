import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';

export interface ActionMenuItem {
  icon: React.ComponentType<{ size?: number | string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
}

/**
 * A "..." (or labeled) button that opens a dropdown of actions.
 *
 * Why a portal: each card in a list (Card + framer-motion's motion.div)
 * creates its own CSS stacking context. An `absolute`/`z-30` menu nested
 * inside card #1 can never visually sit above card #2's content even with
 * a high z-index — z-index only resolves *within* a stacking context, and
 * card #2 paints as a whole after card #1 regardless. Portaling the menu
 * to document.body and positioning it with fixed coordinates escapes that
 * entirely, so it always renders on top of every card.
 */
export function ActionMenu({ trigger, items, align = 'right', menuWidth = 176 }: {
  trigger: (props: { onClick: () => void; open: boolean }) => ReactNode;
  items: ActionMenuItem[];
  align?: 'left' | 'right';
  menuWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const left = align === 'right' ? Math.max(8, rect.right - menuWidth) : rect.left;
      setPos({ top: rect.bottom + 4, left: Math.min(left, window.innerWidth - menuWidth - 8) });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  const visibleItems = items.filter((i) => !i.hidden);

  return (
    <div ref={triggerRef} className="relative shrink-0">
      {trigger({ onClick: toggle, open })}
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <div
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: menuWidth }}
            className="z-[101] rounded-2xl border border-border bg-surface py-1 shadow-lg dark:border-border-dark dark:bg-surface-dark"
          >
            {visibleItems.map((item) => (
              <button
                key={item.label}
                onClick={() => { item.onClick(); setOpen(false); }}
                className={cn('flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted/30', item.danger && 'text-red-500')}
              >
                <item.icon size={16} /> {item.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

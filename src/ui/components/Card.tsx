// PANTHÉON shared Card primitive (T-005 UX).
//
// Used for god-portrait tiles, settings groups, and results-stat blocks.
// The `selected` affordance pairs a gold border AND a shape cue (inset corner
// tick) — never color-alone per DESIGN §13. `muted` dims the card for
// "coming soon" lock states on the god-select.

import type { HTMLAttributes, ReactNode } from 'react';
import { useAppStore } from '../../state/store';

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'> {
  children: ReactNode;
  /** Optional header node rendered above children (renamed from `title` to avoid collision with the HTML `title` attribute). */
  header?: ReactNode;
  selected?: boolean;
  muted?: boolean;
  interactive?: boolean;
  accentColor?: string;
}

export function Card({
  children,
  header,
  selected = false,
  muted = false,
  interactive = false,
  accentColor,
  className = '',
  ...rest
}: Props) {
  const highContrast = useAppStore((s) => s.settings.accessibility.highContrast);

  const selectionRing = selected
    ? highContrast
      ? 'ring-4 ring-[color:var(--panth-accent-gold)] ring-offset-2 ring-offset-[color:var(--panth-bg)]'
      : 'ring-2 ring-[color:var(--panth-accent-gold)]'
    : '';
  const borderClass = highContrast ? 'border-2 border-white/40' : 'border border-white/10';
  const interactiveClass = interactive
    ? 'cursor-pointer transition-transform hover:-translate-y-0.5 hover:border-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panth-accent-gold)]'
    : '';
  const mutedClass = muted ? 'opacity-50 grayscale' : '';

  return (
    <div
      {...rest}
      aria-selected={interactive ? selected : undefined}
      className={[
        'relative flex flex-col gap-3 rounded-xl bg-black/40 p-4 backdrop-blur-sm',
        borderClass,
        selectionRing,
        interactiveClass,
        mutedClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {accentColor !== undefined && (
        <span
          aria-hidden
          className="absolute left-0 top-3 bottom-3 w-1 rounded-r-md"
          style={{ backgroundColor: accentColor }}
        />
      )}
      {selected && (
        <span
          aria-hidden
          className="absolute right-2 top-2 text-xs text-[color:var(--panth-accent-gold)]"
        >
          {'\u25C9'}
        </span>
      )}
      {header !== undefined && (
        <div className="text-sm font-semibold text-[color:var(--panth-ink)]">{header}</div>
      )}
      {children}
    </div>
  );
}

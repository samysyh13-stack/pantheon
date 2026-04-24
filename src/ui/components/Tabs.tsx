// PANTHÉON shared Tabs primitive (T-005 UX).
//
// Implements the WAI-ARIA tabs pattern with arrow-key navigation:
//   - Left/Right (or Up/Down) moves focus between tabs and activates
//   - Home / End jump to first / last
// Automatic activation on focus is used (the panel switches when focus
// lands) — this is the "automatic activation" variant of the ARIA pattern,
// recommended when panel switching is cheap.

import type { ReactNode, KeyboardEvent } from 'react';
import { useId, useRef } from 'react';
import { useAppStore } from '../../state/store';

export interface TabDef {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface Props {
  tabs: readonly TabDef[];
  activeId: string;
  onChange: (id: string) => void;
  children: ReactNode;
  ariaLabel?: string;
}

export function Tabs({ tabs, activeId, onChange, children, ariaLabel }: Props) {
  const groupId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const highContrast = useAppStore((s) => s.settings.accessibility.highContrast);

  const focusIndex = (i: number) => {
    const idx = ((i % tabs.length) + tabs.length) % tabs.length;
    const el = refs.current[idx];
    if (el) el.focus();
    const t = tabs[idx];
    if (t) onChange(t.id);
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        focusIndex(currentIndex + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        focusIndex(currentIndex - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusIndex(0);
        break;
      case 'End':
        e.preventDefault();
        focusIndex(tabs.length - 1);
        break;
      default:
        break;
    }
  };

  const activeBorder = highContrast
    ? 'border-b-4 border-[color:var(--panth-accent-gold)] text-[color:var(--panth-ink)]'
    : 'border-b-2 border-[color:var(--panth-accent-gold)] text-[color:var(--panth-ink)]';
  const inactiveBorder = 'border-b-2 border-transparent text-[color:var(--panth-ink-dim)]';

  return (
    <div className="flex h-full w-full flex-col">
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex gap-1 overflow-x-auto border-b border-white/10"
      >
        {tabs.map((t, i) => {
          const isActive = t.id === activeId;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              id={`${groupId}-tab-${t.id}`}
              aria-selected={isActive}
              aria-controls={`${groupId}-panel-${t.id}`}
              tabIndex={isActive ? 0 : -1}
              onKeyDown={(e) => onKey(e, i)}
              onClick={() => onChange(t.id)}
              className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap px-4 py-2 text-sm transition-colors hover:text-[color:var(--panth-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panth-accent-gold)] ${
                isActive ? activeBorder : inactiveBorder
              }`}
            >
              {t.icon !== undefined && (
                <span aria-hidden className="inline-flex">
                  {t.icon}
                </span>
              )}
              {t.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${groupId}-panel-${activeId}`}
        aria-labelledby={`${groupId}-tab-${activeId}`}
        className="min-h-0 flex-1 overflow-y-auto p-4"
      >
        {children}
      </div>
    </div>
  );
}

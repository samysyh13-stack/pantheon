// PANTHÉON shared Toggle primitive (T-005 UX).
//
// Native <button role="switch"> with aria-checked. Visual state is conveyed
// both by color (gold = on) AND by thumb position + text — colorblind safe
// per DESIGN §13. The hit area is the whole row so the label is tappable on
// mobile (≥ 44 pt combined).

import type { ReactNode } from 'react';
import { useId } from 'react';
import { useAppStore } from '../../state/store';

interface Props {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, description, disabled = false }: Props) {
  const id = useId();
  const highContrast = useAppStore((s) => s.settings.accessibility.highContrast);

  const trackClass = checked
    ? highContrast
      ? 'bg-[color:var(--panth-accent-gold)] border-2 border-white'
      : 'bg-[color:var(--panth-accent-gold)]'
    : highContrast
      ? 'bg-white/10 border-2 border-[color:var(--panth-ink)]/60'
      : 'bg-white/15';

  return (
    <label
      htmlFor={id}
      className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1 ${
        disabled ? 'pointer-events-none opacity-50' : 'hover:bg-white/5'
      }`}
    >
      <span className="flex flex-col">
        <span className="text-sm text-[color:var(--panth-ink)]">{label}</span>
        {description !== undefined && (
          <span className="text-xs text-[color:var(--panth-ink-dim)]">{description}</span>
        )}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panth-accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--panth-bg)] ${trackClass}`}
      >
        <span
          aria-hidden
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
        {/* Shape cue for colorblind safety — checkmark glyph overlaid when on */}
        <span
          aria-hidden
          className={`absolute left-1.5 text-[10px] font-bold leading-none text-black/80 ${
            checked ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {'\u2713'}
        </span>
      </button>
    </label>
  );
}

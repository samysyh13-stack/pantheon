// PANTHÉON shared Select primitive (T-005 UX).
//
// Uses a native <select> for mobile a11y — browsers render OS-native wheel
// pickers on iOS / Android, which solves keyboard nav and screen reader
// support for free. A custom dropdown would need full ARIA combobox plumbing;
// native gives us that out of the box.
//
// We wrap the control so we can style the chevron and value row without
// losing the native popup. A light disabled-option note inline (per option)
// supports the "requires browser support" flag next to webgpu.

import type { ReactNode } from 'react';
import { useId } from 'react';
import { useAppStore } from '../../state/store';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
  note?: string;
}

interface Props<T extends string> {
  label: ReactNode;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  description?: string;
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  description,
}: Props<T>) {
  const id = useId();
  const highContrast = useAppStore((s) => s.settings.accessibility.highContrast);
  const active = options.find((o) => o.value === value);

  const borderClass = highContrast
    ? 'border-2 border-[color:var(--panth-ink)]'
    : 'border border-white/20';

  return (
    <div className="flex w-full flex-col gap-1">
      <label htmlFor={id} className="text-sm text-[color:var(--panth-ink)]">
        {label}
      </label>
      {description !== undefined && (
        <span className="text-xs text-[color:var(--panth-ink-dim)]">{description}</span>
      )}
      <div className={`relative flex min-h-11 items-center rounded-md bg-black/40 ${borderClass}`}>
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.value as T)}
          className="w-full cursor-pointer appearance-none bg-transparent px-3 py-2 pr-9 text-sm text-[color:var(--panth-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panth-accent-gold)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
              {o.note !== undefined ? ` — ${o.note}` : ''}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 text-[color:var(--panth-ink-dim)]"
        >
          {'\u25BE'}
        </span>
      </div>
      {active?.note !== undefined && (
        <span className="text-xs italic text-[color:var(--panth-ink-dim)]">{active.note}</span>
      )}
    </div>
  );
}

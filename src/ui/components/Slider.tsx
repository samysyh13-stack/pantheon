// PANTHÉON shared Slider primitive (T-005 UX).
//
// Wraps a native <input type="range"> for perfect mobile + keyboard + screen
// reader behavior. The visible value display keeps the control legible at a
// glance on 44×44 pt touch targets.
//
// Accessibility:
//   - `aria-valuenow`, `aria-valuemin`, `aria-valuemax` are set natively by
//     the browser on <input type="range">; we also forward the label via
//     htmlFor/id pairing.
//   - High-contrast mode thickens the track so the slider is visible against
//     the arena backdrop behind a translucent settings panel.
//   - Value display uses a numeric format helper — cognitive-load-friendly.

import { useId } from 'react';
import { useAppStore } from '../../state/store';

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  disabled?: boolean;
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  format,
  disabled = false,
}: Props) {
  const id = useId();
  const highContrast = useAppStore((s) => s.settings.accessibility.highContrast);

  const displayed = format
    ? format(value)
    : max <= 1
      ? `${Math.round(value * 100)}%`
      : value.toFixed(2);

  const trackClass = highContrast
    ? 'h-2 appearance-none rounded-full bg-[color:var(--panth-ink)]/25 accent-[color:var(--panth-accent-gold)]'
    : 'h-1.5 appearance-none rounded-full bg-white/15 accent-[color:var(--panth-accent-gold)]';

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id} className="text-[color:var(--panth-ink)]">
          {label}
        </label>
        <span
          aria-live="polite"
          className="tabular-nums text-[color:var(--panth-ink-dim)]"
        >
          {displayed}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        className={`${trackClass} w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50`}
      />
    </div>
  );
}

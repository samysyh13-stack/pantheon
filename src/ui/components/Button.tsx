// PANTHÉON shared Button primitive (T-005 UX).
//
// Three variants:
//   - primary: solid gold accent for the dominant action on a screen
//   - secondary: outline with hover fill — for "Back", alternate actions
//   - ghost: no border, text-only — for tertiary links / footer actions
//
// Mobile-first sizing: every variant hits the 44×44 pt minimum touch target
// via `min-h-11 min-w-11` (Tailwind v4 spacing: 11 = 2.75rem = 44px).
// Text is ≥ 14 px per DESIGN §13 accessibility minimum.
//
// Loading state disables the button and shows a spinner in place of the icon;
// the label stays visible so the target width doesn't jump.
//
// Colorblind safety: disabled and loading states are distinguishable by
// opacity + spinner + pointer-events, never by color alone (DESIGN §13).

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useAppStore } from '../../state/store';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  className = '',
  type = 'button',
  ...rest
}: Props) {
  const highContrast = useAppStore((s) => s.settings.accessibility.highContrast);

  const base =
    'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panth-accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--panth-bg)] disabled:cursor-not-allowed disabled:opacity-50';

  const variants: Record<ButtonVariant, string> = {
    primary: highContrast
      ? 'bg-[color:var(--panth-accent-gold)] text-black border-2 border-white hover:brightness-110 active:brightness-95'
      : 'bg-[color:var(--panth-accent-gold)] text-black hover:brightness-110 active:brightness-95',
    secondary: highContrast
      ? 'border-2 border-[color:var(--panth-ink)] text-[color:var(--panth-ink)] hover:bg-[color:var(--panth-ink)]/15'
      : 'border border-[color:var(--panth-accent-gold)] text-[color:var(--panth-accent-gold)] hover:bg-[color:var(--panth-accent-gold)]/10',
    ghost: 'text-[color:var(--panth-ink)] hover:bg-white/10',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading}
      className={[base, variants[variant], widthClass, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : icon !== undefined ? (
        <span aria-hidden className="inline-flex">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}

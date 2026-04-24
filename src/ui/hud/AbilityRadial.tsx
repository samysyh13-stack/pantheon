// Signature-ability icon with a SVG cooldown radial overlay. When the
// cooldown is active, a conic-wedge fills counter-clockwise revealing the
// ready state. Pairs with a keyboard hint (RMB by default).

import { useAppStore } from '../../state/store';

interface Props {
  /** Lucide-like glyph to render inside the icon frame. Keep it a single
   *  character or short SVG path; icon-pack imports come in Phase 4. */
  icon?: string;
  /** Keymap hint label displayed beneath the icon. */
  hint?: string;
}

export function AbilityRadial({ icon = '◉', hint = 'RMB' }: Props) {
  const cdMs = useAppStore((s) => s.match.playerAbilityCdMs);
  const maxCdMs = useAppStore((s) => s.match.playerAbilityMaxCdMs);
  const reducedMotion = useAppStore((s) => s.settings.accessibility.reducedMotion);

  const ratio = maxCdMs > 0 ? Math.max(0, Math.min(1, cdMs / maxCdMs)) : 0;
  const ready = ratio <= 0;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);
  const transition = reducedMotion ? '' : 'transition-[stroke-dashoffset] duration-100 linear';

  return (
    <div className="pointer-events-none flex flex-col items-center gap-1">
      <div
        className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 ${
          ready
            ? 'border-[color:var(--panth-accent-gold)] bg-black/50'
            : 'border-[color:var(--panth-ink-dim)]/40 bg-black/70'
        }`}
        role="img"
        aria-label={ready ? 'Ability ready' : `Ability cooldown ${Math.ceil(cdMs / 1000)} s`}
      >
        <svg className="absolute inset-0" viewBox="-32 -32 64 64" width="64" height="64">
          <circle
            r={radius}
            cx={0}
            cy={0}
            fill="none"
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={3}
          />
          {!ready ? (
            <circle
              r={radius}
              cx={0}
              cy={0}
              fill="none"
              stroke="var(--panth-accent-gold)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className={transition}
              transform="rotate(-90)"
            />
          ) : null}
        </svg>
        <span
          className={`relative z-10 text-2xl ${
            ready ? 'text-[color:var(--panth-accent-gold)]' : 'text-[color:var(--panth-ink-dim)]'
          }`}
        >
          {icon}
        </span>
      </div>
      <span className="text-[10px] uppercase tracking-wide text-[color:var(--panth-ink-dim)]">
        {hint}
      </span>
      {!ready ? (
        <span className="text-xs text-[color:var(--panth-ink)]" aria-hidden="true">
          {Math.ceil(cdMs / 1000)}s
        </span>
      ) : null}
    </div>
  );
}

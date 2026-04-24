// Ultimate-charge radial. A bigger-than-ability ring that fills clockwise
// as charge accumulates. When charged (≥ 1.0), pulses subtly and adds a
// golden glow to signal readiness; the pulse disables under reducedMotion.

import { useAppStore } from '../../state/store';

export function UltimateRadial() {
  const charge = useAppStore((s) => s.match.playerUltCharge);
  const reducedMotion = useAppStore((s) => s.settings.accessibility.reducedMotion);

  const clamped = Math.max(0, Math.min(1, charge));
  const ready = clamped >= 1;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);
  const transition = reducedMotion ? '' : 'transition-[stroke-dashoffset] duration-150 linear';
  const pulseClass = ready && !reducedMotion ? 'animate-pulse' : '';

  return (
    <div className="pointer-events-none flex flex-col items-center gap-1">
      <div
        className={`relative flex h-20 w-20 items-center justify-center rounded-full border-2 ${pulseClass} ${
          ready
            ? 'border-[color:var(--panth-accent-gold)] bg-black/50 shadow-[0_0_20px_rgba(212,162,74,0.6)]'
            : 'border-[color:var(--panth-ink-dim)]/40 bg-black/70'
        }`}
        role="img"
        aria-label={ready ? 'Ultimate ready' : `Ultimate charge ${Math.round(clamped * 100)}%`}
      >
        <svg className="absolute inset-0" viewBox="-40 -40 80 80" width="80" height="80">
          <circle
            r={radius}
            cx={0}
            cy={0}
            fill="none"
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={4}
          />
          {clamped > 0 ? (
            <circle
              r={radius}
              cx={0}
              cy={0}
              fill="none"
              stroke={ready ? 'var(--panth-accent-gold)' : '#c9c4b7'}
              strokeWidth={4}
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
          aria-hidden="true"
        >
          ✦
        </span>
      </div>
      <span className="text-[10px] uppercase tracking-wide text-[color:var(--panth-ink-dim)]">
        SPACE
      </span>
    </div>
  );
}

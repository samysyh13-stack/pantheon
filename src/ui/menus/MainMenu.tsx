// Main menu — Phase 1 stub. UX subagent (T-005 in Phase 1, expanded in Phase 2)
// implements the full god-select, settings, and tutorial-entry flows.

interface Props {
  onPlay: () => void;
}

export function MainMenu({ onPlay }: Props) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-center gap-4 rounded-2xl bg-black/50 px-10 py-8 backdrop-blur-sm">
        <h1 className="text-5xl font-semibold tracking-tight text-[color:var(--panth-ink)]">
          PANTHÉON
        </h1>
        <p className="text-sm text-[color:var(--panth-ink-dim)]">Phase 1 — Technical foundation</p>
        <div className="mt-3 flex flex-col gap-2">
          <button
            onClick={onPlay}
            className="rounded-lg border border-[color:var(--panth-accent-gold)] px-6 py-2 text-[color:var(--panth-accent-gold)] transition-colors hover:bg-[color:var(--panth-accent-gold)]/10"
          >
            Play
          </button>
          <button
            disabled
            className="rounded-lg border border-[color:var(--panth-ink-dim)]/30 px-6 py-2 text-[color:var(--panth-ink-dim)]"
          >
            Gods
          </button>
          <button
            disabled
            className="rounded-lg border border-[color:var(--panth-ink-dim)]/30 px-6 py-2 text-[color:var(--panth-ink-dim)]"
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}

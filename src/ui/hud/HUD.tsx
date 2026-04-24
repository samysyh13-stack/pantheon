// In-match HUD — Phase 1 stub with virtual joystick slots.
// UX subagent fully wires health bar, ability cooldowns, ultimate charge, timer
// in Phase 2 (task T-106).

interface Props {
  onExit: () => void;
}

export function HUD({ onExit }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* top-left: match timer stub */}
      <div className="safe-top absolute left-4 top-4 rounded-md bg-black/40 px-3 py-1 text-sm text-[color:var(--panth-ink)]">
        00:00
      </div>
      {/* top-right: pause/exit */}
      <div className="safe-top pointer-events-auto absolute right-4 top-4">
        <button
          onClick={onExit}
          className="rounded-md bg-black/40 px-3 py-1 text-sm text-[color:var(--panth-ink)] hover:bg-black/60"
        >
          Menu
        </button>
      </div>
      {/* bottom-left: virtual move joystick anchor */}
      <div
        id="joystick-left"
        className="safe-bottom pointer-events-auto absolute bottom-8 left-8 h-36 w-36"
      />
      {/* bottom-right: virtual aim joystick + buttons anchor */}
      <div
        id="joystick-right"
        className="safe-bottom pointer-events-auto absolute bottom-8 right-8 h-36 w-36"
      />
    </div>
  );
}

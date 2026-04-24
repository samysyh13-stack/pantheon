// In-match HUD — Phase 2 T-106 expanded layout.
//
// Layout (landscape):
//   top-left:      HPBar (signature color, red + ▼ glyph at <30%)
//   top-center:    MatchTimer (MM:SS)
//   top-right:     Menu button (opens PauseMenu via App)
//   top-right-2:   ScoreBar "You" pill
//   top-left-2:    ScoreBar "Bot" pill (mirrored to left of center)
//   bottom-left:   #joystick-left anchor (touch-device virtual move joystick)
//   bottom-right:  AbilityRadial + UltimateRadial
//   bottom-right-2: #joystick-right anchor (touch-device aim joystick)
//
// All HUD elements are pointer-events-none except the Menu button.
// Damage numbers + kill feed land in Phase 3 T-106 polish when real hit
// events wire through from the combat layer.

import { HPBar } from './HPBar';
import { AbilityRadial } from './AbilityRadial';
import { UltimateRadial } from './UltimateRadial';
import { MatchTimer } from './MatchTimer';
import { ScoreBar } from './ScoreBar';

interface Props {
  onExit: () => void;
}

export function HUD({ onExit }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <HPBar />
      <MatchTimer />
      <ScoreBar />

      {/* top-right: pause / menu */}
      <div className="safe-top pointer-events-auto absolute right-4 top-4">
        <button
          onClick={onExit}
          className="rounded-md bg-black/50 px-3 py-1 text-sm text-[color:var(--panth-ink)] hover:bg-black/70"
        >
          Menu
        </button>
      </div>

      {/* bottom-left: virtual move joystick anchor */}
      <div
        id="joystick-left"
        className="safe-bottom pointer-events-auto absolute bottom-8 left-8 h-36 w-36"
      />

      {/* bottom-right: ability + ultimate stack, with joystick anchor above for touch */}
      <div className="safe-bottom safe-right absolute bottom-8 right-8 flex items-end gap-4">
        <AbilityRadial />
        <UltimateRadial />
      </div>
      <div
        id="joystick-right"
        className="safe-bottom pointer-events-auto absolute bottom-44 right-8 h-36 w-36"
      />
    </div>
  );
}

// PANTHÉON screen router (T-005 UX).
//
// Reads `match.screen` from the store and renders the corresponding menu /
// overlay. This component owns ONLY the 2D UI layer — Canvas and HUD stay
// in App.tsx so gameplay can keep running behind the menu layer (per the
// DESIGN §12 "no modal dialogs during gameplay" rule, which applies to the
// match screen specifically).
//
// Screen map:
//   - 'menu'       → MainMenu
//   - 'god-select' → GodSelect
//   - 'loading'    → lightweight spinner placeholder (real asset-load UI
//                    lands when the match bootstrap task does; see
//                    /docs/PROGRESS.md Phase 2)
//   - 'match'      → null (HUD is rendered by App.tsx; PauseMenu too)
//   - 'results'    → Results

import { useAppStore } from '../state/store';
import { MainMenu } from './menus/MainMenu';
import { GodSelect } from './menus/GodSelect';
import { Results } from './menus/Results';
import { TutorialOverlay } from './menus/TutorialOverlay';

export function Screens() {
  const screen = useAppStore((s) => s.match.screen);
  const lastMatchResult = useAppStore((s) => s.match.lastMatchResult);

  let content: React.ReactNode = null;
  switch (screen) {
    case 'menu':
      content = <MainMenu />;
      break;
    case 'god-select':
      content = <GodSelect />;
      break;
    case 'loading':
      content = <LoadingScreen />;
      break;
    case 'match':
      content = null;
      break;
    case 'results':
      content = lastMatchResult ? (
        <Results
          outcome={lastMatchResult.outcome}
          stats={{
            damageDealt: lastMatchResult.damageDealt,
            damageTaken: lastMatchResult.damageTaken,
            durationSeconds: lastMatchResult.durationSeconds,
            kills: lastMatchResult.kills,
          }}
        />
      ) : (
        <Results />
      );
      break;
  }

  return (
    <>
      {content}
      {/* TutorialOverlay auto-shows on first visit (gated by hasSeenTutorial) */}
      <TutorialOverlay />
    </>
  );
}

function LoadingScreen() {
  return (
    <div className="safe-top safe-bottom safe-left safe-right absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
      <div
        aria-hidden
        className="h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--panth-accent-gold)] border-t-transparent"
      />
      <p className="mt-4 text-sm uppercase tracking-widest text-[color:var(--panth-ink-dim)]">
        {'Loading match\u2026'}
      </p>
    </div>
  );
}

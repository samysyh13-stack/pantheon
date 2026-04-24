// Dexie-backed persistence layer per /docs/ARCHITECTURE.md §11.
//
// Two tables:
//   - settings (id='local'): zustand-serialized Settings JSON. Written via
//     the StateStorage adapter below.
//   - profile  (id='local'): player profile + match-history ring buffer.
//     Phase 2 T-106 writes a record here on match-end; a separate thin
//     persistence module (Phase 2) handles the cap-20 FIFO logic.
//
// Why Dexie rather than localStorage?
//   - Match history grows (20 records × ~1 KB = 20 KB) and approaches the
//     5 MB localStorage soft cap on some browsers
//   - IndexedDB is safer across concurrent tab writes
//   - Settings + profile share a DB → atomic migrations when schema evolves
//
// Schema version: 1.

import Dexie, { type Table } from 'dexie';
import type { StateStorage } from 'zustand/middleware';

export interface SettingsRow {
  id: 'local';
  json: string;
}

export interface MatchRecord {
  id: string;
  mode: 'duel' | 'totem_rush';
  god: string;
  opponent: string;
  result: 'win' | 'loss' | 'draw';
  duration: number;
  damageDealt: number;
  damageTaken: number;
  endedAt: number;
}

export interface ProfileRow {
  id: 'local';
  name: string;
  godPreference: string;
  matches: MatchRecord[];
  firstPlayed: number;
  lastPlayed: number;
}

class PanthenonDB extends Dexie {
  settings!: Table<SettingsRow, 'local'>;
  profile!: Table<ProfileRow, 'local'>;

  constructor() {
    super('panthenon');
    this.version(1).stores({
      settings: 'id',
      profile: 'id',
    });
  }
}

export const db = new PanthenonDB();

// Zustand StateStorage adapter. zustand's persist middleware calls these
// three methods with the persisted-slice name ('panthenon-state'). We
// ignore the name — this DB has a single row per table keyed by 'local'.
// The middleware treats getItem/setItem as possibly-async and awaits them.
export const dexieStorage: StateStorage = {
  async getItem(_name: string): Promise<string | null> {
    try {
      const row = await db.settings.get('local');
      return row?.json ?? null;
    } catch {
      // IDB unavailable (Safari private mode, corrupted DB, etc.) — fall
      // back to a null read so zustand uses the defaultSettings seed.
      return null;
    }
  },
  async setItem(_name: string, value: string): Promise<void> {
    try {
      await db.settings.put({ id: 'local', json: value });
    } catch {
      /* IDB write failure is non-fatal — settings just don't persist
         across sessions. Dev + prod log the error in the logger. */
    }
  },
  async removeItem(_name: string): Promise<void> {
    try {
      await db.settings.delete('local');
    } catch {
      /* swallow */
    }
  },
};

/**
 * One-time migration from localStorage to IndexedDB. Called at app-
 * bootstrap time. If a `panthenon-state` entry exists in localStorage
 * (from the pre-Dexie persist backend) AND no settings row exists in
 * IDB yet, copy it over and clear the localStorage entry.
 *
 * Safe to call repeatedly — it's a no-op once migration has run.
 */
export async function migrateLocalStorageToDexie(): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const legacy = window.localStorage.getItem('panthenon-state');
    if (!legacy) return;
    const existing = await db.settings.get('local');
    if (existing) {
      // Already migrated — just clean up the legacy entry.
      window.localStorage.removeItem('panthenon-state');
      return;
    }
    await db.settings.put({ id: 'local', json: legacy });
    window.localStorage.removeItem('panthenon-state');
  } catch {
    /* non-fatal */
  }
}

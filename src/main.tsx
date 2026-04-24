import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { migrateLocalStorageToDexie } from './persistence/db';

// One-time migration from the pre-Dexie localStorage persist backend.
// No-op after first run. Non-blocking — UI renders immediately.
void migrateLocalStorageToDexie();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

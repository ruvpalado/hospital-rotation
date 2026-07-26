import React from 'react';
import { APP_NAME, APP_VERSION, APP_AUTHOR, APP_YEAR } from '../version';

/**
 * Version watermark: a discreet footer line identifying the deployed release
 * and its owner. Shown on the Login screen and the Dashboard. Kept muted and
 * small so it stamps the build without competing with the UI. All values come
 * from the single source of truth in src/version.js.
 */
export default function VersionFooter({ className = '' }) {
  return (
    <div
      className={`text-center text-muted small ${className}`}
      style={{ opacity: 0.75, userSelect: 'none' }}
      aria-label="Application version"
    >
      {APP_NAME} v{APP_VERSION} &middot; &copy; {APP_YEAR} {APP_AUTHOR}
    </div>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Small KPI tile: label, big number, optional subtext, optional color accent.
 * If `to` is provided, the number becomes a link (e.g. Conflict-Free
 * Scheduling links to the Schedules page pre-filtered to the conflicting
 * assignments) so users can jump straight from the metric to the records
 * behind it.
 */
export default function KpiCard({ label, value, suffix = '', subtext, accent = '#4A90D9', to }) {
  // Some KPIs are undefined until real (non-test) data exists, e.g. Schedule
  // Publication Timeliness before any rotation schedule has been created.
  // Show a plain "N/A" instead of blank/NaN in that case.
  const isEmpty = value === null || value === undefined;
  const display = isEmpty ? 'N/A' : <>{value}{suffix}</>;

  return (
    <div className="card shadow-sm h-100" style={{ borderTop: `4px solid ${accent}` }}>
      <div className="card-body">
        <div className="text-muted small text-uppercase mb-1">{label}</div>
        <div className="fs-3 fw-bold">
          {to && !isEmpty ? (
            <Link to={to} className="text-decoration-none" style={{ color: accent }} title="View affected schedules">
              {display}
            </Link>
          ) : (
            display
          )}
        </div>
        {subtext && <div className="text-muted small mt-1">{subtext}</div>}
      </div>
    </div>
  );
}

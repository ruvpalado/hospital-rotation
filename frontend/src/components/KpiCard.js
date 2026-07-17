import React from 'react';

/** Small KPI tile: label, big number, optional subtext, optional color accent. */
export default function KpiCard({ label, value, suffix = '', subtext, accent = '#4A90D9' }) {
  return (
    <div className="card shadow-sm h-100" style={{ borderTop: `4px solid ${accent}` }}>
      <div className="card-body">
        <div className="text-muted small text-uppercase mb-1">{label}</div>
        <div className="fs-3 fw-bold">{value}{suffix}</div>
        {subtext && <div className="text-muted small mt-1">{subtext}</div>}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import './PhysicianScheduleModal.css';

export const WEEK_STATUS_OPTIONS = ['pending', 'attended', 'maternity_leave', 'annual_leave', 'absent'];

/**
 * Complete-schedule view for one physician, opened by clicking their name in
 * the Schedules list (ScheduleViewer). Shows every rotation recorded under
 * that name, ordered by curriculum block then date, with columns in the
 * agreed order: Block Number, Date, Site, Department, Block Status.
 *
 * Each row can expand ("Weeks") to show/edit the weekly attendance dropdowns
 * (same rules as before: scheduler/admin only, locked once the rotation is
 * completed), and has an Edit button that hands off to the Edit Schedule
 * module. The Print button uses the browser's print dialog (also offers
 * Save as PDF); PhysicianScheduleModal.css hides everything except the
 * schedule sheet during printing.
 */
export default function PhysicianScheduleModal({
  physicianName,
  schedules,
  canEditWeeks,
  canEditSchedule,
  onEditSchedule,
  onUpdateWeek,
  onClose,
}) {
  const [expandedId, setExpandedId] = useState(null);

  const rows = schedules
    .filter((s) => (s.physician?.full_name || '').toLowerCase() === physicianName.toLowerCase())
    .sort((a, b) => {
      const blockDiff = (a.block?.block_number || 0) - (b.block?.block_number || 0);
      if (blockDiff !== 0) return blockDiff;
      return String(a.startDate).localeCompare(String(b.startDate));
    });

  const statusBadgeClass = (status) => {
    switch (status) {
      case 'completed': return 'bg-success';
      case 'in_progress': return 'bg-primary';
      case 'incomplete': return 'bg-danger';
      default: return 'bg-secondary'; // scheduled
    }
  };

  const columnCount = canEditSchedule ? 7 : 6;

  return (
    <div className="modal d-block physician-schedule-modal" tabIndex={-1} style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Schedule: {physicianName}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="physician-print-sheet">
              {/* Only visible on the printed page (see CSS) */}
              <div className="sheet-title">
                <h4 className="mb-1">OBGYN Master Rotation - Physician Schedule</h4>
                <p className="mb-1"><strong>Physician:</strong> {physicianName}</p>
                <p className="text-muted mb-3">Generated {new Date().toLocaleDateString()}</p>
              </div>

              {rows.length === 0 ? (
                <p className="text-muted">No rotations recorded for this physician.</p>
              ) : (
                <table className="table table-striped align-middle">
                  <thead>
                    <tr>
                      <th>Block #</th>
                      <th>Date</th>
                      <th>Site</th>
                      <th>Department</th>
                      <th>Block Status</th>
                      <th className="d-print-none">Weeks</th>
                      {canEditSchedule && <th className="d-print-none"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <React.Fragment key={s.id}>
                        <tr>
                          <td>Block {s.block?.block_number}</td>
                          <td>{s.startDate} to {s.endDate}</td>
                          <td>{s.site?.name}</td>
                          <td>{s.department?.code} ({s.department?.name})</td>
                          <td><span className={`badge ${statusBadgeClass(s.status)}`}>{s.status}</span></td>
                          <td className="d-print-none">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                            >
                              {expandedId === s.id ? 'Hide' : 'Show'}
                            </button>
                          </td>
                          {canEditSchedule && (
                            <td className="d-print-none">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                disabled={s.status === 'completed'}
                                title={s.status === 'completed' ? 'Completed schedules can no longer be edited.' : 'Edit this schedule'}
                                onClick={() => onEditSchedule(s)}
                              >
                                Edit
                              </button>
                            </td>
                          )}
                        </tr>
                        {expandedId === s.id && (
                          <tr className="d-print-none">
                            <td colSpan={columnCount} className="bg-light">
                              {canEditWeeks && s.status === 'completed' && (
                                <div className="text-muted small mb-2">Weekly attendance is locked for completed rotations.</div>
                              )}
                              <table className="table table-sm mb-0" style={{ maxWidth: 560 }}>
                                <thead>
                                  <tr><th>Week</th><th>Date</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                  {s.weeks.map((w) => (
                                    <tr key={w.id}>
                                      <td>{w.week_number}</td>
                                      <td>{w.week_start_date}</td>
                                      <td>
                                        {canEditWeeks && s.status !== 'completed' ? (
                                          <select
                                            className="form-select form-select-sm"
                                            value={w.status}
                                            onChange={(e) => onUpdateWeek(w.id, e.target.value)}
                                          >
                                            {WEEK_STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                          </select>
                                        ) : (
                                          <span className="badge bg-light text-dark">{w.status}</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={rows.length === 0}>
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

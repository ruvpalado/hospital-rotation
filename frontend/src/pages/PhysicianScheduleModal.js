import React from 'react';
import './PhysicianScheduleModal.css';

/**
 * Complete-schedule view for one physician, opened by clicking their name on
 * any schedule card (ScheduleViewer). Shows every rotation recorded under
 * that name, ordered by curriculum block then date, with the columns in the
 * agreed order: Block Number, Date, Site, Department, Block Status.
 *
 * The Print button uses the browser's print dialog (which also offers
 * Save as PDF); PhysicianScheduleModal.css hides everything except the
 * schedule sheet during printing so the hard copy comes out clean.
 */
export default function PhysicianScheduleModal({ physicianName, schedules, onClose }) {
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

  return (
    <div className="modal d-block physician-schedule-modal" tabIndex={-1} style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
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
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.id}>
                        <td>Block {s.block?.block_number}</td>
                        <td>{s.startDate} to {s.endDate}</td>
                        <td>{s.site?.name}</td>
                        <td>{s.department?.code} ({s.department?.name})</td>
                        <td><span className={`badge ${statusBadgeClass(s.status)}`}>{s.status}</span></td>
                      </tr>
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

import React, { useEffect, useState } from 'react';
import api from '../api/axios';

const WEEK_STATUS_OPTIONS = ['pending', 'attended', 'maternity_leave', 'annual_leave', 'absent'];

/**
 * Physician-facing "My Weekly Attendance" page: a direct, discoverable place
 * for a physician to update their own weekly rotation status. Each change is
 * submitted as a proposal (PATCH /schedules/weeks/:id/propose) that an admin
 * then approves -- the official status shown here only changes once approved.
 * The backend already scopes /schedules to the logged-in physician's own
 * rotations, so this page only ever shows their data.
 */
export default function MyAttendance() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/schedules').then((res) => setSchedules(res.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const propose = async (weekId, status) => {
    setError('');
    setNotice('');
    try {
      const res = await api.patch(`/schedules/weeks/${weekId}/propose`, { status });
      setNotice(res.data.message || 'Update submitted for administrator approval.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit update.');
    }
  };

  if (loading) return <div className="text-center mt-5">Loading your rotations...</div>;

  const sorted = [...schedules].sort((a, b) => (a.block?.block_number || 0) - (b.block?.block_number || 0));

  return (
    <div className="container py-4" style={{ maxWidth: 820 }}>
      <h4 className="mb-1">My Weekly Attendance</h4>
      <p className="text-muted small">
        Update your weekly status below. Each change is submitted for administrator approval —
        the approved status is what counts toward your rotation completion.
      </p>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {notice && <div className="alert alert-info py-2">{notice}</div>}

      {sorted.length === 0 ? (
        <p className="text-muted">You have no rotations assigned yet.</p>
      ) : sorted.map((s) => {
        const locked = s.status === 'completed';
        return (
          <div className="card shadow-sm mb-3" key={s.id}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <span><strong>Block {s.block?.block_number}</strong> — {s.site?.name} / {s.department?.code}</span>
              <span className="badge bg-secondary">{s.status}</span>
            </div>
            <div className="card-body">
              {locked && <div className="text-muted small mb-2">This rotation is completed; weekly attendance is locked.</div>}
              <table className="table table-sm mb-0" style={{ maxWidth: 620 }}>
                <thead><tr><th>Week</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  {(s.weeks || []).map((w) => (
                    <tr key={w.id}>
                      <td>{w.week_number}</td>
                      <td>{w.week_start_date}</td>
                      <td>
                        {locked ? (
                          <span className="badge bg-light text-dark">{w.status}</span>
                        ) : (
                          <>
                            <select
                              className="form-select form-select-sm"
                              style={{ maxWidth: 220 }}
                              value={w.proposed_status || w.status}
                              onChange={(e) => propose(w.id, e.target.value)}
                            >
                              {WEEK_STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            {w.proposed_status
                              ? <div className="small text-muted mt-1">Proposed <strong>{w.proposed_status}</strong> — awaiting approval (approved: {w.status}).</div>
                              : <div className="small text-muted mt-1">Approved: {w.status}</div>}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

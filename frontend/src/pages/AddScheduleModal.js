import React, { useEffect, useState } from 'react';
import api from '../api/axios';

/**
 * Form for creating a new RotationAssignment, structured directly off the
 * backend's database shape: physicianId, siteDepartmentId, blockId,
 * startDate, endDate (see backend/models/RotationAssignment.js). Submitting
 * calls POST /api/schedules, which also auto-creates the 4 RotationWeek rows
 * for the assignment's block.
 */
export default function AddScheduleModal({ onClose, onCreated }) {
  const [physicians, setPhysicians] = useState([]);
  const [siteDepartments, setSiteDepartments] = useState([]);
  const [blocks, setBlocks] = useState([]);

  const [physicianId, setPhysicianId] = useState('');
  const [siteDepartmentId, setSiteDepartmentId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users', { params: { role: 'physician' } }).then((res) => setPhysicians(res.data));
    api.get('/sites/site-departments').then((res) => setSiteDepartments(res.data));
    api.get('/blocks').then((res) => setBlocks(res.data));
  }, []);

  // When a block is picked, default the start/end dates to that block's dates
  // (matches the "3 of 4 weeks" rule -- weeks are generated from these dates).
  const handleBlockChange = (e) => {
    const id = e.target.value;
    setBlockId(id);
    const block = blocks.find((b) => String(b.id) === String(id));
    if (block) {
      setStartDate(block.start_date);
      setEndDate(block.end_date);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!physicianId || !siteDepartmentId || !blockId || !startDate || !endDate) {
      setError('All fields are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/schedules', {
        physicianId: Number(physicianId),
        siteDepartmentId: Number(siteDepartmentId),
        blockId: Number(blockId),
        startDate,
        endDate,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal d-block" tabIndex={-1} style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <h5 className="modal-title">Add Rotation Schedule</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}

              <div className="mb-3">
                <label className="form-label">Physician</label>
                <select className="form-select" value={physicianId} onChange={(e) => setPhysicianId(e.target.value)} required>
                  <option value="">-- select physician --</option>
                  {physicians.map((p) => (
                    <option key={p.id} value={p.id}>{p.fullName} ({p.email})</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label">Site / Department</label>
                <select className="form-select" value={siteDepartmentId} onChange={(e) => setSiteDepartmentId(e.target.value)} required>
                  <option value="">-- select site + department --</option>
                  {siteDepartments.map((sd) => (
                    <option key={sd.id} value={sd.id}>
                      {sd.Site?.name} &mdash; {sd.Department?.code} ({sd.Department?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label">Curriculum Block</label>
                <select className="form-select" value={blockId} onChange={handleBlockChange} required>
                  <option value="">-- select block --</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      Block {b.block_number}: {b.name} ({b.start_date} to {b.end_date})
                    </option>
                  ))}
                </select>
              </div>

              <div className="row">
                <div className="col-6 mb-3">
                  <label className="form-label">Start Date</label>
                  <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div className="col-6 mb-3">
                  <label className="form-label">End Date</label>
                  <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </div>
              </div>
              <p className="text-muted small mb-0">
                4 weekly attendance records will be auto-created for this block. A rotation only
                counts as completed once at least 3 of those 4 weeks are marked "attended" &mdash;
                maternity/annual leave weeks never count.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Schedule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import api from '../api/axios';

/**
 * "Add Block" form, opened from the physician schedule modal's + Add Block
 * button. Creates the next sequential rotation for a physician:
 *   - Physician (Name) and Block Number are LOCKED (read-only) -- the block
 *     is fixed at the physician's highest existing block + 1.
 *   - Site and Department are EDITABLE, so the new block can be placed at a
 *     different facility/department than the previous one.
 * Submitting posts to POST /api/schedules (which enforces the
 * one-schedule-per-physician-per-block rule server-side).
 */
export default function AddBlockModal({ physicianId, physicianName, nextBlockNumber, onClose, onCreated }) {
  const [siteDepartments, setSiteDepartments] = useState([]);
  const [block, setBlock] = useState(null);

  const [siteId, setSiteId] = useState('');
  const [siteDepartmentId, setSiteDepartmentId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/sites/site-departments').then((res) => setSiteDepartments(res.data)),
      api.get('/blocks').then((res) => {
        const b = res.data.find((x) => x.block_number === nextBlockNumber);
        setBlock(b || null);
      }),
    ]).finally(() => setLoading(false));
  }, [nextBlockNumber]);

  const sites = [];
  siteDepartments.forEach((sd) => {
    if (sd.Site && !sites.some((s) => s.id === sd.Site.id)) sites.push(sd.Site);
  });
  sites.sort((a, b) => a.name.localeCompare(b.name));

  const departmentOptions = siteId
    ? siteDepartments.filter((sd) => sd.Site && String(sd.Site.id) === String(siteId))
    : [];

  const handleSiteChange = (e) => {
    setSiteId(e.target.value);
    setSiteDepartmentId(''); // department list changes with the site
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!siteDepartmentId) {
      setError('Please choose a Site and Department for this block.');
      return;
    }
    if (!block) {
      setError('Could not resolve the block details. Please try again.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/schedules', {
        physicianId: physicianId || null,
        physicianName,
        siteDepartmentId: Number(siteDepartmentId),
        blockId: Number(block.id),
        startDate: block.start_date,
        endDate: block.end_date,
      });
      onCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add the block.');
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
              <h5 className="modal-title">Add Block {nextBlockNumber}</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}

              {/* Physician -- locked */}
              <div className="mb-3">
                <label className="form-label">Physician</label>
                <input className="form-control" value={physicianName} readOnly disabled />
              </div>

              {/* Block Number -- locked */}
              <div className="mb-3">
                <label className="form-label">Curriculum Block</label>
                <input
                  className="form-control"
                  value={block
                    ? `Block ${block.block_number}: ${block.name} (${block.start_date} to ${block.end_date})`
                    : `Block ${nextBlockNumber}`}
                  readOnly
                  disabled
                />
                <div className="form-text">The block number is fixed to the next block in sequence.</div>
              </div>

              {/* Site -- editable */}
              <div className="mb-3">
                <label className="form-label">Site</label>
                <select className="form-select" value={siteId} onChange={handleSiteChange} required disabled={loading}>
                  <option value="">-- select site --</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Department -- editable, scoped to site */}
              <div className="mb-3">
                <label className="form-label">Department</label>
                <select
                  className="form-select"
                  value={siteDepartmentId}
                  onChange={(e) => setSiteDepartmentId(e.target.value)}
                  required
                  disabled={!siteId}
                >
                  <option value="">{siteId ? '-- select department --' : '-- select a site first --'}</option>
                  {departmentOptions.map((sd) => (
                    <option key={sd.id} value={sd.id}>
                      {sd.Department?.code} ({sd.Department?.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting || loading}>
                {submitting ? 'Adding...' : `Add Block ${nextBlockNumber}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

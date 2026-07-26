import React, { useEffect, useState } from 'react';
import api from '../api/axios';

/**
 * Form for creating a new RotationAssignment, structured directly off the
 * backend's database shape: physicianId, physicianName, siteDepartmentId,
 * blockId, startDate, endDate (see backend/models/RotationAssignment.js).
 * Submitting calls POST /api/schedules, which also auto-creates the 4
 * RotationWeek rows for the assignment's block.
 *
 * Site and Department are two separate dropdowns (not one combined
 * "Site / Department" picker): choosing a Site filters the Department
 * dropdown down to only the departments actually offered at that site (via
 * backend/seed/data.js SITE_DEPARTMENTS), since not every department exists
 * at every hospital. Under the hood the Department dropdown's value is still
 * the SiteDepartment join-row id (siteDepartmentId) the backend expects --
 * picking "Site" then "Department" together is equivalent to picking one
 * SiteDepartment row, just split into two friendlier selects.
 */
export default function AddScheduleModal({ onClose, onCreated }) {
  const [physicians, setPhysicians] = useState([]);
  const [roster, setRoster] = useState([]);
  const [siteDepartments, setSiteDepartments] = useState([]);
  const [blocks, setBlocks] = useState([]);
  // All existing assignments, used to disable blocks the chosen physician
  // already has a schedule for (Block Assignment Control).
  const [existingSchedules, setExistingSchedules] = useState([]);

  const [physicianId, setPhysicianId] = useState('');
  const [physicianInput, setPhysicianInput] = useState('');
  const [siteId, setSiteId] = useState('');
  const [siteDepartmentId, setSiteDepartmentId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users', { params: { role: 'physician' } }).then((res) => setPhysicians(res.data));
    // The Physician List module's name-only roster (managed by the developer
    // account at /physician-list; CSV/Excel upload or manual add). Adds
    // autocomplete suggestions only -- picking one behaves exactly like a
    // free-typed name (physicianId stays unset, physician_name is stored).
    api.get('/physician-roster').then((res) => setRoster(res.data)).catch(() => {});
    api.get('/sites/site-departments').then((res) => setSiteDepartments(res.data));
    api.get('/blocks').then((res) => setBlocks(res.data));
    api.get('/schedules').then((res) => setExistingSchedules(res.data)).catch(() => {});
  }, []);

  // Only offer sites that actually have at least one department linked, so
  // the Site dropdown never leads to an empty Department dropdown.
  const sites = [];
  siteDepartments.forEach((sd) => {
    if (sd.Site && !sites.some((s) => s.id === sd.Site.id)) sites.push(sd.Site);
  });
  sites.sort((a, b) => a.name.localeCompare(b.name));

  // Department dropdown is scoped to whichever site is currently selected.
  const departmentOptions = siteId
    ? siteDepartments.filter((sd) => sd.Site && String(sd.Site.id) === String(siteId))
    : [];

  // Physician accepts any manually typed name -- it's not restricted to a
  // predefined list. Suggestions still pop up as you type (native browser
  // autocomplete via <datalist>, filtered by matching letters) for the
  // convenience of picking an already-registered physician, which links the
  // real account so that physician's own dashboard, per-physician KPIs, and
  // reminder notifications all work. If what's typed doesn't match a
  // suggestion, the rotation is still created under that typed name -- it
  // just won't be tied to an account for those account-linked features.
  const physicianLabel = (p) => `${p.fullName} (${p.email})`;

  const handlePhysicianInputChange = (e) => {
    const value = e.target.value;
    setPhysicianInput(value);
    const match = physicians.find((p) => physicianLabel(p) === value);
    setPhysicianId(match ? match.id : '');
  };

  const handleSiteChange = (e) => {
    setSiteId(e.target.value);
    // The previously selected department may not exist at the new site.
    setSiteDepartmentId('');
  };

  // Block Assignment Control: blocks this physician already has a schedule
  // for are disabled in the dropdown. The physician is identified by their
  // linked account when the autocomplete resolved one, otherwise by the
  // typed name (case-insensitive) -- matching the backend's conflict rule.
  const typedName = physicianInput.trim().toLowerCase();
  const assignedBlockIds = new Set(
    existingSchedules
      .filter((s) => {
        if (physicianId) return s.physician?.id === Number(physicianId);
        return typedName && (s.physician?.full_name || '').toLowerCase() === typedName;
      })
      .map((s) => s.block?.id)
      .filter(Boolean)
  );

  // If the physician changes and the currently selected block is now
  // unavailable for them, clear the selection rather than submitting a
  // conflict the backend would reject anyway.
  useEffect(() => {
    if (blockId && assignedBlockIds.has(Number(blockId))) setBlockId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physicianId, physicianInput]);

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
    if (!physicianInput.trim() || !siteDepartmentId || !blockId || !startDate || !endDate) {
      setError('All fields are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/schedules', {
        physicianId: physicianId ? Number(physicianId) : null,
        physicianName: physicianInput.trim(),
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
                <input
                  className="form-control"
                  list="physician-suggestions"
                  value={physicianInput}
                  onChange={handlePhysicianInputChange}
                  placeholder="Start typing a name..."
                  autoComplete="off"
                  required
                />
                <datalist id="physician-suggestions">
                  {physicians.map((p) => (
                    <option key={`account-${p.id}`} value={physicianLabel(p)} />
                  ))}
                  {roster
                    // Skip roster names that duplicate a registered account's
                    // name -- the account entry above (with email) wins.
                    .filter((r) => !physicians.some((p) => p.fullName.toLowerCase() === r.fullName.toLowerCase()))
                    .map((r) => (
                      <option key={`roster-${r.id}`} value={r.fullName} />
                    ))}
                </datalist>
                {physicianInput && !physicianId && (
                  <div className="form-text">
                    Not a registered physician account -- this rotation will be recorded under this name only
                    (won't appear on a physician login, per-physician KPIs, or trigger reminder notifications).
                  </div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label">Site</label>
                <select className="form-select" value={siteId} onChange={handleSiteChange} required>
                  <option value="">-- select site --</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

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
                {siteId && (
                  <div className="form-text">Showing only departments offered at the selected site.</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label">Curriculum Block</label>
                <select className="form-select" value={blockId} onChange={handleBlockChange} required>
                  <option value="">-- select block --</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id} disabled={assignedBlockIds.has(b.id)}>
                      Block {b.block_number}: {b.name} ({b.start_date} to {b.end_date})
                      {assignedBlockIds.has(b.id) ? ' — already assigned' : ''}
                    </option>
                  ))}
                </select>
                {assignedBlockIds.size > 0 && (
                  <div className="form-text">
                    Grayed-out blocks already have a schedule for this physician and can't be selected again.
                  </div>
                )}
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

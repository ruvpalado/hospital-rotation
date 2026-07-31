import React, { useEffect, useState } from 'react';
import api from '../api/axios';

/**
 * Edit Schedule module: opened from a schedule card's Edit button
 * (ScheduleViewer). Mirrors AddScheduleModal's form -- same physician
 * autocomplete (registered accounts + the Physician List roster), same
 * site-scoped department dropdown -- but prefilled with the schedule being
 * edited and submitting to PUT /api/schedules/:id.
 *
 * Week attendance already recorded is preserved server-side; only week
 * DATES are re-anchored if the start date or block changes.
 *
 * Deleting the schedule outright lives here too (instead of a separate
 * card button), still restricted to the developer account like the
 * backend's DELETE /api/schedules/:id.
 */
export default function EditScheduleModal({ schedule, onClose, onSaved }) {
  const [physicians, setPhysicians] = useState([]);
  const [roster, setRoster] = useState([]);
  const [siteDepartments, setSiteDepartments] = useState([]);
  const [blocks, setBlocks] = useState([]);
  // All existing assignments, used to disable blocks the chosen physician
  // already has a schedule for (Block Assignment Control) -- excluding the
  // schedule being edited itself, whose own block must stay selectable.
  const [existingSchedules, setExistingSchedules] = useState([]);

  const [physicianId, setPhysicianId] = useState(schedule.physician?.id || '');
  const [physicianInput, setPhysicianInput] = useState('');
  const [siteId, setSiteId] = useState(String(schedule.site?.id || ''));
  const [siteDepartmentId, setSiteDepartmentId] = useState('');
  const [blockId, setBlockId] = useState(String(schedule.block?.id || ''));
  const [startDate, setStartDate] = useState(schedule.startDate || '');
  const [endDate, setEndDate] = useState(schedule.endDate || '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const physicianLabel = (p) => `${p.fullName} (${p.email})`;

  useEffect(() => {
    api.get('/users', { params: { role: 'physician' } }).then((res) => {
      setPhysicians(res.data);
      // Prefill the physician input: if this schedule is linked to a real
      // account, show the same "Name (email)" label the autocomplete uses so
      // saving without touching the field keeps the account link; otherwise
      // show the stored free-text name.
      if (schedule.physician?.id) {
        const match = res.data.find((p) => p.id === schedule.physician.id);
        setPhysicianInput(match ? physicianLabel(match) : (schedule.physician?.full_name || ''));
      } else {
        setPhysicianInput(schedule.physician?.full_name || '');
      }
    });
    api.get('/physician-roster').then((res) => setRoster(res.data)).catch(() => {});
    api.get('/sites/site-departments').then((res) => {
      setSiteDepartments(res.data);
      // Resolve the current SiteDepartment join row from the schedule's
      // site + department pair (serialize() exposes those, not the join id).
      const current = res.data.find(
        (sd) => sd.Site?.id === schedule.site?.id && sd.Department?.id === schedule.department?.id
      );
      if (current) setSiteDepartmentId(String(current.id));
    });
    api.get('/blocks').then((res) => setBlocks(res.data));
    api.get('/schedules').then((res) => setExistingSchedules(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Blocks already assigned to this physician (other than this very
  // schedule) are disabled -- matches the backend's conflict rule.
  const typedName = physicianInput.trim().toLowerCase();
  const assignedBlockIds = new Set(
    existingSchedules
      .filter((s) => s.id !== schedule.id)
      .filter((s) => {
        if (physicianId) return s.physician?.id === Number(physicianId);
        return typedName && (s.physician?.full_name || '').toLowerCase() === typedName;
      })
      .map((s) => s.block?.id)
      .filter(Boolean)
  );

  useEffect(() => {
    if (blockId && assignedBlockIds.has(Number(blockId))) setBlockId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physicianId, physicianInput]);

  const sites = [];
  siteDepartments.forEach((sd) => {
    if (sd.Site && !sites.some((s) => s.id === sd.Site.id)) sites.push(sd.Site);
  });
  sites.sort((a, b) => a.name.localeCompare(b.name));

  const departmentOptions = siteId
    ? siteDepartments.filter((sd) => sd.Site && String(sd.Site.id) === String(siteId))
    : [];

  const handlePhysicianInputChange = (e) => {
    const value = e.target.value;
    setPhysicianInput(value);
    const match = physicians.find((p) => physicianLabel(p) === value);
    setPhysicianId(match ? match.id : '');
  };

  const handleSiteChange = (e) => {
    setSiteId(e.target.value);
    setSiteDepartmentId('');
  };

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
      await api.put(`/schedules/${schedule.id}`, {
        physicianId: physicianId ? Number(physicianId) : null,
        physicianName: physicianInput.trim(),
        siteDepartmentId: Number(siteDepartmentId),
        blockId: Number(blockId),
        startDate,
        endDate,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update schedule.');
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
              <h5 className="modal-title">Edit Rotation Schedule</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}

              <div className="mb-3">
                <label className="form-label">Physician</label>
                <input
                  className="form-control"
                  list="edit-physician-suggestions"
                  value={physicianInput}
                  onChange={handlePhysicianInputChange}
                  placeholder="Start typing a name..."
                  autoComplete="off"
                  required
                />
                <datalist id="edit-physician-suggestions">
                  {physicians.map((p) => (
                    <option key={`account-${p.id}`} value={physicianLabel(p)} />
                  ))}
                  {roster
                    .filter((r) => !physicians.some((p) => p.fullName.toLowerCase() === r.fullName.toLowerCase()))
                    .map((r) => (
                      <option key={`roster-${r.id}`} value={r.fullName} />
                    ))}
                </datalist>
                {physicianInput && !physicianId && (
                  <div className="form-text">
                    Not a registered physician account -- this rotation will be recorded under this name only.
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
                Recorded weekly attendance is kept. If you change the block or start date, the week
                dates are re-aligned to the new schedule automatically.
              </p>
            </div>
            <div className="modal-footer justify-content-end">
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

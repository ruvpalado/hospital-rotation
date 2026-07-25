import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useColorMaps, colorFor } from '../utils/colorCoding';
import AddScheduleModal from './AddScheduleModal';
import EditScheduleModal from './EditScheduleModal';
import PhysicianScheduleModal from './PhysicianScheduleModal';

/**
 * Schedules page, restructured around physician selection:
 *  - The list view shows ONLY physician names (one row per physician, with
 *    a rotation count and the sites they rotate through).
 *  - Clicking a name opens PhysicianScheduleModal: that physician's complete
 *    schedule table (Block #, Date, Site, Department, Block Status) with
 *    per-row week details, Print, and Edit (disabled once completed).
 *  - Editing hands off to EditScheduleModal on top; the physician view stays
 *    open underneath and refreshes when the edit is saved.
 */
export default function ScheduleViewer() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { siteColors } = useColorMaps();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Populated when arriving from the "Conflict-Free Scheduling" KPI card
  // (?conflictIds=1,2,3) so we can jump straight to the schedules involved.
  const [searchParams, setSearchParams] = useSearchParams();
  const conflictIds = (searchParams.get('conflictIds') || '')
    .split(',')
    .filter(Boolean)
    .map(Number);
  const conflictFilterActive = conflictIds.length > 0;

  const clearConflictFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('conflictIds');
    setSearchParams(next);
  };

  // The Master Scheduler can change a week's attendance status; other roles
  // see schedules read-only. Admin is included since the merged admin
  // account also holds Master Scheduler permissions.
  const canEditWeeks = user?.role === 'scheduler' || user?.role === 'admin' || user?.role === 'developer';
  const canAddSchedule = user?.role === 'scheduler' || user?.role === 'admin' || user?.role === 'developer';
  const canEditSchedule = user?.role === 'scheduler' || user?.role === 'admin' || user?.role === 'developer';
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [viewingPhysician, setViewingPhysician] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/schedules').then((res) => setSchedules(res.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Deep link from the navbar's "Schedules > Add Schedule" menu item
  // (/schedules?add=1): open the Add Schedule modal on arrival, then strip
  // the param so refreshing or sharing the URL doesn't re-open it.
  useEffect(() => {
    if (searchParams.get('add') === '1') {
      if (canAddSchedule) setShowAddModal(true);
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canAddSchedule]);

  const handleCreated = () => {
    setShowAddModal(false);
    load();
  };

  // Saving (or deleting) from the Edit modal refreshes the data but keeps
  // the physician's schedule view open underneath so the user sees the
  // updated table immediately.
  const handleScheduleSaved = () => {
    setEditingSchedule(null);
    load();
  };

  const updateWeek = async (weekId, status) => {
    await api.patch(`/schedules/weeks/${weekId}`, { status });
    load();
  };

  const runSearch = (e) => {
    e.preventDefault();
    setAppliedSearch(searchInput.trim().toLowerCase());
  };

  const clearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
  };

  // Match against physician name (Doctor) and site name (Facility).
  let visibleSchedules = appliedSearch
    ? schedules.filter((s) => {
        const doctor = (s.physician?.full_name || '').toLowerCase();
        const facility = (s.site?.name || '').toLowerCase();
        return doctor.includes(appliedSearch) || facility.includes(appliedSearch);
      })
    : schedules;

  if (conflictFilterActive) {
    visibleSchedules = visibleSchedules.filter((s) => conflictIds.includes(s.id));
  }

  // Collapse the visible schedules into one row per physician: name,
  // rotation count, the sites involved, and whether any of their rotations
  // is part of the active conflict filter.
  const physicians = [];
  visibleSchedules.forEach((s) => {
    const name = s.physician?.full_name;
    if (!name) return;
    let entry = physicians.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (!entry) {
      entry = { name, count: 0, sites: [], hasConflict: false };
      physicians.push(entry);
    }
    entry.count += 1;
    if (s.site && !entry.sites.some((x) => x.short_code === s.site.short_code)) entry.sites.push(s.site);
    if (conflictIds.includes(s.id)) entry.hasConflict = true;
  });
  physicians.sort((a, b) => a.name.localeCompare(b.name));

  if (loading) return <div className="text-center mt-5">Loading schedules...</div>;

  return (
    <div className="container py-4" style={{ maxWidth: 860 }}>
      <div className="mb-3">
        <h4 className="mb-0">{t('schedules')}</h4>
        <p className="text-muted small mb-0">Select a physician to view their complete schedule.</p>
      </div>

      <form className="d-flex align-items-center flex-wrap gap-2 mb-3" onSubmit={runSearch}>
        <input
          type="text"
          className="form-control"
          style={{ maxWidth: 360 }}
          placeholder="Search by Doctor name or Facility..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit" className="btn btn-outline-primary">Search</button>
        {appliedSearch && (
          <button type="button" className="btn btn-outline-secondary" onClick={clearSearch}>Clear</button>
        )}
        {canAddSchedule && (
          <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Schedule
          </button>
        )}
      </form>

      {appliedSearch && (
        <p className="text-muted small">
          Showing {physicians.length} physician{physicians.length === 1 ? '' : 's'} matching "{searchInput}"
        </p>
      )}

      {conflictFilterActive && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span>
            Showing physicians involved in an overlapping-date conflict.
          </span>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={clearConflictFilter}>
            Clear filter
          </button>
        </div>
      )}

      {showAddModal && (
        <AddScheduleModal onClose={() => setShowAddModal(false)} onCreated={handleCreated} />
      )}
      {viewingPhysician && (
        <PhysicianScheduleModal
          physicianName={viewingPhysician}
          schedules={schedules}
          canEditWeeks={canEditWeeks}
          canEditSchedule={canEditSchedule}
          onEditSchedule={(s) => setEditingSchedule(s)}
          onUpdateWeek={updateWeek}
          onClose={() => setViewingPhysician(null)}
        />
      )}
      {editingSchedule && (
        <EditScheduleModal
          schedule={editingSchedule}
          onClose={() => setEditingSchedule(null)}
          onSaved={handleScheduleSaved}
        />
      )}

      {physicians.length === 0 && (
        <p className="text-muted">
          {appliedSearch ? 'No physicians match that search.' : 'No rotation assignments found.'}
        </p>
      )}

      <div className="list-group">
        {physicians.map((p) => (
          <button
            key={p.name}
            type="button"
            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
            onClick={() => setViewingPhysician(p.name)}
          >
            <span className="d-flex align-items-center gap-2">
              <span className="fw-semibold">{p.name}</span>
              {p.hasConflict && <span className="badge bg-danger">Conflict</span>}
            </span>
            <span className="d-flex align-items-center gap-2">
              {p.sites.map((site) => (
                <span
                  key={site.short_code}
                  className="badge"
                  style={{ background: colorFor(siteColors, site.short_code), color: '#fff' }}
                  title={site.name}
                >
                  {site.short_code}
                </span>
              ))}
              <span className="badge bg-secondary rounded-pill">{p.count} rotation{p.count === 1 ? '' : 's'}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

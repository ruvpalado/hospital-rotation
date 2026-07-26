import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

/**
 * User list + management. Deactivate/reactivate is available to Master
 * Scheduler and Hospital Administrator. Editing a user's ROLE is restricted to
 * the Developer account: the Edit button only renders for a developer, and the
 * backend re-checks via requireDeveloperEmail (defense in depth). "Delete"
 * remains a reversible deactivation so historical records are never lost.
 */

// Assignable roles for the Edit Role dropdown. 'scheduler' is intentionally
// omitted (that role was retired). Keep in sync with backend Role.js.
const ROLE_OPTIONS = [
  { key: 'developer', label: 'Developer' },
  { key: 'program_administrator', label: 'Program Administrator' },
  { key: 'program_manager', label: 'Program Manager' },
  { key: 'hospital_admin', label: 'Hospital Administrator' },
  { key: 'dept_head', label: 'Department Head' },
  { key: 'physician', label: 'Physician' },
];

export default function UserManagement() {
  const { user: me } = useAuth();
  const isDeveloper = me?.role === 'developer';
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  // Edit Role modal state.
  const [editing, setEditing] = useState(null); // the user row being edited
  const [selectedRole, setSelectedRole] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/users').then((res) => setUsers(res.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this account? They will no longer be able to log in. This can be undone.')) return;
    setError('');
    setBusyId(id);
    try {
      await api.delete(`/users/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to deactivate user.');
    } finally {
      setBusyId(null);
    }
  };

  const reactivate = async (id) => {
    setError('');
    setBusyId(id);
    try {
      await api.post(`/users/${id}/reactivate`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reactivate user.');
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (u) => {
    setError('');
    setEditing(u);
    setSelectedRole(u.role);
  };

  const closeEdit = () => {
    setEditing(null);
    setSelectedRole('');
  };

  const saveRole = async () => {
    if (!editing) return;
    if (selectedRole === editing.role) { closeEdit(); return; }
    const target = ROLE_OPTIONS.find((r) => r.key === selectedRole);
    const label = target ? target.label : selectedRole;
    // Confirmation prompt before applying the change.
    if (!window.confirm(`Change ${editing.fullName}'s role to "${label}"? This takes effect immediately.`)) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/users/${editing.id}/role`, { roleKey: selectedRole });
      closeEdit();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update role.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center mt-5">Loading users...</div>;

  return (
    <div className="container-fluid py-4">
      <h4 className="mb-3">User Accounts</h4>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <table className="table table-striped align-middle">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Site</th>
            <th>Department</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={u.isActive ? '' : 'table-secondary'}>
              <td>{u.fullName}</td>
              <td>{u.email}</td>
              <td><span className="badge bg-secondary">{u.roleLabel}</span></td>
              <td>{u.homeSite?.short_code || '-'}</td>
              <td>{u.homeDepartment?.code || '-'}</td>
              <td>
                {u.isActive ? (
                  <span className="badge bg-success">Active</span>
                ) : (
                  <span className="badge bg-danger">Deactivated</span>
                )}
              </td>
              <td>
                <div className="d-flex align-items-center gap-2">
                  {/* Edit Role -- developer account only, and not on your own row. */}
                  {isDeveloper && u.id !== me?.id && (
                    <button
                      className="btn btn-sm btn-outline-primary"
                      disabled={busyId === u.id}
                      onClick={() => openEdit(u)}
                    >
                      Edit
                    </button>
                  )}
                  {u.id === me?.id ? (
                    <span className="text-muted small">(you)</span>
                  ) : u.isActive ? (
                    <button
                      className="btn btn-sm btn-outline-danger"
                      disabled={busyId === u.id}
                      onClick={() => deactivate(u.id)}
                    >
                      {busyId === u.id ? 'Working...' : 'Deactivate'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-outline-success"
                      disabled={busyId === u.id}
                      onClick={() => reactivate(u.id)}
                    >
                      {busyId === u.id ? 'Working...' : 'Reactivate'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Edit Role modal (developer-only; only rendered when a row is being edited). */}
      {editing && (
        <>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Edit Role</h5>
                  <button type="button" className="btn-close" onClick={closeEdit} disabled={saving} aria-label="Close" />
                </div>
                <div className="modal-body">
                  <p className="mb-3">
                    <strong>{editing.fullName}</strong><br />
                    <span className="text-muted small">{editing.email}</span>
                  </p>
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    disabled={saving}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                  <div className="form-text">
                    The change takes effect immediately and is recorded in the audit log.
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={closeEdit} disabled={saving}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={saveRole}
                    disabled={saving || selectedRole === editing.role}
                  >
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
    </div>
  );
}

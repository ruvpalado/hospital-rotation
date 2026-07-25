import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

/**
 * User list + deactivate/reactivate management, available to Master
 * Scheduler and Hospital Administrator. "Delete" is implemented as a
 * reversible deactivation (see backend/controllers/userController.js) so
 * historical rotation assignments, change requests, and audit log entries
 * tied to an account are never lost -- deactivated accounts simply can't
 * log in anymore and drop out of active pickers (e.g. Add Schedule).
 */
export default function UserManagement() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

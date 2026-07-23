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
// Bulk CSV doctor upload is restricted to the developer account, matching
// the backend's POST /api/users/bulk-upload-doctors gating (requireDeveloperEmail).
const DEVELOPER_EMAIL = 'ruvpalado@gmail.com';

export default function UserManagement() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const isDeveloper = me?.email === DEVELOPER_EMAIL;
  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);

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

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) return;
    setUploadError('');
    setUploadResult(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      // Deliberately no Content-Type header here -- letting the browser set
      // it (with the multipart boundary it generates for this FormData) is
      // required for multer to parse the request; setting it manually
      // without a boundary would break the upload.
      const res = await api.post('/users/bulk-upload-doctors', formData);
      setUploadResult(res.data);
      setCsvFile(null);
      load();
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Failed to upload CSV.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="text-center mt-5">Loading users...</div>;

  return (
    <div className="container-fluid py-4">
      <h4 className="mb-3">User Accounts</h4>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      {isDeveloper && (
        <div className="card mb-4" style={{ maxWidth: 640 }}>
          <div className="card-body">
            <h6 className="card-title">Bulk Upload Doctors (CSV)</h6>
            <p className="text-muted small mb-2">
              CSV columns (header row required): <code>full_name</code>, <code>email</code>,{' '}
              <code>phone</code> (optional), <code>site_code</code> (optional, matches a site's short
              code), <code>department_code</code> (optional, matches a department's code). Each new
              account is created with the Physician role and emailed a one-time temporary password.
            </p>
            <form onSubmit={handleCsvUpload} className="d-flex align-items-center gap-2">
              <input
                type="file"
                accept=".csv,text/csv"
                className="form-control"
                style={{ maxWidth: 320 }}
                onChange={(e) => setCsvFile(e.target.files[0] || null)}
              />
              <button type="submit" className="btn btn-primary" disabled={!csvFile || uploading}>
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </form>
            {uploadError && <div className="alert alert-danger py-2 mt-3 mb-0">{uploadError}</div>}
            {uploadResult && (
              <div className="alert alert-info py-2 mt-3 mb-0">
                <div>{uploadResult.message}</div>
                {uploadResult.skipped?.length > 0 && (
                  <ul className="small mb-0 mt-2">
                    {uploadResult.skipped.map((s) => (
                      <li key={s.row}>Row {s.row} ({s.email || 'no email'}): {s.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
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

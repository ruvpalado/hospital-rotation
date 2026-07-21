import React, { useEffect, useState } from 'react';
import api from '../api/axios';

const DEVELOPER_EMAIL = 'ruvpalado@gmail.com';

/**
 * Account Creation Policy (temporarily tightened): approval rights are
 * restricted to the developer account only -- for every pending request,
 * regardless of requested role. The route itself (see App.js requireEmail
 * and backend routes/users.js requireDeveloperEmail) already keeps anyone
 * else from reaching this page at all, so there's no per-row gating needed
 * here anymore; whoever's looking at this page is always ruvpalado@gmail.com.
 */
export default function PendingApprovals() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingOnId, setActingOnId] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/users/pending')
      .then((res) => setPending(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load pending accounts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (row) => {
    setActingOnId(row.id);
    setError('');
    try {
      await api.post(`/users/${row.id}/approve`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve');
    } finally {
      setActingOnId(null);
    }
  };

  const handleReject = async (row) => {
    if (!window.confirm(`Reject ${row.email}'s registration?`)) return;
    setActingOnId(row.id);
    setError('');
    try {
      await api.post(`/users/${row.id}/reject`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject');
    } finally {
      setActingOnId(null);
    }
  };

  return (
    <div className="container-fluid py-4">
      <h4 className="mb-1">Pending Approvals</h4>
      <p className="text-muted small mb-3">
        Approval rights are currently restricted to {DEVELOPER_EMAIL} for every pending request.
        Admin-role requests are additionally capped at 3 total admin accounts.
      </p>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : pending.length === 0 ? (
        <div className="text-muted">No accounts awaiting approval.</div>
      ) : (
        <table className="table table-sm table-striped">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Requested Role</th>
              <th>Site</th>
              <th>Department</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pending.map((row) => (
              <tr key={row.id}>
                <td>{row.fullName}</td>
                <td>{row.email}</td>
                <td><span className="badge bg-secondary">{row.roleLabel}</span></td>
                <td>{row.homeSite?.name || '-'}</td>
                <td>{row.homeDepartment?.name || '-'}</td>
                <td className="text-end">
                  <button
                    className="btn btn-success btn-sm me-2"
                    disabled={actingOnId === row.id}
                    onClick={() => handleApprove(row)}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-outline-danger btn-sm"
                    disabled={actingOnId === row.id}
                    onClick={() => handleReject(row)}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

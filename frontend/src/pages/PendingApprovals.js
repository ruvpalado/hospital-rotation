import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const DEVELOPER_EMAIL = 'ruvpalado@gmail.com';

/**
 * Account Creation Policy: lists every account awaiting approval. Any admin
 * can see this page, but the Approve/Reject buttons for an admin-role
 * request are disabled for everyone except the developer account
 * (ruvpalado@gmail.com) -- the backend enforces this too, this is just
 * matching UI so people aren't clicking a button that will 403.
 */
export default function PendingApprovals() {
  const { user } = useAuth();
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

  const isDeveloper = user?.email === DEVELOPER_EMAIL;

  const canAct = (row) => row.role !== 'admin' || isDeveloper;

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
        Non-admin requests can be approved by any admin. Admin-role requests can only be approved or
        rejected by {DEVELOPER_EMAIL}, and are capped at 3 total admin accounts.
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
                  {!canAct(row) ? (
                    <span className="text-muted small">Only {DEVELOPER_EMAIL} can act on this</span>
                  ) : (
                    <>
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
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

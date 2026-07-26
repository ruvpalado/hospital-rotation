import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const DEVELOPER_EMAIL = 'ruvpalado@gmail.com';

/**
 * Account Creation Policy:
 *  - Any admin can approve/reject NON-admin account requests.
 *  - Admin-role requests are routed to the developer account
 *    (ruvpalado@gmail.com) for final confirmation -- the backend rejects an
 *    admin-role approve/reject from anyone else, so for a non-developer admin
 *    those rows' action buttons are disabled here with an explanatory note.
 */
export default function PendingApprovals() {
  const { user: me } = useAuth();
  const isDeveloper = me?.email === DEVELOPER_EMAIL;
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
      <h4 className="mb-1">User Approval</h4>
      <p className="text-muted small mb-3">
        Any admin can approve or reject standard account requests. <strong>Program Administrator</strong> requests
        are routed to {DEVELOPER_EMAIL} for final confirmation
        {isDeveloper ? '' : ' — you can view them here, but only that account can approve or reject them'}.
        Program Administrator accounts are additionally capped at 3 total.
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
            {pending.map((row) => {
              // Elevated (Program Administrator) requests can only be actioned
              // by the developer account (backend enforces this too). Other
              // roles: any admin. 'admin' is the retired legacy key.
              const isAdminRequest = row.role === 'program_administrator' || row.role === 'admin';
              const blocked = isAdminRequest && !isDeveloper;
              return (
                <tr key={row.id}>
                  <td>{row.fullName}</td>
                  <td>{row.email}</td>
                  <td>
                    <span className="badge bg-secondary">{row.roleLabel}</span>
                    {isAdminRequest && <span className="badge bg-warning text-dark ms-1">Developer approval</span>}
                  </td>
                  <td>{row.homeSite?.name || '-'}</td>
                  <td>{row.homeDepartment?.name || '-'}</td>
                  <td className="text-end">
                    {blocked ? (
                      <span className="text-muted small">Awaiting {DEVELOPER_EMAIL}</span>
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
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

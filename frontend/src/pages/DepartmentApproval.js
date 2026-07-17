import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

// Department Head / Admin: approve or reject pending change requests,
// feeding the Change Request Rate and Approval Turnaround Time KPIs.
export default function DepartmentApproval() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/change-requests').then((res) => setRequests(res.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const resolve = async (id, decision) => {
    await api.post(`/change-requests/${id}/resolve`, { decision });
    load();
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container-fluid py-4">
      <h4 className="mb-3">{t('departmentApproval')}</h4>
      <table className="table table-striped">
        <thead>
          <tr>
            <th>ID</th><th>Rotation Assignment</th><th>Requested By</th><th>Reason</th><th>{t('status')}</th><th>Requested At</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>#{r.rotation_assignment_id}</td>
              <td>{r.requestedBy?.full_name}</td>
              <td>{r.reason}</td>
              <td><span className={`badge ${r.status === 'pending' ? 'bg-warning' : r.status === 'approved' ? 'bg-success' : 'bg-danger'}`}>{r.status}</span></td>
              <td>{new Date(r.requested_at).toLocaleString()}</td>
              <td>
                {r.status === 'pending' && (
                  <>
                    <button className="btn btn-sm btn-success me-1" onClick={() => resolve(r.id, 'approved')}>Approve</button>
                    <button className="btn btn-sm btn-danger" onClick={() => resolve(r.id, 'rejected')}>Reject</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

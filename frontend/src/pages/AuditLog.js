import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

export default function AuditLog() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [clearing, setClearing] = useState(false);

  const load = () => api.get('/auditlogs').then((res) => setLogs(res.data));

  useEffect(() => {
    load();
  }, []);

  const handleClear = async () => {
    if (!window.confirm('Permanently delete every audit log entry? This cannot be undone.')) return;
    setClearing(true);
    try {
      await api.delete('/auditlogs');
      await load();
    } catch (err) {
      window.alert(err.response?.data?.error || 'Failed to clear audit log.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">{t('auditLog')}</h4>
        <button className="btn btn-outline-danger btn-sm" onClick={handleClear} disabled={clearing || logs.length === 0}>
          {clearing ? 'Clearing...' : 'Clear Audit Log'}
        </button>
      </div>
      <table className="table table-sm table-striped">
        <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>ID</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{new Date(l.createdAt).toLocaleString()}</td>
              <td>{l.User?.full_name || 'system'}</td>
              <td><span className="badge bg-secondary">{l.action}</span></td>
              <td>{l.entity_type}</td>
              <td>{l.entity_id ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

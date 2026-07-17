import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

export default function AuditLog() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.get('/auditlogs').then((res) => setLogs(res.data));
  }, []);

  return (
    <div className="container-fluid py-4">
      <h4 className="mb-3">{t('auditLog')}</h4>
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

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

export default function NotificationsCenter() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    api.get('/notifications').then((res) => setNotifications(res.data));
  }, []);

  return (
    <div className="container-fluid py-4">
      <h4 className="mb-3">{t('notifications')}</h4>
      <div className="list-group">
        {notifications.map((n) => (
          <div key={n.id} className="list-group-item">
            <div className="d-flex justify-content-between">
              <strong>{n.title}</strong>
              <span className={`badge ${n.status === 'failed' ? 'bg-danger' : 'bg-success'}`}>{n.status} ({n.channel})</span>
            </div>
            <p className="mb-0 text-muted">{n.message}</p>
            <small className="text-muted">{n.sent_at ? new Date(n.sent_at).toLocaleString() : ''}</small>
          </div>
        ))}
        {notifications.length === 0 && <p className="text-muted">No notifications yet.</p>}
      </div>
    </div>
  );
}

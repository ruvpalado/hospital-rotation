import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useColorMaps, colorFor } from '../utils/colorCoding';

const WEEK_STATUS_OPTIONS = ['pending', 'attended', 'maternity_leave', 'annual_leave', 'absent'];

export default function ScheduleViewer() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { siteColors, deptColors } = useColorMaps();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  const canEditWeeks = ['admin', 'scheduler', 'dept_head'].includes(user?.role);

  const load = () => {
    setLoading(true);
    api.get('/schedules').then((res) => setSchedules(res.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const updateWeek = async (weekId, status) => {
    await api.patch(`/schedules/weeks/${weekId}`, { status });
    load();
  };

  if (loading) return <div className="text-center mt-5">Loading schedules...</div>;

  return (
    <div className="container-fluid py-4">
      <h4 className="mb-3">{t('schedules')}</h4>
      {schedules.length === 0 && <p className="text-muted">No rotation assignments found.</p>}
      <div className="row g-3">
        {schedules.map((s) => (
          <div className="col-md-6 col-lg-4" key={s.id}>
            <div className="card shadow-sm h-100">
              <div className="card-header d-flex justify-content-between align-items-center"
                   style={{ background: colorFor(siteColors, s.site.short_code), color: '#fff' }}>
                <span>{s.site.name}</span>
                <span className="badge bg-light text-dark">{s.block.name}</span>
              </div>
              <div className="card-body">
                <div className="mb-2">
                  <span className="badge" style={{ background: colorFor(deptColors, s.department.code), color: '#fff' }}>
                    {s.department.code}
                  </span>
                  <span className="ms-2 text-muted small">{s.department.name}</span>
                </div>
                <p className="mb-1"><strong>{t('physician')}:</strong> {s.physician?.full_name}</p>
                <p className="mb-1"><strong>{t('startDate')}:</strong> {s.startDate} &nbsp; <strong>{t('endDate')}:</strong> {s.endDate}</p>
                <p className="mb-2"><strong>{t('status')}:</strong> <span className="badge bg-secondary">{s.status}</span></p>
                <table className="table table-sm">
                  <thead><tr><th>{t('week')}</th><th>Date</th><th>{t('status')}</th></tr></thead>
                  <tbody>
                    {s.weeks.map((w) => (
                      <tr key={w.id}>
                        <td>{w.week_number}</td>
                        <td>{w.week_start_date}</td>
                        <td>
                          {canEditWeeks ? (
                            <select className="form-select form-select-sm" value={w.status} onChange={(e) => updateWeek(w.id, e.target.value)}>
                              {WEEK_STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : (
                            <span className="badge bg-light text-dark">{w.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

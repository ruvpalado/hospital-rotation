import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '', roleKey: 'physician', siteId: '', departmentId: '' });
  const [sites, setSites] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/sites').catch(() => {}).then((res) => res && setSites(res.data));
    api.get('/departments').catch(() => {}).then((res) => res && setDepartments(res.data));
  }, []);

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  const isHospitalAdmin = form.roleKey === 'hospital_admin';

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light py-4">
      <div className="card shadow p-4" style={{ width: 460 }}>
        <h4 className="mb-3 text-center">{t('register')}</h4>
        {error && <div className="alert alert-danger py-2">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-2">
            <label className="form-label">Full Name</label>
            <input className="form-control" value={form.fullName} onChange={handleChange('fullName')} required />
          </div>
          <div className="mb-2">
            <label className="form-label">{t('email')}</label>
            <input type="email" className="form-control" value={form.email} onChange={handleChange('email')} required />
          </div>
          <div className="mb-2">
            <label className="form-label">{t('password')}</label>
            <input type="password" className="form-control" value={form.password} onChange={handleChange('password')} required />
          </div>
          <div className="mb-2">
            <label className="form-label">Phone</label>
            <input className="form-control" value={form.phone} onChange={handleChange('phone')} />
          </div>
          <div className="mb-2">
            <label className="form-label">Role</label>
            <select className="form-select" value={form.roleKey} onChange={handleChange('roleKey')}>
              <option value="physician">Physician</option>
              <option value="dept_head">Department Head</option>
              <option value="scheduler">Master Scheduler</option>
              <option value="admin">Admin</option>
              <option value="program_manager">Program Manager</option>
              <option value="hospital_admin">Hospital Administrator</option>
            </select>
          </div>
          <div className="mb-2">
            <label className="form-label">
              {t('site')}{isHospitalAdmin && <span className="text-danger"> * required for Hospital Administrator</span>}
            </label>
            <select className="form-select" value={form.siteId} onChange={handleChange('siteId')} required={isHospitalAdmin}>
              <option value="">-- none --</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {isHospitalAdmin && (
              <div className="form-text">Your dashboard will only show data for the hospital selected here.</div>
            )}
          </div>
          <div className="mb-3">
            <label className="form-label">{t('department')}</label>
            <select className="form-select" value={form.departmentId} onChange={handleChange('departmentId')}>
              <option value="">-- none --</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary w-100">{t('register')}</button>
        </form>
      </div>
    </div>
  );
}

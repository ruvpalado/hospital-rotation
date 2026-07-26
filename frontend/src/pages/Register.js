import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const EMPTY_FORM = { fullName: '', email: '', password: '', phone: '', roleKey: '', siteId: '', departmentId: '' };

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [sites, setSites] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');

  useEffect(() => {
    api.get('/sites').catch(() => {}).then((res) => res && setSites(res.data));
  }, []);

  // Department options depend strictly on the chosen Site -- per the
  // authoritative Site-Department guideline, each site's department list is
  // unique and must never be merged with another site's. With no site
  // selected yet, the dropdown stays empty rather than falling back to the
  // full cross-site department list.
  useEffect(() => {
    if (!form.siteId) {
      setDepartments([]);
      return;
    }
    api.get('/departments', { params: { siteId: form.siteId } }).catch(() => {}).then((res) => res && setDepartments(res.data));
  }, [form.siteId]);

  // If the previously chosen department isn't offered at the newly chosen
  // site, clear it rather than silently submitting a stale/invalid pairing.
  useEffect(() => {
    if (form.departmentId && !departments.some((d) => String(d.id) === String(form.departmentId))) {
      setForm((f) => ({ ...f, departmentId: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments]);

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  // Site/Department relevance by role:
  //   Department Head       -> Site + Department (both required)
  //   Hospital Administrator -> Site only (Department not applicable)
  //   Any other role        -> neither
  // When the role changes, clear whichever field no longer applies so a
  // disabled selection can never be submitted.
  const roleNeedsSite = (roleKey) => roleKey === 'dept_head' || roleKey === 'hospital_admin';
  const roleNeedsDepartment = (roleKey) => roleKey === 'dept_head';

  const handleRoleChange = (e) => {
    const roleKey = e.target.value;
    setForm((f) => ({
      ...f,
      roleKey,
      siteId: roleNeedsSite(roleKey) ? f.siteId : '',
      departmentId: roleNeedsDepartment(roleKey) ? f.departmentId : '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // Department Head: both Site and Department required.
    // Hospital Administrator: Site required, Department ignored.
    // Every other role: these fields are disabled and skipped entirely.
    if (form.roleKey === 'dept_head' && (!form.siteId || !form.departmentId)) {
      setError('Site and Department are required for the Department Head role.');
      return;
    }
    if (form.roleKey === 'hospital_admin' && !form.siteId) {
      setError('Site is required for the Hospital Administrator role.');
      return;
    }
    try {
      const res = await register(form);
      // Account Creation Policy: registration no longer logs the account in
      // immediately -- it's pending until an admin (or, for admin-role
      // requests, the developer account) approves it. Show that message
      // instead of redirecting into the app.
      setPendingMessage(res.message || 'Registration submitted. Your account is pending admin approval.');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  const handleReturnToLogin = () => {
    setForm({ ...EMPTY_FORM });
    setError('');
    setPendingMessage('');
    navigate('/login');
  };

  // Field enabling/requirement flags derived from the selected role.
  const needsSite = roleNeedsSite(form.roleKey);         // dept_head + hospital_admin
  const needsDepartment = roleNeedsDepartment(form.roleKey); // dept_head only

  if (pendingMessage) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light py-4">
        <div className="card shadow p-4 text-center" style={{ width: 460 }}>
          <h4 className="mb-3">Registration Submitted</h4>
          <div className="alert alert-info">{pendingMessage}</div>
          <button type="button" className="btn btn-primary w-100" onClick={handleReturnToLogin}>
            Return to Log In
          </button>
        </div>
      </div>
    );
  }

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
            <select className="form-select" value={form.roleKey} onChange={handleRoleChange} required>
              <option value="">-- select role --</option>
              <option value="physician">Physician</option>
              <option value="dept_head">Department Head</option>
              <option value="program_administrator">Program Administrator</option>
              <option value="program_manager">Program Manager</option>
              <option value="hospital_admin">Hospital Administrator</option>
            </select>
          </div>
          <div className="mb-2">
            <label className="form-label">
              {t('site')}{needsSite && <span className="text-danger"> *</span>}
            </label>
            <select
              className="form-select"
              value={form.siteId}
              onChange={handleChange('siteId')}
              required={needsSite}
              disabled={!needsSite}
            >
              <option value="">-- none --</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label">
              {t('department')}{needsDepartment && <span className="text-danger"> *</span>}
            </label>
            <select
              className="form-select"
              value={form.departmentId}
              onChange={handleChange('departmentId')}
              required={needsDepartment}
              disabled={!needsDepartment || !form.siteId}
            >
              <option value="">-- none --</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
            </select>
            <div className="form-text">
              {form.roleKey === 'hospital_admin'
                ? 'Not applicable for the Hospital Administrator role.'
                : !needsDepartment
                  ? 'Only required for the Department Head role.'
                  : form.siteId
                    ? 'Showing only departments offered at the selected site.'
                    : 'Select a site first to see its departments.'}
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-100">{t('register')}</button>
          <button type="button" className="btn btn-outline-secondary w-100 mt-2" onClick={handleReturnToLogin}>
            Return to Log In
          </button>
        </form>
      </div>
    </div>
  );
}

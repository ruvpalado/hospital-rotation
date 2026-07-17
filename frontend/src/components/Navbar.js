import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();

  const toggleLanguage = () => {
    const next = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('languagePref', next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  };

  if (!user) return null;

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-3">
      <Link className="navbar-brand" to="/dashboard">{t('appName')}</Link>
      <div className="collapse navbar-collapse">
        <ul className="navbar-nav me-auto">
          <li className="nav-item"><Link className="nav-link" to="/dashboard">{t('dashboard')}</Link></li>
          <li className="nav-item"><Link className="nav-link" to="/schedules">{t('schedules')}</Link></li>
          {(user.role === 'admin' || user.role === 'dept_head') && (
            <li className="nav-item"><Link className="nav-link" to="/approvals">{t('departmentApproval')}</Link></li>
          )}
          <li className="nav-item"><Link className="nav-link" to="/notifications">{t('notifications')}</Link></li>
          {user.role === 'admin' && (
            <li className="nav-item"><Link className="nav-link" to="/audit-log">{t('auditLog')}</Link></li>
          )}
        </ul>
        <div className="d-flex align-items-center gap-2">
          <span className="text-light small">{user.fullName} ({user.roleLabel})</span>
          <button className="btn btn-outline-light btn-sm" onClick={toggleLanguage}>{t('language')}</button>
          <button className="btn btn-outline-light btn-sm" onClick={logout}>{t('logout')}</button>
        </div>
      </div>
    </nav>
  );
}

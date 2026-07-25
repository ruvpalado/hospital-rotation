import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const DEVELOPER_EMAIL = 'ruvpalado@gmail.com';

/**
 * Grouped navigation (see Navbar.css for the visual treatment):
 *   Dashboard | Schedules ▾ (View, Add Schedule, Physician List)
 *   | Approvals ▾ (Department Approval, Pending Approvals)
 *   | Notifications | Users | Reports ▾ (Generate Report, Audit Log)
 * Dropdowns are permission-aware: items the current user can't access are
 * hidden, and a dropdown with no visible items disappears entirely.
 * Bootstrap's JS bundle isn't loaded, so open/close is handled here.
 */
export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState(null);
  const navRef = useRef(null);

  // Close any open dropdown when clicking outside the navbar or navigating.
  useEffect(() => {
    const onClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => { setOpenMenu(null); }, [location]);

  if (!user) return null;

  const isDeveloper = user.email === DEVELOPER_EMAIL;
  const isAdmin = user.role === 'admin';
  const canAddSchedule = user.role === 'scheduler' || isAdmin;

  const toggleLanguage = () => {
    const next = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('languagePref', next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  };

  const toggle = (menu) => setOpenMenu(openMenu === menu ? null : menu);

  // Dropdown group definitions; items are filtered by permission before
  // rendering, and groups with no items left are skipped.
  const groups = [
    {
      key: 'schedules',
      icon: '📅',
      label: t('schedules'),
      // Parent shows the active accent when any child route is current.
      childPaths: ['/schedules', '/physician-list'],
      items: [
        { to: '/schedules', icon: '📋', label: 'View Schedules', show: true },
        { to: '/schedules?add=1', icon: '➕', label: 'Add Schedule', show: canAddSchedule },
        { to: '/physician-list', icon: '🧑‍⚕️', label: 'Physician List', show: isDeveloper },
      ],
    },
    {
      key: 'approvals',
      icon: '✅',
      label: 'Approvals',
      childPaths: ['/approvals', '/pending-approvals'],
      items: [
        { to: '/approvals', icon: '🏥', label: t('departmentApproval'), show: isAdmin || user.role === 'dept_head' },
        { to: '/pending-approvals', icon: '⏳', label: 'User Approval', show: isDeveloper },
      ],
    },
    {
      key: 'reports',
      icon: '📊',
      label: 'Reports',
      childPaths: ['/report', '/audit-log'],
      items: [
        { to: '/report', icon: '📄', label: 'Generate Report', show: true },
        { to: '/audit-log', icon: '📜', label: t('auditLog'), show: isDeveloper },
      ],
    },
  ];

  return (
    <nav className="app-navbar" ref={navRef}>
      <Link className="brand" to="/dashboard">{t('appName')}</Link>
      <ul className="nav-items">
        <li>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon">🏠</span>{t('dashboard')}
          </NavLink>
        </li>

        {groups.map((group) => {
          const visibleItems = group.items.filter((i) => i.show);
          if (visibleItems.length === 0) return null;
          const childActive = group.childPaths.some((p) => location.pathname.startsWith(p));
          return (
            <li className={`nav-dropdown${openMenu === group.key ? ' open' : ''}`} key={group.key}>
              <button
                type="button"
                className={`nav-dropdown-toggle${childActive ? ' child-active' : ''}`}
                onClick={() => toggle(group.key)}
              >
                <span className="nav-icon">{group.icon}</span>{group.label}<span className="caret">▼</span>
              </button>
              <div className="nav-dropdown-menu">
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `nav-dropdown-item${isActive && !item.to.includes('?') ? ' active' : ''}`
                    }
                  >
                    <span className="nav-icon">{item.icon}</span>{item.label}
                  </NavLink>
                ))}
              </div>
            </li>
          );
        })}

        <li>
          <NavLink to="/notifications" className={({ isActive }) => `nav-item-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon">🔔</span>{t('notifications')}
          </NavLink>
        </li>

        {isAdmin && (
          <li>
            <NavLink to="/users" className={({ isActive }) => `nav-item-link${isActive ? ' active' : ''}`}>
              <span className="nav-icon">👥</span>Users
            </NavLink>
          </li>
        )}
      </ul>

      <div className="nav-right">
        <span className="nav-user">{user.fullName}</span>
        <button className="nav-btn" onClick={toggleLanguage}>{t('language')}</button>
        <button className="nav-btn" onClick={logout}>{t('logout')}</button>
      </div>
    </nav>
  );
}

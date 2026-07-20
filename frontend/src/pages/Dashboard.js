import React from 'react';
import { useAuth } from '../context/AuthContext';
import AdminDashboard from './dashboards/AdminDashboard';
import SchedulerDashboard from './dashboards/SchedulerDashboard';
import DeptHeadDashboard from './dashboards/DeptHeadDashboard';
import PhysicianDashboard from './dashboards/PhysicianDashboard';
import HospitalAdminDashboard from './dashboards/HospitalAdminDashboard';

// Dynamic Dashboard Rendering: backend detects role via JWT; frontend picks the
// matching layout after login, per the "Implementation Approach" spec.
// Program Manager reuses AdminDashboard as-is (same hospital-wide view,
// same permissions as Admin). Hospital Administrator gets its own
// component, scoped to just their hospital -- see HospitalAdminDashboard.js.
export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;
  switch (user.role) {
    case 'admin': return <AdminDashboard />;
    case 'program_manager': return <AdminDashboard />;
    case 'hospital_admin': return <HospitalAdminDashboard />;
    case 'scheduler': return <SchedulerDashboard />;
    case 'dept_head': return <DeptHeadDashboard />;
    case 'physician': return <PhysicianDashboard />;
    default: return <div className="p-4">Unknown role.</div>;
  }
}

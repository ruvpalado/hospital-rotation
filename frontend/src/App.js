import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RoleBasedRoute from './components/RoleBasedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ScheduleViewer from './pages/ScheduleViewer';
import DepartmentApproval from './pages/DepartmentApproval';
import NotificationsCenter from './pages/NotificationsCenter';
import AuditLog from './pages/AuditLog';
import Report from './pages/Report';
import UserManagement from './pages/UserManagement';
import PendingApprovals from './pages/PendingApprovals';

function Layout({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={
            <RoleBasedRoute><Layout><Dashboard /></Layout></RoleBasedRoute>
          } />
          <Route path="/schedules" element={
            <RoleBasedRoute><Layout><ScheduleViewer /></Layout></RoleBasedRoute>
          } />
          <Route path="/approvals" element={
            <RoleBasedRoute allowedRoles={['admin', 'dept_head']}><Layout><DepartmentApproval /></Layout></RoleBasedRoute>
          } />
          <Route path="/notifications" element={
            <RoleBasedRoute><Layout><NotificationsCenter /></Layout></RoleBasedRoute>
          } />
          <Route path="/audit-log" element={
            <RoleBasedRoute requireEmail="ruvpalado@gmail.com"><Layout><AuditLog /></Layout></RoleBasedRoute>
          } />
          <Route path="/report" element={
            <RoleBasedRoute><Layout><Report /></Layout></RoleBasedRoute>
          } />
          <Route path="/users" element={
            <RoleBasedRoute allowedRoles={['admin']}><Layout><UserManagement /></Layout></RoleBasedRoute>
          } />
          <Route path="/pending-approvals" element={
            <RoleBasedRoute requireEmail="ruvpalado@gmail.com"><Layout><PendingApprovals /></Layout></RoleBasedRoute>
          } />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

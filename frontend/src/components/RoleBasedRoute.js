import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleBasedRoute({ allowedRoles, requireEmail, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center mt-5">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  // Role expansion mirrors backend middleware/roles.js: 'developer' is a
  // superset of admin, and 'program_administrator' is the successor to (and
  // RBAC-identical to) the retired 'admin' role -- so any route open to
  // 'admin' is also open to both.
  const effectiveRoles = user.role === 'developer'
    ? [user.role, 'admin', 'program_administrator']
    : user.role === 'program_administrator'
      ? [user.role, 'admin']
      : [user.role];
  if (allowedRoles && !allowedRoles.some((r) => effectiveRoles.includes(r))) {
    return <Navigate to="/dashboard" replace />;
  }
  if (requireEmail && user.email !== requireEmail) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

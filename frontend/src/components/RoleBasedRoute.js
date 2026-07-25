import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleBasedRoute({ allowedRoles, requireEmail, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center mt-5">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  // The developer role is a superset of admin (see backend middleware/roles.js):
  // any route open to 'admin' is also open to the developer.
  const effectiveRoles = user.role === 'developer' ? [user.role, 'admin'] : [user.role];
  if (allowedRoles && !allowedRoles.some((r) => effectiveRoles.includes(r))) {
    return <Navigate to="/dashboard" replace />;
  }
  if (requireEmail && user.email !== requireEmail) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

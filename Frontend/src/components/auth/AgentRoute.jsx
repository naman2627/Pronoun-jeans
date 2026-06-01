import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

const AgentRoute = ({ children }) => {
  const { isAuthenticated, isAgent } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAgent) {
    // Authenticated but not an agent — send to buyer dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default AgentRoute;
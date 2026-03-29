/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Search from './pages/Search';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import Notifications from './pages/Notifications';
import Privacy from './pages/Privacy';
import BlockedUsers from './pages/BlockedUsers';
import Chat from './pages/Chat';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="h-screen bg-white flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#DBDBDB] border-t-[#8E8E8E] rounded-full animate-spin"></div></div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Home />} />
              <Route path="search" element={<Search />} />
              <Route path="profile" element={<Profile />} />
              <Route path="user/:userId" element={<UserProfile />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="blocked" element={<BlockedUsers />} />
            </Route>
            
            <Route path="/chat/:chatId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          </Routes>
        </Router>
        <Toaster position="top-center" />
      </AuthProvider>
    </ErrorBoundary>
  );
}

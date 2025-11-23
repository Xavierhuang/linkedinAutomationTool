import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { ThemeProvider } from './components/ThemeProvider';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <ThemeProvider>
      <AdminAuthProvider>
        <BrowserRouter basename="/admin">
          <Routes>
            <Route path="/login" element={<AdminLogin />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <AdminDashboard />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AdminAuthProvider>
    </ThemeProvider>
  );
}

export default App;




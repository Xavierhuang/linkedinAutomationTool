import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  FileText,
  LogOut,
  Menu,
  X,
  Key
} from 'lucide-react';

// Import page components
import DashboardOverview from './DashboardOverview';
import UsersManagement from './UsersManagement';
import APIKeysManagement from './APIKeysManagement';
import BillingManagement from './BillingManagement';
import AnalyticsView from './AnalyticsView';
import ActivityLogs from './ActivityLogs';
import SystemSettings from './SystemSettings';

const AdminDashboard = () => {
  const { logout, adminUser } = useAdminAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'API Keys', href: '/api-keys', icon: Key },
    { name: 'Billing', href: '/billing', icon: CreditCard },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Activity Logs', href: '/logs', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <span className="text-gray-900 font-bold text-sm">LP</span>
              </div>
              <span className="text-white font-semibold">Admin</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    active
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User info and logout */}
          <div className="border-t border-gray-800 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {adminUser?.full_name?.charAt(0) || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {adminUser?.full_name || 'Admin'}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {adminUser?.email || 'admin@mandi.media'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">LP</span>
            </div>
            <span className="font-semibold text-gray-900">Admin</span>
          </div>
          <div className="w-6" />
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Routes>
            <Route path="/dashboard" element={<DashboardOverview />} />
            <Route path="/users" element={<UsersManagement />} />
            <Route path="/api-keys" element={<APIKeysManagement />} />
            <Route path="/billing" element={<BillingManagement />} />
            <Route path="/analytics" element={<AnalyticsView />} />
            <Route path="/logs" element={<ActivityLogs />} />
            <Route path="/settings" element={<SystemSettings />} />
            <Route path="/" element={<DashboardOverview />} />
          </Routes>
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;


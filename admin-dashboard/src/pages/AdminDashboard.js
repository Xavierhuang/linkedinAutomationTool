import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useThemeTokens } from '../hooks/useThemeTokens';
import { useTheme } from 'next-themes';
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
  Key,
  Sun,
  Moon,
  Sparkles
} from 'lucide-react';

// Import page components
import DashboardOverview from './DashboardOverview';
import UsersManagement from './UsersManagement';
import APIKeysManagement from './APIKeysManagement';
import BillingManagement from './BillingManagement';
import AnalyticsView from './AnalyticsView';
import ActivityLogs from './ActivityLogs';
import SystemSettings from './SystemSettings';
import AIPromptsManagement from './AIPromptsManagement';

const getIsDesktop = () => {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.innerWidth >= 1024;
};

const AdminDashboard = () => {
  const { logout, adminUser } = useAdminAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(getIsDesktop());
  const tokens = useThemeTokens();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handleResize = () => {
      const desktop = getIsDesktop();
      setIsDesktop(desktop);
      if (desktop) {
        setSidebarOpen(false);
      }
    };
    if (typeof window !== 'undefined') {
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
    return undefined;
  }, []);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'API Keys', href: '/api-keys', icon: Key },
    { name: 'AI Prompts', href: '/ai-prompts', icon: Sparkles },
    { name: 'Billing', href: '/billing', icon: CreditCard },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Activity Logs', href: '/logs', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: tokens.colors.background.app }}>
      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 50,
          width: isDesktop ? '256px' : '85vw',
          maxWidth: '400px',
          backgroundColor: tokens.colors.background.layer1,
          borderRight: `1px solid ${tokens.colors.border.default}`,
          transform: isDesktop ? 'translateX(0)' : (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'),
          transition: 'transform 300ms ease-in-out'
        }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', padding: '0 24px', borderBottom: `1px solid ${tokens.colors.border.default}` }}>
            <div className="flex items-center gap-3">
              <div style={{ width: '32px', height: '32px', backgroundColor: tokens.colors.accent.lime, borderRadius: tokens.radius.lg }} className="flex items-center justify-center">
                <span style={{ color: tokens.colors.text.inverse, fontWeight: 700, fontSize: '14px' }}>LP</span>
              </div>
              <span style={{ color: tokens.colors.text.primary, fontWeight: 600, fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic' }}>Admin</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{ color: tokens.colors.text.secondary }}
              className="lg:hidden"
              onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
              onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav style={{ flex: 1, padding: '16px', paddingTop: '24px', overflowY: 'auto' }} className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: tokens.radius.lg,
                    fontSize: '14px',
                    fontWeight: 500,
                    backgroundColor: active ? tokens.colors.accent.lime : 'transparent',
                    color: active ? tokens.colors.text.inverse : tokens.colors.text.secondary,
                    fontFamily: tokens.typography.fontFamily.sans
                  }}
                  className="transition"
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.color = tokens.colors.text.primary;
                      e.currentTarget.style.backgroundColor = tokens.colors.background.input;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.color = tokens.colors.text.secondary;
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User info and logout */}
          <div style={{ borderTop: `1px solid ${tokens.colors.border.default}`, padding: '16px' }}>
            <div className="flex items-center gap-3 mb-3">
              <div style={{ width: '40px', height: '40px', backgroundColor: tokens.colors.accent.lime, borderRadius: '50%' }} className="flex items-center justify-center">
                <span style={{ color: tokens.colors.text.inverse, fontWeight: 600, fontSize: '14px' }}>
                  {adminUser?.full_name?.charAt(0) || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: '14px', fontWeight: 500, color: tokens.colors.text.primary }} className="truncate">
                  {adminUser?.full_name || 'Admin'}
                </p>
                <p style={{ fontSize: '12px', color: tokens.colors.text.tertiary }} className="truncate">
                  {adminUser?.email || 'admin@mandi.media'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: tokens.colors.background.input,
                color: tokens.colors.text.primary,
                borderRadius: tokens.radius.lg,
                fontSize: '14px',
                fontWeight: 500,
                border: `1px solid ${tokens.colors.border.default}`
              }}
              className="transition"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = tokens.colors.background.layer2;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = tokens.colors.background.input;
              }}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div
        className="lg:pl-64 transition-[padding] duration-300"
        style={{
          paddingLeft: isDesktop ? '256px' : '0px',
          width: '100%'
        }}
      >
        {/* Desktop Header */}
        <div style={{ backgroundColor: tokens.colors.background.app, borderBottom: `1px solid ${tokens.colors.border.default}`, padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="hidden lg:flex">
          <div style={{ fontSize: '20px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary, fontWeight: 500 }}>
            {location.pathname === '/dashboard' || location.pathname === '/' ? 'Dashboard Overview' :
             location.pathname === '/users' ? 'Users Management' :
             location.pathname === '/api-keys' ? 'API Keys Management' :
             location.pathname === '/ai-prompts' ? 'AI Prompts Management' :
             location.pathname === '/billing' ? 'Billing Management' :
             location.pathname === '/analytics' ? 'Analytics' :
             location.pathname === '/logs' ? 'Activity Logs' :
             location.pathname === '/settings' ? 'System Settings' : 'Admin Dashboard'}
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: tokens.colors.background.input,
              color: tokens.colors.text.primary,
              borderRadius: tokens.radius.full,
              fontSize: '14px',
              fontWeight: 500,
              border: `1px solid ${tokens.colors.border.default}`,
              fontFamily: tokens.typography.fontFamily.sans
            }}
            className="transition"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = tokens.colors.background.layer2;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = tokens.colors.background.input;
            }}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="hidden xl:inline">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>

        {/* Mobile header */}
        <div style={{ backgroundColor: tokens.colors.background.app, borderBottom: `1px solid ${tokens.colors.border.default}`, padding: '16px' }} className="lg:hidden flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ color: tokens.colors.text.secondary }}
            onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
            onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div style={{ width: '24px', height: '24px', backgroundColor: tokens.colors.accent.lime, borderRadius: tokens.radius.md }} className="flex items-center justify-center">
              <span style={{ color: tokens.colors.text.inverse, fontWeight: 700, fontSize: '12px' }}>LP</span>
            </div>
            <span style={{ fontWeight: 600, color: tokens.colors.text.primary, fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic' }}>Admin</span>
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{ width: '24px', height: '24px', color: tokens.colors.text.secondary }}
            onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary}
            onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* Page content */}
        <main style={{ padding: '16px', paddingTop: '32px', paddingBottom: '32px', backgroundColor: tokens.colors.background.app }} className="lg:p-8">
          <Routes>
            <Route path="/dashboard" element={<DashboardOverview />} />
            <Route path="/users" element={<UsersManagement />} />
            <Route path="/api-keys" element={<APIKeysManagement />} />
            <Route path="/ai-prompts" element={<AIPromptsManagement />} />
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
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: tokens.colors.background.app + 'CC',
            backdropFilter: 'blur(4px)',
            zIndex: 40
          }}
          className="lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;


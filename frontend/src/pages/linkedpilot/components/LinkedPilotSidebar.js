import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Briefcase, FileText, Send, BarChart3, Building2, Settings, ChevronLeft, ChevronRight, CheckCircle2, Menu, X } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LinkedPilotSidebar = ({ selectedOrg, onOrgChange, collapsed = false, onToggleCollapse, mobileMenuOpen, setMobileMenuOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [orgName, setOrgName] = useState(null);

  const isActive = (path) => location.pathname.includes(path);

  // Fetch organization name when selectedOrg changes
  useEffect(() => {
    const fetchOrgName = async () => {
      if (selectedOrg && user) {
        try {
          const response = await axios.get(`${BACKEND_URL}/api/organizations?user_id=${user.id}`);
          const org = response.data.find(o => o.id === selectedOrg);
          setOrgName(org?.name || null);
        } catch (error) {
          console.error('Error fetching organization name:', error);
          setOrgName(null);
        }
      } else {
        setOrgName(null);
      }
    };
    fetchOrgName();
  }, [selectedOrg, user]);

  // Reordered with Create as the primary feature: Create → Setup → Review → Manage → Analyze
  const menuItems = [
    { icon: FileText, label: 'Create', path: '/dashboard/drafts' },                 // 1. Primary feature - Generate content
    { icon: Building2, label: 'Organizations', path: '/dashboard/organizations' },  // 2. Setup organizations
    { icon: Briefcase, label: 'Campaigns', path: '/dashboard/campaigns' },          // 3. Create campaigns
    { icon: CheckCircle2, label: 'Review Queue', path: '/dashboard/review-queue' }, // 4. Review & approve
    { icon: Calendar, label: 'Calendar', path: '/dashboard/calendar' },             // 5. Schedule posts
    { icon: Send, label: 'Posts', path: '/dashboard/posts' },                       // 6. Manage published
    { icon: BarChart3, label: 'Analytics', path: '/dashboard/analytics' },          // 7. Analyze results
    { icon: Settings, label: 'Settings', path: '/dashboard/settings' },             // 8. Configure (includes billing)
  ];

  return (
    <>
      {/* Mobile Header - Only shows on mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-50">
        {/* Mobile Hamburger Button */}
        <button
          className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="w-5 h-5 text-white" />
          ) : (
            <Menu className="w-5 h-5 text-white" />
          )}
        </button>

        {/* Mobile Logo */}
        <div className="text-xl font-bold text-gray-900">
          SocialFlow
        </div>

        {/* Spacer for balance */}
        <div className="w-10" />
      </div>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300
          ${collapsed ? 'w-16' : 'w-64'}
          fixed md:relative z-40
          md:translate-x-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          top-16 md:top-0
          h-[calc(100vh-4rem)] md:h-screen
        `}
      >
        {/* Desktop Toggle Button - Only shows on desktop */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:block absolute top-20 -right-3 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-100 transition shadow-sm z-10"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          )}
        </button>

      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        {collapsed ? (
          <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-lg">LP</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">LP</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">LinkedPilot</h1>
              <p className="text-xs text-gray-600">LinkedIn Content Manager</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setMobileMenuOpen(false); // Close mobile menu on navigation
              }}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-lg transition-colors ${
                active
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title={collapsed ? item.label : ''}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          {selectedOrg && (
            <div className="text-xs text-gray-500">
              <div className="font-semibold mb-1">Current Organization</div>
              <div className="text-gray-700 truncate font-medium">{orgName || 'Loading...'}</div>
            </div>
          )}
        </div>
      )}
    </aside>
    </>
  );
};

export default LinkedPilotSidebar;

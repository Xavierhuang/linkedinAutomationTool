import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Direct imports to avoid lazy loading issues
import LinkedPilotSidebar from './components/LinkedPilotSidebar';
import CalendarView from './components/CalendarView';
import Organizations from './components/Organizations';
import CampaignsView from './components/CampaignsView';
import BeeBotDraftsView from './components/BeeBotDraftsView';
import PostsView from './components/PostsView';
import AnalyticsView from './components/AnalyticsView';
import SettingsView from './components/SettingsView';
import ReviewQueueView from './components/ReviewQueueView';

const LinkedPilotDashboard = () => {
  const location = useLocation();
  const [selectedOrg, setSelectedOrg] = useState(() => {
    // Load from localStorage on mount
    return localStorage.getItem('selectedOrgId') || null;
  });
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 overflow-hidden">
      <LinkedPilotSidebar 
        selectedOrg={selectedOrg} 
        onOrgChange={setSelectedOrg}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />
      
      <main className="flex-1 overflow-hidden w-full md:w-auto pt-16 md:pt-0">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard/organizations" replace />} />
          <Route path="/calendar" element={<CalendarView orgId={selectedOrg} />} />
          <Route path="/organizations" element={<Organizations onOrgSelect={setSelectedOrg} />} />
          <Route path="/campaigns" element={<CampaignsView orgId={selectedOrg} />} />
          <Route path="/review-queue" element={<ReviewQueueView orgId={selectedOrg} />} />
          <Route path="/drafts" element={<BeeBotDraftsView orgId={selectedOrg} />} />
          <Route path="/posts" element={<PostsView orgId={selectedOrg} />} />
          <Route path="/analytics" element={<AnalyticsView orgId={selectedOrg} />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </main>
    </div>
  );
};

export default LinkedPilotDashboard;



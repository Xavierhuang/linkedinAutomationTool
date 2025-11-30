import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import FloatingToolbar from './components/FloatingToolbar';
import CalendarView from './components/CalendarView';
import CampaignsView from './components/CampaignsView';
import PostsView from './components/PostsView';
import ReviewQueueView from './components/ReviewQueueView';
import AnalyticsView from './components/AnalyticsView';
import SettingsView from './components/SettingsView';
import CreateView from './components/CreateView';
import Organizations from './components/Organizations';
import DraftsView from './components/Drafts';
import BrandDNAView from './components/BrandDNAView';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LinkedPilotDashboard = () => {
  const { user } = useAuth();
  const [selectedOrg, setSelectedOrg] = useState(() => localStorage.getItem('selectedOrgId') || null);
  const [organizations, setOrganizations] = useState([]);



  const handleOrganizationChange = (orgId) => {
    setSelectedOrg(orgId);
    if (orgId) {
      localStorage.setItem('selectedOrgId', orgId);
    }
  };


  useEffect(() => {
    const fetchOrganizations = async () => {
      if (!user) return;
      try {
        const response = await axios.get(`${BACKEND_URL}/api/organizations`, {
          params: { user_id: user.id },
        });
        const orgs = Array.isArray(response.data) ? response.data : [];
        setOrganizations(orgs);

        // Check if there's a saved orgId from onboarding or previous selection
        const savedOrgId = localStorage.getItem('selectedOrgId');
        
        if (savedOrgId) {
          // Verify the saved orgId exists in the user's organizations
          const orgExists = orgs.find(org => org.id === savedOrgId);
          if (orgExists) {
            // Use the saved orgId (from onboarding or previous selection)
            if (selectedOrg !== savedOrgId) {
              setSelectedOrg(savedOrgId);
              console.log(`✅ Auto-selected organization: ${savedOrgId}`);
            }
          } else {
            // Saved orgId doesn't exist, select first available
            if (orgs.length > 0 && selectedOrg !== orgs[0].id) {
              setSelectedOrg(orgs[0].id);
              localStorage.setItem('selectedOrgId', orgs[0].id);
            }
          }
        } else if (orgs.length > 0 && !selectedOrg) {
          // No saved orgId, select first available
          setSelectedOrg(orgs[0].id);
          localStorage.setItem('selectedOrgId', orgs[0].id);
        }
      } catch (error) {
        console.error('Failed to load organizations:', error);
      }
    };

    fetchOrganizations();
  }, [user]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden relative text-foreground bg-background">
      {/* Floating Toolbar Header */}
      <FloatingToolbar activeOrgId={selectedOrg} />

      {/* Main Content Area */}
      <div className="pt-20 px-4 lg:px-8 pb-10 w-full max-w-7xl mx-auto transition-all duration-300">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard/calendar" replace />} />
          <Route path="/create" element={<CreateView />} />
          <Route path="/calendar" element={<CalendarView key={selectedOrg} orgId={selectedOrg} />} />
          <Route path="/campaigns" element={<CampaignsView orgId={selectedOrg} />} />
          <Route path="/posts" element={<PostsView orgId={selectedOrg} />} />
          <Route path="/review-queue" element={<ReviewQueueView orgId={selectedOrg} />} />
          <Route path="/analytics" element={<AnalyticsView orgId={selectedOrg} />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route
            path="/organizations"
            element={<Organizations orgId={selectedOrg} onSelectOrg={handleOrganizationChange} />}
          />
          <Route path="/brand-dna" element={<BrandDNAView orgId={selectedOrg} />} />
          <Route path="/drafts" element={<DraftsView orgId={selectedOrg} />} />
          <Route path="*" element={<Navigate to="/dashboard/calendar" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default LinkedPilotDashboard;

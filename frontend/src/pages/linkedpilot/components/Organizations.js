import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Building2, Linkedin, Globe, Trash2, Edit, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import OrganizationMaterialsModal from './OrganizationMaterialsModal';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Organizations = ({ onOrgSelect }) => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [linkedInConnected, setLinkedInConnected] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    website: '',
    brand_tone: 'Professional and engaging',
    target_audience: 'Business professionals'
  });

  useEffect(() => {
    if (user) {
      fetchOrganizations();
      fetchLinkedInStatus();
    }
  }, [user]);

  const fetchOrganizations = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/organizations?user_id=${user.id}`);
      setOrganizations(response.data);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedInStatus = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/settings/linkedin-status?user_id=${user.id}`);
      setLinkedInConnected(response.data.linkedin_connected);
    } catch (error) {
      console.error('Error fetching LinkedIn status:', error);
      setLinkedInConnected(false);
    }
  };

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${BACKEND_URL}/api/organizations`, {
        ...formData,
        created_by: user.id
      });
      
      setOrganizations([...organizations, response.data]);
      setShowCreateModal(false);
      setFormData({ name: '', website: '', brand_tone: 'Professional and engaging', target_audience: 'Business professionals' });
      
      // Auto-select the new organization
      if (onOrgSelect) {
        onOrgSelect(response.data.id);
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      alert('Failed to create organization. Please try again.');
    }
  };

  const handleSelectOrg = (orgId) => {
    if (onOrgSelect) {
      onOrgSelect(orgId);
    }
    // Store in localStorage for persistence
    localStorage.setItem('selectedOrgId', orgId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header - Responsive */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Organizations</h1>
            <p className="text-xs md:text-sm text-gray-600 mt-1">Manage your LinkedIn organization pages</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Organization
          </Button>
        </div>
        
        {/* Materials Feature Banner */}
        {organizations.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  🚀 AI-Powered Campaign Generation
                </h3>
                <p className="text-xs text-blue-800">
                  Upload your company materials (website, PDFs, images) and let AI analyze your brand to generate complete LinkedIn campaigns in minutes. Click the <strong>"Materials"</strong> button on any organization to get started.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content - Responsive Padding */}
      <div className="flex-1 overflow-auto p-4 md:p-8">
        {organizations.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Organizations Yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create your first organization to start managing your LinkedIn content and scheduling posts.
            </p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Organization
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-7xl">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="bg-white rounded-lg border border-gray-200 p-4 md:p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleSelectOrg(org.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      className="p-2 hover:bg-gray-100 rounded" 
                      onClick={(e) => { 
                        e.stopPropagation();
                        setEditingOrg(org);
                        setShowMaterialsModal(true);
                      }}
                      title="Manage Materials"
                    >
                      <FileText className="w-4 h-4 text-blue-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded" onClick={(e) => { e.stopPropagation(); }}>
                      <Edit className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2">{org.name}</h3>
                
                {org.website && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <Globe className="w-4 h-4" />
                    <span className="truncate">{org.website}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">LinkedIn</span>
                    {linkedInConnected ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        Connected
                      </span>
                    ) : (
                      <span className="text-gray-400">Not connected</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingOrg(org);
                      setShowMaterialsModal(true);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Materials
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectOrg(org.id);
                    }}
                    className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                  >
                    Select
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Materials Modal */}
      {showMaterialsModal && editingOrg && (
        <OrganizationMaterialsModal
          isOpen={showMaterialsModal}
          onClose={() => {
            setShowMaterialsModal(false);
            setEditingOrg(null);
          }}
          orgId={editingOrg.id}
          organization={editingOrg}
          onAnalysisComplete={(analysis) => {
            console.log('Analysis complete:', analysis);
            // Optionally refresh organizations or show success message
          }}
        />
      )}

      {/* Create Modal - Responsive */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-none md:rounded-lg w-full md:max-w-md h-full md:h-auto overflow-y-auto p-4 md:p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Organization</h2>
            
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <Label className="text-gray-700 mb-2 block text-sm font-medium">Organization Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., TechCorp Inc."
                  className="border-gray-300 bg-white text-gray-900"
                  required
                />
              </div>

              <div>
                <Label className="text-gray-700 mb-2 block text-sm font-medium">Website</Label>
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://yourcompany.com"
                  className="border-gray-300 bg-white text-gray-900"
                />
              </div>

              <div>
                <Label className="text-gray-700 mb-2 block text-sm font-medium">Brand Tone</Label>
                <Input
                  value={formData.brand_tone}
                  onChange={(e) => setFormData({ ...formData, brand_tone: e.target.value })}
                  placeholder="Professional and engaging"
                  className="border-gray-300 bg-white text-gray-900"
                />
              </div>

              <div>
                <Label className="text-gray-700 mb-2 block text-sm font-medium">Target Audience</Label>
                <Input
                  value={formData.target_audience}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                  placeholder="Business professionals"
                  className="border-gray-300 bg-white text-gray-900"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                >
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Organizations;

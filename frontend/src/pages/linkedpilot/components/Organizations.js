import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Linkedin, Globe, Trash2, Edit, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import OrganizationMaterialsModal from './OrganizationMaterialsModal';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Organizations = ({ onOrgSelect }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    website: '',
    brand_tone: 'Professional and engaging',
    target_audience: 'Business professionals'
  });

  useEffect(() => {
    if (user) {
      fetchOrganizations();
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="bg-background border-b border-border px-8 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-serif italic text-foreground mb-2">Organizations</h1>
            <p className="text-sm text-muted-foreground font-light">Manage your LinkedIn organization pages</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate('/onboarding')}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-medium rounded-full px-6 border-none flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Start New Onboarding
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full px-6 border-none flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Organization
            </Button>
          </div>
        </div>

        {/* Materials Feature Banner */}
        {organizations.length > 0 && (
          <div className="bg-gradient-to-r from-secondary to-layer-1 border border-border rounded-2xl p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 border border-accent/20">
                <FileText className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-foreground mb-2">
                  🚀 AI-Powered Campaign Generation
                </h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">
                  Upload your company materials (website, PDFs, images) and let AI analyze your brand to generate complete LinkedIn campaigns in minutes. Click the <strong>"Materials"</strong> button on any organization to get started.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {organizations.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-border border-dashed animate-in fade-in duration-500">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">No Organizations Yet</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto font-light">
              Create your first organization to start managing your LinkedIn content and scheduling posts.
            </p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary/10 hover:bg-primary/20 text-primary rounded-full px-6 border border-primary/20"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Organization
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl animate-in fade-in duration-500">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all cursor-pointer group hover:shadow-2xl hover:-translate-y-1"
                onClick={() => handleSelectOrg(org.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center border border-border">
                    <Building2 className="w-6 h-6 text-foreground" />
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-2 hover:bg-accent/50 rounded-lg text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingOrg(org);
                        setShowMaterialsModal(true);
                      }}
                      title="Manage Materials"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); }}>
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-xl font-serif italic text-foreground mb-2">{org.name}</h3>

                {org.website && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Globe className="w-4 h-4" />
                    <span className="truncate">{org.website}</span>
                  </div>
                )}

                <div className="pt-4 border-t border-border mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">LinkedIn</span>
                    {org.linkedin_access_token ? (
                      <span className="flex items-center gap-1.5 text-primary font-medium bg-primary/10 px-2 py-0.5 rounded border border-primary/20 text-xs">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                        Connected
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 text-xs">Not connected</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingOrg(org);
                      setShowMaterialsModal(true);
                    }}
                    className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 h-9 text-xs font-medium rounded-lg"
                  >
                    <FileText className="w-3.5 h-3.5 mr-2" />
                    Materials
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectOrg(org.id);
                    }}
                    className="flex-1 bg-muted hover:bg-accent/50 text-foreground border border-border h-9 text-xs font-medium rounded-lg"
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-8 shadow-2xl">
            <h2 className="text-2xl font-serif italic text-foreground mb-6">Create Organization</h2>

            <form onSubmit={handleCreateOrg} className="space-y-5">
              <div>
                <Label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Organization Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., TechCorp Inc."
                  className="bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 h-11 rounded-xl"
                  required
                />
              </div>

              <div>
                <Label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Website</Label>
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://yourcompany.com"
                  className="bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 h-11 rounded-xl"
                />
              </div>

              <div>
                <Label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Brand Tone</Label>
                <Input
                  value={formData.brand_tone}
                  onChange={(e) => setFormData({ ...formData, brand_tone: e.target.value })}
                  placeholder="Professional and engaging"
                  className="bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 h-11 rounded-xl"
                />
              </div>

              <div>
                <Label className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wide">Target Audience</Label>
                <Input
                  value={formData.target_audience}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                  placeholder="Business professionals"
                  className="bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary/50 h-11 rounded-xl"
                />
              </div>

              <div className="flex gap-3 pt-6">
                <Button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-muted hover:bg-accent/50 text-foreground border border-border h-11 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-11 rounded-xl border-none"
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

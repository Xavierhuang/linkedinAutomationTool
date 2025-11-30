import React, { useState, useEffect } from 'react';
import { X, Upload, Link as LinkIcon, FileText, Image as ImageIcon, Trash2, Loader2, Sparkles, Plus, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { useThemeTokens } from '@/hooks/useThemeTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const OrganizationMaterialsModal = ({ isOpen, onClose, orgId, onAnalysisComplete, organization }) => {
  const tokens = useThemeTokens();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlType, setUrlType] = useState('website');
  const [brandAnalysis, setBrandAnalysis] = useState(null);
  const [showWebsiteSuggestion, setShowWebsiteSuggestion] = useState(false);

  useEffect(() => {
    if (isOpen && orgId) {
      fetchMaterials();
      fetchAnalysis();
      checkWebsiteSuggestion();
    }
  }, [isOpen, orgId]);

  const checkWebsiteSuggestion = async () => {
    // Check if organization has a website and if it's not already added as material
    if (organization?.website) {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/organization-materials?org_id=${orgId}`);
        const materials = response.data;
        
        // Check if website is already added
        const websiteExists = materials.some(m => 
          m.url === organization.website || 
          m.url === organization.website.replace(/\/$/, '') ||
          m.url === organization.website + '/'
        );
        
        if (!websiteExists) {
          setShowWebsiteSuggestion(true);
        }
      } catch (error) {
        console.error('Error checking website:', error);
      }
    }
  };

  const handleAddOrgWebsite = async () => {
    if (!organization?.website) return;
    
    try {
      setLoading(true);
      await axios.post(`${BACKEND_URL}/api/organization-materials/add-url`, null, {
        params: {
          org_id: orgId,
          url: organization.website,
          material_type: 'website'
        }
      });

      setShowWebsiteSuggestion(false);
      await fetchMaterials();
      alert('Organization website added successfully!');
    } catch (error) {
      console.error('Error adding organization website:', error);
      alert('Failed to add website');
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/organization-materials?org_id=${orgId}`);
      setMaterials(response.data);
    } catch (error) {
      console.error('Error fetching materials:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysis = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/organization-materials/analysis?org_id=${orgId}`);
      setBrandAnalysis(response.data);
    } catch (error) {
      // No analysis yet
      setBrandAnalysis(null);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('org_id', orgId);

      await axios.post(`${BACKEND_URL}/api/organization-materials/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await fetchMaterials();
      alert('File uploaded successfully!');
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;

    try {
      setLoading(true);
      await axios.post(`${BACKEND_URL}/api/organization-materials/add-url`, null, {
        params: {
          org_id: orgId,
          url: urlInput,
          material_type: urlType
        }
      });

      setUrlInput('');
      setShowUrlInput(false);
      await fetchMaterials();
      alert('URL added successfully!');
    } catch (error) {
      console.error('Error adding URL:', error);
      alert('Failed to add URL');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (materialId) => {
    if (!window.confirm('Delete this material?')) return;

    try {
      await axios.delete(`${BACKEND_URL}/api/organization-materials/${materialId}`);
      await fetchMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      alert('Failed to delete material');
    }
  };

  const handleAnalyze = async () => {
    if (materials.length === 0) {
      alert('Please add some materials first');
      return;
    }

    try {
      setAnalyzing(true);
      const response = await axios.post(`${BACKEND_URL}/api/organization-materials/analyze?org_id=${orgId}`);
      setBrandAnalysis(response.data);
      alert('Analysis complete! You can now generate campaigns based on these insights.');
      if (onAnalysisComplete) onAnalysisComplete(response.data);
    } catch (error) {
      console.error('Error analyzing materials:', error);
      alert('Analysis failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateCampaign = async (suggestedCampaign) => {
    try {
      setLoading(true);
      const response = await axios.post(`${BACKEND_URL}/api/organization-materials/generate-campaign`, {
        org_id: orgId,
        campaign_name: suggestedCampaign.name,
        focus_area: suggestedCampaign.focus || suggestedCampaign.description,
        use_analysis: true
      });

      alert(`Campaign "${suggestedCampaign.name}" created successfully! Check the Campaigns tab.`);
      
      // Optionally close modal and refresh campaigns
      if (onAnalysisComplete) {
        onAnalysisComplete(brandAnalysis);
      }
    } catch (error) {
      console.error('Error generating campaign:', error);
      alert('Campaign generation failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const getMaterialIcon = (type) => {
    const iconStyle = { width: '20px', height: '20px' };
    switch (type) {
      case 'pdf':
      case 'document':
        return <FileText style={{ ...iconStyle, color: '#EF4444' }} />;
      case 'image':
        return <ImageIcon style={{ ...iconStyle, color: tokens.colors.accent.lime }} />;
      case 'website':
      case 'blog':
        return <LinkIcon style={{ ...iconStyle, color: '#10B981' }} />;
      default:
        return <FileText style={{ ...iconStyle, color: tokens.colors.text.tertiary }} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{
        backgroundColor: tokens.isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)'
      }}
      onClick={onClose}
    >
      <div 
        className="materials-modal max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          backgroundColor: tokens.colors.background.layer2,
          borderRadius: tokens.radius.xl,
          border: `1px solid ${tokens.colors.border.default}`,
          boxShadow: tokens.shadow.floating
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="px-6 py-4 flex items-center justify-between"
          style={{
            borderBottom: `1px solid ${tokens.colors.border.default}`,
            backgroundColor: tokens.colors.background.layer1
          }}
        >
          <div>
            <h2 
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: tokens.colors.text.primary,
                fontFamily: tokens.typography.fontFamily.serif,
                fontStyle: 'italic'
              }}
            >
              Organizational Materials
            </h2>
            <p 
              style={{
                fontSize: '14px',
                color: tokens.colors.text.secondary,
                marginTop: '4px'
              }}
            >
              Upload materials to auto-generate campaign insights
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              color: tokens.colors.text.tertiary,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: '8px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}
            onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.tertiary}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Website Suggestion Banner */}
          {showWebsiteSuggestion && organization?.website && (
            <div 
              className="mb-6 p-4 rounded-lg"
              style={{
                background: `linear-gradient(to right, ${tokens.colors.accent.lime}20, ${tokens.colors.accent.lime}10)`,
                border: `1px solid ${tokens.colors.accent.lime}40`,
                borderRadius: tokens.radius.lg
              }}
            >
              <div className="flex items-start gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: tokens.colors.accent.lime,
                    borderRadius: tokens.radius.md
                  }}
                >
                  <Globe className="w-5 h-5" style={{ color: '#000000' }} />
                </div>
                <div className="flex-1">
                  <h3 
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: tokens.colors.text.primary,
                      marginBottom: '4px'
                    }}
                  >
                    Organization Website Detected
                  </h3>
                  <p 
                    style={{
                      fontSize: '12px',
                      color: tokens.colors.text.secondary,
                      marginBottom: '8px'
                    }}
                  >
                    We found your organization's website: <strong>{organization.website}</strong>
                  </p>
                  <p 
                    style={{
                      fontSize: '12px',
                      color: tokens.colors.text.tertiary,
                      marginBottom: '12px'
                    }}
                  >
                    Add it as a material to help AI analyze your brand and generate better campaigns.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddOrgWebsite}
                      disabled={loading}
                      style={{
                        backgroundColor: tokens.colors.accent.lime,
                        color: '#000000',
                        fontSize: '12px',
                        padding: '6px 12px',
                        borderRadius: tokens.radius.md,
                        border: 'none',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                        opacity: loading ? 0.5 : 1
                      }}
                    >
                      {loading ? 'Adding...' : 'Add Website'}
                    </button>
                    <button
                      onClick={() => setShowWebsiteSuggestion(false)}
                      style={{
                        backgroundColor: tokens.colors.background.input,
                        color: tokens.colors.text.secondary,
                        fontSize: '12px',
                        padding: '6px 12px',
                        borderRadius: tokens.radius.md,
                        border: `1px solid ${tokens.colors.border.default}`,
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upload Section */}
          <div className="mb-6">
            <h3 
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: tokens.colors.text.primary,
                marginBottom: '12px'
              }}
            >
              Add Materials
            </h3>
            <div className="flex gap-2">
              <label className="flex-1">
                <div 
                  className="rounded-lg p-4 text-center cursor-pointer transition"
                  style={{
                    border: `2px dashed ${tokens.colors.border.default}`,
                    borderRadius: tokens.radius.lg
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = tokens.colors.accent.lime}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = tokens.colors.border.default}
                >
                  <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: tokens.colors.text.tertiary }} />
                  <span style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>
                    Upload PDF, Image, or Document
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt,image/*"
                    onChange={handleFileUpload}
                    disabled={loading}
                  />
                </div>
              </label>
              
              <button
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="flex-1 rounded-lg p-4 text-center transition"
                style={{
                  border: `2px dashed ${tokens.colors.border.default}`,
                  borderRadius: tokens.radius.lg,
                  background: 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = tokens.colors.accent.lime}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = tokens.colors.border.default}
              >
                <LinkIcon className="w-6 h-6 mx-auto mb-2" style={{ color: tokens.colors.text.tertiary }} />
                <span style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>
                  Add Website or Blog URL
                </span>
              </button>
            </div>

            {showUrlInput && (
              <div 
                className="mt-3 p-4 rounded-lg"
                style={{
                  backgroundColor: tokens.colors.background.input,
                  borderRadius: tokens.radius.lg
                }}
              >
                <div className="flex gap-2 mb-2">
                  <select
                    value={urlType}
                    onChange={(e) => setUrlType(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{
                      color: tokens.colors.text.primary,
                      backgroundColor: tokens.colors.background.layer2,
                      border: `1px solid ${tokens.colors.border.default}`,
                      borderRadius: tokens.radius.md
                    }}
                  >
                    <option value="website">Website</option>
                    <option value="blog">Blog</option>
                  </select>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 px-3 py-2 rounded-lg text-sm"
                    style={{
                      color: tokens.colors.text.primary,
                      backgroundColor: tokens.colors.background.layer2,
                      border: `1px solid ${tokens.colors.border.default}`,
                      borderRadius: tokens.radius.md
                    }}
                  />
                  <button
                    onClick={handleAddUrl}
                    disabled={loading}
                    style={{
                      backgroundColor: tokens.colors.accent.lime,
                      color: '#000000',
                      padding: '8px 12px',
                      borderRadius: tokens.radius.md,
                      border: 'none',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Materials List */}
          <div className="mb-6">
            <h3 
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: tokens.colors.text.primary,
                marginBottom: '12px'
              }}
            >
              Materials ({materials.length})
            </h3>
            {loading && materials.length === 0 ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: tokens.colors.text.tertiary }} />
              </div>
            ) : materials.length === 0 ? (
              <div 
                className="text-center py-8"
                style={{
                  color: tokens.colors.text.tertiary,
                  fontSize: '14px'
                }}
              >
                No materials added yet. Upload files or add URLs to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {materials.map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center gap-3 p-3 rounded-lg transition"
                    style={{
                      backgroundColor: tokens.colors.background.input,
                      borderRadius: tokens.radius.lg
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.background.layer1}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.background.input}
                  >
                    {getMaterialIcon(material.type)}
                    <div className="flex-1 min-w-0">
                      <p 
                        className="truncate"
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: tokens.colors.text.primary
                        }}
                      >
                        {material.name}
                      </p>
                      <p 
                        className="capitalize"
                        style={{
                          fontSize: '12px',
                          color: tokens.colors.text.tertiary
                        }}
                      >
                        {material.type} • {material.status}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(material.id)}
                      style={{
                        color: tokens.colors.error,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Analysis Section */}
          {brandAnalysis && (
            <div className="mb-6">
              <div 
                className="p-4 rounded-lg mb-4"
                style={{
                  background: `linear-gradient(to right, ${tokens.colors.accent.lime}20, ${tokens.colors.accent.lime}10)`,
                  border: `1px solid ${tokens.colors.accent.lime}40`,
                  borderRadius: tokens.radius.lg
                }}
              >
                <h3 
                  className="mb-3 flex items-center gap-2"
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: tokens.colors.text.primary
                  }}
                >
                  <Sparkles className="w-4 h-4" style={{ color: tokens.colors.accent.lime }} />
                  Brand Analysis Complete
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-4" style={{ fontSize: '12px' }}>
                  <div>
                    <span style={{ color: tokens.colors.text.secondary, fontWeight: 500 }}>Brand Voice:</span>
                    <span className="ml-1 capitalize" style={{ color: tokens.colors.text.primary }}>{brandAnalysis.brand_voice}</span>
                  </div>
                  <div>
                    <span style={{ color: tokens.colors.text.secondary, fontWeight: 500 }}>Content Pillars:</span>
                    <span className="ml-1" style={{ color: tokens.colors.text.primary }}>{brandAnalysis.content_pillars?.length || 0}</span>
                  </div>
                  <div>
                    <span style={{ color: tokens.colors.text.secondary, fontWeight: 500 }}>Target Industries:</span>
                    <span className="ml-1" style={{ color: tokens.colors.text.primary }}>{brandAnalysis.target_audience?.industries?.length || 0}</span>
                  </div>
                  <div>
                    <span style={{ color: tokens.colors.text.secondary, fontWeight: 500 }}>Expert Segments:</span>
                    <span className="ml-1" style={{ color: tokens.colors.text.primary }}>{brandAnalysis.expert_segments?.length || 0}</span>
                  </div>
                </div>

                {/* Content Pillars Preview */}
                {brandAnalysis.content_pillars && brandAnalysis.content_pillars.length > 0 && (
                  <div className="mb-3">
                    <span style={{ fontSize: '12px', color: tokens.colors.text.secondary, fontWeight: 500 }}>Content Pillars:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {brandAnalysis.content_pillars.slice(0, 6).map((pillar, idx) => (
                        <span 
                          key={idx} 
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            backgroundColor: tokens.colors.accent.lime + '30',
                            color: tokens.colors.accent.lime,
                            borderRadius: tokens.radius.sm
                          }}
                        >
                          {pillar}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Target Audience Preview */}
                {brandAnalysis.target_audience?.job_titles && brandAnalysis.target_audience.job_titles.length > 0 && (
                  <div>
                    <span style={{ fontSize: '12px', color: tokens.colors.text.secondary, fontWeight: 500 }}>Target Roles:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {brandAnalysis.target_audience.job_titles.slice(0, 5).map((title, idx) => (
                        <span 
                          key={idx} 
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            backgroundColor: tokens.colors.accent.lime + '30',
                            color: tokens.colors.accent.lime,
                            borderRadius: tokens.radius.sm
                          }}
                        >
                          {title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Suggested Campaigns */}
              {brandAnalysis.suggested_campaigns && brandAnalysis.suggested_campaigns.length > 0 && (
                <div 
                  className="p-4 rounded-lg"
                  style={{
                    backgroundColor: tokens.colors.background.input,
                    border: `1px solid ${tokens.colors.border.default}`,
                    borderRadius: tokens.radius.lg
                  }}
                >
                  <h4 
                    className="mb-3"
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: tokens.colors.text.primary
                    }}
                  >
                    Suggested Campaigns
                  </h4>
                  <div className="space-y-2">
                    {brandAnalysis.suggested_campaigns.slice(0, 3).map((campaign, idx) => (
                      <div 
                        key={idx} 
                        className="p-3 rounded"
                        style={{
                          backgroundColor: tokens.colors.background.layer2,
                          border: `1px solid ${tokens.colors.border.default}`,
                          borderRadius: tokens.radius.md
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 
                              style={{
                                fontSize: '14px',
                                fontWeight: 500,
                                color: tokens.colors.text.primary
                              }}
                            >
                              {campaign.name}
                            </h5>
                            <p 
                              className="mt-1"
                              style={{
                                fontSize: '12px',
                                color: tokens.colors.text.secondary
                              }}
                            >
                              {campaign.description}
                            </p>
                            {campaign.focus && (
                              <span 
                                className="inline-block mt-2 px-2 py-1 rounded text-xs"
                                style={{
                                  backgroundColor: tokens.colors.accent.lime + '30',
                                  color: tokens.colors.accent.lime,
                                  borderRadius: tokens.radius.sm
                                }}
                              >
                                {campaign.focus}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleGenerateCampaign(campaign)}
                            className="ml-2 px-3 py-1 rounded text-xs flex items-center gap-1"
                            style={{
                              backgroundColor: tokens.colors.accent.lime,
                              color: '#000000',
                              border: 'none',
                              cursor: 'pointer',
                              borderRadius: tokens.radius.md,
                              fontWeight: 500
                            }}
                          >
                            <Sparkles className="w-3 h-3" />
                            Generate
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-6 py-4 flex justify-between"
          style={{
            borderTop: `1px solid ${tokens.colors.border.default}`,
            backgroundColor: tokens.colors.background.layer1
          }}
        >
          <button
            onClick={onClose}
            style={{
              backgroundColor: tokens.colors.background.input,
              color: tokens.colors.text.primary,
              padding: '10px 24px',
              borderRadius: '9999px',
              border: `1px solid ${tokens.colors.border.default}`,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            Close
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || materials.length === 0}
            style={{
              backgroundColor: analyzing || materials.length === 0 ? tokens.colors.text.tertiary : tokens.colors.accent.lime,
              color: '#000000',
              padding: '10px 24px',
              borderRadius: '9999px',
              border: 'none',
              cursor: analyzing || materials.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: analyzing || materials.length === 0 ? 0.5 : 1
            }}
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {brandAnalysis ? 'Re-analyze Materials' : 'Analyze & Generate Insights'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrganizationMaterialsModal;

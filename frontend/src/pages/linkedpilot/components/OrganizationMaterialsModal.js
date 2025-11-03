import React, { useState, useEffect } from 'react';
import { X, Upload, Link as LinkIcon, FileText, Image as ImageIcon, Trash2, Loader2, Sparkles, Plus, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const OrganizationMaterialsModal = ({ isOpen, onClose, orgId, onAnalysisComplete, organization }) => {
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
    switch (type) {
      case 'pdf':
      case 'document':
        return <FileText className="w-5 h-5 text-red-600" />;
      case 'image':
        return <ImageIcon className="w-5 h-5 text-blue-600" />;
      case 'website':
      case 'blog':
        return <LinkIcon className="w-5 h-5 text-green-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <style>{`
        .materials-modal input,
        .materials-modal select {
          color: #1A1A1A !important;
          background-color: #FFFFFF !important;
        }
      `}</style>

      <div className="materials-modal bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Organizational Materials</h2>
            <p className="text-sm text-gray-600 mt-1">Upload materials to auto-generate campaign insights</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Website Suggestion Banner */}
          {showWebsiteSuggestion && organization?.website && (
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-green-900 mb-1">
                    🎯 Organization Website Detected
                  </h3>
                  <p className="text-xs text-green-800 mb-2">
                    We found your organization's website: <strong>{organization.website}</strong>
                  </p>
                  <p className="text-xs text-green-700 mb-3">
                    Add it as a material to help AI analyze your brand and generate better campaigns.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddOrgWebsite}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 h-auto"
                    >
                      {loading ? 'Adding...' : 'Add Website'}
                    </Button>
                    <Button
                      onClick={() => setShowWebsiteSuggestion(false)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs px-3 py-1 h-auto"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upload Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Materials</h3>
            <div className="flex gap-2">
              <label className="flex-1">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition">
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <span className="text-sm text-gray-600">Upload PDF, Image, or Document</span>
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
                className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition"
              >
                <LinkIcon className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <span className="text-sm text-gray-600">Add Website or Blog URL</span>
              </button>
            </div>

            {showUrlInput && (
              <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex gap-2 mb-2">
                  <select
                    value={urlType}
                    onChange={(e) => setUrlType(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    style={{ color: '#1A1A1A', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="website">Website</option>
                    <option value="blog">Blog</option>
                  </select>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    style={{ color: '#1A1A1A', backgroundColor: '#FFFFFF' }}
                  />
                  <Button onClick={handleAddUrl} disabled={loading} className="bg-blue-600 text-white">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Materials List */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Materials ({materials.length})
            </h3>
            {loading && materials.length === 0 ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
              </div>
            ) : materials.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No materials added yet. Upload files or add URLs to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {materials.map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    {getMaterialIcon(material.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{material.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{material.type} • {material.status}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(material.id)}
                      className="text-red-600 hover:text-red-800"
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
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 mb-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Brand Analysis Complete
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div>
                    <span className="text-blue-700 font-medium">Brand Voice:</span>
                    <span className="text-blue-900 ml-1 capitalize">{brandAnalysis.brand_voice}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Content Pillars:</span>
                    <span className="text-blue-900 ml-1">{brandAnalysis.content_pillars?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Target Industries:</span>
                    <span className="text-blue-900 ml-1">{brandAnalysis.target_audience?.industries?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Expert Segments:</span>
                    <span className="text-blue-900 ml-1">{brandAnalysis.expert_segments?.length || 0}</span>
                  </div>
                </div>

                {/* Content Pillars Preview */}
                {brandAnalysis.content_pillars && brandAnalysis.content_pillars.length > 0 && (
                  <div className="mb-3">
                    <span className="text-xs text-blue-700 font-medium">Content Pillars:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {brandAnalysis.content_pillars.slice(0, 6).map((pillar, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {pillar}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Target Audience Preview */}
                {brandAnalysis.target_audience?.job_titles && brandAnalysis.target_audience.job_titles.length > 0 && (
                  <div>
                    <span className="text-xs text-blue-700 font-medium">Target Roles:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {brandAnalysis.target_audience.job_titles.slice(0, 5).map((title, idx) => (
                        <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                          {title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Suggested Campaigns */}
              {brandAnalysis.suggested_campaigns && brandAnalysis.suggested_campaigns.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Suggested Campaigns</h4>
                  <div className="space-y-2">
                    {brandAnalysis.suggested_campaigns.slice(0, 3).map((campaign, idx) => (
                      <div key={idx} className="p-3 bg-white rounded border border-gray-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="text-sm font-medium text-gray-900">{campaign.name}</h5>
                            <p className="text-xs text-gray-600 mt-1">{campaign.description}</p>
                            {campaign.focus && (
                              <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                {campaign.focus}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleGenerateCampaign(campaign)}
                            className="ml-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs flex items-center gap-1"
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
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <Button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-900">
            Close
          </Button>
          <Button
            onClick={handleAnalyze}
            disabled={analyzing || materials.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
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
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrganizationMaterialsModal;

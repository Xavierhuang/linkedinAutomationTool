import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import axios from 'axios';
import { useThemeTokens } from '@/hooks/useThemeTokens';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const BrandDNAEditModal = ({ isOpen, onClose, onSave, initialData, orgId }) => {
  const tokens = useThemeTokens();
  const [formData, setFormData] = useState({
    brand_voice: '',
    brand_tone: [],
    key_messages: [],
    value_propositions: [],
    content_pillars: [],
    target_audience: {
      job_titles: [],
      industries: [],
      interests: [],
      pain_points: []
    }
  });
  const [saving, setSaving] = useState(false);
  const [newTone, setNewTone] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newPillar, setNewPillar] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newIndustry, setNewIndustry] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [newPainPoint, setNewPainPoint] = useState('');

  useEffect(() => {
    if (initialData && isOpen) {
      setFormData({
        brand_voice: initialData.brand_voice || '',
        brand_tone: initialData.brand_tone || [],
        key_messages: initialData.key_messages || [],
        value_propositions: initialData.value_propositions || [],
        content_pillars: initialData.content_pillars || [],
        target_audience: {
          job_titles: initialData.target_audience?.job_titles || [],
          industries: initialData.target_audience?.industries || [],
          interests: initialData.target_audience?.interests || [],
          pain_points: initialData.target_audience?.pain_points || []
        }
      });
    }
  }, [initialData, isOpen]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`${BACKEND_URL}/api/organization-materials/analysis`, formData, {
        params: { org_id: orgId }
      });
      if (onSave) {
        onSave(formData);
      }
      onClose();
    } catch (error) {
      console.error('Error saving brand DNA:', error);
      alert('Failed to save brand DNA: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const addItem = (field, value, setter) => {
    if (value.trim()) {
      if (field.startsWith('target_audience.')) {
        const subField = field.split('.')[1];
        setFormData(prev => ({
          ...prev,
          target_audience: {
            ...prev.target_audience,
            [subField]: [...prev.target_audience[subField], value.trim()]
          }
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [field]: [...prev[field], value.trim()]
        }));
      }
      setter('');
    }
  };

  const removeItem = (field, index) => {
    if (field.startsWith('target_audience.')) {
      const subField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        target_audience: {
          ...prev.target_audience,
          [subField]: prev.target_audience[subField].filter((_, i) => i !== index)
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: prev[field].filter((_, i) => i !== index)
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div 
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"
        style={{ 
          backgroundColor: tokens.colors.background.layer1,
          border: `1px solid ${tokens.colors.border.default}`,
          boxShadow: tokens.shadow.floating
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 
            className="text-2xl font-serif italic"
            style={{ color: tokens.colors.text.primary }}
          >
            Edit Brand DNA
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-opacity-10"
            style={{ color: tokens.colors.text.secondary }}
            onMouseEnter={(e) => e.target.style.backgroundColor = tokens.colors.background.layer2}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Brand Voice */}
          <div>
            <label 
              className="block mb-2 text-sm font-medium"
              style={{ color: tokens.colors.text.primary }}
            >
              Brand Voice
            </label>
            <Textarea
              value={formData.brand_voice}
              onChange={(e) => setFormData(prev => ({ ...prev, brand_voice: e.target.value }))}
              placeholder="Describe your brand voice..."
              className="w-full min-h-[100px]"
              style={{
                backgroundColor: tokens.colors.background.input,
                borderColor: tokens.colors.border.default,
                color: tokens.colors.text.primary,
                borderRadius: tokens.radius.lg
              }}
            />
          </div>

          {/* Brand Tone */}
          <div>
            <label 
              className="block mb-2 text-sm font-medium"
              style={{ color: tokens.colors.text.primary }}
            >
              Brand Tone
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.brand_tone.map((tone, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: tokens.colors.background.layer2,
                    border: `1px solid ${tokens.colors.border.default}`
                  }}
                >
                  <span style={{ color: tokens.colors.text.primary }}>{tone}</span>
                  <button
                    onClick={() => removeItem('brand_tone', i)}
                    style={{ color: tokens.colors.text.secondary }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTone}
                onChange={(e) => setNewTone(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addItem('brand_tone', newTone, setNewTone)}
                placeholder="Add tone..."
                className="flex-1"
                style={{
                  backgroundColor: tokens.colors.background.input,
                  borderColor: tokens.colors.border.default,
                  color: tokens.colors.text.primary
                }}
              />
              <Button
                onClick={() => addItem('brand_tone', newTone, setNewTone)}
                style={{
                  backgroundColor: tokens.colors.accent.lime,
                  color: tokens.colors.text.inverse
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Key Messages */}
          <div>
            <label 
              className="block mb-2 text-sm font-medium"
              style={{ color: tokens.colors.text.primary }}
            >
              Key Messages
            </label>
            <div className="space-y-2 mb-2">
              {formData.key_messages.map((msg, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Textarea
                    value={msg}
                    onChange={(e) => {
                      const newMessages = [...formData.key_messages];
                      newMessages[i] = e.target.value;
                      setFormData(prev => ({ ...prev, key_messages: newMessages }));
                    }}
                    className="flex-1 min-h-[60px]"
                    style={{
                      backgroundColor: tokens.colors.background.input,
                      borderColor: tokens.colors.border.default,
                      color: tokens.colors.text.primary
                    }}
                  />
                  <button
                    onClick={() => removeItem('key_messages', i)}
                    className="mt-2"
                    style={{ color: tokens.colors.text.secondary }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addItem('key_messages', newMessage, setNewMessage)}
                placeholder="Add key message..."
                className="flex-1"
                style={{
                  backgroundColor: tokens.colors.background.input,
                  borderColor: tokens.colors.border.default,
                  color: tokens.colors.text.primary
                }}
              />
              <Button
                onClick={() => addItem('key_messages', newMessage, setNewMessage)}
                style={{
                  backgroundColor: tokens.colors.accent.lime,
                  color: tokens.colors.text.inverse
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Value Propositions */}
          <div>
            <label 
              className="block mb-2 text-sm font-medium"
              style={{ color: tokens.colors.text.primary }}
            >
              Value Propositions
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.value_propositions.map((value, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: tokens.colors.background.layer2,
                    border: `1px solid ${tokens.colors.border.default}`
                  }}
                >
                  <span style={{ color: tokens.colors.text.primary }}>{value}</span>
                  <button
                    onClick={() => removeItem('value_propositions', i)}
                    style={{ color: tokens.colors.text.secondary }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addItem('value_propositions', newValue, setNewValue)}
                placeholder="Add value proposition..."
                className="flex-1"
                style={{
                  backgroundColor: tokens.colors.background.input,
                  borderColor: tokens.colors.border.default,
                  color: tokens.colors.text.primary
                }}
              />
              <Button
                onClick={() => addItem('value_propositions', newValue, setNewValue)}
                style={{
                  backgroundColor: tokens.colors.accent.lime,
                  color: tokens.colors.text.inverse
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Content Pillars */}
          <div>
            <label 
              className="block mb-2 text-sm font-medium"
              style={{ color: tokens.colors.text.primary }}
            >
              Content Pillars
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.content_pillars.map((pillar, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: tokens.colors.background.layer2,
                    border: `1px solid ${tokens.colors.border.default}`
                  }}
                >
                  <span style={{ color: tokens.colors.text.primary }}>{pillar}</span>
                  <button
                    onClick={() => removeItem('content_pillars', i)}
                    style={{ color: tokens.colors.text.secondary }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newPillar}
                onChange={(e) => setNewPillar(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addItem('content_pillars', newPillar, setNewPillar)}
                placeholder="Add content pillar..."
                className="flex-1"
                style={{
                  backgroundColor: tokens.colors.background.input,
                  borderColor: tokens.colors.border.default,
                  color: tokens.colors.text.primary
                }}
              />
              <Button
                onClick={() => addItem('content_pillars', newPillar, setNewPillar)}
                style={{
                  backgroundColor: tokens.colors.accent.lime,
                  color: tokens.colors.text.inverse
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Target Audience */}
          <div>
            <label 
              className="block mb-2 text-sm font-medium"
              style={{ color: tokens.colors.text.primary }}
            >
              Target Audience
            </label>
            
            {/* Job Titles */}
            <div className="mb-4">
              <label className="block mb-2 text-xs" style={{ color: tokens.colors.text.secondary }}>Job Titles</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.target_audience.job_titles.map((title, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: tokens.colors.background.layer2,
                      border: `1px solid ${tokens.colors.border.default}`
                    }}
                  >
                    <span style={{ color: tokens.colors.text.primary }}>{title}</span>
                    <button
                      onClick={() => removeItem('target_audience.job_titles', i)}
                      style={{ color: tokens.colors.text.secondary }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addItem('target_audience.job_titles', newJobTitle, setNewJobTitle)}
                  placeholder="Add job title..."
                  className="flex-1"
                  style={{
                    backgroundColor: tokens.colors.background.input,
                    borderColor: tokens.colors.border.default,
                    color: tokens.colors.text.primary
                  }}
                />
                <Button
                  onClick={() => addItem('target_audience.job_titles', newJobTitle, setNewJobTitle)}
                  style={{
                    backgroundColor: tokens.colors.accent.lime,
                    color: tokens.colors.text.inverse
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Industries */}
            <div className="mb-4">
              <label className="block mb-2 text-xs" style={{ color: tokens.colors.text.secondary }}>Industries</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.target_audience.industries.map((industry, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: tokens.colors.background.layer2,
                      border: `1px solid ${tokens.colors.border.default}`
                    }}
                  >
                    <span style={{ color: tokens.colors.text.primary }}>{industry}</span>
                    <button
                      onClick={() => removeItem('target_audience.industries', i)}
                      style={{ color: tokens.colors.text.secondary }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newIndustry}
                  onChange={(e) => setNewIndustry(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addItem('target_audience.industries', newIndustry, setNewIndustry)}
                  placeholder="Add industry..."
                  className="flex-1"
                  style={{
                    backgroundColor: tokens.colors.background.input,
                    borderColor: tokens.colors.border.default,
                    color: tokens.colors.text.primary
                  }}
                />
                <Button
                  onClick={() => addItem('target_audience.industries', newIndustry, setNewIndustry)}
                  style={{
                    backgroundColor: tokens.colors.accent.lime,
                    color: tokens.colors.text.inverse
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-6" style={{ borderTop: `1px solid ${tokens.colors.border.default}` }}>
          <Button
            onClick={onClose}
            variant="outline"
            style={{
              borderColor: tokens.colors.border.default,
              color: tokens.colors.text.primary
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            style={{
              backgroundColor: tokens.colors.accent.lime,
              color: tokens.colors.text.inverse
            }}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BrandDNAEditModal;








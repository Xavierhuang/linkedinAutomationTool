import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CampaignConfigModal = ({ isOpen, onClose, onSave, initialData, orgId }) => {
    const { user } = useAuth();
    const [linkedinAuthors, setLinkedinAuthors] = useState(null);
    const [selectedAuthor, setSelectedAuthor] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        profile_type: 'personal',
        linkedin_author_id: null,
        content_pillars: [''],
        target_audience: {
            job_titles: [''],
            industries: [''],
            interests: ['']
        },
        posting_schedule: {
            frequency: 'weekly',
            time_slots: ['09:00']
        },
        tone_voice: 'professional',
        content_types: ['text'],
        include_images: false,
        use_ai_images: false,
        image_style: 'professional',
        text_model: 'openai/gpt-4o-mini',
        image_model: 'openai/dall-e-3',
        auto_post: false,
        status: 'draft'
    });

    useEffect(() => {
        if (orgId && isOpen) {
            fetchLinkedInAuthors();
        }
    }, [orgId, isOpen]);

    const fetchLinkedInAuthors = async () => {
        try {
            if (!user?.id) {
                console.error('User ID not available');
                return;
            }
            const response = await axios.get(`${BACKEND_URL}/api/linkedin/managed-organizations?org_id=${orgId}&user_id=${user.id}`);
            setLinkedinAuthors(response.data);
            // Set default to personal profile if no initial data
            if (!initialData?.linkedin_author_id) {
                setSelectedAuthor({
                    id: response.data.personal.id,
                    name: response.data.personal.name,
                    type: 'personal'
                });
            }
        } catch (error) {
            console.error('Error fetching LinkedIn authors:', error);
        }
    };

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                description: initialData.description || '',
                profile_type: initialData.profile_type || 'personal',
                linkedin_author_id: initialData.linkedin_author_id || null,
                content_pillars: initialData.content_pillars?.length > 0 ? initialData.content_pillars : [''],
                target_audience: {
                    job_titles: initialData.target_audience?.job_titles?.length > 0 ? initialData.target_audience.job_titles : [''],
                    industries: initialData.target_audience?.industries?.length > 0 ? initialData.target_audience.industries : [''],
                    interests: initialData.target_audience?.interests?.length > 0 ? initialData.target_audience.interests : ['']
                },
                posting_schedule: {
                    frequency: initialData.posting_schedule?.frequency || 'weekly',
                    time_slots: initialData.posting_schedule?.time_slots?.length > 0 ? initialData.posting_schedule.time_slots : ['09:00']
                },
                tone_voice: initialData.tone_voice || 'professional',
                content_types: initialData.content_types?.length > 0 ? initialData.content_types : ['text'],
                include_images: initialData.include_images || false,
                use_ai_images: initialData.use_ai_images || false,
                image_style: initialData.image_style || 'professional',
                text_model: initialData.text_model || 'openai/gpt-4o-mini',
                image_model: initialData.image_model || 'openai/dall-e-3',
                auto_post: initialData.auto_post || false,
                status: initialData.status || 'draft'
            });
            // Set selected author from initial data
            if (initialData.linkedin_author_id && linkedinAuthors) {
                if (initialData.profile_type === 'personal') {
                    setSelectedAuthor({
                        id: linkedinAuthors.personal.id,
                        name: linkedinAuthors.personal.name,
                        type: 'personal'
                    });
                } else {
                    // Convert both to strings for comparison (backend saves as string, LinkedIn API returns as number)
                    const org = linkedinAuthors.organizations?.find(o => String(o.id) === String(initialData.linkedin_author_id));
                    if (org) {
                        setSelectedAuthor({
                            id: org.id,
                            name: org.name,
                            type: 'organization'
                        });
                    }
                }
            }
        } else {
            // Reset form for new campaign
            setFormData({
                name: '',
                description: '',
                profile_type: 'personal',
                linkedin_author_id: null,
                content_pillars: [''],
                target_audience: {
                    job_titles: [''],
                    industries: [''],
                    interests: ['']
                },
                posting_schedule: {
                    frequency: 'weekly',
                    time_slots: ['09:00']
                },
                tone_voice: 'professional',
                content_types: ['text'],
                include_images: false,
                use_ai_images: false,
                image_style: 'professional',
                text_model: 'openai/gpt-4o-mini',
                image_model: 'openai/dall-e-3',
                auto_post: false,
                status: 'draft'
            });
            // Reset to personal profile for new campaigns
            if (linkedinAuthors) {
                setSelectedAuthor({
                    id: linkedinAuthors.personal.id,
                    name: linkedinAuthors.personal.name,
                    type: 'personal'
                });
            }
        }
    }, [initialData, isOpen, linkedinAuthors]);

    const handleSubmit = (e) => {
        e.preventDefault();

        // Clean up empty values
        const cleanedData = {
            ...formData,
            profile_type: selectedAuthor?.type === 'organization' ? 'company' : 'personal',
            linkedin_author_id: selectedAuthor?.id,
            content_pillars: formData.content_pillars.filter(p => p.trim() !== ''),
            target_audience: {
                job_titles: formData.target_audience.job_titles.filter(j => j.trim() !== ''),
                industries: formData.target_audience.industries.filter(i => i.trim() !== ''),
                interests: formData.target_audience.interests.filter(i => i.trim() !== '')
            }
        };

        onSave(cleanedData);
    };

    const addArrayItem = (field, subfield = null) => {
        if (subfield) {
            setFormData({
                ...formData,
                [field]: {
                    ...formData[field],
                    [subfield]: [...formData[field][subfield], '']
                }
            });
        } else {
            setFormData({
                ...formData,
                [field]: [...formData[field], '']
            });
        }
    };

    const removeArrayItem = (field, index, subfield = null) => {
        if (subfield) {
            const newArray = formData[field][subfield].filter((_, i) => i !== index);
            setFormData({
                ...formData,
                [field]: {
                    ...formData[field],
                    [subfield]: newArray.length > 0 ? newArray : ['']
                }
            });
        } else {
            const newArray = formData[field].filter((_, i) => i !== index);
            setFormData({
                ...formData,
                [field]: newArray.length > 0 ? newArray : ['']
            });
        }
    };

    const updateArrayItem = (field, index, value, subfield = null) => {
        if (subfield) {
            const newArray = [...formData[field][subfield]];
            newArray[index] = value;
            setFormData({
                ...formData,
                [field]: {
                    ...formData[field],
                    [subfield]: newArray
                }
            });
        } else {
            const newArray = [...formData[field]];
            newArray[index] = value;
            setFormData({
                ...formData,
                [field]: newArray
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <style>{`
                .campaign-modal input,
                .campaign-modal textarea,
                .campaign-modal select {
                    color: #1A1A1A !important;
                    background-color: #FFFFFF !important;
                }
                .campaign-modal input::placeholder,
                .campaign-modal textarea::placeholder {
                    color: #9CA3AF !important;
                }
            `}</style>
            <div className="campaign-modal bg-white rounded-none md:rounded-lg shadow-xl w-full md:max-w-3xl h-full md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header - Responsive */}
                <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg md:text-xl font-bold text-gray-900">
                        {initialData ? 'Edit Campaign' : 'Create New Campaign'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form - Responsive padding */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="px-4 md:px-6 py-4 space-y-4 md:space-y-6">
                        {/* Basic Info */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Campaign Name *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Q1 Thought Leadership Campaign"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows="3"
                                placeholder="Describe the campaign goals and strategy..."
                            />
                        </div>

                        {/* Profile Type Selector */}
                        {linkedinAuthors && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Publish As *
                                </label>
                                <select
                                    value={selectedAuthor ? `${selectedAuthor.type}:${selectedAuthor.id}` : ''}
                                    onChange={(e) => {
                                        const [type, id] = e.target.value.split(':');
                                        if (type === 'personal') {
                                            setSelectedAuthor({
                                                id: linkedinAuthors.personal.id,
                                                name: linkedinAuthors.personal.name,
                                                type: 'personal'
                                            });
                                        } else {
                                            // Convert both to strings for comparison (dropdown value is string, API returns number)
                                            const org = linkedinAuthors.organizations.find(o => String(o.id) === String(id));
                                            if (org) {
                                                setSelectedAuthor({
                                                    id: org.id,
                                                    name: org.name,
                                                    type: 'organization'
                                                });
                                            }
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                >
                                    <option value={`personal:${linkedinAuthors.personal.id}`}>
                                        👤 {linkedinAuthors.personal.name} (Personal Profile)
                                    </option>
                                    {linkedinAuthors.organizations?.length > 0 && (
                                        <optgroup label="━━━ Company Pages ━━━">
                                            {linkedinAuthors.organizations.map(org => (
                                                <option key={org.id} value={`organization:${org.id}`}>
                                                    🏢 {org.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                <p className="text-xs text-gray-500 mt-2">
                                    Choose where posts from this campaign will be published
                                </p>
                            </div>
                        )}

                        {/* Content Pillars */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Content Pillars
                            </label>
                            {formData.content_pillars.map((pillar, index) => (
                                <div key={index} className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={pillar}
                                        onChange={(e) => updateArrayItem('content_pillars', index, e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="e.g., Leadership Tips, Industry Trends"
                                    />
                                    {formData.content_pillars.length > 1 && (
                                        <Button
                                            type="button"
                                            onClick={() => removeArrayItem('content_pillars', index)}
                                            className="bg-red-100 hover:bg-red-200 text-red-800"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button
                                type="button"
                                onClick={() => addArrayItem('content_pillars')}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Pillar
                            </Button>
                        </div>

                        {/* Target Audience */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-gray-700">Target Audience</h3>

                            {/* Job Titles */}
                            <div>
                                <label className="block text-xs text-gray-600 mb-2">Job Titles</label>
                                {formData.target_audience.job_titles.map((title, index) => (
                                    <div key={index} className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) => updateArrayItem('target_audience', index, e.target.value, 'job_titles')}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            placeholder="e.g., CEO, Marketing Director"
                                        />
                                        {formData.target_audience.job_titles.length > 1 && (
                                            <Button
                                                type="button"
                                                onClick={() => removeArrayItem('target_audience', index, 'job_titles')}
                                                className="bg-red-100 hover:bg-red-200 text-red-800"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    onClick={() => addArrayItem('target_audience', 'job_titles')}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs"
                                >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add Title
                                </Button>
                            </div>

                            {/* Industries */}
                            <div>
                                <label className="block text-xs text-gray-600 mb-2">Industries</label>
                                {formData.target_audience.industries.map((industry, index) => (
                                    <div key={index} className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={industry}
                                            onChange={(e) => updateArrayItem('target_audience', index, e.target.value, 'industries')}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            placeholder="e.g., Technology, SaaS"
                                        />
                                        {formData.target_audience.industries.length > 1 && (
                                            <Button
                                                type="button"
                                                onClick={() => removeArrayItem('target_audience', index, 'industries')}
                                                className="bg-red-100 hover:bg-red-200 text-red-800"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    onClick={() => addArrayItem('target_audience', 'industries')}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs"
                                >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add Industry
                                </Button>
                            </div>

                            {/* Interests */}
                            <div>
                                <label className="block text-xs text-gray-600 mb-2">Interests</label>
                                {formData.target_audience.interests.map((interest, index) => (
                                    <div key={index} className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={interest}
                                            onChange={(e) => updateArrayItem('target_audience', index, e.target.value, 'interests')}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            placeholder="e.g., Leadership, Innovation"
                                        />
                                        {formData.target_audience.interests.length > 1 && (
                                            <Button
                                                type="button"
                                                onClick={() => removeArrayItem('target_audience', index, 'interests')}
                                                className="bg-red-100 hover:bg-red-200 text-red-800"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    onClick={() => addArrayItem('target_audience', 'interests')}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs"
                                >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add Interest
                                </Button>
                            </div>
                        </div>

                        {/* Posting Schedule */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Automation Frequency
                                </label>
                                <select
                                    value={formData.posting_schedule.frequency}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        posting_schedule: { ...formData.posting_schedule, frequency: e.target.value }
                                    })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="every_5_min">Every 5 Minutes (Testing)</option>
                                    <option value="every_15_min">Every 15 Minutes (Testing)</option>
                                    <option value="every_30_min">Every 30 Minutes (Testing)</option>
                                    <option value="hourly">Hourly (Testing)</option>
                                    <option value="twice_daily">Twice Daily</option>
                                    <option value="daily">Daily</option>
                                    <option value="3x_week">3x per Week</option>
                                    <option value="2x_week">2x per Week</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="bi_weekly">Bi-Weekly</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    How often the campaign generates new content
                                </p>
                            </div>

                            {/* Time Slots */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Posting Time Slots
                                </label>
                                {formData.posting_schedule.time_slots.map((time, index) => (
                                    <div key={index} className="flex gap-2 mb-2">
                                        <input
                                            type="time"
                                            value={time}
                                            onChange={(e) => {
                                                const newTimeSlots = [...formData.posting_schedule.time_slots];
                                                newTimeSlots[index] = e.target.value;
                                                setFormData({
                                                    ...formData,
                                                    posting_schedule: { ...formData.posting_schedule, time_slots: newTimeSlots }
                                                });
                                            }}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                        {formData.posting_schedule.time_slots.length > 1 && (
                                            <Button
                                                type="button"
                                                onClick={() => {
                                                    const newTimeSlots = formData.posting_schedule.time_slots.filter((_, i) => i !== index);
                                                    setFormData({
                                                        ...formData,
                                                        posting_schedule: { ...formData.posting_schedule, time_slots: newTimeSlots }
                                                    });
                                                }}
                                                className="bg-red-100 hover:bg-red-200 text-red-800"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setFormData({
                                            ...formData,
                                            posting_schedule: {
                                                ...formData.posting_schedule,
                                                time_slots: [...formData.posting_schedule.time_slots, '14:00']
                                            }
                                        });
                                    }}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm"
                                >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add Time Slot
                                </Button>
                                <p className="text-xs text-gray-500 mt-2">
                                    Preferred times for posting (e.g., 9:00 AM, 2:00 PM)
                                </p>
                            </div>
                        </div>

                        {/* Tone & Voice */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tone & Voice
                            </label>
                            <select
                                value={formData.tone_voice}
                                onChange={(e) => setFormData({ ...formData, tone_voice: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="professional">Professional</option>
                                <option value="casual">Casual</option>
                                <option value="thought-leader">Thought Leader</option>
                                <option value="storytelling">Storytelling</option>
                            </select>
                        </div>

                        {/* AI Model Selection */}
                        <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <h3 className="text-sm font-semibold text-gray-900">AI Model Selection</h3>
                            
                            {/* Text Generation Model */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Text Generation Model
                                </label>
                                <select
                                    value={formData.text_model || 'openai/gpt-4o-mini'}
                                    onChange={(e) => setFormData({ ...formData, text_model: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <optgroup label="OpenAI">
                                        <option value="openai/gpt-4o">GPT-4o (Best Quality)</option>
                                        <option value="openai/gpt-4o-mini">GPT-4o Mini (Fast & Affordable)</option>
                                        <option value="openai/gpt-4-turbo">GPT-4 Turbo</option>
                                        <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo (Fastest)</option>
                                    </optgroup>
                                    <optgroup label="Anthropic">
                                        <option value="anthropic/claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Latest)</option>
                                        <option value="anthropic/claude-3-5-haiku-20241022">Claude 3.5 Haiku (Fast)</option>
                                        <option value="anthropic/claude-3-opus-20240229">Claude 3 Opus (Best)</option>
                                    </optgroup>
                                    <optgroup label="Google">
                                        <option value="google/gemini-2.0-flash-exp">Gemini 2.0 Flash (Latest)</option>
                                        <option value="google/gemini-1.5-pro">Gemini 1.5 Pro</option>
                                        <option value="google/gemini-1.5-flash">Gemini 1.5 Flash</option>
                                    </optgroup>
                                    <optgroup label="Meta">
                                        <option value="meta-llama/llama-3.1-405b-instruct">Llama 3.1 405B</option>
                                        <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
                                    </optgroup>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    Model used for generating post content
                                </p>
                            </div>
                        </div>

                        {/* Image Generation */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="include_images"
                                    checked={formData.include_images}
                                    onChange={(e) => setFormData({ ...formData, include_images: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <label htmlFor="include_images" className="text-sm font-medium text-gray-700">
                                    Generate images with posts
                                </label>
                            </div>

                            {formData.include_images && (
                                <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                                    {/* Use AI Images Toggle */}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="use_ai_images"
                                            checked={formData.use_ai_images}
                                            onChange={(e) => setFormData({ ...formData, use_ai_images: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                        <label htmlFor="use_ai_images" className="text-sm font-medium text-gray-700">
                                            Use AI Image Generation
                                        </label>
                                    </div>
                                    <p className="text-xs text-gray-500 ml-6">
                                        {formData.use_ai_images 
                                            ? '🎨 AI will generate custom images (requires API credits)' 
                                            : '📷 Using free stock photos from Unsplash/Pexels (default)'}
                                    </p>

                                    <div>
                                        <label className="block text-sm text-gray-600 mb-2">Image Style</label>
                                        <select
                                            value={formData.image_style}
                                            onChange={(e) => setFormData({ ...formData, image_style: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        >
                                            <option value="professional">Professional</option>
                                            <option value="modern">Modern</option>
                                            <option value="minimalist">Minimalist</option>
                                            <option value="creative">Creative</option>
                                        </select>
                                    </div>

                                    {/* AI Image Model - Only show if AI is enabled */}
                                    {formData.use_ai_images && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                AI Image Generation Model
                                            </label>
                                            <select
                                                value={formData.image_model || 'openai/dall-e-3'}
                                                onChange={(e) => setFormData({ ...formData, image_model: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            >
                                                <optgroup label="OpenAI">
                                                    <option value="openai/dall-e-3">DALL-E 3 - HD Quality ($0.040/image)</option>
                                                </optgroup>
                                                <optgroup label="Google">
                                                    <option value="google/gemini-2.5-flash-image">Gemini 2.5 Flash Image (Fast & Affordable)</option>
                                                </optgroup>
                                                <optgroup label="OpenRouter">
                                                    <option value="openrouter/seedream">SeeDream via OpenRouter (High Quality)</option>
                                                </optgroup>
                                            </select>
                                            <p className="text-xs text-gray-500 mt-1">
                                                💳 Premium models - requires API credits
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Auto-post */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="auto_post"
                                checked={formData.auto_post}
                                onChange={(e) => setFormData({ ...formData, auto_post: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <label htmlFor="auto_post" className="text-sm font-medium text-gray-700">
                                Auto-post without review
                            </label>
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Status
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="draft">Draft</option>
                                <option value="active">Active</option>
                                <option value="paused">Paused</option>
                            </select>
                        </div>
                    </div>

                    {/* Footer - Responsive */}
                    <div className="px-4 md:px-6 py-3 md:py-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
                        <Button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-900 w-full sm:w-auto"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-gray-900 hover:bg-gray-800 text-white w-full sm:w-auto"
                        >
                            {initialData ? 'Update Campaign' : 'Create Campaign'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CampaignConfigModal;

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Loader2, RefreshCw, Megaphone, Target, Users, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrandIdentityCard from './conversation/BrandIdentityCard';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const BrandDNAView = ({ orgId }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [brandData, setBrandData] = useState(null);
    const [brandInfo, setBrandInfo] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [organization, setOrganization] = useState(null);

    useEffect(() => {
        if (orgId) {
            fetchBrandDNA();
        }
    }, [orgId]);

    const fetchBrandDNA = async () => {
        try {
            setLoading(true);
            const orgRes = await axios.get(`${BACKEND_URL}/api/organizations/${orgId}`);
            setOrganization(orgRes.data);
            const analysisRes = await axios.get(`${BACKEND_URL}/api/organization-materials/analysis`, {
                params: { org_id: orgId }
            });
            setBrandData(analysisRes.data);
            
            // Fetch brand discovery data (colors, images, fonts) from brand analysis
            // Check if brand_analysis has brand_colors and brand_images
            const brandAnalysis = analysisRes.data;
            const orgData = orgRes.data;
            
            // Create brandInfo object similar to onboarding
            // This will display colors, images, and website snapshot if available
            const brandInfoData = {
                title: orgData?.name || organization?.name || 'Brand Overview',
                description: brandAnalysis?.key_messages?.slice(0, 2).join(' • ') || 
                           brandAnalysis?.value_propositions?.slice(0, 2).join(' • ') || 
                           'Brand identity summary',
                colorPalette: brandAnalysis?.brand_colors || [],
                fontFamilies: brandAnalysis?.brand_fonts || [],
                imagery: brandAnalysis?.brand_images || [],
                toneKeywords: brandAnalysis?.brand_tone || [],
                keywordSummary: brandAnalysis?.content_pillars || [],
                contentExcerpt: brandAnalysis?.key_messages?.slice(0, 1).join(' • ') || 
                              brandAnalysis?.value_propositions?.slice(0, 1).join(' • '),
                normalizedUrl: orgData?.website || organization?.website,
                websiteUrl: orgData?.website || organization?.website,
            };
            setBrandInfo(brandInfoData);
        } catch (error) {
            console.error('Error fetching Brand DNA:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerate = async () => {
        try {
            setLoading(true);
            await axios.post(`${BACKEND_URL}/api/organization-materials/analyze`, null, {
                params: { org_id: orgId }
            });
            await fetchBrandDNA();
        } catch (error) {
            console.error('Error regenerating Brand DNA:', error);
            alert('Failed to regenerate Brand DNA');
        }
    };

    if (!orgId) {
        return (
            <div className="h-full flex items-center justify-center bg-background">
                <div className="text-center max-w-md p-8 bg-card rounded-2xl border border-border">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-accent/10 text-accent">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-serif italic text-foreground mb-2">No Organization Selected</h3>
                    <p className="text-muted-foreground mb-6 text-sm">Please select an organization to view brand DNA.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        );
    }

    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`
                flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all relative
                ${activeTab === id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}
            `}
        >
            <Icon className="w-4 h-4" />
            {label}
            {activeTab === id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(136,217,231,0.5)]" />
            )}
        </button>
    );

    return (
        <div className="h-full flex flex-col bg-background text-foreground">
            {/* Header */}
            <div className="bg-background border-b border-border px-8 py-4">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-serif italic text-foreground mb-2">Brand DNA</h1>
                        <p className="text-sm text-muted-foreground font-light">{organization?.name}</p>
                    </div>
                    <Button
                        onClick={handleRegenerate}
                        className="bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-full h-9 px-4 text-xs font-medium flex items-center gap-2"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Regenerate Analysis
                    </Button>
                </div>

                <div className="flex gap-2 border-b border-muted">
                    <TabButton id="overview" label="Overview" icon={Megaphone} />
                    <TabButton id="voice" label="Voice & Identity" icon={Sparkles} />
                    <TabButton id="audience" label="Target Audience" icon={Users} />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-5xl mx-auto">
                    {activeTab === 'overview' && brandData && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Brand Identity Card - Same as onboarding */}
                            {brandInfo && (
                                <div className="mb-6">
                                    <BrandIdentityCard brand={brandInfo} />
                                </div>
                            )}

                            <div className="bg-card border border-border rounded-2xl p-8">
                                <h3 className="text-xl font-serif italic text-foreground mb-6 flex items-center gap-3">
                                    <Sparkles className="w-5 h-5 text-accent" />
                                    Brand Overview
                                </h3>
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div>
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Organization</h4>
                                        <p className="text-lg text-foreground font-light mb-2">{organization?.name}</p>
                                        {organization?.website && (
                                            <a
                                                href={organization.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-accent hover:underline text-sm flex items-center gap-1"
                                            >
                                                {organization.website}
                                            </a>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Core Values</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {brandData.value_propositions?.slice(0, 3).map((val, i) => (
                                                <span key={i} className="px-3 py-1 rounded-full bg-muted border border-border text-sm text-foreground">
                                                    {val}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-2xl p-8">
                                <h3 className="text-xl font-serif italic text-foreground mb-6">Key Messages</h3>
                                <div className="grid gap-4">
                                    {brandData.key_messages?.map((msg, i) => (
                                        <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-muted border border-border">
                                            <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <span className="text-accent text-xs font-bold">{i + 1}</span>
                                            </div>
                                            <p className="text-foreground font-light leading-relaxed">{msg}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'voice' && brandData && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-card border border-border rounded-2xl p-8">
                                <h3 className="text-xl font-serif italic text-foreground mb-6">Brand Voice</h3>
                                <div className="p-6 bg-muted rounded-xl border border-border mb-8">
                                    <p className="text-lg text-foreground font-light leading-relaxed">
                                        "{brandData.brand_voice || 'Not analyzed yet'}"
                                    </p>
                                </div>

                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Tone Characteristics</h4>
                                <div className="flex flex-wrap gap-3">
                                    {brandData.brand_tone?.map((tone, i) => (
                                        <div key={i} className="px-4 py-2 rounded-lg bg-accent/5 border border-accent/20 text-accent text-sm">
                                            {tone}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'audience' && brandData && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-card border border-border rounded-2xl p-8">
                                <h3 className="text-xl font-serif italic text-foreground mb-6">Target Audience</h3>

                                <div className="grid md:grid-cols-2 gap-8">
                                    <div>
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Job Titles</h4>
                                        <ul className="space-y-2">
                                            {brandData.target_audience?.job_titles?.map((title, i) => (
                                                <li key={i} className="flex items-center gap-3 text-foreground font-light">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                                                    {title}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Industries</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {brandData.target_audience?.industries?.map((ind, i) => (
                                                <span key={i} className="px-3 py-1 rounded-full bg-muted border border-border text-sm text-foreground">
                                                    {ind}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-8 border-t border-border">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Pain Points</h4>
                                    <div className="grid gap-3">
                                        {brandData.target_audience?.pain_points?.map((point, i) => (
                                            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                                                <Target className="w-4 h-4 text-accent" />
                                                <span className="text-foreground font-light">{point}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BrandDNAView;

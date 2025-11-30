import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Sparkles, 
  ArrowRight,
  TrendingUp,
  Zap,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const SuggestionCard = ({ title, description, image, onClick }) => (
  <div 
    onClick={onClick}
    className="group relative overflow-hidden rounded-2xl bg-card border border-border hover:border-primary/40 transition-all duration-300 cursor-pointer flex flex-col justify-between p-5 w-64 h-[360px]"
  >
    {/* Abstract gradient background or image */}
    <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-500">
      {image ? (
        <img src={image} alt="" className="w-full h-full object-cover filter grayscale contrast-125" />
      ) : (
        <div className="w-full h-full bg-gradient-to-b from-transparent to-background/80" />
      )}
    </div>
    
    <div className="relative z-10">
      <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">{title}</h3>
      <p className="text-lg font-serif text-foreground leading-tight">{description}</p>
    </div>

    <div className="relative z-10 mt-auto">
      <div className="flex items-center text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors uppercase tracking-wider">
        Create Post <ArrowRight className="w-3 h-3 ml-2" />
      </div>
    </div>
  </div>
);

const CreateView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orgId, setOrgId] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [campaignSuggestions, setCampaignSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    const savedOrgId = localStorage.getItem('selectedOrgId');
    if (savedOrgId) {
      setOrgId(savedOrgId);
    }
  }, []);

  // Fetch campaign suggestions from the same API as onboarding
  useEffect(() => {
    if (orgId) {
      fetchCampaignSuggestions();
    }
  }, [orgId]);

  const fetchCampaignSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      // Use the same endpoint as onboarding
      const response = await axios.post(`${BACKEND_URL}/api/brand/campaign-previews`, {
        org_id: orgId,
        count: 3,
        suggestions: []
      });

      const campaigns = response.data?.campaigns || [];
      // Transform to match the suggestion card format
      const suggestions = campaigns.map((campaign, index) => ({
        title: campaign.focus || campaign.name || `Campaign ${index + 1}`,
        description: campaign.name || campaign.description || '',
        image: `https://images.unsplash.com/photo-${1550751827 + index}-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop`,
        campaign: campaign // Store full campaign data for potential use
      }));
      
      setCampaignSuggestions(suggestions);
    } catch (error) {
      console.error('Error fetching campaign suggestions:', error);
      // Fallback to empty array - don't show error to user
      setCampaignSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleGenerate = async () => {
    if (!inputValue.trim() || !orgId) return;

    // Navigate to BeeBot with the text to start a new conversation
    navigate('/dashboard/drafts', { 
      state: { 
        initialMessage: inputValue.trim(),
        startNewConversation: true
      } 
    });
  };

  const handleSuggestionClick = (suggestion) => {
    if (suggestion.campaign) {
      // Navigate to BeeBot with the campaign suggestion to start a new conversation
      navigate('/dashboard/drafts', { 
        state: { 
          initialMessage: `Create a post about: ${suggestion.description || suggestion.title}`,
          startNewConversation: true
        } 
      });
    } else {
      // Navigate to BeeBot with the suggestion text
      navigate('/dashboard/drafts', { 
        state: { 
          initialMessage: `Create a post about: ${suggestion.description || suggestion.title}`,
          startNewConversation: true
        } 
      });
    }
  };

  if (!orgId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md bg-card border border-border rounded-2xl p-8 shadow-2xl">
          <h3 className="text-2xl font-serif italic text-foreground mb-2">Select Organization</h3>
          <p className="text-muted-foreground mb-6">Please select an organization to begin.</p>
          <button 
            onClick={() => navigate('/dashboard/organizations')}
            className="rounded-full px-6 py-2 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Go to Organizations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center pt-0 max-w-6xl mx-auto px-4">
      <div className="w-full">
        {/* Header */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex justify-center mb-6">
            <div className="bg-card p-3 rounded-full border border-border shadow-sm">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h1 className="text-5xl font-serif italic text-foreground mb-3">
            Home
          </h1>
          <p className="text-muted-foreground font-light tracking-wide">
            Start from our suggestions or prompt to create a new post.
          </p>
        </div>

        {/* Main Input Area */}
        <div className="w-full max-w-2xl relative mb-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 mx-auto">
          <div className="relative bg-card border border-border rounded-[24px] px-6 py-4 shadow-xl">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Describe the post you want to create"
              className="w-full h-20 bg-transparent border-none text-foreground placeholder:text-muted-foreground text-base leading-relaxed resize-none focus:ring-0 font-light font-sans"
              style={{ outline: 'none' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
            <div className="flex justify-end pt-4">
              <button
                onClick={handleGenerate}
                disabled={!inputValue.trim() || isGenerating}
                className={`
                  rounded-full px-6 py-3 font-medium transition-all duration-300 flex items-center gap-2 text-sm
                  ${inputValue.trim() 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 transform hover:-translate-y-0.5' 
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }
                `}
              >
                {isGenerating ? (
                  <>
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75" />
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150" />
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Suggest Ideas
                  </>
                )}
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            LinkedIn Pilot can make mistakes, so double-check it.
          </p>
        </div>

        {/* Suggestions Section */}
        <div className="w-full animate-in fade-in slide-in-from-bottom-12 duration-700 delay-300">
          <h2 className="text-sm text-muted-foreground mb-8 font-normal text-center tracking-wide uppercase">
            Suggestions based on Business DNA
          </h2>
          {loadingSuggestions ? (
            <div className="flex items-center justify-center gap-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-64 h-[360px] bg-card border border-border rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : campaignSuggestions.length > 0 ? (
            <div className="flex items-center justify-center gap-6 flex-wrap">
              {campaignSuggestions.map((suggestion, index) => (
                <SuggestionCard
                  key={index}
                  {...suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Complete onboarding to see personalized campaign suggestions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateView;

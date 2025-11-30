import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, Calendar, Send, BarChart3, Settings, FileCheck, Megaphone, Plus } from 'lucide-react';
import designTokens from '@/designTokens';

const navItems = [
  {
    id: 'create',
    label: 'Create',
    path: '/dashboard/create',
    icon: Plus,
    description: 'Generate new content',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    path: '/dashboard/calendar',
    icon: Calendar,
    description: 'Scheduling and timeline',
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    path: '/dashboard/campaigns',
    icon: Megaphone,
    description: 'Manage and refine campaigns',
  },
  {
    id: 'posts',
    label: 'Posts',
    path: '/dashboard/posts',
    icon: Send,
    description: 'Published and queued posts',
  },
  {
    id: 'review-queue',
    label: 'Review Queue',
    path: '/dashboard/review-queue',
    icon: FileCheck,
    description: 'Pending approval',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    path: '/dashboard/analytics',
    icon: BarChart3,
    description: 'Performance metrics',
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/dashboard/settings',
    icon: Settings,
    description: 'Brand preferences',
  },
];

const MobileNavDrawer = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigate = (path) => {
    navigate(path);
    onClose();
  };

  const isActive = (path) => location.pathname.startsWith(path);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose}
        style={{
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 h-full w-80 z-50 lg:hidden flex flex-col"
        style={{
          background: designTokens.colors.background.sidebar,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: `1px solid ${designTokens.colors.border.default}`,
          boxShadow: designTokens.shadow.xl,
          animation: 'slideInRight 0.3s ease-out',
        }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/60">Workspace</p>
            <h2 className="text-lg font-semibold text-white mt-1">LinkedPilot</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-3 space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40 px-3 mb-2">Insights</p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.path)}
                  className={`flex items-center justify-between w-full px-4 py-3 rounded-2xl transition-all ${
                    active
                      ? 'bg-white/15 text-white shadow-[0_10px_40px_rgba(0,0,0,0.25)]'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-10 w-10 rounded-2xl flex items-center justify-center"
                      style={{
                        background: active ? designTokens.colors.accent.greenGlow : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${designTokens.colors.border.light}`,
                      }}
                    >
                      <Icon className={`h-5 w-5 ${active ? 'text-black' : 'text-white/70'}`} />
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-xs text-white/50">{item.description}</p>
                    </div>
                  </div>
                  <div
                    className={`h-2 w-2 rounded-full ${
                      active ? 'bg-white' : 'bg-white/30'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-white/10">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-sm font-semibold text-white">Up Next</p>
            <p className="text-xs text-white/60 mt-2 leading-relaxed">
              Keep refining campaigns directly in chat. Use the menu once you are ready to schedule, post, or review analytics.
            </p>
          </div>
        </div>
      </aside>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
};

export default MobileNavDrawer;


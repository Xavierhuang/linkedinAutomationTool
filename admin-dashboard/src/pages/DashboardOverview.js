import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, DollarSign, Cpu, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useThemeTokens } from '../hooks/useThemeTokens';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const DashboardOverview = () => {
  const tokens = useThemeTokens();
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsResponse, activityResponse] = await Promise.all([
        axios.get(`${API_URL}/api/admin/dashboard/stats`),
        axios.get(`${API_URL}/api/admin/dashboard/recent-activity`)
      ]);
      setStats(statsResponse.data);
      setActivity(activityResponse.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'user_signup':
        return 'bg-green-500';
      case 'subscription_upgrade':
        return 'bg-blue-500';
      case 'subscription_cancellation':
        return 'bg-red-500';
      case 'high_usage_alert':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ borderColor: tokens.colors.accent.lime, borderTopColor: 'transparent' }} className="animate-spin rounded-full h-12 w-12 border-2"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 animate-in fade-in duration-500">
        <p style={{ color: tokens.colors.text.secondary }}>No data available. Make sure the backend is running.</p>
      </div>
    );
  }

  const metrics = [
    {
      name: 'Total Users',
      value: stats.total_users || 0,
      icon: Users,
      change: stats.total_users_change,
      color: 'bg-blue-500',
    },
    {
      name: 'Active Subscriptions',
      value: stats.active_subscriptions || 0,
      icon: DollarSign,
      change: stats.active_subscriptions_change,
      color: 'bg-green-500',
      subtitle: stats.cancelling_subscriptions ? `${stats.cancelling_subscriptions} cancelling` : null
    },
    {
      name: 'MRR',
      value: `$${stats.mrr || 0}`,
      icon: TrendingUp,
      change: stats.mrr_change,
      color: 'bg-purple-500',
      subtitle: stats.at_risk_mrr ? `$${stats.at_risk_mrr} at risk` : null
    },
    {
      name: 'At Risk',
      value: stats.cancelling_subscriptions || 0,
      icon: TrendingDown,
      color: 'bg-orange-500',
      subtitle: `$${stats.at_risk_mrr || 0} MRR`
    },
    {
      name: 'AI Tokens (Month)',
      value: (stats.ai_tokens_this_month || 0).toLocaleString(),
      icon: Cpu,
      change: stats.ai_tokens_change,
      color: 'bg-cyan-500',
    },
    {
      name: 'Posts (Month)',
      value: stats.posts_this_month || 0,
      icon: FileText,
      change: stats.posts_change,
      color: 'bg-pink-500',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="animate-in fade-in duration-500">
        <h1 style={{ fontSize: '30px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary, marginBottom: '8px' }}>Dashboard Overview</h1>
        <p style={{ color: tokens.colors.text.secondary, fontWeight: 300 }}>
          Welcome back! Here's what's happening with LinkedPilot.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          const changeType = metric.change >= 0 ? 'increase' : 'decrease';
          const changeText = metric.change >= 0 ? `+${metric.change}%` : `${metric.change}%`;

          return (
            <div
              key={metric.name}
              style={{
                backgroundColor: tokens.colors.background.layer2,
                borderRadius: tokens.radius.xl,
                border: `1px solid ${tokens.colors.border.default}`,
                padding: '24px'
              }}
              className="transition-all group hover:shadow-lg"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = tokens.colors.border.strong;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = tokens.colors.border.default;
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${metric.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: changeType === 'increase' ? tokens.colors.accent.lime : '#EF4444'
                  }}
                >
                  {changeType === 'increase' ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {changeText}
                </div>
              </div>
              <h3 style={{ fontSize: '24px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary }}>{metric.value}</h3>
              <p style={{ fontSize: '14px', color: tokens.colors.text.secondary, marginTop: '4px' }}>{metric.name}</p>
              {metric.subtitle && (
                <p style={{ fontSize: '12px', color: '#FB923C', marginTop: '4px', fontWeight: 500 }}>{metric.subtitle}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div style={{ backgroundColor: tokens.colors.background.layer2, borderRadius: tokens.radius.xl, border: `1px solid ${tokens.colors.border.default}`, padding: '24px' }} className="animate-in fade-in duration-500">
        <h2 style={{ fontSize: '20px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary, marginBottom: '16px' }}>Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => navigate('/users')}
            style={{
              padding: '12px 16px',
              backgroundColor: tokens.colors.accent.lime,
              color: tokens.colors.text.inverse,
              borderRadius: tokens.radius.lg,
              fontWeight: 500,
              fontSize: '14px',
              fontFamily: tokens.typography.fontFamily.sans
            }}
            className="transition"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.limeHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.accent.lime}
          >
            View All Users
          </button>
          <button 
            onClick={() => navigate('/billing')}
            style={{
              padding: '12px 16px',
              backgroundColor: tokens.colors.background.input,
              color: tokens.colors.text.primary,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radius.lg,
              fontWeight: 500,
              fontSize: '14px',
              fontFamily: tokens.typography.fontFamily.sans
            }}
            className="transition"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = tokens.colors.background.layer1;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = tokens.colors.background.input;
            }}
          >
            Check Failed Payments
          </button>
          <button 
            onClick={() => navigate('/logs')}
            style={{
              padding: '12px 16px',
              backgroundColor: tokens.colors.background.input,
              color: tokens.colors.text.primary,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radius.lg,
              fontWeight: 500,
              fontSize: '14px',
              fontFamily: tokens.typography.fontFamily.sans
            }}
            className="transition"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = tokens.colors.background.layer1;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = tokens.colors.background.input;
            }}
          >
            View Activity Logs
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ backgroundColor: tokens.colors.background.layer2, borderRadius: tokens.radius.xl, border: `1px solid ${tokens.colors.border.default}`, padding: '24px' }} className="animate-in fade-in duration-500">
        <h2 style={{ fontSize: '20px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary, marginBottom: '16px' }}>Recent Activity</h2>
        {activity.length === 0 ? (
          <p style={{ color: tokens.colors.text.tertiary, textAlign: 'center', padding: '32px 0' }}>No recent activity yet.</p>
        ) : (
          <div className="space-y-4">
            {activity.map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '12px 0',
                  borderBottom: index < activity.length - 1 ? `1px solid ${tokens.colors.border.subtle}` : 'none'
                }}
              >
                <div className={`w-2 h-2 ${getActivityColor(item.type)} rounded-full`}></div>
                <div className="flex-1">
                  <p style={{ fontSize: '14px', fontWeight: 500, color: tokens.colors.text.primary }}>{item.description}</p>
                  <p style={{ fontSize: '12px', color: tokens.colors.text.tertiary }}>
                    {item.email} - {formatTimeAgo(item.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;

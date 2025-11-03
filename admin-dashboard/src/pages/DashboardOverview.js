import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, DollarSign, Cpu, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const DashboardOverview = () => {
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No data available. Make sure the backend is running.</p>
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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-600 mt-1">
          Welcome back! Here's what's happening with LinkedPilot.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const changeType = metric.change >= 0 ? 'increase' : 'decrease';
          const changeText = metric.change >= 0 ? `+${metric.change}%` : `${metric.change}%`;

          return (
            <div
              key={metric.name}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${metric.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div
                  className={`flex items-center gap-1 text-sm font-medium ${
                    changeType === 'increase'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {changeType === 'increase' ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {changeText}
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{metric.value}</h3>
              <p className="text-sm text-gray-600 mt-1">{metric.name}</p>
              {metric.subtitle && (
                <p className="text-xs text-orange-600 mt-1 font-medium">{metric.subtitle}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => navigate('/users')}
            className="px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition font-medium"
          >
            View All Users
          </button>
          <button 
            onClick={() => navigate('/billing')}
            className="px-4 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            Check Failed Payments
          </button>
          <button 
            onClick={() => navigate('/logs')}
            className="px-4 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            View Activity Logs
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
        {activity.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No recent activity yet.</p>
        ) : (
          <div className="space-y-4">
            {activity.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0"
              >
                <div className={`w-2 h-2 ${getActivityColor(item.type)} rounded-full`}></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.description}</p>
                  <p className="text-xs text-gray-600">
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

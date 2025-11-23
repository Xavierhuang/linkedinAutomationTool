import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DollarSign, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { useThemeTokens } from '../hooks/useThemeTokens';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const BillingManagement = () => {
  const tokens = useThemeTokens();
  const [overview, setOverview] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const [overviewRes, subsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/billing/overview`),
        axios.get(`${API_URL}/api/admin/subscriptions`),
      ]);
      setOverview(overviewRes.data);
      setSubscriptions(subsRes.data.subscriptions);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-t-transparent" style={{ borderColor: tokens.colors.accent.lime }}></div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="text-center py-12 animate-in fade-in duration-500">
        <p style={{ color: tokens.colors.text.secondary }}>Unable to load billing data. Check backend connection.</p>
      </div>
    );
  }

  const metrics = [
    {
      name: 'Total Users',
      value: overview?.total_users || 0,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      name: 'Pro Subscribers',
      value: overview?.pro_users || 0,
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      name: 'Monthly Recurring Revenue',
      value: `$${overview?.mrr || 0}`,
      icon: DollarSign,
      color: 'bg-purple-500',
    },
    {
      name: 'Churn Rate',
      value: `${overview?.churn_rate || 0}%`,
      icon: AlertCircle,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="animate-in fade-in duration-500">
        <h1 style={{ fontSize: '24px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary, fontWeight: 500 }}>Billing & Subscriptions</h1>
        <p style={{ color: tokens.colors.text.secondary, fontWeight: 300, marginTop: '4px' }}>
          Manage subscriptions and revenue
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.name}
              style={{
                backgroundColor: tokens.colors.background.layer1,
                borderRadius: tokens.radius.xl,
                border: `1px solid ${tokens.colors.border.default}`,
                padding: '24px'
              }}
              className="transition-all"
              onMouseEnter={(e) => e.currentTarget.style.borderColor = tokens.colors.border.strong}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = tokens.colors.border.default}
            >
              <div className={`${metric.color} p-3 rounded-lg inline-flex mb-4`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 style={{ fontSize: '24px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary }}>{metric.value}</h3>
              <p style={{ fontSize: '14px', color: tokens.colors.text.secondary, marginTop: '4px' }}>{metric.name}</p>
            </div>
          );
        })}
      </div>

      {/* Subscriptions Table */}
      <div style={{ backgroundColor: tokens.colors.background.layer1, borderRadius: tokens.radius.xl, border: `1px solid ${tokens.colors.border.default}`, overflow: 'hidden' }} className="animate-in fade-in duration-500">
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${tokens.colors.border.default}` }}>
          <h2 style={{ fontSize: '18px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary }}>
            Active Subscriptions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: tokens.colors.background.input, borderBottom: `1px solid ${tokens.colors.border.default}` }}>
              <tr>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  User
                </th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Plan
                </th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Status
                </th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Started
                </th>
              </tr>
            </thead>
            <tbody style={{ backgroundColor: tokens.colors.background.layer1 }}>
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '48px 24px', textAlign: 'center', color: tokens.colors.text.tertiary }}>
                    No active subscriptions yet
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id} style={{ borderTop: `1px solid ${tokens.colors.border.subtle}` }} className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.background.layer2} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.background.layer1}>
                    <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: tokens.colors.text.primary }}>
                          {sub.full_name}
                        </div>
                        <div style={{ fontSize: '14px', color: tokens.colors.text.tertiary }}>{sub.email}</div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                      <span style={{ padding: '4px 8px', display: 'inline-flex', fontSize: '12px', lineHeight: '20px', fontWeight: 600, borderRadius: tokens.radius.full, backgroundColor: 'rgba(168, 85, 247, 0.2)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                        PRO - $49/month
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                      <span style={{ padding: '4px 8px', display: 'inline-flex', fontSize: '12px', lineHeight: '20px', fontWeight: 600, borderRadius: tokens.radius.full, backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                        {(sub.subscription_status || 'active').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', fontSize: '14px', color: tokens.colors.text.tertiary }}>
                      {sub.subscription_start_date
                        ? new Date(sub.subscription_start_date).toLocaleDateString()
                        : 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BillingManagement;


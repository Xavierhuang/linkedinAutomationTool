import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Zap, FileText } from 'lucide-react';
import { useThemeTokens } from '../hooks/useThemeTokens';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const AnalyticsView = () => {
  const tokens = useThemeTokens();
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/analytics/usage`);
      setUsageData(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
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

  if (!usageData) {
    return (
      <div className="text-center py-12 animate-in fade-in duration-500">
        <p style={{ color: tokens.colors.text.secondary }}>No analytics data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="animate-in fade-in duration-500">
        <h1 style={{ fontSize: '24px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary, fontWeight: 500 }}>Analytics & Reports</h1>
        <p style={{ color: tokens.colors.text.secondary, fontWeight: 300, marginTop: '4px' }}>
          Usage analytics and insights
        </p>
      </div>

      {/* Usage by Type */}
      <div style={{ backgroundColor: tokens.colors.background.layer1, borderRadius: tokens.radius.xl, border: `1px solid ${tokens.colors.border.default}`, padding: '24px' }} className="animate-in fade-in duration-500">
        <h2 style={{ fontSize: '20px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary, marginBottom: '24px' }}>Usage by Type</h2>
        {!usageData?.usage_by_type || usageData.usage_by_type.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '32px 0', color: tokens.colors.text.tertiary }}>No usage data yet. Start creating content to see analytics.</p>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {usageData.usage_by_type.map((item) => (
            <div
              key={item._id}
              style={{ border: `1px solid ${tokens.colors.border.default}`, borderRadius: tokens.radius.lg, padding: '24px', backgroundColor: tokens.colors.background.input }}
            >
              <div className="flex items-center gap-3 mb-4">
                {item._id === 'ai_generation' && <Zap className="w-6 h-6 text-purple-400" />}
                {item._id === 'post_creation' && <FileText className="w-6 h-6 text-blue-400" />}
                {item._id === 'image_generation' && <Activity className="w-6 h-6 text-pink-400" />}
                <h3 style={{ fontWeight: 500, color: tokens.colors.text.primary, textTransform: 'capitalize' }}>
                  {item._id.replace('_', ' ')}
                </h3>
              </div>
              <div className="space-y-2">
                <div>
                  <p style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Total Tokens</p>
                  <p style={{ fontSize: '24px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary }}>
                    {item.total_tokens.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Total Cost</p>
                  <p style={{ fontSize: '18px', fontWeight: 600, color: tokens.colors.text.primary }}>
                    ${item.total_cost.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>Count</p>
                  <p style={{ fontSize: '18px', fontWeight: 600, color: tokens.colors.text.primary }}>
                    {item.count}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Top Users */}
      <div style={{ backgroundColor: tokens.colors.background.layer1, borderRadius: tokens.radius.xl, border: `1px solid ${tokens.colors.border.default}`, overflow: 'hidden' }} className="animate-in fade-in duration-500">
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${tokens.colors.border.default}` }}>
          <h2 style={{ fontSize: '18px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary }}>
            Top Users by Usage
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: tokens.colors.background.input, borderBottom: `1px solid ${tokens.colors.border.default}` }}>
              <tr>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Rank
                </th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  User
                </th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Tokens
                </th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Cost
                </th>
              </tr>
            </thead>
            <tbody style={{ backgroundColor: tokens.colors.background.layer1 }}>
              {!usageData?.top_users || usageData.top_users.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '48px 24px', textAlign: 'center', color: tokens.colors.text.tertiary }}>
                    No usage data yet
                  </td>
                </tr>
              ) : usageData.top_users.map((userData, index) => (
                <tr key={userData._id} style={{ borderTop: `1px solid ${tokens.colors.border.subtle}` }} className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.background.layer2} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.background.layer1}>
                  <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', fontSize: '14px', fontWeight: 500, color: tokens.colors.text.primary }}>
                    #{index + 1}
                  </td>
                  <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: tokens.colors.text.primary }}>
                        {userData.user?.full_name || 'Unknown User'}
                      </div>
                      <div style={{ fontSize: '14px', color: tokens.colors.text.tertiary }}>
                        {userData.user?.email || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', fontSize: '14px', color: tokens.colors.text.primary }}>
                    {userData.total_tokens.toLocaleString()}
                  </td>
                  <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', fontSize: '14px', color: tokens.colors.text.primary }}>
                    ${userData.total_cost.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsView;


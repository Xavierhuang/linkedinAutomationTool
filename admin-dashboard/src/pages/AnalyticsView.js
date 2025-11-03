import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Zap, FileText } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const AnalyticsView = () => {
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!usageData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No analytics data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
        <p className="text-gray-600 mt-1">
          Usage analytics and insights
        </p>
      </div>

      {/* Usage by Type */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Usage by Type</h2>
        {!usageData?.usage_by_type || usageData.usage_by_type.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No usage data yet. Start creating content to see analytics.</p>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {usageData.usage_by_type.map((item) => (
            <div
              key={item._id}
              className="border border-gray-200 rounded-lg p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                {item._id === 'ai_generation' && <Zap className="w-6 h-6 text-purple-600" />}
                {item._id === 'post_creation' && <FileText className="w-6 h-6 text-blue-600" />}
                {item._id === 'image_generation' && <Activity className="w-6 h-6 text-pink-600" />}
                <h3 className="font-semibold text-gray-900 capitalize">
                  {item._id.replace('_', ' ')}
                </h3>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Total Tokens</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {item.total_tokens.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Cost</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ${item.total_cost.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Count</p>
                  <p className="text-lg font-semibold text-gray-900">
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Top Users by Usage
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Tokens
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Cost
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!usageData?.top_users || usageData.top_users.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                    No usage data yet
                  </td>
                </tr>
              ) : usageData.top_users.map((userData, index) => (
                <tr key={userData._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {userData.user?.full_name || 'Unknown User'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {userData.user?.email || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {userData.total_tokens.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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


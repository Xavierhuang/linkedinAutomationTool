import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DollarSign, TrendingUp, Users, AlertCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const BillingManagement = () => {
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Unable to load billing data. Check backend connection.</p>
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing & Subscriptions</h1>
        <p className="text-gray-600 mt-1">
          Manage subscriptions and revenue
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.name}
              className="bg-white rounded-xl border border-gray-200 p-6"
            >
              <div className={`${metric.color} p-3 rounded-lg inline-flex mb-4`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{metric.value}</h3>
              <p className="text-sm text-gray-600 mt-1">{metric.name}</p>
            </div>
          );
        })}
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Active Subscriptions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Started
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                    No active subscriptions yet
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {sub.full_name}
                        </div>
                        <div className="text-sm text-gray-500">{sub.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        PRO - $49/month
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {(sub.subscription_status || 'active').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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


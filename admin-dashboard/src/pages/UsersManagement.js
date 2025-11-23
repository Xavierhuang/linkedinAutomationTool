import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Filter, MoreVertical, Edit, Ban, Trash2, Eye } from 'lucide-react';
import { useThemeTokens } from '../hooks/useThemeTokens';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const UsersManagement = () => {
  const tokens = useThemeTokens();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCancellingOnly, setShowCancellingOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchUsers();
  }, [page, tierFilter, statusFilter, search]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 50,
      };
      if (tierFilter !== 'all') params.tier = tierFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;

      const response = await axios.get(`${API_URL}/api/admin/users`, { params });
      setUsers(response.data.users);
      setTotalPages(response.data.pages);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between animate-in fade-in duration-500">
        <div>
          <h1 style={{ fontSize: '24px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary, fontWeight: 500 }}>Users Management</h1>
          <p style={{ color: tokens.colors.text.secondary, fontWeight: 300, marginTop: '4px' }}>
            Manage all users and their subscriptions
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ backgroundColor: tokens.colors.background.layer1, borderRadius: tokens.radius.xl, border: `1px solid ${tokens.colors.border.default}`, padding: '24px' }} className="animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: tokens.colors.text.tertiary }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                style={{
                  width: '100%',
                  paddingLeft: '40px',
                  paddingRight: '16px',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                  backgroundColor: tokens.colors.background.input,
                  border: `1px solid ${tokens.colors.border.default}`,
                  color: tokens.colors.text.primary,
                  borderRadius: tokens.radius.lg,
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = tokens.colors.accent.lime;
                  e.currentTarget.style.boxShadow = `0 0 0 2px ${tokens.colors.accent.lime}33`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = tokens.colors.border.default;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </form>

          {/* Tier Filter */}
          <select
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: tokens.colors.background.input,
              border: `1px solid ${tokens.colors.border.default}`,
              color: tokens.colors.text.primary,
              borderRadius: tokens.radius.lg,
              outline: 'none'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = tokens.colors.accent.lime;
              e.currentTarget.style.boxShadow = `0 0 0 2px ${tokens.colors.accent.lime}33`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = tokens.colors.border.default;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <option value="all">All Tiers</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: tokens.colors.background.input,
              border: `1px solid ${tokens.colors.border.default}`,
              color: tokens.colors.text.primary,
              borderRadius: tokens.radius.lg,
              outline: 'none'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = tokens.colors.accent.lime;
              e.currentTarget.style.boxShadow = `0 0 0 2px ${tokens.colors.accent.lime}33`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = tokens.colors.border.default;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        
        {/* Cancellation Filter */}
        <div className="flex items-center gap-2 mt-4">
          <input
            type="checkbox"
            id="showCancellingOnly"
            checked={showCancellingOnly}
            onChange={(e) => setShowCancellingOnly(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: tokens.colors.accent.lime }}
          />
          <label htmlFor="showCancellingOnly" style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>
            Show only users with pending cancellations
          </label>
        </div>
      </div>

      {/* Users Table */}
      <div style={{ backgroundColor: tokens.colors.background.layer1, borderRadius: tokens.radius.xl, border: `1px solid ${tokens.colors.border.default}`, overflow: 'hidden' }} className="animate-in fade-in duration-500">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-t-transparent" style={{ borderColor: tokens.colors.accent.lime }}></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: tokens.colors.background.input, borderBottom: `1px solid ${tokens.colors.border.default}` }}>
                  <tr>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      User
                    </th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Tier
                    </th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Status
                    </th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Usage
                    </th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Joined
                    </th>
                    <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: tokens.colors.background.layer1 }}>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '48px 24px', textAlign: 'center', color: tokens.colors.text.tertiary }}>
                        No users found
                      </td>
                    </tr>
                  ) : users.filter(user => !showCancellingOnly || user.cancel_at_period_end).map((user) => (
                    <tr key={user.id} style={{ borderTop: `1px solid ${tokens.colors.border.subtle}` }} className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.background.layer2} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.background.layer1}>
                      <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                        <div className="flex items-center">
                          <div style={{ width: '40px', height: '40px', backgroundColor: tokens.colors.accent.lime, borderRadius: '50%' }} className="flex items-center justify-center flex-shrink-0">
                            <span style={{ color: tokens.colors.text.inverse, fontWeight: 600, fontSize: '14px' }}>
                              {user.full_name?.charAt(0) || 'U'}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div style={{ fontSize: '14px', fontWeight: 500, color: tokens.colors.text.primary }}>
                              {user.full_name}
                            </div>
                            <div style={{ fontSize: '14px', color: tokens.colors.text.tertiary }}>{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                        <div className="flex items-center gap-2">
                          <span
                            style={{
                              padding: '4px 8px',
                              display: 'inline-flex',
                              fontSize: '12px',
                              lineHeight: '20px',
                              fontWeight: 600,
                              borderRadius: tokens.radius.full,
                              backgroundColor: user.subscription_tier === 'pro' ? 'rgba(168, 85, 247, 0.2)' : tokens.colors.background.input,
                              color: user.subscription_tier === 'pro' ? '#a855f7' : tokens.colors.text.secondary,
                              border: `1px solid ${user.subscription_tier === 'pro' ? 'rgba(168, 85, 247, 0.3)' : tokens.colors.border.default}`
                            }}
                          >
                            {(user.subscription_tier || 'free').toUpperCase()}
                          </span>
                          {user.cancel_at_period_end && (
                            <span style={{ padding: '4px 8px', display: 'inline-flex', fontSize: '12px', lineHeight: '20px', fontWeight: 600, borderRadius: tokens.radius.full, backgroundColor: 'rgba(251, 146, 60, 0.2)', color: '#fb923c', border: '1px solid rgba(251, 146, 60, 0.3)' }} title="Subscription will be cancelled at the end of the billing period">
                              CANCELLING
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            display: 'inline-flex',
                            fontSize: '12px',
                            lineHeight: '20px',
                            fontWeight: 600,
                            borderRadius: tokens.radius.full,
                            backgroundColor: user.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : user.status === 'suspended' ? 'rgba(239, 68, 68, 0.2)' : tokens.colors.background.input,
                            color: user.status === 'active' ? '#22c55e' : user.status === 'suspended' ? '#ef4444' : tokens.colors.text.secondary,
                            border: `1px solid ${user.status === 'active' ? 'rgba(34, 197, 94, 0.3)' : user.status === 'suspended' ? 'rgba(239, 68, 68, 0.3)' : tokens.colors.border.default}`
                          }}
                        >
                          {(user.status || 'active').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '14px', color: tokens.colors.text.primary }}>
                          {user.ai_tokens_used || 0} / {user.ai_tokens_limit || 0} tokens
                        </div>
                        <div style={{ fontSize: '14px', color: tokens.colors.text.tertiary }}>
                          {user.posts_this_month || 0} posts
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', fontSize: '14px', color: tokens.colors.text.tertiary }}>
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: '14px', fontWeight: 500 }}>
                        <button style={{ color: tokens.colors.text.secondary }} onMouseEnter={(e) => e.currentTarget.style.color = tokens.colors.text.primary} onMouseLeave={(e) => e.currentTarget.style.color = tokens.colors.text.secondary}>
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ padding: '16px 24px', borderTop: `1px solid ${tokens.colors.border.default}` }} className="flex items-center justify-between">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: tokens.colors.background.input,
                    border: `1px solid ${tokens.colors.border.default}`,
                    color: tokens.colors.text.primary,
                    borderRadius: tokens.radius.lg,
                    fontSize: '14px',
                    fontWeight: 500,
                    opacity: page === 1 ? 0.5 : 1,
                    cursor: page === 1 ? 'not-allowed' : 'pointer'
                  }}
                  className="transition-colors"
                  onMouseEnter={(e) => {
                    if (page !== 1) e.currentTarget.style.backgroundColor = tokens.colors.background.layer2;
                  }}
                  onMouseLeave={(e) => {
                    if (page !== 1) e.currentTarget.style.backgroundColor = tokens.colors.background.input;
                  }}
                >
                  Previous
                </button>
                <span style={{ fontSize: '14px', color: tokens.colors.text.secondary }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: tokens.colors.background.input,
                    border: `1px solid ${tokens.colors.border.default}`,
                    color: tokens.colors.text.primary,
                    borderRadius: tokens.radius.lg,
                    fontSize: '14px',
                    fontWeight: 500,
                    opacity: page === totalPages ? 0.5 : 1,
                    cursor: page === totalPages ? 'not-allowed' : 'pointer'
                  }}
                  className="transition-colors"
                  onMouseEnter={(e) => {
                    if (page !== totalPages) e.currentTarget.style.backgroundColor = tokens.colors.background.layer2;
                  }}
                  onMouseLeave={(e) => {
                    if (page !== totalPages) e.currentTarget.style.backgroundColor = tokens.colors.background.input;
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UsersManagement;


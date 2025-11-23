import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, User, Settings, Shield } from 'lucide-react';
import { useThemeTokens } from '../hooks/useThemeTokens';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const ActivityLogs = () => {
  const tokens = useThemeTokens();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/admin/logs`, {
        params: { page, limit: 50 },
      });
      setLogs(response.data.logs);
      setTotalPages(Math.ceil(response.data.total / 50));
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    if (action.includes('user')) return User;
    if (action.includes('system') || action.includes('settings')) return Settings;
    return FileText;
  };


  const getActionColor = (action) => {
    if (action.includes('suspended') || action.includes('deleted')) {
      return { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' };
    }
    if (action.includes('updated') || action.includes('modified')) {
      return { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' };
    }
    if (action.includes('login')) {
      return { backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' };
    }
    return { backgroundColor: tokens.colors.background.input, color: tokens.colors.text.secondary, border: `1px solid ${tokens.colors.border.default}` };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="animate-in fade-in duration-500">
        <h1 style={{ fontSize: '24px', fontFamily: tokens.typography.fontFamily.serif, fontStyle: 'italic', color: tokens.colors.text.primary, fontWeight: 500 }}>Activity Logs</h1>
        <p style={{ color: tokens.colors.text.secondary, fontWeight: 300, marginTop: '4px' }}>
          Admin actions and system events
        </p>
      </div>

      {/* Logs Table */}
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
                      Timestamp
                    </th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Admin
                    </th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Action
                    </th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Target
                    </th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: tokens.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      IP Address
                    </th>
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: tokens.colors.background.layer1 }}>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '48px 24px', textAlign: 'center', color: tokens.colors.text.tertiary }}>
                        No activity logs yet. Admin actions will appear here.
                      </td>
                    </tr>
                  ) : logs.map((log) => {
                    const Icon = getActionIcon(log.action);
                    const actionColor = getActionColor(log.action);
                    return (
                      <tr key={log.id} style={{ borderTop: `1px solid ${tokens.colors.border.subtle}` }} className="transition-colors" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.colors.background.layer2} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.colors.background.layer1}>
                        <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', fontSize: '14px', color: tokens.colors.text.tertiary }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: tokens.colors.text.primary }}>
                            {log.admin?.full_name || 'Admin'}
                          </div>
                          <div style={{ fontSize: '14px', color: tokens.colors.text.tertiary }}>
                            {log.admin?.email || log.admin_id}
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              padding: '4px 8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '12px',
                              lineHeight: '20px',
                              fontWeight: 600,
                              borderRadius: tokens.radius.full,
                              ...actionColor
                            }}
                          >
                            <Icon className="w-3 h-3" />
                            {log.action.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', fontSize: '14px', color: tokens.colors.text.primary }}>
                          {log.target_user_id || 'System'}
                        </td>
                        <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', fontSize: '14px', color: tokens.colors.text.tertiary }}>
                          {log.ip_address || 'N/A'}
                      </td>
                    </tr>
                  );
                })}
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

export default ActivityLogs;


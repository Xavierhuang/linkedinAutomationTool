import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * DiagnosticApp - A utility component for testing and debugging
 * This component can be used to verify backend connectivity and API functionality
 */
const DiagnosticApp = () => {
  const [status, setStatus] = useState({
    backend: 'checking',
    database: 'checking',
    auth: 'checking'
  });
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    addLog('Starting diagnostics...', 'info');

    // Test backend connection
    try {
      const response = await axios.get(`${BACKEND_URL}/health`);
      setStatus(prev => ({ ...prev, backend: 'ok' }));
      addLog('✓ Backend connection successful', 'success');
    } catch (error) {
      setStatus(prev => ({ ...prev, backend: 'error' }));
      addLog(`✗ Backend connection failed: ${error.message}`, 'error');
    }

    // Test database connection
    try {
      const response = await axios.get(`${BACKEND_URL}/api/health/db`);
      setStatus(prev => ({ ...prev, database: 'ok' }));
      addLog('✓ Database connection successful', 'success');
    } catch (error) {
      setStatus(prev => ({ ...prev, database: 'error' }));
      addLog(`✗ Database connection failed: ${error.message}`, 'error');
    }

    addLog('Diagnostics complete', 'info');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ok': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'checking': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">System Diagnostics</h1>

        {/* Status Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Backend</h3>
            <p className={`text-lg font-semibold ${getStatusColor(status.backend)}`}>
              {status.backend.toUpperCase()}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Database</h3>
            <p className={`text-lg font-semibold ${getStatusColor(status.database)}`}>
              {status.database.toUpperCase()}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Auth</h3>
            <p className={`text-lg font-semibold ${getStatusColor(status.auth)}`}>
              {status.auth.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Diagnostic Logs</h2>
            <button
              onClick={runDiagnostics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Run Again
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="flex gap-3 text-sm font-mono">
                <span className="text-gray-400">{log.timestamp}</span>
                <span className={getLogColor(log.type)}>{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Environment Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Environment</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Backend URL:</span>
              <span className="font-mono text-gray-900">{BACKEND_URL || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Node Environment:</span>
              <span className="font-mono text-gray-900">{process.env.NODE_ENV || 'development'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticApp;

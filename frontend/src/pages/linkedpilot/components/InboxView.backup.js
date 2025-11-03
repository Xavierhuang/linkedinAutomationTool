import React from 'react';
import { MessageSquare, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const InboxView = ({ orgId }) => {
  if (!orgId) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Organization Selected</h3>
          <p className="text-gray-600 mb-6">Please select an organization to view comments.</p>
          <Button 
            onClick={() => window.location.href = '/dashboard/organizations'}
            className="bg-gray-900 hover:bg-gray-800 text-white"
          >
            Go to Organizations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
            <p className="text-sm text-gray-600 mt-1">Manage comments and engagement on your posts</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Comments Yet</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            When people comment on your published posts, you'll see them here with AI-powered reply suggestions.
          </p>
          <Button
            onClick={() => window.location.href = '/dashboard/posts'}
            className="bg-gray-900 hover:bg-gray-800 text-white"
          >
            View Published Posts
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InboxView;
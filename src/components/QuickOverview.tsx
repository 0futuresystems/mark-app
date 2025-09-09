'use client';

import { useAuctionStats } from '../hooks/useAuctionStats';

interface QuickOverviewProps {
  currentAuctionId: string | null;
}

export default function QuickOverview({ currentAuctionId }: QuickOverviewProps) {
  const stats = useAuctionStats(currentAuctionId);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Quick Overview</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Lots</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.draft}</div>
          <div className="text-sm text-gray-600">Draft</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600">{stats.complete}</div>
          <div className="text-sm text-gray-600">Complete</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.sent}</div>
          <div className="text-sm text-gray-600">Sent</div>
        </div>
      </div>
    </div>
  );
}

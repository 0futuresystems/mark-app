'use client';

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Eye, Send } from "lucide-react";
import { getCurrentAuction } from "../../src/lib/currentAuction";
import { Auction } from "../../src/types";
import QuickOverview from "../../src/components/QuickOverview";
import { useAuctionStats } from "../../src/hooks/useAuctionStats";

export default function Home() {
  const router = useRouter();
  const [currentAuction, setCurrentAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const auctionStats = useAuctionStats(currentAuction?.id || null);

  useEffect(() => {
    const loadCurrentAuction = async () => {
      try {
        const auction = await getCurrentAuction();
        setCurrentAuction(auction);
        
        // If no current auction, redirect to auctions page
        if (!auction) {
          router.push('/auctions');
          return;
        }
      } catch (error) {
        console.error('Error loading current auction:', error);
        router.push('/auctions');
      } finally {
        setLoading(false);
      }
    };

    loadCurrentAuction();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h1 className="text-2xl font-semibold text-gray-900">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!currentAuction) {
    return null; // Will redirect to auctions page
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Track and manage your lots</p>
      </div>

      {/* Current Auction Card */}
      <div className="bg-brand-panel rounded-2xl p-4 sm:p-6 shadow-soft border border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <h2 className="text-lg font-semibold text-white truncate">
                  Current auction: {currentAuction.name}
                </h2>
              </div>
              <p className="text-sm text-gray-400">
                {auctionStats.total} total lots ({auctionStats.draft} draft, {auctionStats.complete} complete, {auctionStats.sent} sent)
              </p>
            </div>
            <Link 
              href="/auctions" 
              className="flex-shrink-0 px-4 py-2 text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              Change
            </Link>
          </div>
        </div>

      {/* Main Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link 
            className="bg-brand-panel rounded-2xl p-6 shadow-soft border border-gray-700 hover:shadow-soft hover:border-gray-600 transition-all group"
            href="/new"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">New Entry</h3>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-gray-400 text-sm">Create a new lot entry with photos and voice notes</p>
          </Link>
          
          <Link 
            className="bg-brand-panel rounded-2xl p-6 shadow-soft border border-gray-700 hover:shadow-soft hover:border-gray-600 transition-all group"
            href="/review"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Review Data</h3>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Eye className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-gray-400 text-sm">Review and manage your existing lot entries</p>
          </Link>
          
          <Link 
            className="bg-brand-panel rounded-2xl p-6 shadow-soft border border-gray-700 hover:shadow-soft hover:border-gray-600 transition-all group"
            href="/send"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Send Data</h3>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Send className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-gray-400 text-sm">Upload and send your lot data</p>
          </Link>
        </div>

      {/* Quick Stats */}
      <QuickOverview currentAuctionId={currentAuction.id} />
    </div>
  );
}
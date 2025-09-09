'use client';

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Plus, Eye, Send } from "lucide-react";
import { db } from "../src/db";
import { Lot } from "../src/types";
import AuctionSelector from "../src/components/AuctionSelector";

export default function Home() {
  const [currentAuctionId, setCurrentAuctionId] = useState<string | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);

  const loadLots = useCallback(async () => {
    try {
      let allLots;
      if (currentAuctionId) {
        allLots = await db.lots.where('auctionId').equals(currentAuctionId).toArray();
      } else {
        allLots = await db.lots.toArray();
      }
      setLots(allLots);
    } catch (error) {
      console.error('Error loading lots:', error);
    }
  }, [currentAuctionId]);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  const getLotCounts = () => {
    const total = lots.length;
    const draft = lots.filter(lot => lot.status === 'draft').length;
    const complete = lots.filter(lot => lot.status === 'complete').length;
    const sent = lots.filter(lot => lot.status === 'sent').length;
    return { total, draft, complete, sent };
  };

  const counts = getLotCounts();
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lot Logger</h1>
            <p className="text-gray-600 mt-1">Track and manage your lots</p>
          </div>
          <AuctionSelector 
            currentAuctionId={currentAuctionId}
            onAuctionChange={setCurrentAuctionId}
          />
        </div>

        {/* Main Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link 
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
            href="/new"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">New Entry</h3>
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-gray-600 text-sm">Create a new lot entry with photos and voice notes</p>
          </Link>
          
          <Link 
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
            href="/review"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Review Data</h3>
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Eye className="w-4 h-4 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-600 text-sm">Review and manage your existing lot entries</p>
          </Link>
          
          <Link 
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
            href="/send"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Send Data</h3>
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Send className="w-4 h-4 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-600 text-sm">Upload and send your lot data</p>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{counts.total}</div>
              <div className="text-sm text-gray-600">Total Lots</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{counts.draft}</div>
              <div className="text-sm text-gray-600">Draft</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{counts.complete}</div>
              <div className="text-sm text-gray-600">Complete</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{counts.sent}</div>
              <div className="text-sm text-gray-600">Sent</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
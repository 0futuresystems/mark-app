'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import { Auction } from '../types';
import { uid } from '../lib/id';
import { ChevronDown, Plus, Check } from 'lucide-react';

interface AuctionSelectorProps {
  currentAuctionId: string | null;
  onAuctionChange: (auctionId: string) => void;
}

export default function AuctionSelector({ currentAuctionId, onAuctionChange }: AuctionSelectorProps) {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newAuctionName, setNewAuctionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadAuctions = useCallback(async () => {
    try {
      const allAuctions = await db.auctions.orderBy('createdAt').reverse().toArray();
      setAuctions(allAuctions);
      
      // If no current auction is selected, select the first one
      if (!currentAuctionId && allAuctions.length > 0) {
        onAuctionChange(allAuctions[0].id);
      }
    } catch (error) {
      console.error('Error loading auctions:', error);
    }
  }, [currentAuctionId, onAuctionChange]);

  useEffect(() => {
    loadAuctions();
  }, [loadAuctions]);

  const createAuction = async () => {
    if (!newAuctionName.trim()) return;
    
    setIsCreating(true);
    try {
      const newAuction: Auction = {
        id: uid(),
        name: newAuctionName.trim(),
        createdAt: Date.now()
      };
      
      await db.auctions.add(newAuction);
      setAuctions(prev => [newAuction, ...prev]);
      setNewAuctionName('');
      onAuctionChange(newAuction.id);
      setIsOpen(false);
    } catch (error) {
      console.error('Error creating auction:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const currentAuction = auctions.find(a => a.id === currentAuctionId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium text-gray-900">
          {currentAuction ? currentAuction.name : 'Select Auction'}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-100">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newAuctionName}
                onChange={(e) => setNewAuctionName(e.target.value)}
                placeholder="New auction name"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && createAuction()}
              />
              <button
                onClick={createAuction}
                disabled={!newAuctionName.trim() || isCreating}
                className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="max-h-48 overflow-y-auto">
            {auctions.map((auction) => (
              <button
                key={auction.id}
                onClick={() => {
                  onAuctionChange(auction.id);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
              >
                <span className="text-gray-900">{auction.name}</span>
                {auction.id === currentAuctionId && (
                  <Check className="w-4 h-4 text-blue-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

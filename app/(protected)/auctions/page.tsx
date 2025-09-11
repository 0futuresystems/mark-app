'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../src/db';
import { Auction } from '../../../src/types';
import { uid } from '../../../src/lib/id';
import { setCurrentAuctionId, getCurrentAuctionId } from '../../../src/lib/currentAuction';
import { upsertAuction } from '../../../src/lib/supabaseSync';
import { Plus, Edit2, Archive, ArchiveRestore, Check, X, ArrowLeft } from 'lucide-react';

export default function AuctionsPage() {
  const router = useRouter();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [currentAuctionId, setCurrentAuctionIdState] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingAuction, setEditingAuction] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newAuctionName, setNewAuctionName] = useState('');
  const [lotCounts, setLotCounts] = useState<Record<string, number>>({});

  const loadAuctions = useCallback(async () => {
    try {
      const [allAuctions, currentId] = await Promise.all([
        db.auctions.orderBy('createdAt').reverse().toArray(),
        getCurrentAuctionId()
      ]);
      
      setAuctions(allAuctions);
      setCurrentAuctionIdState(currentId);
      
      // Load lot counts for all auctions
      const counts: Record<string, number> = {};
      for (const auction of allAuctions) {
        const lots = await db.lots.where('auctionId').equals(auction.id).toArray();
        counts[auction.id] = lots.length;
      }
      setLotCounts(counts);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading auctions:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuctions();
  }, [loadAuctions]);

  const filteredAuctions = auctions.filter(auction => 
    showArchived ? true : !auction.archived
  );


  const createAuction = async () => {
    if (!newAuctionName.trim()) return;
    
    setIsCreating(true);
    try {
      const newAuction: Auction = {
        id: uid(),
        name: newAuctionName.trim(),
        createdAt: Date.now(),
        archived: false
      };
      
      await db.auctions.add(newAuction);
      setAuctions(prev => [newAuction, ...prev]);
      setNewAuctionName('');
      
      // Sync to Supabase
      await upsertAuction({ id: newAuction.id, name: newAuction.name });
    } catch (error) {
      console.error('Error creating auction:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const startEdit = (auction: Auction) => {
    setEditingAuction(auction.id);
    setEditName(auction.name);
  };

  const saveEdit = async (auctionId: string) => {
    if (!editName.trim()) return;
    
    try {
      await db.auctions.update(auctionId, { name: editName.trim() });
      setAuctions(prev => prev.map(a => 
        a.id === auctionId ? { ...a, name: editName.trim() } : a
      ));
      setEditingAuction(null);
      setEditName('');
      
      // Sync to Supabase
      await upsertAuction({ id: auctionId, name: editName.trim() });
    } catch (error) {
      console.error('Error updating auction:', error);
    }
  };

  const cancelEdit = () => {
    setEditingAuction(null);
    setEditName('');
  };

  const toggleArchive = async (auction: Auction) => {
    try {
      const newArchived = !auction.archived;
      await db.auctions.update(auction.id, { archived: newArchived });
      setAuctions(prev => prev.map(a => 
        a.id === auction.id ? { ...a, archived: newArchived } : a
      ));
      
      // If we're archiving the current auction, clear the current auction
      if (newArchived && currentAuctionId === auction.id) {
        await setCurrentAuctionId(null);
        setCurrentAuctionIdState(null);
      }
    } catch (error) {
      console.error('Error toggling archive:', error);
    }
  };

  const selectAuction = async (auction: Auction) => {
    try {
      await setCurrentAuctionId(auction.id);
      setCurrentAuctionIdState(auction.id);
      router.push('/');
    } catch (error) {
      console.error('Error selecting auction:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h1 className="text-2xl font-semibold text-gray-900">Loading auctions...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center space-x-4">
        <button 
          onClick={() => router.push('/')}
          className="w-10 h-10 bg-brand-panel rounded-full flex items-center justify-center shadow-soft border border-gray-700 hover:border-gray-600 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Auctions</h1>
          <p className="text-gray-400 mt-1">Manage your auctions</p>
        </div>
      </div>

      {/* Create New Auction */}
      <div className="bg-brand-panel rounded-2xl p-6 shadow-soft border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Create New Auction</h2>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <input
              type="text"
              value={newAuctionName}
              onChange={(e) => setNewAuctionName(e.target.value)}
              placeholder="Auction name"
              className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white text-gray-900 placeholder:text-gray-400 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400"
              onKeyPress={(e) => e.key === 'Enter' && createAuction()}
            />
            <button
              onClick={createAuction}
              disabled={!newAuctionName.trim() || isCreating}
              className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreating ? 'Creating...' : 'Create'}</span>
            </button>
          </div>
        </div>

        {/* Show Archived Toggle */}
        {auctions.some(a => a.archived) && (
          <div className="mb-6">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Show archived auctions</span>
            </label>
          </div>
        )}

        {/* Auctions List */}
        {filteredAuctions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {showArchived ? 'No archived auctions' : 'No auctions yet'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {showArchived 
                ? 'Archived auctions will appear here when you archive them.'
                : 'Get started by creating your first auction.'
              }
            </p>
            {!showArchived && (
              <button
                onClick={() => (document.querySelector('input[placeholder="Auction name"]') as HTMLInputElement)?.focus()}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create your first auction
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAuctions.map((auction) => {
              const lotCount = lotCounts[auction.id] || 0;
              const isCurrent = currentAuctionId === auction.id;
              const isEditing = editingAuction === auction.id;
              
              return (
                <div 
                  key={auction.id} 
                  className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border transition-all ${
                    isCurrent 
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-100 dark:border-gray-700 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-3 py-1 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white text-gray-900 placeholder:text-gray-400 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400"
                            onKeyPress={(e) => e.key === 'Enter' && saveEdit(auction.id)}
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit(auction.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 text-rose-600 hover:bg-rose-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                            <span>{auction.name}</span>
                            {isCurrent && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full">
                                Current
                              </span>
                            )}
                            {auction.archived && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
                                Archived
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Created: {new Date(auction.createdAt).toLocaleDateString()} - {lotCount} lots
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {!isEditing && (
                      <div className="flex items-center space-x-2">
                        {!auction.archived && (
                          <>
                            <button
                              onClick={() => startEdit(auction)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Rename auction"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleArchive(auction)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Archive auction"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {auction.archived && (
                          <button
                            onClick={() => toggleArchive(auction)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Unarchive auction"
                          >
                            <ArchiveRestore className="w-4 h-4" />
                          </button>
                        )}
                        {!auction.archived && (
                          <button
                            onClick={() => selectAuction(auction)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                          >
                            {isCurrent ? 'Selected' : 'Select'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

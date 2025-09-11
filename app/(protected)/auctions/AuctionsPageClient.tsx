'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/db';
import { Auction } from '@/types';
import { getCurrentAuctionId, setCurrentAuctionId } from '@/lib/currentAuction';
import { uid } from '@/lib/id';
import { Plus, Edit2, Check, X, Archive, ArchiveRestore, Trash2 } from 'lucide-react';

export default function AuctionsPageClient() {
  const router = useRouter();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [currentAuctionId, setCurrentAuctionIdState] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingAuction, setEditingAuction] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newAuctionName, setNewAuctionName] = useState<string>('');
  const [lotCounts, setLotCounts] = useState<Record<string, number>>({});

  // Load auctions and current auction ID
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load all auctions
        const allAuctions = await db.auctions.orderBy('createdAt').reverse().toArray();
        setAuctions(allAuctions);

        // Load current auction ID
        const currentId = await getCurrentAuctionId();
        setCurrentAuctionIdState(currentId);

        // Load lot counts for each auction
        const counts: Record<string, number> = {};
        for (const auction of allAuctions) {
          const count = await db.lots.where('auctionId').equals(auction.id).count();
          counts[auction.id] = count;
        }
        setLotCounts(counts);
      } catch (error) {
        console.error('Error loading auctions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter auctions based on archived status
  const filteredAuctions = auctions.filter(auction => 
    showArchived ? auction.archived : !auction.archived
  );

  // Create new auction
  const handleCreateAuction = async () => {
    if (!newAuctionName.trim()) return;

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
      setIsCreating(false);

      // Auto-select the new auction
      await setCurrentAuctionId(newAuction.id);
      setCurrentAuctionIdState(newAuction.id);
    } catch (error) {
      console.error('Error creating auction:', error);
    }
  };

  // Update auction name
  const handleUpdateAuction = async (auctionId: string) => {
    if (!editName.trim()) return;

    try {
      await db.auctions.update(auctionId, { name: editName.trim() });
      setAuctions(prev => prev.map(auction => 
        auction.id === auctionId ? { ...auction, name: editName.trim() } : auction
      ));
      setEditingAuction(null);
      setEditName('');
    } catch (error) {
      console.error('Error updating auction:', error);
    }
  };

  // Archive/unarchive auction
  const handleToggleArchive = async (auctionId: string, archived: boolean) => {
    try {
      await db.auctions.update(auctionId, { archived });
      setAuctions(prev => prev.map(auction => 
        auction.id === auctionId ? { ...auction, archived } : auction
      ));
    } catch (error) {
      console.error('Error toggling archive:', error);
    }
  };

  // Delete auction (only if it has no lots)
  const handleDeleteAuction = async (auctionId: string) => {
    const lotCount = lotCounts[auctionId] || 0;
    if (lotCount > 0) {
      alert('Cannot delete auction with existing lots. Archive it instead.');
      return;
    }

    if (!confirm('Are you sure you want to delete this auction?')) return;

    try {
      await db.auctions.delete(auctionId);
      setAuctions(prev => prev.filter(auction => auction.id !== auctionId));
      
      // If this was the current auction, clear it
      if (currentAuctionId === auctionId) {
        await setCurrentAuctionId(null);
        setCurrentAuctionIdState(null);
      }
    } catch (error) {
      console.error('Error deleting auction:', error);
    }
  };

  // Select auction as current
  const handleSelectAuction = async (auctionId: string) => {
    try {
      await setCurrentAuctionId(auctionId);
      setCurrentAuctionIdState(auctionId);
      router.push('/dashboard'); // Redirect to dashboard page
    } catch (error) {
      console.error('Error selecting auction:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent mx-auto mb-4"></div>
          <h1 className="text-2xl font-semibold text-brand-text">Loading auctions...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Auctions</h1>
          <p className="text-brand-text-muted mt-1">Manage your auction events</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showArchived 
                ? 'bg-brand-accent text-white' 
                : 'bg-brand-panel text-brand-text border border-brand-border hover:bg-gray-50'
            }`}
          >
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>
          
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Auction
          </button>
        </div>
      </div>

      {/* Create Auction Form */}
      {isCreating && (
        <div className="bg-brand-panel rounded-2xl p-6 border border-brand-border">
          <h3 className="text-lg font-semibold text-brand-text mb-4">Create New Auction</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newAuctionName}
              onChange={(e) => setNewAuctionName(e.target.value)}
              placeholder="Enter auction name..."
              className="flex-1 px-4 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateAuction();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewAuctionName('');
                }
              }}
            />
            <button
              onClick={handleCreateAuction}
              disabled={!newAuctionName.trim()}
              className="px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewAuctionName('');
              }}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Auctions List */}
      {filteredAuctions.length === 0 ? (
        <div className="bg-brand-panel rounded-2xl p-8 text-center border border-brand-border">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Archive className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-brand-text mb-2">
            {showArchived ? 'No archived auctions' : 'No auctions yet'}
          </h3>
          <p className="text-brand-text-muted mb-6">
            {showArchived 
              ? 'Archived auctions will appear here'
              : 'Create your first auction to start tracking lots'
            }
          </p>
          {!showArchived && (
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-accent text-white rounded-lg hover:bg-brand-accent-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Auction
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAuctions.map((auction) => (
            <div
              key={auction.id}
              className={`bg-brand-panel rounded-2xl p-6 border transition-all ${
                currentAuctionId === auction.id
                  ? 'border-brand-accent ring-2 ring-brand-accent/20'
                  : 'border-brand-border hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  {editingAuction === auction.id ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-3 py-1 border border-brand-border rounded focus:outline-none focus:ring-2 focus:ring-brand-accent"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateAuction(auction.id);
                          if (e.key === 'Escape') {
                            setEditingAuction(null);
                            setEditName('');
                          }
                        }}
                      />
                      <button
                        onClick={() => handleUpdateAuction(auction.id)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingAuction(null);
                          setEditName('');
                        }}
                        className="p-1 text-gray-400 hover:bg-gray-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-lg font-semibold text-brand-text truncate">
                        {auction.name}
                      </h3>
                      <p className="text-sm text-brand-text-muted">
                        {lotCounts[auction.id] || 0} lots • Created {new Date(auction.createdAt).toLocaleDateString()}
                        {auction.archived && ' • Archived'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {currentAuctionId === auction.id && (
                    <div className="px-3 py-1 bg-brand-accent text-white text-sm font-medium rounded-full">
                      Current
                    </div>
                  )}
                  
                  {!auction.archived && currentAuctionId !== auction.id && (
                    <button
                      onClick={() => handleSelectAuction(auction.id)}
                      className="px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent-hover transition-colors text-sm"
                    >
                      Select
                    </button>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingAuction(auction.id);
                        setEditName(auction.name);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      title="Edit name"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => handleToggleArchive(auction.id, !auction.archived)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      title={auction.archived ? 'Restore' : 'Archive'}
                    >
                      {auction.archived ? (
                        <ArchiveRestore className="w-4 h-4" />
                      ) : (
                        <Archive className="w-4 h-4" />
                      )}
                    </button>
                    
                    {auction.archived && (lotCounts[auction.id] || 0) === 0 && (
                      <button
                        onClick={() => handleDeleteAuction(auction.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

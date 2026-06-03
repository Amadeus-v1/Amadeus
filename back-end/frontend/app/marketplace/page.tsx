'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { ShoppingBag, Tag, MessageSquare, Search, Filter } from 'lucide-react';

export default function MarketplacePage() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const response = await api.get('/marketplace/listings');
      setListings(response.data);
    } catch (err) {
      console.error('Failed to fetch listings', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white text-balance">Marketplace</h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">Buy and sell physical media with other collectors.</p>
            </div>
          </header>

          <div className="mb-8 flex gap-4">
             <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search marketplace..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 hover:bg-gray-50 transition">
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amadeus-600"></div>
            </div>
          ) : listings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <div key={listing.id} className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-md transition">
                  <div className="p-4 flex gap-4">
                    <div className="h-24 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg flex-shrink-0 overflow-hidden">
                       <img 
                        src={listing.collectionItem.mediaItem.baseCover || 'https://via.placeholder.com/150'} 
                        alt="" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-gray-900 dark:text-white truncate">{listing.collectionItem.mediaItem.title}</h3>
                        <span className="text-amadeus-600 font-bold text-lg">${listing.price}</span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{listing.collectionItem.mediaItem.creator}</p>
                      <div className="mt-2 flex items-center gap-2">
                         <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600">{listing.collectionItem.mediaItem.type}</span>
                         <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{listing.collectionItem.condition}</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-amadeus-100 flex items-center justify-center text-[10px] font-bold text-amadeus-600">
                        {listing.seller.username[0].toUpperCase()}
                      </div>
                      <span className="text-xs text-gray-600">@{listing.seller.username}</span>
                    </div>
                    <div className="flex gap-2">
                       <button className="p-2 text-gray-400 hover:text-amadeus-600 transition">
                        <MessageSquare className="h-4 w-4" />
                       </button>
                       <button className="bg-amadeus-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-amadeus-700 transition">
                         Buy Now
                       </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-24 bg-white dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800">
              <ShoppingBag className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">No items for sale</h3>
              <p className="text-gray-500 mt-2">Check back later or list your own items!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

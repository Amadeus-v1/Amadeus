'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { UserPlus, UserCheck, UserX, Search, MessageSquare, Clock } from 'lucide-react';

export default function FriendsPage() {
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const friendsRes = await api.get('/friends');
      setFriends(friendsRes.data);
      // In a real app, we'd also fetch pending requests here
    } catch (err) {
      console.error('Failed to fetch friends', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Friends</h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">Connect with other collectors and see their latest additions.</p>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Friends List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <h2 className="font-bold text-gray-900 dark:text-white">Your Friends</h2>
                  <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">{friends.length}</span>
                </div>
                
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {friends.length > 0 ? friends.map((friend) => (
                    <div key={friend.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                      <div className="h-12 w-12 rounded-full bg-amadeus-100 dark:bg-amadeus-900/20 flex items-center justify-center text-amadeus-600 font-bold">
                        {friend.username[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-white">{friend.displayName || friend.username}</h3>
                        <p className="text-xs text-gray-500">@{friend.username}</p>
                      </div>
                      <button className="p-2 text-gray-400 hover:text-amadeus-600 transition">
                        <MessageSquare className="h-5 w-5" />
                      </button>
                    </div>
                  )) : (
                    <div className="p-12 text-center text-gray-500 italic text-sm">
                      You haven't added any friends yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar: Requests & Search */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Find Collectors
                </h2>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search by username..."
                    className="w-full pl-4 pr-10 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
                  />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-amadeus-600">
                    <UserPlus className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                  <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Pending Requests
                  </h2>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-800"></div>
                    <div className="flex-1">
                      <p className="text-sm font-bold truncate">VinylLover99</p>
                    </div>
                    <div className="flex gap-1">
                      <button className="p-1.5 text-green-600 hover:bg-green-50 rounded transition">
                        <UserCheck className="h-4 w-4" />
                      </button>
                      <button className="p-1.5 text-red-600 hover:bg-red-50 rounded transition">
                        <UserX className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

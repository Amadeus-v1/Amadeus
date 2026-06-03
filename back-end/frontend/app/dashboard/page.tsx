'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { Disc, DollarSign, Package, Clock, Sparkles, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchData(parsedUser.username);
    }
  }, []);

  const fetchData = async (username: string) => {
    try {
      const [statsRes, recsRes] = await Promise.all([
        api.get(`/user/profile/${username}`),
        api.get('/media/recommendations')
      ]);
      setStats(statsRes.data.stats);
      setRecommendations(recsRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { name: 'Total Items', value: stats?.totalItems || 0, icon: Package, color: 'text-blue-600' },
    { name: 'Total Quantity', value: stats?.totalQuantity || 0, icon: Disc, color: 'text-purple-600' },
    { name: 'Estimated Value', value: `$${stats?.totalValue || 0}`, icon: DollarSign, color: 'text-green-600' },
    { name: 'Recent Activity', value: '3 additions', icon: Clock, color: 'text-orange-600' },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back, {user?.username}</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Here is what's happening with your collection today.</p>
          </header>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.name} className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</p>
                      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{loading ? '...' : stat.value}</p>
                    </div>
                    <div className={`rounded-full bg-gray-100 p-3 dark:bg-gray-800 ${stat.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommendations Section */}
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amadeus-500" />
                Would you like more like this?
              </h2>
              <Link href="/discovery" className="text-sm font-medium text-amadeus-600 hover:text-amadeus-500 flex items-center">
                Explore all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {recommendations.length > 0 ? recommendations.map((item) => (
                <div key={item.id} className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition group cursor-pointer">
                  <div className="aspect-square rounded-lg bg-gray-100 dark:bg-gray-800 mb-3 overflow-hidden">
                    {item.baseCover ? (
                      <img src={item.baseCover} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <Disc className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-sm truncate dark:text-white">{item.title}</h3>
                  <p className="text-xs text-gray-500 truncate">{item.creator}</p>
                </div>
              )) : (
                [1,2,3,4,5].map(i => (
                  <div key={i} className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-800 animate-pulse">
                    <div className="aspect-square rounded-lg bg-gray-100 dark:bg-gray-800 mb-3" />
                    <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-800 rounded mb-2" />
                    <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded" />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Additions</h2>
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center h-48 text-gray-500 italic text-sm">
                  No recent additions.
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Friend Activity</h2>
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 italic text-sm">
                No recent activity from your friends.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

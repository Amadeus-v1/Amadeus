'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { ShieldAlert, CheckCircle, XCircle, Users, Database, BarChart3 } from 'lucide-react';

export default function AdminDashboard() {
  const [pendingMedia, setPendingMedia] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [mediaRes, usersRes] = await Promise.all([
        api.get('/admin/media/pending'),
        api.get('/admin/users')
      ]);
      setPendingMedia(mediaRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error('Failed to fetch admin data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/admin/media/approve/${id}`);
      setPendingMedia(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      alert('Approval failed');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-red-600" />
              Admin Control Panel
            </h1>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Pending Approvals</p>
                    <p className="text-3xl font-bold mt-1">{pendingMedia.length}</p>
                  </div>
                  <Database className="text-amadeus-500" />
               </div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Total Users</p>
                    <p className="text-3xl font-bold mt-1">{users.length}</p>
                  </div>
                  <Users className="text-amadeus-500" />
               </div>
            </div>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">System Health</p>
                    <p className="text-xl font-bold mt-2 text-green-600">Operational</p>
                  </div>
                  <BarChart3 className="text-amadeus-500" />
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Moderation Queue */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <h2 className="font-bold">Media Moderation Queue</h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {pendingMedia.length > 0 ? pendingMedia.map(item => (
                  <div key={item.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.creator} • {item.type}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleApprove(item.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                      >
                        <CheckCircle className="h-5 w-5" />
                      </button>
                      <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
                        <XCircle className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="p-8 text-center text-gray-500 text-sm italic">
                    Queue is empty. No items pending review.
                  </div>
                )}
              </div>
            </div>

            {/* User Management */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <h2 className="font-bold">User Management</h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map(u => (
                  <div key={u.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-xs">
                        {u.username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{u.username}</p>
                        <p className="text-[10px] text-gray-400">{u._count.collection} items in collection</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${u.role === 'ADMIN' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

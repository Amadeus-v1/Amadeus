'use client';

import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import AddItemModal from '../../components/AddItemModal';
import api from '../../lib/api';
import { Plus, Search, LayoutGrid, List as ListIcon, Library } from 'lucide-react';
import { clsx } from 'clsx';

export default function CollectionPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchCollection();
  }, []);

  const fetchCollection = async () => {
    try {
      const response = await api.get('/collection');
      setItems(response.data);
    } catch (err) {
      console.error('Failed to fetch collection', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.mediaItem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.mediaItem.creator.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Collection</h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">Manage and browse your physical media.</p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-2 bg-amadeus-600 text-white px-4 py-2 rounded-lg hover:bg-amadeus-700 transition shadow-md"
            >
              <Plus className="h-5 w-5" />
              <span>Add Item</span>
            </button>
          </header>

          <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search collection..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-amadeus-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-2 bg-white dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-800">
              <button 
                onClick={() => setViewMode('grid')}
                className={clsx('p-1.5 rounded', viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-800 text-amadeus-600' : 'text-gray-400')}
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={clsx('p-1.5 rounded', viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-800 text-amadeus-600' : 'text-gray-400')}
              >
                <ListIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amadeus-600"></div>
            </div>
          ) : filteredItems.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {filteredItems.map((item) => (
                  <div key={item.id} className="group bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-md transition">
                    <div className="aspect-square bg-gray-200 dark:bg-gray-800 relative">
                      {item.mediaItem.baseCover ? (
                        <img src={item.mediaItem.baseCover} alt={item.mediaItem.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Plus className="h-12 w-12 opacity-20" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 dark:text-white truncate">{item.mediaItem.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{item.mediaItem.creator}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-amadeus-50 text-amadeus-600 dark:bg-amadeus-900/20">{item.mediaItem.type}</span>
                        <span className="text-xs text-gray-500">{item.condition || 'Mint'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500 font-bold">
                    <tr>
                      <th className="px-6 py-3">Title</th>
                      <th className="px-6 py-3">Creator</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Condition</th>
                      <th className="px-6 py-3 text-right">Acquired</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.mediaItem.title}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{item.mediaItem.creator}</td>
                        <td className="px-6 py-4">
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">{item.mediaItem.type}</span>
                        </td>
                        <td className="px-6 py-4 text-sm">{item.condition || '-'}</td>
                        <td className="px-6 py-4 text-right text-sm text-gray-500">
                          {item.dateAcquired ? new Date(item.dateAcquired).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="text-center py-24 bg-white dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800">
              <Library className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Your collection is empty</h3>
              <p className="text-gray-500 mt-2">Start adding records, CDs, movies or books!</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="mt-6 inline-flex items-center space-x-2 bg-amadeus-600 text-white px-6 py-2 rounded-lg hover:bg-amadeus-700 transition"
              >
                <Plus className="h-5 w-5" />
                <span>Add your first item</span>
              </button>
            </div>
          )}
        </div>
      </main>

      <AddItemModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchCollection} 
      />
    </div>
  );
}

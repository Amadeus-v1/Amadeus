'use client';

import { useState } from 'react';
import { Search, Plus, X, Disc, Book, Monitor, Music, Check, ScanLine, ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import Scanner from './Scanner';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddItemModal({ isOpen, onClose, onSuccess }: AddItemModalProps) {
  const [step, setStep] = useState<'search' | 'details' | 'custom'>('search');
  const [showScanner, setShowScanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Collection Detail fields
  const [condition, setCondition] = useState('Near Mint');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Custom Media fields
  const [customTitle, setCustomTitle] = useState('');
  const [customCreator, setCustomCreator] = useState('');
  const [customType, setCustomType] = useState('VINYL');
  const [customYear, setCustomYear] = useState('');

  if (!isOpen) return null;

  const handleSearch = async (queryOverride?: string) => {
    const query = queryOverride || searchQuery;
    if (!query) return;
    setLoading(true);
    try {
      const response = await api.get(`/media/search?query=${query}`);
      setSearchResults(response.data);
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScan = (barcode: string) => {
    setSearchQuery(barcode);
    setShowScanner(false);
    handleSearch(barcode);
  };

  const handleSelectMedia = (media: any) => {
    setSelectedMedia(media);
    setStep('details');
  };

  const handleAddSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/collection/add', {
        mediaItemId: selectedMedia.id,
        condition,
        purchasePrice: price ? parseFloat(price) : undefined,
        notes,
        quantity,
      });
      onSuccess();
      onClose();
      resetState();
    } catch (err) {
      console.error('Failed to add item', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomAndAdd = async () => {
    setLoading(true);
    try {
      // 1. Create the media item in the community database
      const mediaRes = await api.post('/media/create', {
        title: customTitle,
        creator: customCreator,
        type: customType,
        releaseYear: customYear ? parseInt(customYear) : undefined,
      });

      // 2. Add it to user collection
      await api.post('/collection/add', {
        mediaItemId: mediaRes.data.id,
        condition,
        purchasePrice: price ? parseFloat(price) : undefined,
        notes,
        quantity,
      });

      onSuccess();
      onClose();
      resetState();
    } catch (err) {
      console.error('Failed to create and add item', err);
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setStep('search');
    setSelectedMedia(null);
    setSearchQuery('');
    setSearchResults([]);
    setCustomTitle('');
    setCustomCreator('');
    setPrice('');
    setNotes('');
  };

  return (
    <>
      {showScanner && (
        <Scanner 
          onScan={handleBarcodeScan} 
          onClose={() => setShowScanner(false)} 
        />
      )}
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {step === 'search' && 'Add Item to Collection'}
              {step === 'details' && 'Item Details'}
              {step === 'custom' && 'Create New Media Entry'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {step === 'search' && (
              <div className="space-y-6">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by title, artist, or barcode..."
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amadeus-500"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                  <button 
                    onClick={() => setShowScanner(true)}
                    className="p-2 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition text-gray-600 dark:text-gray-400"
                    title="Scan Barcode"
                  >
                    <ScanLine className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => handleSearch()}
                    disabled={loading}
                    className="bg-amadeus-600 text-white px-6 py-2 rounded-lg hover:bg-amadeus-700 transition disabled:opacity-50 font-bold"
                  >
                    {loading ? '...' : 'Search'}
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                  {searchResults.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => handleSelectMedia(item)}
                      className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-amadeus-500 hover:bg-amadeus-50/30 dark:hover:bg-amadeus-900/10 cursor-pointer transition"
                    >
                      <div className="h-16 w-16 bg-gray-100 dark:bg-gray-800 rounded-md flex-shrink-0 overflow-hidden">
                        {item.baseCover ? (
                          <img src={item.baseCover} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Disc className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 dark:text-white truncate">{item.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{item.creator}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">{item.type}</span>
                        </div>
                      </div>
                      <Plus className="h-5 w-5 text-gray-300" />
                    </div>
                  ))}
                  
                  {searchQuery && !loading && searchResults.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500 mb-4">No matches found in our database.</p>
                      <button 
                        onClick={() => setStep('custom')}
                        className="text-amadeus-600 font-bold hover:underline flex items-center justify-center gap-2 mx-auto"
                      >
                        <Plus className="h-4 w-4" />
                        Add a custom entry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 'details' && selectedMedia && (
              <div className="space-y-6">
                <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="h-20 w-20 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                    {selectedMedia.baseCover && <img src={selectedMedia.baseCover} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{selectedMedia.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{selectedMedia.creator}</p>
                    <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-widest">{selectedMedia.type}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Condition</label>
                    <select 
                      className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                    >
                      <option>Mint</option>
                      <option>Near Mint</option>
                      <option>Very Good Plus</option>
                      <option>Very Good</option>
                      <option>Good</option>
                      <option>Fair/Poor</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Purchase Price ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                      placeholder="0.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Notes</label>
                  <textarea 
                    className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 min-h-[80px]"
                    placeholder="Where did you get it? Special features?"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setStep('search')}
                    className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-800 font-bold hover:bg-gray-50 transition"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleAddSubmit}
                    disabled={loading}
                    className="flex-[2] bg-amadeus-600 text-white py-3 rounded-xl font-bold hover:bg-amadeus-700 transition flex items-center justify-center gap-2"
                  >
                    {loading ? 'Adding...' : (
                      <>
                        <Check className="h-5 w-5" />
                        Confirm Addition
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 'custom' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Title</label>
                  <input 
                    type="text"
                    className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                    placeholder="Album or Book Title"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Artist / Author / Creator</label>
                  <input 
                    type="text"
                    className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                    placeholder="Creator Name"
                    value={customCreator}
                    onChange={(e) => setCustomCreator(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Media Type</label>
                    <select 
                      className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                    >
                      <option value="VINYL">Vinyl Record</option>
                      <option value="CD">CD</option>
                      <option value="DVD">DVD</option>
                      <option value="BLURAY">Blu-ray</option>
                      <option value="BOOK">Book</option>
                      <option value="CASSETTE">Cassette</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Release Year</label>
                    <input 
                      type="number"
                      className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                      placeholder="YYYY"
                      value={customYear}
                      onChange={(e) => setCustomYear(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                  <h4 className="text-xs font-bold text-amadeus-600 uppercase mb-4">Your Item Condition</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Condition</label>
                      <select 
                        className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm"
                        value={condition}
                        onChange={(e) => setCondition(e.target.value)}
                      >
                        <option>Mint</option>
                        <option>Near Mint</option>
                        <option>Very Good Plus</option>
                        <option>Very Good</option>
                        <option>Good</option>
                        <option>Fair/Poor</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Price Paid ($)</label>
                      <input 
                        type="number"
                        className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm"
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setStep('search')}
                    className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-800 font-bold hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCreateCustomAndAdd}
                    disabled={loading || !customTitle || !customCreator}
                    className="flex-[2] bg-amadeus-600 text-white py-3 rounded-xl font-bold hover:bg-amadeus-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : (
                      <>
                        <Plus className="h-5 w-5" />
                        Create & Add
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

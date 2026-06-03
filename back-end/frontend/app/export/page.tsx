'use client';

import { useState } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { Download, FileSpreadsheet, FileText, Shield, AlertCircle } from 'lucide-react';

export default function ExportPage() {
  const [loading, setLoading] = useState(false);

  const handleExportCSV = async () => {
    setLoading(true);
    try {
      const response = await api.get('/user/export/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'amadeus_collection.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Insurance & Exports</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Protect your collection by generating ownership reports.</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-800">
              <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 mb-6">
                <Shield className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold mb-4">Why export?</h2>
              <ul className="space-y-3 text-gray-600 dark:text-gray-400 text-sm">
                <li className="flex items-start gap-2">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span>Proof of ownership for insurance companies in case of loss or damage.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span>Offline backup of your entire catalog.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span>Migrate your data to other platforms easily.</span>
                </li>
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-sm border border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-bold mb-6">Available Formats</h2>
              
              <div className="space-y-4">
                <button 
                  onClick={handleExportCSV}
                  disabled={loading}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-amadeus-500 hover:bg-amadeus-50/30 transition group"
                >
                  <div className="flex items-center gap-4">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    <div className="text-left">
                      <p className="font-bold">Excel / CSV Report</p>
                      <p className="text-xs text-gray-500">Best for value calculation and spreadsheets.</p>
                    </div>
                  </div>
                  <Download className="h-5 w-5 text-gray-300 group-hover:text-amadeus-500" />
                </button>

                <div className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-800 opacity-50 cursor-not-allowed">
                  <div className="flex items-center gap-4">
                    <FileText className="h-8 w-8 text-red-600" />
                    <div className="text-left">
                      <p className="font-bold">PDF Insurance Certificate</p>
                      <p className="text-xs text-gray-500">Official document with cover art. (Coming Soon)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 rounded-lg flex gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 shrink-0" />
                <p className="text-xs text-orange-800 dark:text-orange-400">
                  Ensure you have added "Purchase Price" and "Condition" to your items for the most accurate insurance reports.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

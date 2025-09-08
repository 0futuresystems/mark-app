import Link from "next/link";
import { Plus, Eye, Send } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lot Logger</h1>
            <p className="text-gray-600 mt-1">Track and manage your lots</p>
          </div>
          <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-lg">M</span>
          </div>
        </div>

        {/* Main Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link 
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
            href="/new"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">New Entry</h3>
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-gray-600 text-sm">Create a new lot entry with photos and voice notes</p>
          </Link>
          
          <Link 
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
            href="/review"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Review Data</h3>
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Eye className="w-4 h-4 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-600 text-sm">Review and manage your existing lot entries</p>
          </Link>
          
          <Link 
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
            href="/send"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Send Data</h3>
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Send className="w-4 h-4 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-600 text-sm">Upload and send your lot data</p>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-sm text-gray-600">Total Lots</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-sm text-gray-600">Draft</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-sm text-gray-600">Complete</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-sm text-gray-600">Sent</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
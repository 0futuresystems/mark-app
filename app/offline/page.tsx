import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 px-8 py-8 text-center flex flex-col justify-center items-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Offline
      </h1>
      <p className="text-lg mb-12 max-w-md leading-relaxed text-gray-600">
        Your changes are saved locally and will sync when you reopen this app online.
      </p>
      <Link 
        href="/" 
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        Go Home
      </Link>
    </div>
  );
}

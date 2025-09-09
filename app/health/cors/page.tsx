'use client';

import { useState, useEffect } from 'react';

export default function CorsHealthPage() {
  const [origin, setOrigin] = useState<string>('');
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const testCorsPreflight = async () => {
    setTestResult({ status: 'testing', message: 'Testing CORS preflight...' });

    try {
      // Test PUT preflight request to R2 endpoint
      const response = await fetch('https://4337fa30a027bf47fb94b823c1f66037.r2.cloudflarestorage.com', {
        method: 'PUT',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: new Blob([]),
      });

      // Note: This will likely fail with 403/404 since we're not actually uploading,
      // but the important part is whether the CORS preflight succeeds
      if (response.ok || response.status === 403 || response.status === 404) {
        setTestResult({
          status: 'success',
          message: 'CORS preflight successful! The origin is allowed.',
        });
      } else {
        setTestResult({
          status: 'error',
          message: `CORS preflight failed with status: ${response.status}`,
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('CORS')) {
          setTestResult({
            status: 'error',
            message: 'CORS preflight failed: Origin not allowed in R2 CORS configuration.',
          });
        } else {
          setTestResult({
            status: 'error',
            message: `Network error: ${error.message}`,
          });
        }
      } else {
        setTestResult({
          status: 'error',
          message: 'Unknown error occurred during CORS test.',
        });
      }
    }
  };

  // Only render in development
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Not Found</h1>
          <p className="text-gray-600 mt-2">This page is only available in development mode.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">CORS Health Check</h1>
          
          <div className="space-y-6">
            {/* Current Origin */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Current Origin</h2>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <code className="text-sm font-mono text-gray-800">{origin || 'Loading...'}</code>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                R2 CORS AllowedOrigins must include the origin above
              </p>
            </div>

            {/* CORS Test */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">CORS Preflight Test</h2>
              <button
                onClick={testCorsPreflight}
                disabled={testResult.status === 'testing'}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {testResult.status === 'testing' ? 'Testing...' : 'Test PUT Preflight'}
              </button>
            </div>

            {/* Test Result */}
            {testResult.status !== 'idle' && (
              <div>
                <h3 className="text-md font-semibold text-gray-900 mb-2">Test Result</h3>
                <div
                  className={`rounded-lg p-4 border ${
                    testResult.status === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : testResult.status === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}
                >
                  <p className="text-sm font-medium">{testResult.message}</p>
                </div>
              </div>
            )}

            {/* Additional Info */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-md font-semibold text-gray-900 mb-2">About This Test</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• This test sends a PUT request to the R2 endpoint to check CORS configuration</li>
                <li>• A successful preflight means your origin is allowed in R2 CORS settings</li>
                <li>• A failed preflight means you need to add your origin to R2 CORS AllowedOrigins</li>
                <li>• The actual upload will fail (403/404) but CORS preflight is what matters</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

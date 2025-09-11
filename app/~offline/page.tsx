'use client'

export default function OfflinePage() {
  return (
    <main className="p-6 text-center space-y-4">
      <h1 className="text-xl font-semibold">You're offline</h1>
      <p className="text-sm opacity-70">
        The app shell is available. Any cached lots, photos, and notes will still show.
      </p>
      <button
        className="px-4 py-2 rounded-lg border"
        onClick={() => location.reload()}
      >
        Try again
      </button>
    </main>
  )
}

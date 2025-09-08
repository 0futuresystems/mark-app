import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div style={{ 
      padding: '2rem', 
      textAlign: 'center', 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem', color: '#0b132b' }}>
        Offline
      </h1>
      <p style={{ 
        fontSize: '1.2rem', 
        marginBottom: '3rem', 
        maxWidth: '400px',
        lineHeight: '1.5',
        color: '#666'
      }}>
        Your changes are saved locally and will sync when you reopen this app online.
      </p>
      <Link href="/" className="btn">
        Go Home
      </Link>
    </div>
  );
}

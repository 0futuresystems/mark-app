export default function Home() {
  return (
    <div style={{ padding: '2rem', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{ marginBottom: '3rem', fontSize: '2rem', textAlign: 'center' }}>Lot Logger</h1>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '300px' }}>
        <a href="/new" className="btn">
          New Entry
        </a>
        <a href="/review" className="btn">
          Review Data
        </a>
        <a href="/send" className="btn">
          Send Data
        </a>
      </div>
    </div>
  );
}

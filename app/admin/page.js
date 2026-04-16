'use client';
import { useState, useEffect } from 'react';

export default function AdminPage() {
  const [ready, setReady] = useState(false);

  useEffect(function() {
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#fff', padding: 40, color: '#000' }}>
      <h1>FUNCIONOU!</h1>
      <p>Se você está vendo isso, o admin está OK.</p>
      <button onClick={function() { localStorage.clear(); window.location.href = '/login'; }} style={{ padding: 10, marginTop: 20 }}>Sair</button>
    </div>
  );
}

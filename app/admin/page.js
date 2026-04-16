'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(function() {
    var id = localStorage.getItem('affiliate_id');
    if (!id) { router.push('/login'); return; }
    check(id);
  }, []);

  async function check(id) {
    var r = await supabase.from('affiliates').select('is_admin, name').eq('id', id).single();
    if (!r.data || !r.data.is_admin) { router.push('/login'); return; }
    setIsAdmin(true);
    setLoading(false);
  }

  if (loading) return (<div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</div>);

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', padding: 40 }}>
      <h1>Dashboard Admin</h1>
      <p>Funcionou! Esta e a versao basica. Vamos adicionar funcionalidades aos poucos.</p>
      <button onClick={function() { localStorage.clear(); router.push('/login'); }} style={{ marginTop: 20, padding: 10 }}>Sair</button>
    </div>
  );
}

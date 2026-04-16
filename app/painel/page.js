'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function PainelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [affiliate, setAffiliate] = useState(null);

  useEffect(function() {
    var id = localStorage.getItem('affiliate_id');
    if (!id) { router.push('/login'); return; }
    loadData(id);
  }, []);

  async function loadData(affiliateId) {
    var check = await supabase.from('affiliates').select('is_admin, name, coupon_code, avatar_initials').eq('id', affiliateId).single();
    if (!check.data) { router.push('/login'); return; }
    if (check.data.is_admin) { router.push('/admin'); return; }
    setAffiliate(check.data);
    setLoading(false);
  }

  function handleLogout() { localStorage.clear(); router.push('/login'); }

  if (loading) return (<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0520' }}><div style={{ fontSize: 40 }}>💎</div></div>);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', padding: 20, color: '#fff' }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>💎</div>
        <h1 style={{ color: '#FFD700', marginBottom: 8 }}>Ola, {affiliate && affiliate.name}!</h1>
        <p style={{ color: '#888' }}>Cupom: {affiliate && affiliate.coupon_code}</p>
        <p style={{ color: '#888', marginTop: 20 }}>Painel em manutencao. Volta em breve!</p>
        <button onClick={handleLogout} style={{ marginTop: 40, padding: '10px 20px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>Sair</button>
      </div>
    </div>
  );
}

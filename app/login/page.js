'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const [coupon, setCoupon] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true);
    setError('');
    var result = await supabase.from('affiliates').select('id, name, coupon_code, password_hash, is_admin').ilike('coupon_code', coupon.trim()).single();
    if (result.error || !result.data) { setError('Cupom nao encontrado.'); setLoading(false); return; }
    if (result.data.password_hash && result.data.password_hash !== password) { setError('Senha incorreta.'); setLoading(false); return; }
    localStorage.setItem('affiliate_id', result.data.id);
    localStorage.setItem('affiliate_name', result.data.name);
    localStorage.setItem('affiliate_coupon', result.data.coupon_code);
    if (result.data.is_admin) { router.push('/admin'); } else { router.push('/painel'); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(135deg, #0f0520, #1a0a2e)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ fontSize: 50, marginBottom: 16 }}>💎</div>
          <h1 style={{ color: '#FFD700', fontSize: 24 }}>Painel de Afiliados</h1>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 30 }}>
          <input type="text" value={coupon} onChange={function(e) { setCoupon(e.target.value.toUpperCase()); }} placeholder="CUPOM" style={{ width: '100%', padding: 14, background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,215,0,0.2)', borderRadius: 12, color: '#FFD700', fontSize: 18, textAlign: 'center', outline: 'none', marginBottom: 14, fontWeight: 800 }} />
          <input type="password" inputMode="numeric" value={password} onChange={function(e) { setPassword(e.target.value.replace(/[^0-9]/g, '').substring(0, 6)); }} placeholder="000000" maxLength={6} style={{ width: '100%', padding: 14, background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,215,0,0.2)', borderRadius: 12, color: '#FFD700', fontSize: 24, textAlign: 'center', letterSpacing: 6, outline: 'none', fontWeight: 800 }} />
          {error && (<div style={{ marginTop: 12, padding: 10, background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 8, color: '#ff6b6b', fontSize: 13, textAlign: 'center' }}>{error}</div>)}
          <button onClick={handleLogin} disabled={loading || !coupon.trim()} style={{ width: '100%', padding: 14, marginTop: 16, background: 'linear-gradient(135deg, #FFD700, #FFA500)', border: 'none', borderRadius: 12, color: '#1a0a2e', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </div>
      </div>
    </div>
  );
}

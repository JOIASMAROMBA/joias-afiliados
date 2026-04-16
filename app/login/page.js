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

  const handleLogin = async function() {
    setLoading(true);
    setError('');
    var result = await supabase.from('affiliates').select('id, name, coupon_code, password_hash').ilike('coupon_code', coupon.trim()).single();
    if (result.error || !result.data) { setError('Cupom nao encontrado.'); setLoading(false); return; }
    if (result.data.password_hash && result.data.password_hash !== password) { setError('Senha incorreta.'); setLoading(false); return; }
    localStorage.setItem('affiliate_id', result.data.id);
    localStorage.setItem('affiliate_name', result.data.name);
    localStorage.setItem('affiliate_coupon', result.data.coupon_code);
    router.push('/painel');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(135deg, #0f0520 0%, #1a0a2e 40%, #0d0a1a 100%)' }}>
      <div style={{ width: '100%', maxWidth: 400, animation: 'slideUp 0.5s ease-out' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 50, marginBottom: 16, animation: 'float 3s ease-in-out infinite' }}>💎</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 800, background: 'linear-gradient(90deg, #FFD700, #FFA500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>Painel de Afiliados</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Divulgue e ganhe R$30 por peca vendida</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32 }}>
          <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600 }}>Seu cupom</label>
          <input type="text" value={coupon} onChange={function(e) { setCoupon(e.target.value.toUpperCase()); }} placeholder="Ex: CAMILA15" style={{ width: '100%', padding: '14px 20px', background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,215,0,0.2)', borderRadius: 14, color: '#FFD700', fontSize: 18, fontWeight: 800, textAlign: 'center', letterSpacing: 2, outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }} />
          <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600 }}>Senha (6 numeros)</label>
          <input type="password" inputMode="numeric" value={password} onChange={function(e) { setPassword(e.target.value.replace(/[^0-9]/g, '').substring(0, 6)); }} placeholder="000000" maxLength={6} style={{ width: '100%', padding: '14px 20px', background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,215,0,0.2)', borderRadius: 14, color: '#FFD700', fontSize: 24, fontWeight: 800, textAlign: 'center', letterSpacing: 6, outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
          {error && (<div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 10, color: '#ff6b6b', fontSize: 13, textAlign: 'center' }}>{error}</div>)}
          <button onClick={handleLogin} disabled={loading || !coupon.trim()} style={{ width: '100%', padding: 16, marginTop: 20, background: coupon.trim() ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 14, color: coupon.trim() ? '#1a0a2e' : 'rgba(255,255,255,0.3)', fontWeight: 800, fontSize: 16, cursor: coupon.trim() ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans', sans-serif", boxShadow: coupon.trim() ? '0 4px 20px rgba(255,215,0,0.3)' : 'none' }}>{loading ? 'Entrando...' : 'Entrar no Painel'}</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          Ainda nao tem cupom?{' '}<span onClick={function() { router.push('/cadastro'); }} style={{ color: '#FFD700', cursor: 'pointer', fontWeight: 600 }}>Quero ser afiliado(a)</span>
        </div>
      </div>
    </div>
  );
}

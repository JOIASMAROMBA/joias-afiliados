'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [coupon, setCoupon] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon: coupon.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const map = {
          invalid_credentials: 'Cupom ou senha incorretos.',
          blocked: 'Conta bloqueada. Contate o suporte.',
          no_password_set: 'Senha nao cadastrada. Faca o cadastro primeiro.',
          missing_fields: 'Preencha cupom e senha.',
        };
        setError(map[data.error] || 'Erro ao entrar. Tente novamente.');
        setLoading(false);
        return;
      }
      localStorage.setItem('affiliate_id', data.affiliate.id);
      localStorage.setItem('affiliate_name', data.affiliate.name);
      localStorage.setItem('affiliate_coupon', data.affiliate.coupon_code);
      if (data.affiliate.is_admin) router.push('/admin');
      else router.push('/painel');
    } catch (err) {
      setError('Erro de conexao. Tente novamente.');
      setLoading(false);
    }
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

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EsqueciSenhaPage() {
  const router = useRouter();
  const [coupon, setCoupon] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (!coupon.trim() || !email.trim()) { setMessage('Preencha cupom e email.'); return; }
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon: coupon.trim(), email: email.trim() }),
      });
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok || !data.ok) {
        const map = {
          not_found: 'Cupom + email nao encontrados. Verifique os dados.',
          rate_limited: 'Muitos pedidos. Tente novamente em alguns minutos.',
        };
        setMessage(map[data.error] || 'Erro. Tente novamente.');
        setLoading(false);
        return;
      }
      setSuccess(true);
    } catch (err) {
      setMessage('Erro de conexao. Tente novamente.');
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(135deg, #0f0520, #1a0a2e)' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ fontSize: 50, marginBottom: 16 }}>🔑</div>
          <h1 style={{ color: '#FFD700', fontSize: 22, marginBottom: 8 }}>Esqueci minha senha</h1>
          <div style={{ color: 'rgba(255,215,0,0.6)', fontSize: 13 }}>Informe seu cupom e email cadastrado</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 30 }}>
          {!success ? (
            <>
              <input type="text" value={coupon} onChange={function(e) { setCoupon(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); }} placeholder="CUPOM" style={{ width: '100%', padding: 14, background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,215,0,0.2)', borderRadius: 12, color: '#FFD700', fontSize: 16, textAlign: 'center', outline: 'none', marginBottom: 12, fontWeight: 800 }} />
              <input type="email" value={email} onChange={function(e) { setEmail(e.target.value); }} placeholder="seu@email.com" style={{ width: '100%', padding: 14, background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,215,0,0.2)', borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none' }} />
              {message && (<div style={{ marginTop: 12, padding: 10, background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 8, color: '#ff6b6b', fontSize: 13, textAlign: 'center' }}>{message}</div>)}
              <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: 14, marginTop: 16, background: 'linear-gradient(135deg, #FFD700, #FFA500)', border: 'none', borderRadius: 12, color: '#1a0a2e', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>{loading ? 'Enviando...' : 'Solicitar Reset'}</button>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#fff' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 15, marginBottom: 8, fontWeight: 700 }}>Email enviado!</div>
              <div style={{ fontSize: 13, color: 'rgba(255,215,0,0.7)', lineHeight: 1.5 }}>Em poucos minutos voce vai receber uma senha provisoria no seu email. Entra no painel com ela e depois troque em Editar Perfil.</div>
            </div>
          )}
          <div style={{ marginTop: 18, textAlign: 'center' }}>
            <button onClick={function() { router.push('/login'); }} style={{ background: 'transparent', border: 'none', color: 'rgba(255,215,0,0.7)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Voltar para login</button>
          </div>
        </div>
      </div>
    </div>
  );
}

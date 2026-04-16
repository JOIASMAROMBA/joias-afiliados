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
  const [couponFocused, setCouponFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

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
      if (data.email_sent === false) {
        setMessage(data.email_error ? 'Email nao saiu: ' + data.email_error : 'Email nao configurado. Avise o admin.');
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
    <div style={{ minHeight: '100vh', background: '#000', position: 'relative', overflow: 'hidden', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'SF Pro Display', sans-serif" }}>
      <style>{`
        @keyframes gridPulse { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.3; } }
        @keyframes goldGlow { 0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.1); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        input.premium::placeholder { color: rgba(255,255,255,0.25); font-weight: 400; letter-spacing: normal; }
        input.premium:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px rgba(20,20,20,0.8) inset !important; -webkit-text-fill-color: #fff !important; transition: background-color 9999s ease-out; }
      `}</style>

      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(201,169,97,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,97,0.06) 1px, transparent 1px)', backgroundSize: '60px 60px', animation: 'gridPulse 4s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,169,97,0.12) 0%, transparent 70%)', transform: 'translate(-50%, -50%)', animation: 'goldGlow 6s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top, rgba(0,0,0,0) 0%, #000 80%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 2, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 420, animation: 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, rgba(201,169,97,0.15), rgba(201,169,97,0.02))', border: '1px solid rgba(201,169,97,0.25)', marginBottom: 24, backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(201,169,97,0.08), inset 0 1px 0 rgba(255,255,255,0.1)', fontSize: 28 }}>
              <span style={{ filter: 'drop-shadow(0 0 8px rgba(201,169,97,0.5))' }}>✦</span>
            </div>
            <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, letterSpacing: -0.3, margin: 0, marginBottom: 8 }}>Recuperar senha</h1>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', letterSpacing: 1, fontWeight: 500 }}>Informe seu cupom e email cadastrado</div>
          </div>

          <div style={{ background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
            {!success ? (
              <>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: couponFocused ? '#C9A961' : 'rgba(255,255,255,0.4)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, transition: 'color 0.3s' }}>Cupom</label>
                  <input type="text" className="premium" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onFocus={() => setCouponFocused(true)} onBlur={() => setCouponFocused(false)} placeholder="SEU_CUPOM" style={{ width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid ' + (couponFocused ? 'rgba(201,169,97,0.5)' : 'rgba(255,255,255,0.1)'), borderRadius: 10, color: '#fff', fontSize: 16, fontWeight: 600, letterSpacing: 1, outline: 'none', transition: 'all 0.3s', boxShadow: couponFocused ? '0 0 0 4px rgba(201,169,97,0.08)' : 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: emailFocused ? '#C9A961' : 'rgba(255,255,255,0.4)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, transition: 'color 0.3s' }}>Email cadastrado</label>
                  <input type="email" className="premium" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={() => setEmailFocused(true)} onBlur={() => setEmailFocused(false)} placeholder="seu@email.com" style={{ width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid ' + (emailFocused ? 'rgba(201,169,97,0.5)' : 'rgba(255,255,255,0.1)'), borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 500, outline: 'none', transition: 'all 0.3s', boxShadow: emailFocused ? '0 0 0 4px rgba(201,169,97,0.08)' : 'none', boxSizing: 'border-box' }} />
                </div>
                {message && (<div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.2)', borderRadius: 8, color: '#ff6b6b', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 16 }}>⚠</span>{message}</div>)}
                <button onClick={handleSubmit} disabled={loading || !coupon.trim() || !email.trim()} style={{ width: '100%', padding: '15px 24px', background: (loading || !coupon.trim() || !email.trim()) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #E8CF8B 0%, #C9A961 50%, #8B6914 100%)', border: '1px solid ' + ((loading || !coupon.trim() || !email.trim()) ? 'rgba(255,255,255,0.08)' : 'rgba(201,169,97,0.6)'), borderRadius: 10, color: (loading || !coupon.trim() || !email.trim()) ? 'rgba(255,255,255,0.3)' : '#1a1306', fontWeight: 700, fontSize: 15, letterSpacing: 0.5, cursor: (loading || !coupon.trim() || !email.trim()) ? 'not-allowed' : 'pointer', transition: 'all 0.3s', boxShadow: (loading || !coupon.trim() || !email.trim()) ? 'none' : '0 8px 24px rgba(201,169,97,0.3), inset 0 1px 0 rgba(255,255,255,0.35)' }}>{loading ? 'Enviando...' : 'Enviar senha provisória'}</button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 16, filter: 'drop-shadow(0 0 20px rgba(201,169,97,0.5))' }}>✓</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Email enviado</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>Em alguns minutos você recebe uma senha provisória no seu email. Acesse o painel e troque em Editar Perfil.</div>
              </div>
            )}
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', padding: 4, transition: 'color 0.3s' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#C9A961'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}>← Voltar para login</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

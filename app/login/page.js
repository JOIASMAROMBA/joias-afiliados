'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [coupon, setCoupon] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [couponFocused, setCouponFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [adminCodeStep, setAdminCodeStep] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminEmailHint, setAdminEmailHint] = useState('');
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
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok || !data.ok) {
        const retryMin = data.retry_in ? Math.ceil(data.retry_in / 60) : 5;
        const map = {
          invalid_credentials: 'Cupom ou senha incorretos.',
          blocked: '⛔ Você foi BANIDA da plataforma por violação dos Termos de Conduta. O banimento é definitivo.',
          no_password_set: 'Senha nao cadastrada. Faca o cadastro primeiro.',
          missing_fields: 'Preencha cupom e senha.',
          rate_limited: 'Muitas tentativas. Aguarde ' + retryMin + ' min.',
          server_misconfigured: 'Servidor mal configurado. Avise o admin.',
          email_not_configured: 'Email admin nao configurado. Contate suporte.',
          db_error: 'Erro no banco: ' + (data.detail || ''),
          unexpected: 'Erro inesperado: ' + (data.detail || ''),
        };
        setError(map[data.error] || ('Erro ' + res.status + ': ' + (data.error || 'desconhecido')));
        setLoading(false);
        return;
      }
      if (data.requires_admin_code) {
        setAdminEmailHint(data.admin_email_hint || '');
        setAdminCodeStep(true);
        setAdminCode('');
        if (data.email_sent === false) {
          setError('Servidor enviou o codigo, mas email FALHOU: ' + (data.email_error || 'motivo desconhecido'));
        } else {
          setError('');
        }
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

  async function handleVerifyAdminCode() {
    if (!/^\d{6}$/.test(adminCode)) { setError('Digite o codigo de 6 digitos.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/admin-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon: coupon.trim(), code: adminCode.trim() }),
      });
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok || !data.ok) {
        const map = {
          invalid_credentials: 'Sessao invalida, faca login novamente.',
          invalid_code: 'Codigo invalido.',
          no_active_code: 'Codigo nao encontrado, faca login novamente.',
          code_expired: 'Codigo expirou, faca login novamente.',
          wrong_code: 'Codigo incorreto.',
          too_many_attempts: 'Muitas tentativas. Faca login novamente.',
          rate_limited: 'Muitas tentativas. Aguarde alguns minutos.',
        };
        setError(map[data.error] || ('Erro: ' + (data.error || 'desconhecido')));
        setLoading(false);
        return;
      }
      localStorage.setItem('affiliate_id', data.affiliate.id);
      localStorage.setItem('affiliate_name', data.affiliate.name);
      localStorage.setItem('affiliate_coupon', data.affiliate.coupon_code);
      router.push('/admin');
    } catch (err) {
      setError('Erro de conexao. Tente novamente.');
      setLoading(false);
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) {
      if (adminCodeStep) { if (/^\d{6}$/.test(adminCode)) handleVerifyAdminCode(); }
      else if (coupon.trim() && password.length >= 6) handleLogin();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'SF Pro Display', sans-serif",
    }}>
      <style>{`
        @keyframes gridPulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.3; }
        }
        @keyframes goldGlow {
          0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes saibaMaisPulse {
          0%, 100% { transform: scale(1); opacity: 0.85; text-shadow: 0 0 12px rgba(201,169,97,0.4); }
          50% { transform: scale(1.08); opacity: 1; text-shadow: 0 0 24px rgba(201,169,97,0.7); }
        }
        input.premium::placeholder {
          color: rgba(255, 255, 255, 0.25);
          font-weight: 400;
          letter-spacing: normal;
        }
        input.premium:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px rgba(20, 20, 20, 0.8) inset !important;
          -webkit-text-fill-color: #fff !important;
          transition: background-color 9999s ease-out;
        }
      `}</style>

      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'linear-gradient(rgba(255,215,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.06) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        animation: 'gridPulse 4s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: 500, height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,215,0,0.12) 0%, transparent 70%)',
        transform: 'translate(-50%, -50%)',
        animation: 'goldGlow 6s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(ellipse at top, rgba(0,0,0,0) 0%, #000 80%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        zIndex: 2,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          width: '100%',
          maxWidth: 420,
          animation: 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 140, height: 140,
              marginBottom: 8,
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(201,169,97,0.18) 0%, transparent 70%)',
                filter: 'blur(20px)',
              }} />
              <img
                src="/logo.png"
                alt="Joias Maromba"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  opacity: 0.92,
                  filter: 'drop-shadow(0 4px 20px rgba(201,169,97,0.35)) drop-shadow(0 0 40px rgba(201,169,97,0.15))',
                  position: 'relative',
                  zIndex: 1,
                }}
              />
            </div>
            <div style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: 3,
              textTransform: 'uppercase',
              fontWeight: 500,
              marginTop: 4,
            }}>
              Área de Afiliados
            </div>
            <button
              onClick={() => router.push('/como-funciona')}
              style={{
                marginTop: 14,
                background: 'none',
                border: 'none',
                color: '#C9A961',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: 'uppercase',
                cursor: 'pointer',
                padding: 6,
                textShadow: '0 0 12px rgba(201,169,97,0.4)',
                animation: 'saibaMaisPulse 1.5s ease-in-out infinite',
                display: 'inline-block',
              }}
            >
              Saiba mais
            </button>
          </div>

          <div style={{
            background: 'rgba(15, 15, 15, 0.6)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 32,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            {adminCodeStep && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                  <div style={{ fontSize: 34 }}>🔐</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#C9A961', marginTop: 4, letterSpacing: 1 }}>Confirmação em 2 etapas</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>Acesso ao painel admin</div>
                </div>
                <div style={{ padding: 12, background: 'rgba(201,169,97,0.08)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: '#C9A961', fontWeight: 700, marginBottom: 4 }}>📧 Código enviado para</div>
                  <div style={{ fontSize: 13, color: '#fff', fontFamily: 'monospace' }}>{adminEmailHint || 'seu email'}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>Digite o código de 6 dígitos. Expira em 10 min.</div>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={handleKeyDown}
                  placeholder="000000"
                  autoFocus
                  style={{ width: '100%', padding: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,169,97,0.4)', borderRadius: 10, color: '#C9A961', fontSize: 26, fontWeight: 900, outline: 'none', textAlign: 'center', letterSpacing: 10, marginBottom: 14, boxSizing: 'border-box' }}
                />
                {error && (<div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.2)', borderRadius: 8, color: '#ff6b6b', fontSize: 13 }}>⚠ {error}</div>)}
                <button
                  onClick={handleVerifyAdminCode}
                  disabled={loading}
                  style={{ width: '100%', padding: '15px 24px', background: 'linear-gradient(135deg, #E8CF8B 0%, #C9A961 50%, #8B6914 100%)', border: '1px solid rgba(201,169,97,0.6)', borderRadius: 10, color: '#1a1306', fontWeight: 700, fontSize: 15, letterSpacing: 0.5, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, marginBottom: 10 }}
                >{loading ? 'Confirmando...' : 'Confirmar e Entrar'}</button>
                <button
                  onClick={() => { setAdminCodeStep(false); setAdminCode(''); setError(''); }}
                  style={{ width: '100%', padding: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer' }}
                >← Voltar</button>
              </div>
            )}

            {!adminCodeStep && (<>
            <div style={{ marginBottom: 18 }}>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: couponFocused ? '#FFD700' : 'rgba(255,255,255,0.4)',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                marginBottom: 8,
                transition: 'color 0.3s',
              }}>
                Cupom
              </label>
              <input
                type="text"
                className="premium"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                onFocus={() => setCouponFocused(true)}
                onBlur={() => setCouponFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="SEU_CUPOM"
                autoComplete="username"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid ' + (couponFocused ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.1)'),
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: 1,
                  outline: 'none',
                  transition: 'all 0.3s',
                  boxShadow: couponFocused ? '0 0 0 4px rgba(255,215,0,0.08)' : 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: passwordFocused ? '#FFD700' : 'rgba(255,255,255,0.4)',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                marginBottom: 8,
                transition: 'color 0.3s',
              }}>
                Senha
              </label>
              <input
                type="password"
                className="premium"
                inputMode="numeric"
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/[^0-9]/g, '').substring(0, 10))}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="••••••"
                maxLength={10}
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid ' + (passwordFocused ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.1)'),
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: password ? 8 : 1,
                  outline: 'none',
                  transition: 'all 0.3s',
                  boxShadow: passwordFocused ? '0 0 0 4px rgba(255,215,0,0.08)' : 'none',
                  boxSizing: 'border-box',
                  textAlign: password ? 'center' : 'left',
                }}
              />
            </div>

            {error && (
              <div style={{
                marginBottom: 16,
                padding: '10px 14px',
                background: 'rgba(255, 60, 60, 0.08)',
                border: '1px solid rgba(255, 60, 60, 0.2)',
                borderRadius: 8,
                color: '#ff6b6b',
                fontSize: 13,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>⚠</span>
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px 24px',
                background: 'linear-gradient(135deg, #E8CF8B 0%, #C9A961 50%, #8B6914 100%)',
                border: '1px solid rgba(201,169,97,0.6)',
                borderRadius: 10,
                color: '#1a1306',
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: 0.5,
                cursor: loading ? 'wait' : 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 8px 24px rgba(201,169,97,0.3), inset 0 1px 0 rgba(255,255,255,0.35)',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <div style={{
              marginTop: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>ou</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <button
              onClick={() => router.push('/cadastro')}
              style={{
                width: '100%',
                padding: '13px 24px',
                marginTop: 16,
                background: 'rgba(255,215,0,0.04)',
                border: '1px solid rgba(255,215,0,0.2)',
                borderRadius: 12,
                color: '#FFD700',
                fontWeight: 600,
                fontSize: 14,
                letterSpacing: 0.3,
                cursor: 'pointer',
                transition: 'all 0.3s',
                backdropFilter: 'blur(10px)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,215,0,0.1)';
                e.currentTarget.style.borderColor = 'rgba(255,215,0,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,215,0,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,215,0,0.2)';
              }}
            >
              Criar Conta
            </button>

            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <button
                onClick={() => router.push('/esqueci-senha')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: 4,
                  transition: 'color 0.3s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#FFD700'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
              >
                Esqueci minha senha
              </button>
            </div>
            </>)}
          </div>

          <div style={{
            textAlign: 'center',
            marginTop: 32,
            fontSize: 11,
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: 1,
          }}>
            <span style={{ marginRight: 6 }}>🔒</span>
            Conexão segura · SSL · bcrypt
          </div>
        </div>
      </div>
    </div>
  );
}

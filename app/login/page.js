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
          blocked: 'Conta bloqueada. Contate o suporte.',
          no_password_set: 'Senha nao cadastrada. Faca o cadastro primeiro.',
          missing_fields: 'Preencha cupom e senha.',
          rate_limited: 'Muitas tentativas. Aguarde ' + retryMin + ' min.',
          server_misconfigured: 'Servidor mal configurado. Avise o admin.',
          db_error: 'Erro no banco: ' + (data.detail || ''),
          unexpected: 'Erro inesperado: ' + (data.detail || ''),
        };
        setError(map[data.error] || ('Erro ' + res.status + ': ' + (data.error || 'desconhecido')));
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && coupon.trim() && password.length === 6 && !loading) {
      handleLogin();
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
              width: 64, height: 64,
              borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.02))',
              border: '1px solid rgba(255,215,0,0.25)',
              marginBottom: 24,
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(255,215,0,0.08), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}>
              <div style={{ fontSize: 28, filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.5))' }}>◆</div>
            </div>
            <h1 style={{
              color: '#fff',
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: -0.5,
              margin: 0,
              marginBottom: 8,
            }}>
              Joias Maromba
            </h1>
            <div style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: 2,
              textTransform: 'uppercase',
              fontWeight: 500,
            }}>
              Área de Afiliados
            </div>
          </div>

          <div style={{
            background: 'rgba(15, 15, 15, 0.6)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
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
                  borderRadius: 12,
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
                onChange={(e) => setPassword(e.target.value.replace(/[^0-9]/g, '').substring(0, 6))}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="••••••"
                maxLength={6}
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid ' + (passwordFocused ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.1)'),
                  borderRadius: 12,
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
                borderRadius: 10,
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
              disabled={loading || !coupon.trim() || password.length !== 6}
              style={{
                width: '100%',
                padding: '15px 24px',
                background: (loading || !coupon.trim() || password.length !== 6)
                  ? 'rgba(255,255,255,0.05)'
                  : 'linear-gradient(135deg, #FFD700 0%, #DAA520 100%)',
                border: '1px solid ' + ((loading || !coupon.trim() || password.length !== 6) ? 'rgba(255,255,255,0.08)' : 'rgba(255,215,0,0.5)'),
                borderRadius: 12,
                color: (loading || !coupon.trim() || password.length !== 6) ? 'rgba(255,255,255,0.3)' : '#000',
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: 0.5,
                cursor: (loading || !coupon.trim() || password.length !== 6) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                boxShadow: (loading || !coupon.trim() || password.length !== 6)
                  ? 'none'
                  : '0 8px 24px rgba(255,215,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)',
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

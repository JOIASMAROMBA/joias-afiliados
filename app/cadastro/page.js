'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CadastroPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [couponStatus, setCouponStatus] = useState('');
  const [couponChecking, setCouponChecking] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [form, setForm] = useState({ name: '', age: '', city: '', email: '', platforms: [], instagram: '', facebook: '', tiktok: '', outro: '', coupon: '', password: '', passwordConfirm: '', agreedCommission: false });
  const [showTerms, setShowTerms] = useState(false);

  const handleChange = (field, value) => {
    if (field === 'coupon') { value = value.toUpperCase().replace(/[^A-Z0-9]/g, ''); setCouponStatus(''); }
    if (field === 'password' || field === 'passwordConfirm') { value = value.replace(/[^0-9]/g, '').substring(0, 6); }
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const togglePlatform = (platform) => {
    setForm(prev => ({ ...prev, platforms: prev.platforms.includes(platform) ? prev.platforms.filter(p => p !== platform) : [...prev.platforms, platform] }));
  };

  const checkCoupon = async () => {
    if (form.coupon.length < 3) { setCouponStatus('min'); return; }
    setCouponChecking(true);
    try {
      const res = await fetch('/api/auth/check-coupon?coupon=' + encodeURIComponent(form.coupon.trim()));
      const data = await res.json();
      setCouponStatus(data.available ? 'available' : 'taken');
    } catch { setCouponStatus(''); }
    setCouponChecking(false);
  };

  useEffect(() => {
    if (form.coupon.length >= 3) {
      const timer = setTimeout(() => checkCoupon(), 600);
      return () => clearTimeout(timer);
    } else { setCouponStatus(''); }
  }, [form.coupon]);

  const validateStep1 = () => {
    if (!form.name.trim()) return 'Preencha seu nome.';
    if (!form.age.trim()) return 'Preencha sua idade.';
    if (!form.city.trim()) return 'Preencha sua cidade.';
    if (!form.email.trim()) return 'Preencha seu e-mail.';
    if (!form.email.includes('@')) return 'E-mail invalido.';
    if (form.platforms.length === 0) return 'Selecione pelo menos uma rede social.';
    var hasHandle = false;
    form.platforms.forEach(function(p) { if (form[p.toLowerCase()] && form[p.toLowerCase()].trim()) hasHandle = true; });
    if (!hasHandle) return 'Preencha pelo menos um @ ou nickname.';
    if (form.coupon.length < 3) return 'O cupom precisa ter pelo menos 3 caracteres.';
    if (couponStatus !== 'available') return 'Verifique se o cupom esta disponivel.';
    if (!form.agreedCommission) return 'Aceite os termos de comissao.';
    return null;
  };

  const handleStep1Submit = async () => {
    var err = validateStep1();
    if (err) { setError(err); return; }
    setError('');
    setShowTicket(true);
  };

  const handleTicketClose = () => { setShowTicket(false); setStep(2); };

  const handleCreatePassword = async () => {
    if (form.password.length !== 6) { setError('A senha precisa ter 6 numeros.'); return; }
    if (form.password !== form.passwordConfirm) { setError('As senhas nao conferem.'); return; }
    setError('');
    setLoading(true);
    try {
      const social = {};
      if (form.instagram) social.instagram = form.instagram;
      if (form.facebook) social.facebook = form.facebook;
      if (form.tiktok) social.tiktok = form.tiktok;
      if (form.outro) social.outro = form.outro;
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), coupon: form.coupon.trim(), password: form.password, age: form.age, city: form.city, platforms: form.platforms, social }),
      });
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok || !data.ok) {
        const map = { coupon_taken: 'Esse cupom ja foi usado.', email_taken: 'Esse e-mail ja esta cadastrado.', invalid_name: 'Nome invalido.', invalid_email: 'E-mail invalido.', invalid_coupon: 'Cupom invalido.', invalid_password: 'Senha deve ter 6 digitos.', rate_limited: 'Muitas tentativas. Aguarde.' };
        setError(map[data.error] || 'Erro ao cadastrar.');
        setLoading(false);
        return;
      }
      localStorage.setItem('affiliate_id', data.affiliate.id);
      localStorage.setItem('affiliate_name', data.affiliate.name);
      localStorage.setItem('affiliate_coupon', data.affiliate.coupon_code);
      setLoading(false);
      setShowWelcome(true);
      setTimeout(function() { router.push('/painel'); }, 3500);
    } catch (err) {
      setError('Erro de conexao. Tente novamente.');
      setLoading(false);
    }
  };

  const bgStyle = { minHeight: '100vh', background: '#000', position: 'relative', overflow: 'hidden', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'SF Pro Display', sans-serif" };
  const bgEffects = (<>
    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(201,169,97,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,97,0.06) 1px, transparent 1px)', backgroundSize: '60px 60px', animation: 'gridPulse 4s ease-in-out infinite', pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', top: '50%', left: '50%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,169,97,0.12) 0%, transparent 70%)', transform: 'translate(-50%, -50%)', animation: 'goldGlow 6s ease-in-out infinite', pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top, rgba(0,0,0,0) 0%, #000 80%)', pointerEvents: 'none' }} />
  </>);
  const globalStyles = (<style>{`
    @keyframes gridPulse { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.3; } }
    @keyframes goldGlow { 0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.1); } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ticketEntry { 0% { opacity: 0; transform: scale(0.8) rotate(-5deg); } 100% { opacity: 1; transform: scale(1) rotate(0deg); } }
    @keyframes sparkleRain { 0% { transform: translateY(-20px); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(100vh); opacity: 0; } }
    @keyframes couponPulse { 0%, 100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.08); opacity: 1; } }
    input.premium::placeholder { color: rgba(255,255,255,0.25); font-weight: 400; }
    input.premium:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px rgba(20,20,20,0.8) inset !important; -webkit-text-fill-color: #fff !important; transition: background-color 9999s ease-out; }
  `}</style>);

  const inputStyle = (focused) => ({ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid ' + (focused ? 'rgba(201,169,97,0.5)' : 'rgba(255,255,255,0.1)'), borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 500, outline: 'none', transition: 'all 0.3s', boxShadow: focused ? '0 0 0 4px rgba(201,169,97,0.08)' : 'none', boxSizing: 'border-box' });
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 };
  const primaryBtn = (disabled) => ({ width: '100%', padding: '15px 24px', background: disabled ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #E8CF8B 0%, #C9A961 50%, #8B6914 100%)', border: '1px solid ' + (disabled ? 'rgba(255,255,255,0.08)' : 'rgba(201,169,97,0.6)'), borderRadius: 10, color: disabled ? 'rgba(255,255,255,0.3)' : '#1a1306', fontWeight: 700, fontSize: 15, letterSpacing: 0.5, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.3s', boxShadow: disabled ? 'none' : '0 8px 24px rgba(201,169,97,0.3), inset 0 1px 0 rgba(255,255,255,0.35)' });

  if (showWelcome) {
    return (
      <div style={bgStyle}>
        {globalStyles}
        {bgEffects}
        <div style={{ position: 'relative', zIndex: 2, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', animation: 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ fontSize: 64, marginBottom: 20, filter: 'drop-shadow(0 0 30px rgba(201,169,97,0.6))' }}>✦</div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#fff', margin: 0, marginBottom: 8, letterSpacing: -0.5 }}>Seja bem-vindo</h1>
            <p style={{ color: '#C9A961', fontSize: 15, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Bora lucrar</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Abrindo seu painel...</p>
          </div>
        </div>
      </div>
    );
  }

  if (showTicket) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: 24, overflow: 'hidden' }}>
        {globalStyles}
        {bgEffects}
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', left: (Math.random() * 100) + '%', top: -20, fontSize: Math.random() * 12 + 10, animation: 'sparkleRain ' + (Math.random() * 3 + 3) + 's linear ' + (Math.random() * 2) + 's infinite', color: '#C9A961', opacity: 0.6 }}>✦</div>
        ))}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 400, width: '100%', textAlign: 'center', animation: 'ticketEntry 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <div style={{ background: 'linear-gradient(145deg, #E8CF8B 0%, #C9A961 50%, #8B6914 100%)', borderRadius: 16, padding: '36px 28px', boxShadow: '0 0 80px rgba(201,169,97,0.4), 0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.3)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg, transparent, transparent 14px, rgba(0,0,0,0.04) 14px, rgba(0,0,0,0.04) 28px)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 11, color: 'rgba(26,19,6,0.6)', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 10 }}>Golden Ticket</div>
              <div style={{ width: 40, height: 1, background: 'rgba(26,19,6,0.3)', margin: '0 auto 16px' }} />
              <div style={{ fontSize: 12, color: 'rgba(26,19,6,0.6)', marginBottom: 4 }}>Cupom exclusivo de</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1306', marginBottom: 12, letterSpacing: -0.5 }}>{form.name.split(' ')[0]}</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#1a1306', letterSpacing: 4, padding: '14px 0', borderTop: '1.5px dashed rgba(26,19,6,0.3)', borderBottom: '1.5px dashed rgba(26,19,6,0.3)', margin: '12px 0' }}>{form.coupon}</div>
              <div style={{ fontSize: 12, color: 'rgba(26,19,6,0.6)', marginTop: 12, marginBottom: 4 }}>Comissão por venda</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#1a1306' }}>R$ 25,00</div>
            </div>
          </div>
          <button onClick={handleTicketClose} style={{ marginTop: 24, padding: '15px 36px', background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', border: '1px solid rgba(201,169,97,0.4)', borderRadius: 10, color: '#C9A961', fontWeight: 700, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}>Ativar meu cupom</button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div style={bgStyle}>
        {globalStyles}
        {bgEffects}
        <div style={{ position: 'relative', zIndex: 2, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 420, animation: 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, rgba(201,169,97,0.15), rgba(201,169,97,0.02))', border: '1px solid rgba(201,169,97,0.25)', marginBottom: 20, boxShadow: '0 8px 32px rgba(201,169,97,0.08)', fontSize: 26 }}>🔒</div>
              <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: 0, marginBottom: 8, letterSpacing: -0.3 }}>Crie sua senha</h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Login será o cupom <strong style={{ color: '#C9A961' }}>{form.coupon}</strong></p>
            </div>
            <div style={{ background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Senha (6 dígitos)</label>
                <input type="password" className="premium" inputMode="numeric" value={form.password} onChange={(e) => handleChange('password', e.target.value)} placeholder="••••••" maxLength={6} style={{ ...inputStyle(false), fontSize: 18, letterSpacing: form.password ? 8 : 1, textAlign: form.password ? 'center' : 'left' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Confirme a senha</label>
                <input type="password" className="premium" inputMode="numeric" value={form.passwordConfirm} onChange={(e) => handleChange('passwordConfirm', e.target.value)} placeholder="••••••" maxLength={6} style={{ ...inputStyle(form.passwordConfirm.length === 6 && form.password === form.passwordConfirm), fontSize: 18, letterSpacing: form.passwordConfirm ? 8 : 1, textAlign: form.passwordConfirm ? 'center' : 'left' }} />
                {form.passwordConfirm.length === 6 && form.password === form.passwordConfirm && (<div style={{ textAlign: 'center', marginTop: 8, color: '#C9A961', fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>✓ SENHAS CONFEREM</div>)}
              </div>
              {error && (<div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.2)', borderRadius: 8, color: '#ff6b6b', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}><span>⚠</span>{error}</div>)}
              <button onClick={handleCreatePassword} disabled={loading || form.password.length !== 6 || form.password !== form.passwordConfirm} style={primaryBtn(loading || form.password.length !== 6 || form.password !== form.passwordConfirm)}>{loading ? 'Criando...' : 'Acessar o painel'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const platformOptions = [
    { id: 'instagram', label: 'Instagram', icon: '📷' },
    { id: 'facebook', label: 'Facebook', icon: '👥' },
    { id: 'tiktok', label: 'TikTok', icon: '🎶' },
    { id: 'outro', label: 'Outro', icon: '🌐' },
  ];

  return (
    <div style={bgStyle}>
      {globalStyles}
      {bgEffects}
      <div style={{ position: 'relative', zIndex: 2, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 440, animation: 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 100, height: 100, marginBottom: 12, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,169,97,0.18) 0%, transparent 70%)', filter: 'blur(20px)' }} />
              <img src="/logo.png" alt="Joias Maromba" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.92, filter: 'drop-shadow(0 4px 20px rgba(201,169,97,0.35))', position: 'relative', zIndex: 1 }} />
            </div>
            <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, letterSpacing: -0.3, margin: 0, marginBottom: 6, textTransform: 'uppercase' }}>Seja Afiliado(a)</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: 0, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 500, lineHeight: 1.5 }}>Ganhe <strong style={{ color: '#C9A961' }}>R$ 25,00 por venda</strong> no seu cupom<br/>divulgando nossas joias</p>
          </div>

          <div style={{ background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nome completo</label>
              <input type="text" className="premium" value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Seu nome completo" style={inputStyle(false)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Idade</label>
                <input type="number" className="premium" value={form.age} onChange={(e) => handleChange('age', e.target.value)} placeholder="25" style={inputStyle(false)} />
              </div>
              <div>
                <label style={labelStyle}>Cidade</label>
                <input type="text" className="premium" value={form.city} onChange={(e) => handleChange('city', e.target.value)} placeholder="Sua cidade" style={inputStyle(false)} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>E-mail</label>
              <input type="email" className="premium" value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="seu@email.com" style={inputStyle(false)} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Onde vai divulgar</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {platformOptions.map((p) => {
                  const selected = form.platforms.includes(p.id);
                  return (
                    <button key={p.id} onClick={() => togglePlatform(p.id)} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid ' + (selected ? 'rgba(201,169,97,0.5)' : 'rgba(255,255,255,0.1)'), background: selected ? 'rgba(201,169,97,0.08)' : 'rgba(255,255,255,0.02)', color: selected ? '#C9A961' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}>
                      <span style={{ fontSize: 16 }}>{p.icon}</span>{p.label}
                      {selected && <span style={{ marginLeft: 'auto' }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {form.platforms.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {form.platforms.map((p) => {
                  const opt = platformOptions.find((o) => o.id === p);
                  return (
                    <div key={p} style={{ marginBottom: 10 }}>
                      <label style={labelStyle}><span style={{ marginRight: 6 }}>{opt.icon}</span>Seu @ no {opt.label}</label>
                      <input type="text" className="premium" value={form[p]} onChange={(e) => handleChange(p, e.target.value)} placeholder={'@seu_' + p} style={inputStyle(false)} />
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <div style={{ display: 'inline-block', marginBottom: 10, animation: 'couponPulse 2.4s ease-in-out infinite' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#C9A961', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 0 16px rgba(201,169,97,0.5)' }}>Crie seu cupom</span>
              </div>
              <input type="text" className="premium" value={form.coupon} onChange={(e) => handleChange('coupon', e.target.value)} placeholder="SEU CUPOM" maxLength={20} style={{ ...inputStyle(couponStatus === 'available'), fontSize: 15, fontWeight: 700, textAlign: 'center', letterSpacing: 2, color: couponStatus === 'taken' ? '#ff6b6b' : '#fff', borderColor: couponStatus === 'taken' ? 'rgba(255,107,107,0.4)' : (couponStatus === 'available' ? 'rgba(0,255,136,0.5)' : 'rgba(255,255,255,0.1)') }} />
              <div style={{ textAlign: 'center', marginTop: 6, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, minHeight: 14 }}>
                {couponChecking && <span style={{ color: 'rgba(255,255,255,0.4)' }}>Verificando...</span>}
                {couponStatus === 'available' && <span style={{ color: '#00ff88' }}>✓ DISPONÍVEL</span>}
                {couponStatus === 'taken' && <span style={{ color: '#ff6b6b' }}>✗ CUPOM EM USO</span>}
              </div>
            </div>

            <div onClick={() => handleChange('agreedCommission', !form.agreedCommission)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px', marginBottom: 10, borderRadius: 10, background: form.agreedCommission ? 'rgba(201,169,97,0.06)' : 'rgba(255,255,255,0.02)', border: '1px solid ' + (form.agreedCommission ? 'rgba(201,169,97,0.3)' : 'rgba(255,255,255,0.08)'), cursor: 'pointer', transition: 'all 0.3s' }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: '2px solid ' + (form.agreedCommission ? '#C9A961' : 'rgba(255,255,255,0.2)'), background: form.agreedCommission ? '#C9A961' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.3s' }}>
                {form.agreedCommission && <span style={{ color: '#1a1306', fontSize: 13, fontWeight: 900 }}>✓</span>}
              </div>
              <div style={{ color: form.agreedCommission ? '#C9A961' : 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, letterSpacing: 0.3 }}>ACEITO OS TERMOS DE USO</div>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <button type="button" onClick={(e) => { e.stopPropagation(); setShowTerms(true); }} style={{ background: 'none', border: 'none', color: '#C9A961', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', padding: 4, textDecoration: 'underline', textUnderlineOffset: 3 }}>Termos de Uso</button>
            </div>

            {error && (<div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.2)', borderRadius: 8, color: '#ff6b6b', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}><span>⚠</span>{error}</div>)}

            <button onClick={handleStep1Submit} disabled={loading} style={primaryBtn(loading)}>{loading ? 'Verificando...' : 'Confirmar e criar cupom'}</button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 20, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
            Já tem cupom? <span onClick={() => router.push('/login')} style={{ color: '#C9A961', cursor: 'pointer', fontWeight: 600 }}>Fazer login</span>
          </div>
        </div>
      </div>

      {showTerms && (
        <div onClick={() => setShowTerms(false)} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: '100%', maxHeight: '88vh', background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(201,169,97,0.25)', borderRadius: 16, padding: '24px 28px', overflowY: 'auto', boxShadow: '0 20px 80px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(201,169,97,0.15)' }}>
              <div>
                <div style={{ fontSize: 11, color: '#C9A961', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Joias Maromba</div>
                <div style={{ fontSize: 20, color: '#fff', fontWeight: 700, letterSpacing: -0.3 }}>Termos de Uso</div>
              </div>
              <button onClick={() => setShowTerms(false)} style={{ background: 'none', border: 'none', color: '#C9A961', fontSize: 24, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.65 }}>
              <TermsContent />
            </div>
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(201,169,97,0.15)', display: 'flex', gap: 12 }}>
              <button onClick={() => { handleChange('agreedCommission', true); setShowTerms(false); }} style={{ flex: 1, padding: 13, background: 'linear-gradient(135deg, #E8CF8B 0%, #C9A961 50%, #8B6914 100%)', border: '1px solid rgba(201,169,97,0.6)', borderRadius: 10, color: '#1a1306', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Aceitar e fechar</button>
              <button onClick={() => setShowTerms(false)} style={{ padding: '13px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TermsContent() {
  const sections = [
    { title: '1. Identificação da Empresa', body: 'O presente programa de afiliados é operado por JV9 COMPANY LTDA, inscrita no CNPJ sob nº 46.368.706/0001-01, doravante denominada JOIAS MAROMBA.' },
    { title: '2. Aceitação dos Termos', body: 'Ao se cadastrar, o afiliado declara que leu, compreendeu e concorda integralmente com este Termo.' },
    { title: '3. Natureza da Relação', body: '3.1. O afiliado atua como parceiro independente, sem qualquer vínculo empregatício, societário ou obrigação de exclusividade.\n3.2. Não há exigência de metas mínimas, frequência de postagens ou resultados financeiros.\n3.3. Não existe garantia de ganhos.' },
    { title: '4. Funcionamento do Programa', body: '4.1. O afiliado receberá um cupom exclusivo para divulgação.\n4.2. A comissão será de R$25,00 (vinte e cinco reais) por peça vendida, vinculada ao cupom do afiliado.\n4.3. Serão consideradas válidas apenas vendas pagas, aprovadas e não canceladas ou estornadas.\n4.4. A JOIAS MAROMBA poderá validar vendas, cancelar comissões indevidas e corrigir eventuais erros sistêmicos.' },
    { title: '5. Bonificações e Metas', body: '5.1. O site poderá apresentar campanhas promocionais, metas e bonificações adicionais.\n5.2. Tais bonificações não são obrigatórias, não constituem garantia de pagamento e não configuram salário, remuneração fixa ou vínculo.\n5.3. Os prêmios e bônus somente serão concedidos caso o afiliado cumpra integralmente os critérios específicos descritos em cada campanha.\n5.4. O não atingimento das metas não gera qualquer obrigação por parte da JOIAS MAROMBA.' },
    { title: '6. Pagamentos e Saques', body: '6.1. O afiliado poderá solicitar saque a qualquer momento.\n6.2. O pagamento será realizado via PIX em até 24 horas, dentro do horário comercial das 08:00 às 22:00.\n6.3. Solicitações fora desse horário serão processadas no próximo período.\n6.4. A JOIAS MAROMBA não se responsabiliza por dados bancários incorretos ou falhas de instituições financeiras.\n6.5. Valores de vendas canceladas, fraudulentas ou estornadas poderão ser descontados.' },
    { title: '7. Obrigações do Afiliado', body: 'O afiliado compromete-se a:\n7.1. Não utilizar práticas ilegais ou enganosas\n7.2. Não realizar spam\n7.3. Não associar a marca a conteúdos impróprios\n7.4. Não se passar pela empresa\n7.5. Cumprir regras de publicidade conforme diretrizes do CONAR' },
    { title: '8. Afiliados Patrocinados', body: '8.1. Afiliados patrocinados poderão ter metas e obrigações específicas definidas em contrato separado.' },
    { title: '9. Limitação de Responsabilidade', body: '9.1. A JOIAS MAROMBA não garante resultados financeiros.\n9.2. O afiliado assume integralmente os riscos da atividade.' },
    { title: '10. Bloqueio e Cancelamento', body: '10.1. A empresa poderá suspender contas e cancelar comissões a qualquer momento em caso de fraude, violação dos termos ou uso indevido da marca.' },
    { title: '11. Tributação', body: '11.1. O afiliado é responsável por seus impostos.' },
    { title: '12. LGPD', body: '12.1. Os dados serão tratados conforme legislação vigente.' },
    { title: '13. Alterações', body: '13.1. Os termos podem ser alterados a qualquer momento.' },
    { title: '14. Foro', body: '14.1. Foro de Curitiba/PR.' },
    { title: '15. Disposições Finais', body: '15.1. Este termo representa o acordo integral entre as partes.' },
  ];
  return (
    <>
      {sections.map((s, i) => (
        <div key={i} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: '#C9A961', fontWeight: 700, marginBottom: 6, letterSpacing: 0.3 }}>{s.title}</div>
          <div style={{ whiteSpace: 'pre-line', color: 'rgba(255,255,255,0.75)' }}>{s.body}</div>
        </div>
      ))}
    </>
  );
}

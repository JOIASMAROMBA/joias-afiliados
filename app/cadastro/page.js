'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

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
    const { data } = await supabase.from('affiliates').select('id').ilike('coupon_code', form.coupon.trim()).single();
    setCouponStatus(data ? 'taken' : 'available');
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
    setLoading(true);
    var result = await supabase.from('affiliates').select('id').ilike('email', form.email.trim()).single();
    if (result.data) { setError('Esse e-mail ja esta cadastrado.'); setLoading(false); return; }
    setShowTicket(true);
    setLoading(false);
  };

  const handleTicketClose = () => { setShowTicket(false); setStep(2); };

  const handleCreatePassword = async () => {
    if (form.password.length !== 6) { setError('A senha precisa ter 6 numeros.'); return; }
    if (form.password !== form.passwordConfirm) { setError('As senhas nao conferem.'); return; }
    setError('');
    setLoading(true);
    var nameParts = form.name.trim().split(' ');
    var initials = nameParts.length >= 2 ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase() : form.name.trim().substring(0, 2).toUpperCase();
    var socialData = {};
    if (form.instagram) socialData.instagram = form.instagram;
    if (form.facebook) socialData.facebook = form.facebook;
    if (form.tiktok) socialData.tiktok = form.tiktok;
    if (form.outro) socialData.outro = form.outro;
    var insertResult = await supabase.from('affiliates').insert({ name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.city.trim(), instagram: JSON.stringify({ age: form.age, city: form.city, platforms: form.platforms, social: socialData }), coupon_code: form.coupon.trim(), avatar_initials: initials, tier: 'Divulgadora', is_sponsored: false, commission_value: 30, commission_type: 'fixed_per_sale', active: true, password_hash: form.password });
    if (insertResult.error) { setError('Erro ao cadastrar. Tente novamente.'); setLoading(false); return; }
    var newResult = await supabase.from('affiliates').select('id').ilike('coupon_code', form.coupon.trim()).single();
    if (newResult.data) { localStorage.setItem('affiliate_id', newResult.data.id); localStorage.setItem('affiliate_name', form.name); localStorage.setItem('affiliate_coupon', form.coupon); }
    setLoading(false);
    setShowWelcome(true);
    setTimeout(function() { router.push('/painel'); }, 3500);
  };

  if (showTicket) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)' }}>
        {Array.from({ length: 40 }).map(function(_, i) { return (
          <div key={i} style={{ position: 'absolute', left: Math.random()*100+'%', top: -20, fontSize: Math.random()*20+16, animation: 'moneyRain '+(Math.random()*2+2)+'s linear '+(Math.random()*1.5)+'s infinite', opacity: 0.8 }}>{['🪙','💰','💵','✨','🪙','💎'][Math.floor(Math.random()*6)]}</div>
        ); })}
        <div style={{ animation: 'slideUp 0.6s cubic-bezier(0.34,1.56,0.64,1)', maxWidth: 360, width: '90%', textAlign: 'center' }}>
          <div style={{ background: 'linear-gradient(145deg, #FFD700 0%, #FFA500 30%, #FFD700 50%, #B8860B 70%, #FFD700 100%)', borderRadius: 24, padding: '40px 28px', boxShadow: '0 0 60px rgba(255,215,0,0.5), 0 0 120px rgba(255,215,0,0.2)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 14, color: 'rgba(26,10,46,0.5)', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 8 }}>GOLDEN TICKET</div>
              <div style={{ width: 60, height: 2, background: 'rgba(26,10,46,0.2)', margin: '0 auto 16px' }} />
              <div style={{ fontSize: 13, color: 'rgba(26,10,46,0.6)', marginBottom: 4 }}>Cupom exclusivo de</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: '#1a0a2e', marginBottom: 4 }}>{form.name.split(' ')[0]}</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#1a0a2e', letterSpacing: 4, padding: '12px 0', borderTop: '2px dashed rgba(26,10,46,0.2)', borderBottom: '2px dashed rgba(26,10,46,0.2)', margin: '12px 0', fontFamily: "'DM Sans', sans-serif" }}>{form.coupon}</div>
              <div style={{ fontSize: 14, color: 'rgba(26,10,46,0.6)', marginBottom: 4 }}>Comissao por venda</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#1a0a2e' }}>R$30,00</div>
              <div style={{ fontSize: 11, color: 'rgba(26,10,46,0.4)', marginTop: 8 }}>Valido enquanto ativo</div>
            </div>
          </div>
          <button onClick={handleTicketClose} style={{ marginTop: 24, padding: '16px 40px', background: 'linear-gradient(135deg, #00ff88, #00cc6a)', border: 'none', borderRadius: 16, color: '#1a0a2e', fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 24px rgba(0,255,136,0.4)', animation: 'pulse 2s ease-in-out infinite' }}>ATIVAR MEU CUPOM!</button>
        </div>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(135deg, #0f0520 0%, #1a0a2e 40%, #0d0a1a 100%)' }}>
        <div style={{ textAlign: 'center', animation: 'slideUp 0.5s ease-out', maxWidth: 400, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 60, marginBottom: 16, animation: 'float 2s ease-in-out infinite' }}>🚀</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 800, color: '#FFD700', marginBottom: 12 }}>Seja bem-vindo(a)!</h2>
          <p style={{ color: '#00ff88', fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Bora lucrar!</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Abrindo seu painel...</p>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(135deg, #0f0520 0%, #1a0a2e 40%, #0d0a1a 100%)' }}>
        <div style={{ width: '100%', maxWidth: 400, animation: 'slideUp 0.5s ease-out' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🔐</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 800, color: '#FFD700', marginBottom: 8 }}>Crie sua senha</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Seu login sera o cupom <strong style={{ color: '#FFD700' }}>{form.coupon}</strong></p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 28 }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Senha (6 numeros)</label>
              <input type="password" inputMode="numeric" value={form.password} onChange={function(e) { handleChange('password', e.target.value); }} placeholder="000000" maxLength={6} style={{ width: '100%', padding: '16px 20px', background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,215,0,0.2)', borderRadius: 14, color: '#FFD700', fontSize: 28, fontWeight: 800, textAlign: 'center', letterSpacing: 8, outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Confirme a senha</label>
              <input type="password" inputMode="numeric" value={form.passwordConfirm} onChange={function(e) { handleChange('passwordConfirm', e.target.value); }} placeholder="000000" maxLength={6} style={{ width: '100%', padding: '16px 20px', background: 'rgba(255,255,255,0.08)', border: '2px solid ' + (form.passwordConfirm.length === 6 && form.password === form.passwordConfirm ? 'rgba(0,255,136,0.5)' : 'rgba(255,215,0,0.2)'), borderRadius: 14, color: form.passwordConfirm.length === 6 && form.password === form.passwordConfirm ? '#00ff88' : '#FFD700', fontSize: 28, fontWeight: 800, textAlign: 'center', letterSpacing: 8, outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
              {form.passwordConfirm.length === 6 && form.password === form.passwordConfirm && (<div style={{ textAlign: 'center', marginTop: 8, color: '#00ff88', fontSize: 12, fontWeight: 600 }}>Senhas conferem!</div>)}
            </div>
            {error && (<div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 10, color: '#ff6b6b', fontSize: 13, textAlign: 'center' }}>{error}</div>)}
            <button onClick={handleCreatePassword} disabled={loading} style={{ width: '100%', padding: 16, background: 'linear-gradient(135deg, #FFD700, #FFA500)', border: 'none', borderRadius: 14, color: '#1a0a2e', fontWeight: 800, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 20px rgba(255,215,0,0.3)', opacity: loading ? 0.7 : 1 }}>{loading ? 'Criando...' : 'Acessar o Painel!'}</button>
          </div>
        </div>
      </div>
    );
  }

  var platformOptions = [
    { id: 'instagram', label: 'Instagram', icon: '📸' },
    { id: 'facebook', label: 'Facebook', icon: '👤' },
    { id: 'tiktok', label: 'TikTok', icon: '🎵' },
    { id: 'outro', label: 'Outro', icon: '🌐' }
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(135deg, #0f0520 0%, #1a0a2e 40%, #0d0a1a 100%)' }}>
      <div style={{ width: '100%', maxWidth: 420, animation: 'slideUp 0.5s ease-out' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 12, animation: 'float 3s ease-in-out infinite' }}>💎</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 800, background: 'linear-gradient(90deg, #FFD700, #FFA500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>Quero ser Afiliado(a)</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Ganhe <strong style={{ color: '#00ff88' }}>R$30 por venda</strong> divulgando nossas joias</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 28 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Nome completo *</label>
            <input type="text" value={form.name} onChange={function(e) { handleChange('name', e.target.value); }} placeholder="Seu nome completo" style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Idade *</label>
              <input type="number" value={form.age} onChange={function(e) { handleChange('age', e.target.value); }} placeholder="25" style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Cidade *</label>
              <input type="text" value={form.city} onChange={function(e) { handleChange('city', e.target.value); }} placeholder="Sua cidade" style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>E-mail *</label>
            <input type="email" value={form.email} onChange={function(e) { handleChange('email', e.target.value); }} placeholder="seu@email.com" style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', marginBottom: 8, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Onde deseja anunciar? *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {platformOptions.map(function(p) {
                var selected = form.platforms.includes(p.id);
                return (
                  <button key={p.id} onClick={function() { togglePlatform(p.id); }} style={{ padding: '12px 14px', borderRadius: 12, border: selected ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.1)', background: selected ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)', color: selected ? '#FFD700' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{p.icon}</span>{p.label}
                    {selected && <span style={{ marginLeft: 'auto', color: '#FFD700' }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
          {form.platforms.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              {form.platforms.map(function(p) {
                var opt = platformOptions.find(function(o) { return o.id === p; });
                return (
                  <div key={p} style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>{opt.icon} Seu @ no {opt.label}</label>
                    <input type="text" value={form[p]} onChange={function(e) { handleChange(p, e.target.value); }} placeholder={'@seu_' + p} style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Crie seu cupom *</label>
            <input type="text" value={form.coupon} onChange={function(e) { handleChange('coupon', e.target.value); }} placeholder="Ex: SEUNOME" maxLength={20} style={{ width: '100%', padding: '14px 18px', background: 'rgba(255,215,0,0.06)', border: '2px solid ' + (couponStatus === 'available' ? 'rgba(0,255,136,0.5)' : couponStatus === 'taken' ? 'rgba(255,80,80,0.5)' : 'rgba(255,215,0,0.2)'), borderRadius: 14, color: couponStatus === 'available' ? '#00ff88' : '#FFD700', fontSize: 18, fontWeight: 800, textAlign: 'center', letterSpacing: 2, outline: 'none', fontFamily: "'DM Sans', sans-serif" }} />
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, fontWeight: 600 }}>
              {couponChecking && <span style={{ color: 'rgba(255,255,255,0.4)' }}>Verificando...</span>}
              {couponStatus === 'available' && <span style={{ color: '#00ff88' }}>Disponivel! Este cupom e seu!</span>}
              {couponStatus === 'taken' && <span style={{ color: '#ff6b6b' }}>Cupom ja em uso. Tente outro.</span>}
            </div>
          </div>
          <div onClick={function() { handleChange('agreedCommission', !form.agreedCommission); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', marginBottom: 20, borderRadius: 14, background: form.agreedCommission ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.03)', border: form.agreedCommission ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, border: form.agreedCommission ? '2px solid #00ff88' : '2px solid rgba(255,255,255,0.2)', background: form.agreedCommission ? '#00ff88' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {form.agreedCommission && <span style={{ color: '#1a0a2e', fontSize: 14, fontWeight: 900 }}>✓</span>}
            </div>
            <div>
              <div style={{ color: form.agreedCommission ? '#00ff88' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600 }}>Comissao por vendas: R$30 por peca</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>Aceito os termos de comissao</div>
            </div>
          </div>
          {error && (<div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 10, color: '#ff6b6b', fontSize: 13, textAlign: 'center' }}>{error}</div>)}
          <button onClick={handleStep1Submit} disabled={loading} style={{ width: '100%', padding: 16, background: 'linear-gradient(135deg, #FFD700, #FFA500)', border: 'none', borderRadius: 14, color: '#1a0a2e', fontWeight: 800, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 20px rgba(255,215,0,0.3)', opacity: loading ? 0.7 : 1 }}>{loading ? 'Verificando...' : 'Confirmar e Criar Cupom!'}</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 20, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          Ja tem cupom?{' '}<span onClick={function() { router.push('/login'); }} style={{ color: '#FFD700', cursor: 'pointer', fontWeight: 600 }}>Fazer login</span>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function CadastroPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', instagram: '', coupon: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleChange = (field, value) => {
    if (field === 'coupon') value = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.coupon.trim()) { setError('Preencha nome, e-mail e cupom.'); return; }
    if (form.coupon.length < 3) { setError('O cupom precisa ter pelo menos 3 caracteres.'); return; }
    setLoading(true);
    const { data: existing } = await supabase.from('affiliates').select('id').ilike('coupon_code', form.coupon.trim()).single();
    if (existing) { setError('Esse cupom já está em uso. Escolha outro.'); setLoading(false); return; }
    const { data: existingEmail } = await supabase.from('affiliates').select('id').ilike('email', form.email.trim()).single();
    if (existingEmail) { setError('Esse e-mail já está cadastrado.'); setLoading(false); return; }
    const nameParts = form.name.trim().split(' ');
    const initials = nameParts.length >= 2 ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase() : form.name.trim().substring(0, 2).toUpperCase();
    const { error: dbError } = await supabase.from('affiliates').insert({ name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() || null, instagram: form.instagram.trim().replace('@', '') || null, coupon_code: form.coupon.trim(), avatar_initials: initials, tier: 'Divulgadora', is_sponsored: false, commission_value: 30, active: true });
    if (dbError) { setError('Erro ao cadastrar. Tente novamente.'); setLoading(false); return; }
    setSuccess(true);
    setTimeout(() => router.push('/login'), 3000);
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(135deg, #0f0520 0%, #1a0a2e 40%, #0d0a1a 100%)' }}>
        <div style={{ textAlign: 'center', animation: 'slideUp 0.5s ease-out', maxWidth: 400 }}>
          <div style={{ fontSize: 60, marginBottom: 16, animation: 'float 3s ease-in-out infinite' }}>🎉</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 800, color: '#FFD700', marginBottom: 12 }}>Cadastro realizado!</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 8 }}>Seu cupom <strong style={{ color: '#FFD700', fontSize: 20 }}>{form.coupon}</strong> está ativo!</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Redirecionando para o login...</p>
          <div style={{ marginTop: 24, padding: 20, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 16 }}>
            <div style={{ color: '#00ff88', fontSize: 14, fontWeight: 600 }}>Cada venda com seu cupom = R$30 pra voce!</div>
          </div>
        </div>
      </div>
    );
  }

  const fields = [
    { label: 'Nome completo *', field: 'name', placeholder: 'Seu nome', type: 'text' },
    { label: 'E-mail *', field: 'email', placeholder: 'seu@email.com', type: 'email' },
    { label: 'WhatsApp', field: 'phone', placeholder: '(41) 99999-9999', type: 'tel' },
    { label: 'Instagram', field: 'instagram', placeholder: '@seu_perfil', type: 'text' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(135deg, #0f0520 0%, #1a0a2e 40%, #0d0a1a 100%)' }}>
      <div style={{ width: '100%', maxWidth: 420, animation: 'slideUp 0.5s ease-out' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 12, animation: 'float 3s ease-in-out infinite' }}>💎</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 800, background: 'linear-gradient(90deg, #FFD700, #FFA500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>Quero ser Afiliado(a)</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Ganhe <strong style={{ color: '#00ff88' }}>R$30 por peça vendida</strong> divulgando</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 28 }}>
          {fields.map((f, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>{f.label}</label>
              <input type={f.type} value={form[f.field]} onChange={(e) => handleChange(f.field, e.target.value)} placeholder={f.placeholder} style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none', fontFamily: "'DM

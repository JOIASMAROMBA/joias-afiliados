'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function PainelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [affiliate, setAffiliate] = useState(null);
  const [balance, setBalance] = useState({ available_balance: 0, pending_withdrawals: 0 });
  const [allSales, setAllSales] = useState([]);
  const [salesFilter, setSalesFilter] = useState('30');
  const [weekPosts, setWeekPosts] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [myWithdrawals, setMyWithdrawals] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptImage, setReceiptImage] = useState('');
  const [pixType, setPixType] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawEmail, setWithdrawEmail] = useState('');
  const [withdrawMessage, setWithdrawMessage] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [postPlatform, setPostPlatform] = useState('');
  const [postLink, setPostLink] = useState('');
  const [postMessage, setPostMessage] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [motivationalPhrase, setMotivationalPhrase] = useState('');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  var phrases = [
    '🔥 Bora pra cima! Você é brabo(a) e ninguém segura!',
    '💪 Cada venda é um passo mais perto do seu sonho',
    '🚀 Anuncie hoje e conquiste sua meta!',
    '⭐ Os campeões não esperam, eles vão atrás!',
    '💎 Você nasceu pra brilhar. Mostra pro mundo!',
    '🎯 Foca na meta, não no problema!',
    '👑 Grandes vendedoras fazem da venda um espetáculo',
    '🔥 O que te diferencia é a consistência. Segue firme!',
    '💰 Dinheiro segue quem age. Parte pra cima!',
    '✨ Sua próxima venda pode mudar seu dia. Vai lá!',
    '🌟 Você é capaz de muito mais do que imagina',
    '🏆 Campeões fazem acontecer, nunca desistem!',
    '⚡ A pressa é inimiga da perfeição, mas a preguiça é inimiga do sucesso',
    '🎊 Cada sim é uma vitória. Vai colecionando!',
    '🔑 A chave do sucesso é a ação diária. Bora postar!'
  ];

  useEffect(function() {
    var id = localStorage.getItem('affiliate_id');
    if (!id) { router.push('/login'); return; }
    loadData(id);
    setMotivationalPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
  }, []);

  useEffect(function() {
    var interval = setInterval(function() {
      setMotivationalPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
    }, 8000);
    return function() { clearInterval(interval); };
  }, []);

  async function loadData(affiliateId) {
    var check = await supabase.from('affiliates').select('*').eq('id', affiliateId).single();
    if (!check.data) { router.push('/login'); return; }
    if (check.data.is_admin) { router.push('/admin'); return; }
    setAffiliate(check.data);
    if (check.data.email) setWithdrawEmail(check.data.email);
    try { var balData = await supabase.from('affiliate_balance').select('*').eq('id', affiliateId).single(); if (balData.data) setBalance(balData.data); } catch(e) {}
    try { var salesData = await supabase.from('sales').select('*').eq('affiliate_id', affiliateId).order('created_at', { ascending: false }).limit(500); setAllSales(salesData.data || []); } catch(e) {}
    try {
      var weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0,0,0,0);
      var postsData = await supabase.from('posts').select('*').eq('affiliate_id', affiliateId).gte('created_at', weekStart.toISOString()).order('created_at', { ascending: false });
      setWeekPosts(postsData.data || []);
    } catch(e) {}
    try { var obData = await supabase.from('posting_obligations').select('*').eq('affiliate_id', affiliateId).eq('active', true); setObligations(obData.data || []); } catch(e) {}
    try { var wd = await supabase.from('withdrawals').select('*').eq('affiliate_id', affiliateId).order('created_at', { ascending: false }); setMyWithdrawals(wd.data || []); } catch(e) {}
    try { var rw = await supabase.from('rewards').select('*').eq('active', true).order('target_value', { ascending: true }); setRewards(rw.data || []); } catch(e) {}
    setLoading(false);
  }

  async function handleRequestWithdraw() {
    if (!withdrawAmount || Number(withdrawAmount) < 10) { setWithdrawMessage('Valor minimo R$10'); return; }
    if (Number(withdrawAmount) > Number(balance.available_balance)) { setWithdrawMessage('Saldo insuficiente'); return; }
    if (!pixType) { setWithdrawMessage('Selecione o tipo de chave PIX'); return; }
    if (!pixKey.trim()) { setWithdrawMessage('Informe sua chave PIX'); return; }
    if (!withdrawEmail.trim() || !withdrawEmail.includes('@')) { setWithdrawMessage('Email invalido'); return; }
    var id = localStorage.getItem('affiliate_id');
    await supabase.from('withdrawals').insert({ affiliate_id: id, amount: Number(withdrawAmount), pix_key: pixKey.trim(), pix_type: pixType, affiliate_email: withdrawEmail.trim(), status: 'pending' });
    setWithdrawSuccess(true);
  }

  function closeWithdrawModal() {
    setShowWithdrawModal(false);
    setWithdrawAmount(''); setPixKey(''); setPixType(''); setWithdrawMessage(''); setWithdrawSuccess(false);
    var id = localStorage.getItem('affiliate_id');
    if (id) loadData(id);
  }

  async function handleConfirmPost() {
    if (!postPlatform) { setPostMessage('Selecione a rede social'); return; }
    if (!postLink.trim()) { setPostMessage('Cole o link ou ID do post'); return; }
    var id = localStorage.getItem('affiliate_id');
    var now = new Date();
    await supabase.from('posts').insert({ affiliate_id: id, post_type: postPlatform, platform: postPlatform, post_id: postLink.trim(), post_url: postLink.trim(), week_number: Math.ceil(now.getDate() / 7), year: now.getFullYear() });
    setShowPostModal(false);
    setPostPlatform(''); setPostLink(''); setPostMessage('');
    loadData(id);
  }

  function openEditProfile() {
    setEditName(affiliate.name || '');
    setEditEmail(affiliate.email || '');
    setEditPhone(affiliate.phone || '');
    setEditPassword('');
    setEditAvatarUrl(affiliate.avatar_url || '');
    setEditMessage('');
    setShowEditProfile(true);
  }

  async function handleAvatarUpload(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setEditMessage('Imagem muito grande (máx 5MB)'); return; }
    setUploadingAvatar(true);
    setEditMessage('');
    try {
      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      var fileName = affiliate.id + '-' + Date.now() + '.' + ext;
      var up = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true, cacheControl: '3600' });
      if (up.error) { setEditMessage('Erro no upload: ' + up.error.message); setUploadingAvatar(false); return; }
      var pub = supabase.storage.from('avatars').getPublicUrl(fileName);
      setEditAvatarUrl(pub.data.publicUrl);
    } catch (err) {
      setEditMessage('Erro: ' + err.message);
    }
    setUploadingAvatar(false);
  }

  async function saveProfile() {
    if (!editName.trim()) { setEditMessage('Nome nao pode estar vazio'); return; }
    if (!editEmail.trim()) { setEditMessage('Email nao pode estar vazio'); return; }
    setSavingProfile(true);
    var updates = {
      name: editName.trim(),
      email: editEmail.trim().toLowerCase(),
      phone: editPhone.trim(),
      avatar_url: editAvatarUrl || null,
    };
    if (editPassword.trim()) {
      if (editPassword.trim().length !== 6) { setEditMessage('Senha deve ter 6 digitos'); setSavingProfile(false); return; }
      updates.password_hash = editPassword.trim();
    }
    var res = await supabase.from('affiliates').update(updates).eq('id', affiliate.id).select();
    if (res.error) { setEditMessage('Erro ao salvar: ' + res.error.message); setSavingProfile(false); return; }
    if (!res.data || res.data.length === 0) {
      setEditMessage('Nenhuma linha foi atualizada (RLS bloqueou o update). Rode o SQL de policy.');
      setSavingProfile(false);
      return;
    }
    setShowEditProfile(false);
    setSavingProfile(false);
    loadData(affiliate.id);
  }

  function viewReceipt(url) { setReceiptImage(url); setShowReceiptModal(true); }
  function formatDate(d) { return new Date(d).toLocaleDateString('pt-BR'); }
  function formatDateTime(d) { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

  var filteredSales = (function() {
    if (salesFilter === 'all') return allSales;
    var days = parseInt(salesFilter);
    var cutoff = days === 1 ? (function() { var t = new Date(); t.setHours(0,0,0,0); return t.getTime(); })() : Date.now() - days * 24 * 60 * 60 * 1000;
    return allSales.filter(function(s) { return new Date(s.created_at).getTime() >= cutoff; });
  })();

  var totalSales = allSales.length;
  var totalRevenue = allSales.reduce(function(s, v) { return s + Number(v.product_value || 0); }, 0);
  var filteredCount = filteredSales.length;
  var filteredRevenue = filteredSales.reduce(function(s, v) { return s + Number(v.product_value || 0); }, 0);

  function getWeekDays() {
    var today = new Date(); today.setHours(0,0,0,0);
    var days = [];
    for (var i = -3; i <= 3; i++) {
      var d = new Date(today);
      d.setDate(today.getDate() + i);
      var dStart = new Date(d);
      var dEnd = new Date(d); dEnd.setHours(23, 59, 59, 999);
      var posted = weekPosts.some(function(p) {
        var pd = new Date(p.created_at);
        return pd.getTime() >= dStart.getTime() && pd.getTime() <= dEnd.getTime();
      });
      var weekday = d.getDay();
      var isObligatory = obligations.some(function(o) {
        if (o.obligation_type === 'recurring') return o.weekday === weekday;
        if (o.obligation_type === 'specific' && o.specific_date) {
          var sd = new Date(o.specific_date);
          return sd.toDateString() === d.toDateString();
        }
        return false;
      });
      var isToday = i === 0;
      var isFuture = i > 0;
      var isPast = i < 0;
      var missed = isObligatory && isPast && !posted;
      days.push({ date: d, posted: posted, isObligatory: isObligatory, isToday: isToday, isFuture: isFuture, isPast: isPast, missed: missed });
    }
    return days;
  }

  var weekDays = getWeekDays();
  var missedCount = weekDays.filter(function(d) { return d.missed; }).length;
  var extraPostsCount = weekDays.filter(function(d) { return d.posted && !d.isObligatory; }).length;
  var compensated = Math.min(missedCount, extraPostsCount);
  var pendingMissed = Math.max(0, missedCount - extraPostsCount);

  if (loading) return (<div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontSize: 40 }}>💎</div></div>);

  var platforms = [{ id: 'instagram', label: 'Instagram', icon: '📸' }, { id: 'tiktok', label: 'TikTok', icon: '🎵' }, { id: 'facebook', label: 'Facebook', icon: '👤' }, { id: 'outro', label: 'Outro', icon: '🌐' }];

  function calculateRocketPosition() {
    if (rewards.length === 0) return 0;
    var nextIdx = rewards.findIndex(function(r) {
      var current = r.target_type === 'sales' ? totalSales : totalRevenue;
      return current < Number(r.target_value);
    });
    if (nextIdx === -1) return rewards.length;
    var prevVal = nextIdx > 0 ? Number(rewards[nextIdx - 1].target_value) : 0;
    var nextVal = Number(rewards[nextIdx].target_value);
    var current = rewards[nextIdx].target_type === 'sales' ? totalSales : totalRevenue;
    var progress = (current - prevVal) / (nextVal - prevVal);
    return nextIdx + Math.max(0, Math.min(1, progress));
  }

  var rocketPos = calculateRocketPosition();
  var weekdayShort = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: 'linear-gradient(180deg, #000000 0%, #0a0a0a 50%, #000000 100%)', padding: 20, color: '#fff', position: 'relative' }}>
      <style>{`
        @keyframes magicTrail {
          0%, 100% { left: -60%; }
          50% { left: 100%; }
        }
        @keyframes magicGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,215,0,0.4), 0 0 40px rgba(255,215,0,0.2), inset 0 0 20px rgba(255,215,0,0.1); border-color: #FFD700; }
          50% { box-shadow: 0 0 40px rgba(255,215,0,0.8), 0 0 80px rgba(255,215,0,0.4), inset 0 0 30px rgba(255,215,0,0.2); border-color: #FFF8DC; }
        }
        @keyframes floatRocket {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-4px) rotate(5deg); }
        }
        @keyframes fadeMotivation {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes shimmerProgress {
          0% { background-position: 200% 50%; }
          100% { background-position: -200% 50%; }
        }
        @keyframes pulseEmoji {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes legendaryGlow {
          0%, 100% { box-shadow: 0 0 30px rgba(255,215,0,0.4), 0 0 60px rgba(255,140,0,0.2), inset 0 0 30px rgba(255,215,0,0.08); }
          50% { box-shadow: 0 0 50px rgba(255,215,0,0.7), 0 0 100px rgba(255,140,0,0.4), inset 0 0 40px rgba(255,215,0,0.15); }
        }
        @keyframes obligationPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,215,0,0.6); }
          50% { box-shadow: 0 0 0 6px rgba(255,215,0,0); }
        }
        @keyframes starSpin {
          0% { transform: perspective(200px) rotateZ(-18deg) rotateY(0deg) scale(1); }
          25% { transform: perspective(200px) rotateZ(-18deg) rotateY(360deg) scale(1.25); }
          50%, 100% { transform: perspective(200px) rotateZ(-18deg) rotateY(720deg) scale(1); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div onClick={openEditProfile} style={{ width: 52, height: 52, borderRadius: '50%', background: affiliate && affiliate.avatar_url ? 'transparent' : 'linear-gradient(135deg, #FFD700, #B8860B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#000', boxShadow: '0 4px 20px rgba(255,215,0,0.4)', overflow: 'hidden', cursor: 'pointer', border: '2px solid #FFD700' }}>
          {affiliate && affiliate.avatar_url ? (<img src={affiliate.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (affiliate && affiliate.avatar_initials)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#fff', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>AFILIADO</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Ola, {affiliate && affiliate.name && affiliate.name.split(' ')[0]}!</div>
          <div onClick={openEditProfile} style={{ fontSize: 10, color: 'rgba(255,215,0,0.7)', cursor: 'pointer', textDecoration: 'underline', marginTop: 2 }}>Editar perfil</div>
        </div>
        <div style={{ background: '#F5C518', color: '#000', padding: '8px 10px', borderRadius: 6, fontWeight: 900, letterSpacing: 1, boxShadow: '0 2px 12px rgba(245,197,24,0.45)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative', minWidth: 68 }}>
          <span style={{ position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: '#000' }}></span>
          <span style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: '#000' }}></span>
          <span style={{ fontSize: 9, letterSpacing: 1.5 }}>CUPOM:</span>
          <span style={{ fontSize: 13, borderTop: '1.5px dashed #000', paddingTop: 3, width: '100%', textAlign: 'center' }}>{affiliate && affiliate.coupon_code}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#0a0a0a', border: '1px solid rgba(255,215,0,0.15)', borderRadius: 12, padding: 4, position: 'relative' }}>
        {[{id: 'home', l: '🏠 Home', magic: false}, {id: 'rewards', l: '✨ PREMIOS', magic: true}, {id: 'withdrawals', l: '💰 Saques', magic: false}].map(function(t) {
          var isActive = activeTab === t.id;
          return (
            <div key={t.id} style={{ flex: 1, position: 'relative' }}>
              {t.magic && !isActive && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', borderRadius: 8, pointerEvents: 'none', zIndex: 0 }}>
                  <div style={{ position: 'absolute', top: '-30%', bottom: '-30%', width: '60%', background: 'radial-gradient(ellipse at center, rgba(255,215,0,0.9) 0%, rgba(255,140,0,0.5) 35%, rgba(255,215,0,0.15) 65%, transparent 100%)', filter: 'blur(6px)', animation: 'magicTrail 2.5s ease-in-out infinite' }} />
                </div>
              )}
              <button onClick={function() { setActiveTab(t.id); }} style={{ width: '100%', padding: '10px 8px', borderRadius: 8, background: isActive ? 'linear-gradient(135deg, #FFD700, #B8860B)' : 'transparent', color: isActive ? '#000' : '#FFD700', fontSize: 12, fontWeight: 800, cursor: 'pointer', position: 'relative', zIndex: 1, border: t.magic && !isActive ? '1px solid #FFD700' : 'none', animation: t.magic && !isActive ? 'magicGlow 2s ease-in-out infinite' : 'none' }}>{t.l}</button>
            </div>
          );
        })}
      </div>

      {activeTab === 'home' && (
        <div>
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,215,0,0.15)', borderRadius: 20, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#FFD700' }}>📊 Suas Vendas</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[{v:'1', l:'Hoje'}, {v:'7', l:'7 dias'}, {v:'30', l:'30 dias'}].map(function(f) {
                  var sel = salesFilter === f.v;
                  return (<button key={f.v} onClick={function() { setSalesFilter(f.v); }} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: sel ? 'linear-gradient(135deg, #FFD700, #B8860B)' : 'rgba(255,215,0,0.05)', color: sel ? '#000' : 'rgba(255,215,0,0.6)', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>{f.l}</button>);
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)', borderRadius: 14, padding: 14 }}>
                <div style={{ color: 'rgba(0,0,0,0.7)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Vendas</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#000' }}>{filteredCount}</div>
              </div>
              <div style={{ background: '#000', border: '1.5px solid #FFD700', borderRadius: 14, padding: 14 }}>
                <div style={{ color: '#FFD700', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Faturado</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#FFD700' }}>R${Number(filteredRevenue).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
              </div>
            </div>
          </div>

          <div style={{ background: '#0a0a0a', border: '2px solid #00ff88', borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: '0 0 30px rgba(0,255,136,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Saldo Disponível</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#00ff88' }}>R${Number(balance.available_balance).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
              </div>
              <div style={{ fontSize: 36 }}>💰</div>
            </div>
            <button onClick={function() { setShowWithdrawModal(true); }} disabled={Number(balance.available_balance) < 10} style={{ width: '100%', padding: 14, background: Number(balance.available_balance) >= 10 ? 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)' : '#1a1a1a', border: 'none', borderRadius: 14, color: Number(balance.available_balance) >= 10 ? '#000' : 'rgba(0,255,136,0.3)', fontWeight: 800, fontSize: 15, cursor: Number(balance.available_balance) >= 10 ? 'pointer' : 'not-allowed', boxShadow: Number(balance.available_balance) >= 10 ? '0 4px 20px rgba(0,255,136,0.4)' : 'none' }}>💸 Solicitar Saque</button>
          </div>

          <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 20, padding: 18, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#FFD700' }}>📸 Sua Semana de Postagens</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 12 }}>
              {weekDays.map(function(d, i) {
                var bg, border, opacity = 1, label = '', labelColor = '';
                if (d.posted) { bg = 'linear-gradient(135deg, #00ff88, #00cc6a)'; border = '2px solid #00ff88'; label = '✓'; labelColor = '#00ff88'; }
                else if (d.missed) { bg = 'rgba(255,80,80,0.15)'; border = '2px solid #ff4444'; label = '✗'; labelColor = '#ff4444'; }
                else if (d.isObligatory && d.isFuture) { bg = 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,140,0,0.1))'; border = '2px solid #FFD700'; label = '!'; labelColor = '#FFD700'; }
                else if (d.isToday) { bg = 'rgba(255,215,0,0.1)'; border = '2px solid rgba(255,215,0,0.5)'; label = ''; }
                else if (d.isFuture) { bg = 'rgba(255,255,255,0.02)'; border = '1px dashed rgba(255,215,0,0.15)'; opacity = 0.4; }
                else { bg = 'rgba(255,255,255,0.04)'; border = '1px solid rgba(255,215,0,0.1)'; opacity = 0.55; }

                return (
                  <div key={i} style={{ background: bg, border: border, borderRadius: 10, padding: '8px 4px', textAlign: 'center', opacity: opacity, animation: d.isObligatory && d.isFuture ? 'obligationPulse 2s ease-in-out infinite' : 'none', position: 'relative', minHeight: 70 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: d.isToday ? '#FFD700' : 'rgba(255,215,0,0.6)', marginBottom: 2 }}>{weekdayShort[d.date.getDay()]}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: d.posted ? '#000' : d.missed ? '#ff4444' : d.isToday ? '#FFD700' : '#fff' }}>{d.date.getDate()}</div>
                    {label && (<div style={{ fontSize: 14, color: labelColor, fontWeight: 900, marginTop: 2 }}>{label}</div>)}
                    {d.posted && !d.missed && (<div style={{ fontSize: 7, color: '#000', fontWeight: 800, marginTop: 1 }}>POSTADO</div>)}
                    {d.missed && (<div style={{ fontSize: 7, color: '#ff4444', fontWeight: 800, marginTop: 1 }}>FALHOU 😔</div>)}
                  </div>
                );
              })}
            </div>

            <button onClick={function() { setShowPostModal(true); }} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,215,0,0.3)' }}>✨ Registrar Postagem de Hoje</button>

            {obligations.length > 0 && (
              <div style={{ marginTop: 12, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: pendingMissed > 0 ? '#ff6b6b' : '#00ff88' }}>
                  {pendingMissed === 0 ? '🎉 Parabéns! Você não falhou nenhum dia ainda!' : '⚠️ Você deixou de postar ' + pendingMissed + ' ' + (pendingMissed === 1 ? 'vez' : 'vezes') + '. Compense postando outro dia!'}
                  {compensated > 0 && pendingMissed > 0 && (<div style={{ fontSize: 10, marginTop: 4, color: '#00ff88' }}>(Você ja compensou {compensated})</div>)}
                </div>
              </div>
            )}
          </div>

          {allSales.length > 0 && (
            <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 20, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#FFD700' }}>💎 Ultima Venda</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 600 }}>{allSales[0].buyer_name}</div>
                  {allSales[0].buyer_city && (<div style={{ color: 'rgba(255,215,0,0.4)', fontSize: 12 }}>{allSales[0].buyer_city}</div>)}
                </div>
                <div style={{ color: '#FFD700', fontSize: 20, fontWeight: 900 }}>+R${allSales[0].commission_earned}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'rewards' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 4 }}>🚀 Sua Jornada de Prêmios</div>
            <div style={{ fontSize: 13, color: 'rgba(255,215,0,0.6)' }}>Cada venda te impulsiona mais alto!</div>
          </div>

          {rewards.length === 0 && (
            <div style={{ background: '#0a0a0a', border: '1px dashed rgba(255,215,0,0.3)', borderRadius: 16, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎁</div>
              <div style={{ color: '#FFD700', fontSize: 14, fontWeight: 600 }}>Novos prêmios em breve</div>
            </div>
          )}

          {rewards.length > 0 && (
            <div style={{ position: 'relative', paddingLeft: 60, paddingRight: 10, minHeight: rewards.length * 150 + 'px' }}>
              <div style={{ position: 'absolute', left: 44, top: 0, bottom: 40, width: 4, background: 'linear-gradient(180deg, #FFD700 0%, #B8860B 100%)', borderRadius: 2, boxShadow: '0 0 20px rgba(255,215,0,0.3)' }}></div>

              {(function() {
                var reversedPos = rewards.length - rocketPos;
                var topCalc = (reversedPos / rewards.length) * 100;
                return (
                  <div style={{ position: 'absolute', left: 0, width: 64, top: 'calc(' + topCalc + '% + 10px)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, zIndex: 3, transition: 'top 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)', animation: 'floatRocket 2s ease-in-out infinite' }}>
                    <div style={{ background: 'linear-gradient(135deg, #FFD700, #B8860B)', color: '#000', padding: '4px 8px', borderRadius: 10, fontSize: 11, fontWeight: 900, boxShadow: '0 0 15px rgba(255,215,0,0.6)', whiteSpace: 'nowrap' }}>{totalSales}</div>
                    <div style={{ fontSize: 36, filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.8))' }}>🚀</div>
                  </div>
                );
              })()}

              {rewards.slice().reverse().map(function(r, idx) {
                var current = r.target_type === 'sales' ? totalSales : totalRevenue;
                var target = Number(r.target_value);
                var achieved = current >= target;
                var progress = Math.min(100, (current / target) * 100);
                var isTop = idx === 0;
                var isMid = idx === 1;

                var tierStyles = isTop ? {
                  bg: 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,140,0,0.1), rgba(255,215,0,0.05))',
                  border: '2px solid #FFD700',
                  badge: '👑 LENDÁRIO',
                  badgeBg: 'linear-gradient(135deg, #FFD700, #FF8C00)',
                  emojiSize: 48,
                  emojiAnim: 'pulseEmoji 2s ease-in-out infinite',
                  titleColor: '#FFF8DC',
                  titleShadow: '0 0 10px rgba(255,215,0,0.6)',
                  cardAnim: 'legendaryGlow 3s ease-in-out infinite'
                } : isMid ? {
                  bg: 'linear-gradient(135deg, rgba(192,192,192,0.18), rgba(255,255,255,0.04))',
                  border: '2px solid #C0C0C0',
                  badge: '⭐ ÉPICO',
                  badgeBg: 'linear-gradient(135deg, #E8E8E8, #A8A8A8)',
                  emojiSize: 42,
                  emojiAnim: 'none',
                  titleColor: '#F0F0F0',
                  titleShadow: 'none',
                  cardAnim: 'none'
                } : {
                  bg: 'linear-gradient(135deg, rgba(205,127,50,0.15), rgba(184,115,51,0.05))',
                  border: '2px solid #CD7F32',
                  badge: '🎯 META',
                  badgeBg: 'linear-gradient(135deg, #CD7F32, #8B4513)',
                  emojiSize: 38,
                  emojiAnim: 'none',
                  titleColor: '#FFD8A8',
                  titleShadow: 'none',
                  cardAnim: 'none'
                };

                if (achieved) {
                  tierStyles.bg = 'linear-gradient(135deg, rgba(0,255,136,0.2), rgba(0,200,100,0.05))';
                  tierStyles.border = '2px solid #00ff88';
                  tierStyles.cardAnim = 'none';
                }

                return (
                  <div key={r.id} style={{ marginBottom: 24, position: 'relative' }}>
                    <div style={{ position: 'absolute', left: -30, top: -16, width: 32, height: 32, background: achieved ? 'linear-gradient(135deg, #00ff88, #00cc6a)' : isTop ? 'linear-gradient(135deg, #FFD700, #FF8C00)' : isMid ? 'linear-gradient(135deg, #E8E8E8, #A8A8A8)' : 'linear-gradient(135deg, #CD7F32, #8B4513)', clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)', filter: 'drop-shadow(0 0 8px ' + (achieved ? 'rgba(0,255,136,0.8)' : isTop ? 'rgba(255,215,0,0.9)' : isMid ? 'rgba(232,232,232,0.6)' : 'rgba(205,127,50,0.6)') + ')', zIndex: 2, animation: 'starSpin 3s ease-in-out infinite', transformOrigin: 'center center' }}></div>
                    {[1, 2, 3].map(function(n) {
                      return (<div key={n} style={{ position: 'absolute', left: -19, top: (n * 25) + '%', width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,215,0,0.3)', border: '2px solid rgba(255,215,0,0.5)', zIndex: 1 }}></div>);
                    })}

                    <div style={{ background: tierStyles.bg, border: tierStyles.border, borderRadius: 16, padding: 18, position: 'relative', overflow: 'hidden', animation: tierStyles.cardAnim }}>
                      {!achieved && (<div style={{ position: 'absolute', top: 0, right: 0, padding: '4px 12px', background: tierStyles.badgeBg, color: '#000', borderRadius: '0 16px 0 12px', fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>{tierStyles.badge}</div>)}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, marginTop: !achieved ? 10 : 0 }}>
                        <div style={{ fontSize: tierStyles.emojiSize, animation: tierStyles.emojiAnim }}>{r.reward_emoji}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: isTop ? 17 : 15, fontWeight: 900, color: tierStyles.titleColor, textShadow: tierStyles.titleShadow }}>{r.reward_title}</div>
                          {r.reward_description && (<div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{r.reward_description}</div>)}
                        </div>
                        {achieved && (<div style={{ padding: '6px 12px', background: '#00ff88', color: '#000', borderRadius: 20, fontSize: 10, fontWeight: 900 }}>CONQUISTADA!</div>)}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                        <div style={{ color: 'rgba(255,255,255,0.6)' }}>{r.target_type === 'sales' ? 'Meta: ' + target + ' vendas' : 'Meta: R$' + Number(target).toLocaleString('pt-BR')}</div>
                        <div style={{ color: isTop ? '#FFD700' : isMid ? '#E8E8E8' : '#FFD8A8', fontWeight: 700 }}>{r.target_type === 'sales' ? current + '/' + target : 'R$' + Number(current).toFixed(0) + '/R$' + Number(target).toFixed(0)}</div>
                      </div>
                      <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: progress + '%', height: '100%', background: isTop ? 'linear-gradient(90deg, #FFD700, #FF8C00, #FFD700)' : isMid ? 'linear-gradient(90deg, #E8E8E8, #A8A8A8)' : 'linear-gradient(90deg, #CD7F32, #DAA520)', backgroundSize: '200% 100%', transition: 'width 0.8s ease-out', animation: isTop ? 'shimmerProgress 2s linear infinite' : 'none' }}></div>
                      </div>
                      {Number(r.reward_value_money) > 0 && (<div style={{ marginTop: 10, fontSize: 12, color: '#00ff88', fontWeight: 800 }}>💰 + Bonus R$ {Number(r.reward_value_money).toFixed(2)}</div>)}
                    </div>
                  </div>
                );
              })}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, padding: 12, background: 'rgba(255,215,0,0.05)', borderRadius: 12, border: '1px dashed rgba(255,215,0,0.3)', position: 'relative' }}>
                <div style={{ position: 'absolute', left: -22, width: 20, height: 20, borderRadius: '50%', background: '#FFD700' }}></div>
                <div style={{ color: '#FFD700', fontWeight: 700, fontSize: 13 }}>🏁 Ponto de partida</div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 30, textAlign: 'center', animation: 'fadeMotivation 3s ease-in-out infinite' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.4 }}>{motivationalPhrase}</div>
          </div>
        </div>
      )}

      {activeTab === 'withdrawals' && (
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#FFD700', marginBottom: 16 }}>Historico de Saques</div>
          {myWithdrawals.length === 0 && (<div style={{ background: '#0a0a0a', border: '1px solid rgba(255,215,0,0.15)', borderRadius: 16, padding: 40, textAlign: 'center', color: 'rgba(255,215,0,0.5)' }}>Nenhum saque solicitado ainda</div>)}
          {myWithdrawals.map(function(w) {
            var isPaid = w.status === 'paid';
            var isRejected = w.status === 'rejected';
            var statusColor = isPaid ? '#00ff88' : isRejected ? '#ff6b6b' : '#FFD700';
            var statusBg = isPaid ? 'rgba(0,255,136,0.1)' : isRejected ? 'rgba(255,107,107,0.1)' : 'rgba(255,215,0,0.1)';
            var statusLabel = isPaid ? 'PAGO ✓' : isRejected ? 'REJEITADO' : 'PENDENTE';
            return (<div key={w.id} style={{ background: '#0a0a0a', border: '1px solid ' + statusColor, borderRadius: 16, padding: 18, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#FFD700' }}>R${Number(w.amount).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,215,0,0.5)', marginTop: 2 }}>Solicitado em {formatDateTime(w.created_at)}</div>
                </div>
                <div style={{ padding: '4px 12px', borderRadius: 20, background: statusBg, color: statusColor, fontSize: 11, fontWeight: 800 }}>{statusLabel}</div>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,215,0,0.4)' }}>PIX ({w.pix_type}): {w.pix_key}</div>
              {isPaid && w.paid_at && (<div style={{ fontSize: 11, color: '#00ff88', marginTop: 6 }}>Pago em {formatDateTime(w.paid_at)}</div>)}
              {isPaid && w.receipt_url && (<button onClick={function() { viewReceipt(w.receipt_url); }} style={{ marginTop: 12, width: '100%', padding: 10, background: 'linear-gradient(135deg, #00ff88, #00cc6a)', border: 'none', borderRadius: 10, color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>📄 Ver Comprovante</button>)}
            </div>);
          })}
        </div>
      )}

      {showWithdrawModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', padding: 20 }}>
          <div style={{ maxWidth: 400, width: '100%', background: '#0a0a0a', border: '2px solid #FFD700', borderRadius: 24, padding: 28, boxShadow: '0 0 60px rgba(255,215,0,0.3)' }}>
            {withdrawSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 50, marginBottom: 16 }}>✅</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#FFD700', marginBottom: 12 }}>Solicitação confirmada!</div>
                <div style={{ fontSize: 13, color: 'rgba(255,215,0,0.7)', lineHeight: 1.5, marginBottom: 20 }}>O prazo de recebimento é de até 24 horas. Fique atenta ao seu email.</div>
                <button onClick={closeWithdrawModal} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>Fechar</button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#FFD700' }}>💸 Solicitar Saque</div>
                  <button onClick={closeWithdrawModal} style={{ background: 'none', border: 'none', color: '#FFD700', fontSize: 20, cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 12, padding: 14, marginBottom: 16, textAlign: 'center' }}>
                  <div style={{ color: 'rgba(0,255,136,0.6)', fontSize: 11 }}>SALDO DISPONIVEL</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#00ff88' }}>R${Number(balance.available_balance).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                </div>
                <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,215,0,0.7)', fontSize: 12, fontWeight: 700 }}>QUANTO DESEJA SACAR?</label>
                <input type="number" value={withdrawAmount} onChange={function(e) { setWithdrawAmount(e.target.value); }} placeholder="Digite o valor" style={{ width: '100%', padding: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 12, color: '#FFD700', fontSize: 16, marginBottom: 14, outline: 'none', fontWeight: 700 }} />
                <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,215,0,0.7)', fontSize: 12, fontWeight: 700 }}>QUAL SUA CHAVE PIX?</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                  {['CPF','Email','Telefone','Aleatoria'].map(function(t) { return (<button key={t} onClick={function() { setPixType(t); }} style={{ padding: 10, borderRadius: 10, border: pixType === t ? '2px solid #FFD700' : '1px solid rgba(255,215,0,0.2)', background: pixType === t ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.03)', color: pixType === t ? '#FFD700' : 'rgba(255,215,0,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t}</button>); })}
                </div>
                <input type="text" value={pixKey} onChange={function(e) { setPixKey(e.target.value); }} placeholder="Digite sua chave PIX" style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 12, color: '#FFD700', marginBottom: 14, outline: 'none' }} />
                <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,215,0,0.7)', fontSize: 12, fontWeight: 700 }}>DIGITE SEU EMAIL PARA RECEBER O COMPROVANTE</label>
                <input type="email" value={withdrawEmail} onChange={function(e) { setWithdrawEmail(e.target.value); }} placeholder="seu@email.com" style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 12, color: '#FFD700', marginBottom: 14, outline: 'none' }} />
                {withdrawMessage && (<div style={{ padding: 10, borderRadius: 10, textAlign: 'center', fontSize: 13, marginBottom: 12, background: 'rgba(255,80,80,0.1)', color: '#ff6b6b' }}>{withdrawMessage}</div>)}
                <button onClick={handleRequestWithdraw} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>Confirmar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showPostModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', padding: 20 }}>
          <div style={{ maxWidth: 400, width: '100%', background: '#0a0a0a', border: '2px solid #FFD700', borderRadius: 24, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#FFD700' }}>📸 Registrar Postagem</div>
              <button onClick={function() { setShowPostModal(false); }} style={{ background: 'none', border: 'none', color: '#FFD700', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <label style={{ display: 'block', marginBottom: 8, color: 'rgba(255,215,0,0.7)', fontSize: 12, fontWeight: 700 }}>REDE SOCIAL</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {platforms.map(function(p) { var sel = postPlatform === p.id; return (<button key={p.id} onClick={function() { setPostPlatform(p.id); }} style={{ padding: 12, borderRadius: 12, border: sel ? '2px solid #FFD700' : '1px solid rgba(255,215,0,0.2)', background: sel ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.03)', color: sel ? '#FFD700' : 'rgba(255,215,0,0.5)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 18 }}>{p.icon}</span>{p.label}</button>); })}
            </div>
            <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,215,0,0.7)', fontSize: 12, fontWeight: 700 }}>LINK OU ID DO POST</label>
            <input type="text" value={postLink} onChange={function(e) { setPostLink(e.target.value); }} placeholder="https://instagram.com/p/..." style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 12, color: '#FFD700', marginBottom: 12, outline: 'none' }} />
            {postMessage && (<div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,80,80,0.1)', color: '#ff6b6b', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{postMessage}</div>)}
            <button onClick={handleConfirmPost} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 800, cursor: 'pointer' }}>Confirmar Postagem</button>
          </div>
        </div>
      )}

      {showReceiptModal && (
        <div onClick={function() { setShowReceiptModal(false); }} style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.95)', padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: 500, width: '100%', background: '#0a0a0a', border: '2px solid #FFD700', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#FFD700' }}>📄 Comprovante</div>
              <button onClick={function() { setShowReceiptModal(false); }} style={{ background: 'none', border: 'none', color: '#FFD700', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <img src={receiptImage} alt="Comprovante" style={{ width: '100%', borderRadius: 8 }} />
            <a href={receiptImage} download target="_blank" rel="noopener" style={{ display: 'block', marginTop: 12, padding: 12, background: 'linear-gradient(135deg, #FFD700, #B8860B)', borderRadius: 10, color: '#000', fontWeight: 800, textAlign: 'center', textDecoration: 'none', fontSize: 14 }}>⬇ Baixar</a>
          </div>
        </div>
      )}

      {showEditProfile && (
        <div onClick={function() { if (!savingProfile && !uploadingAvatar) setShowEditProfile(false); }} style={{ position: 'fixed', inset: 0, zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.92)', padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: 440, width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0a0a0a', border: '2px solid #FFD700', borderRadius: 20, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#FFD700' }}>👤 Editar Perfil</div>
              <button onClick={function() { if (!savingProfile && !uploadingAvatar) setShowEditProfile(false); }} style={{ background: 'none', border: 'none', color: '#FFD700', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: editAvatarUrl ? 'transparent' : 'linear-gradient(135deg, #FFD700, #B8860B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: '#000', boxShadow: '0 4px 20px rgba(255,215,0,0.5)', overflow: 'hidden', border: '3px solid #FFD700', marginBottom: 12 }}>
                {editAvatarUrl ? (<img src={editAvatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (affiliate && affiliate.avatar_initials)}
              </div>
              <label style={{ cursor: uploadingAvatar ? 'wait' : 'pointer', padding: '8px 16px', background: 'linear-gradient(135deg, #FFD700, #B8860B)', borderRadius: 10, color: '#000', fontWeight: 800, fontSize: 12, opacity: uploadingAvatar ? 0.6 : 1 }}>
                {uploadingAvatar ? 'Enviando...' : '📷 Escolher Foto'}
                <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} style={{ display: 'none' }} />
              </label>
              {editAvatarUrl && (
                <button onClick={function() { setEditAvatarUrl(''); }} style={{ marginTop: 8, background: 'none', border: 'none', color: 'rgba(255,107,107,0.8)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>Remover foto</button>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,215,0,0.7)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Nome completo</label>
              <input type="text" value={editName} onChange={function(e) { setEditName(e.target.value); }} style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,215,0,0.7)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Email</label>
              <input type="email" value={editEmail} onChange={function(e) { setEditEmail(e.target.value); }} style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,215,0,0.7)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Telefone / WhatsApp</label>
              <input type="text" value={editPhone} onChange={function(e) { setEditPhone(e.target.value); }} placeholder="(00) 00000-0000" style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,215,0,0.7)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Nova senha (opcional)</label>
              <input type="password" value={editPassword} onChange={function(e) { setEditPassword(e.target.value); }} maxLength={6} placeholder="6 digitos" style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', letterSpacing: 4 }} />
              <div style={{ fontSize: 10, color: 'rgba(255,215,0,0.5)', marginTop: 4 }}>Deixe em branco para manter a senha atual</div>
            </div>

            {editMessage && (<div style={{ marginBottom: 12, padding: 10, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8, color: '#ff6b6b', fontSize: 12, textAlign: 'center' }}>{editMessage}</div>)}

            <button onClick={saveProfile} disabled={savingProfile || uploadingAvatar} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #FFD700, #B8860B)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 900, fontSize: 14, cursor: savingProfile ? 'wait' : 'pointer', opacity: (savingProfile || uploadingAvatar) ? 0.6 : 1, boxShadow: '0 4px 20px rgba(255,215,0,0.4)' }}>
              {savingProfile ? 'Salvando...' : '💾 Salvar Alteracoes'}
            </button>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 20, right: 20 }}>
        <button onClick={function() { localStorage.clear(); router.push('/login'); }} style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 12, padding: '8px 16px', color: '#FFD700', fontSize: 12, cursor: 'pointer' }}>Sair</button>
      </div>
    </div>
  );
}

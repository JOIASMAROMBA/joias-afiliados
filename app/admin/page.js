'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { BONUS_MILESTONES, getUnlockedMilestones } from '../../lib/milestones';
import BonusPopup from '../../components/BonusPopup';
import SaleToast from '../../components/SaleToast';

export default function PainelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [affiliate, setAffiliate] = useState(null);
  const [balance, setBalance] = useState({ total_earned: 0, total_paid: 0, pending_withdrawals: 0, available_balance: 0 });
  const [sales, setSales] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [activeTab, setActiveTab] = useState('painel');
  const [showBonusPopup, setShowBonusPopup] = useState(false);
  const [bonusMilestone, setBonusMilestone] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [latestSale, setLatestSale] = useState(null);
  const [postConfetti, setPostConfetti] = useState(false);
  const [animatedEarnings, setAnimatedEarnings] = useState(0);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [pixType, setPixType] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMessage, setWithdrawMessage] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [postPlatform, setPostPlatform] = useState('');
  const [postLink, setPostLink] = useState('');
  const [postLoading, setPostLoading] = useState(false);
  const [postMessage, setPostMessage] = useState('');

  useEffect(function() {
    var id = localStorage.getItem('affiliate_id');
    if (!id) { router.push('/login'); return; }
    checkAdminAndLoad(id);
  }, []);

  async function checkAdminAndLoad(affiliateId) {
    var adminCheck = await supabase.from('affiliates').select('is_admin').eq('id', affiliateId).single();
    if (adminCheck.data && adminCheck.data.is_admin) {
      router.push('/admin');
      return;
    }
    loadData(affiliateId);
  }

  async function loadData(affiliateId) {
    var dashData = await supabase.from('affiliate_dashboard').select('*').eq('id', affiliateId).single();
    if (!dashData.data) { router.push('/login'); return; }
    setAffiliate(dashData.data);
    var balData = await supabase.from('affiliate_balance').select('*').eq('id', affiliateId).single();
    if (balData.data) setBalance(balData.data);
    var salesData = await supabase.from('sales').select('*').eq('affiliate_id', affiliateId).order('created_at', { ascending: false }).limit(20);
    setSales(salesData.data || []);
    var rankData = await supabase.from('monthly_ranking').select('*').limit(10);
    setRanking(rankData.data || []);
    var salesCount = dashData.data.sales_this_month || 0;
    var unlocked = getUnlockedMilestones(salesCount);
    if (unlocked.length > 0) {
      var lastUnlocked = unlocked[unlocked.length - 1];
      var existingBonus = await supabase.from('bonuses').select('id').eq('affiliate_id', affiliateId).eq('milestone_target', lastUnlocked.target).single();
      if (!existingBonus.data) {
        setBonusMilestone(lastUnlocked);
        setShowBonusPopup(true);
        await supabase.from('bonuses').insert({ affiliate_id: affiliateId, milestone_target: lastUnlocked.target, bonus_value: lastUnlocked.rewardValue, month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      }
    }
    if (salesData.data && salesData.data.length > 0) {
      var newest = salesData.data[0];
      var timeDiff = Date.now() - new Date(newest.created_at).getTime();
      if (timeDiff < 24 * 60 * 60 * 1000) { setLatestSale(newest); setTimeout(function() { setShowToast(true); }, 1500); }
    }
    setLoading(false);
  }

  useEffect(function() {
    if (!affiliate) return;
    var end = affiliate.earnings_this_month || 0;
    var start = 0;
    var step = end / (1500 / 16);
    var iv = setInterval(function() { start += step; if (start >= end) { start = end; clearInterval(iv); } setAnimatedEarnings(Math.round(start)); }, 16);
    return function() { clearInterval(iv); };
  }, [affiliate]);

  async function handleRequestWithdraw() {
    if (!withdrawAmount || Number(withdrawAmount) < 10) { setWithdrawMessage('Valor minimo R$10'); return; }
    if (Number(withdrawAmount) > Number(balance.available_balance)) { setWithdrawMessage('Saldo insuficiente'); return; }
    if (!pixKey.trim()) { setWithdrawMessage('Informe sua chave PIX'); return; }
    if (!pixType) { setWithdrawMessage('Selecione o tipo de chave'); return; }
    setWithdrawLoading(true);
    var id = localStorage.getItem('affiliate_id');
    var result = await supabase.from('withdrawals').insert({ affiliate_id: id, amount: Number(withdrawAmount), pix_key: pixKey.trim(), pix_type: pixType, status: 'pending' });
    if (result.error) { setWithdrawMessage('Erro ao solicitar'); setWithdrawLoading(false); return; }
    setWithdrawMessage('Saque solicitado! Processamento em ate 24h.');
    setWithdrawLoading(false);
    setTimeout(function() {
      setShowWithdrawModal(false);
      setWithdrawAmount(''); setPixKey(''); setPixType(''); setWithdrawMessage('');
      loadData(id);
    }, 2500);
  }

  function openPostModal() {
    setShowPostModal(true);
    setPostPlatform('');
    setPostLink('');
    setPostMessage('');
  }

  async function handleConfirmPost() {
    if (!postPlatform) { setPostMessage('Selecione a rede social'); return; }
    if (!postLink.trim()) { setPostMessage('Cole o link ou ID do post'); return; }
    setPostLoading(true);
    var id = localStorage.getItem('affiliate_id');
    var now = new Date();
    var result = await supabase.from('posts').insert({
      affiliate_id: id,
      post_type: postPlatform,
      platform: postPlatform,
      post_id: postLink.trim(),
      post_url: postLink.trim(),
      week_number: Math.ceil(now.getDate() / 7),
      year: now.getFullYear()
    });
    if (result.error) { setPostMessage('Erro ao registrar'); setPostLoading(false); return; }
    setPostLoading(false);
    setShowPostModal(false);
    setPostConfetti(true);
    setAffiliate(function(prev) { return prev ? Object.assign({}, prev, { posts_this_week: (prev.posts_this_week || 0) + 1 }) : prev; });
    setTimeout(function() { setPostConfetti(false); }, 3000);
  }

  function handleLogout() { localStorage.removeItem('affiliate_id'); localStorage.removeItem('affiliate_name'); localStorage.removeItem('affiliate_coupon'); router.push('/login'); }

  if (loading) return (<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontSize: 40, animation: 'pulse 1.5s ease-in-out infinite' }}>💎</div></div>);

  var salesCount = affiliate && affiliate.sales_this_month || 0;
  var earnings = affiliate && affiliate.earnings_this_month || 0;
  var postsWeek = affiliate && affiliate.posts_this_week || 0;
  var postsRequired = 5;
  var tabs = [{ id: 'painel', label: 'Painel', icon: '🏠' }, { id: 'vendas', label: 'Vendas', icon: '💰' }, { id: 'bonus', label: 'Bonus', icon: '🚀' }, { id: 'ranking', label: 'Ranking', icon: '🏆' }];
  var weekDays = ['Seg','Ter','Qua','Qui','Sex','Sab','Dom'];
  var today = new Date().getDay();
  var todayIdx = today === 0 ? 6 : today - 1;

  function timeSince(dateStr) { var diff = Date.now() - new Date(dateStr).getTime(); var mins = Math.floor(diff / 60000); if (mins < 60) return 'ha ' + mins + ' min'; var hrs = Math.floor(mins / 60); if (hrs < 24) return 'ha ' + hrs + 'h'; return 'ontem'; }

  var platforms = [
    { id: 'instagram', label: 'Instagram', icon: '📸', color: '#E1306C' },
    { id: 'tiktok', label: 'TikTok', icon: '🎵', color: '#000' },
    { id: 'facebook', label: 'Facebook', icon: '👤', color: '#1877F2' },
    { id: 'outro', label: 'Outro', icon: '🌐', color: '#666' }
  ];

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', position: 'relative' }}>
      {showBonusPopup && bonusMilestone && <BonusPopup milestone={bonusMilestone} onClose={function() { setShowBonusPopup(false); }} />}
      {showToast && latestSale && <SaleToast sale={latestSale} onClose={function() { setShowToast(false); }} />}

      {showPostModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', padding: 20 }}>
          <div style={{ maxWidth: 400, width: '100%', background: 'linear-gradient(145deg, #1a0a2e 0%, #2d1b4e 100%)', border: '2px solid #FFD700', borderRadius: 24, padding: 28, animation: 'slideUp 0.4s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: '#FFD700' }}>📸 Registrar Postagem</div>
              <button onClick={function() { setShowPostModal(false); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <label style={{ display: 'block', marginBottom: 8, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Em qual rede voce postou?</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {platforms.map(function(p) {
                var sel = postPlatform === p.id;
                return (
                  <button key={p.id} onClick={function() { setPostPlatform(p.id); }} style={{ padding: '12px 14px', borderRadius: 12, border: sel ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.1)', background: sel ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)', color: sel ? '#FFD700' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{p.icon}</span>{p.label}
                  </button>
                );
              })}
            </div>
            <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Link ou ID do post</label>
            <input type="text" value={postLink} onChange={function(e) { setPostLink(e.target.value); }} placeholder="https://instagram.com/p/..." style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }} />
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginBottom: 16, textAlign: 'center' }}>Cole o link do post ou so o ID/nome do post</div>
            {postMessage && (<div style={{ padding: '10px 14px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 10, color: '#ff6b6b', fontSize: 13, textAlign: 'center', marginBottom: 14 }}>{postMessage}</div>)}
            <button onClick={handleConfirmPost} disabled={postLoading} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #FFD700, #FFA500)', border: 'none', borderRadius: 12, color: '#1a0a2e', fontWeight: 800, fontSize: 15, cursor: postLoading ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: postLoading ? 0.7 : 1 }}>{postLoading ? 'Registrando...' : '✨ Confirmar Postagem'}</button>
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', padding: 20 }}>
          <div style={{ maxWidth: 400, width: '100%', background: 'linear-gradient(145deg, #1a0a2e 0%, #2d1b4e 100%)', border: '2px solid #FFD700', borderRadius: 24, padding: 28, animation: 'slideUp 0.4s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: '#FFD700' }}>💸 Solicitar Saque</div>
              <button onClick={function() { setShowWithdrawModal(false); setWithdrawMessage(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 12, padding: 14, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Saldo disponivel</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#00ff88' }}>R${Number(balance.available_balance).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
            </div>
            <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Valor a sacar</label>
            <input type="number" value={withdrawAmount} onChange={function(e) { setWithdrawAmount(e.target.value); }} placeholder="0,00" style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 16, outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }} />
            <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Tipo de chave PIX</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
              {['CPF','Email','Telefone','Aleatoria'].map(function(t) {
                return (<button key={t} onClick={function() { setPixType(t); }} style={{ padding: 10, borderRadius: 10, border: pixType === t ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.1)', background: pixType === t ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)', color: pixType === t ? '#FFD700' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>{t}</button>);
              })}
            </div>
            <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600 }}>Sua chave PIX</label>
            <input type="text" value={pixKey} onChange={function(e) { setPixKey(e.target.value); }} placeholder="Digite sua chave" style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }} />
            {withdrawMessage && (<div style={{ padding: '10px 14px', background: withdrawMessage.includes('solicitado') ? 'rgba(0,255,136,0.1)' : 'rgba(255,80,80,0.1)', border: '1px solid ' + (withdrawMessage.includes('solicitado') ? 'rgba(0,255,136,0.2)' : 'rgba(255,80,80,0.2)'), borderRadius: 10, color: withdrawMessage.includes('solicitado') ? '#00ff88' : '#ff6b6b', fontSize: 13, textAlign: 'center', marginBottom: 14 }}>{withdrawMessage}</div>)}
            <button onClick={handleRequestWithdraw} disabled={withdrawLoading} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #FFD700, #FFA500)', border: 'none', borderRadius: 12, color: '#1a0a2e', fontWeight: 800, fontSize: 15, cursor: withdrawLoading ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: withdrawLoading ? 0.7 : 1 }}>{withdrawLoading ? 'Enviando...' : 'Solicitar Saque'}</button>
          </div>
        </div>
      )}

      {postConfetti && (<div style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none' }}>{Array.from({ length: 40 }).map(function(_, i) { return (<div key={i} style={{ position: 'absolute', left: Math.random() * 100 + '%', top: -10, width: Math.random() * 10 + 5, height: Math.random() * 10 + 5, borderRadius: Math.random() > 0.5 ? '50%' : '2px', background: ['#FFD700','#FF6B6B','#00ff88','#7B68EE','#FF69B4','#00CED1'][Math.floor(Math.random() * 6)], animation: 'confettiDrop ' + (Math.random() * 2 + 1.5) + 's ease-out forwards', animationDelay: Math.random() * 0.5 + 's' }} />); })}</div>)}

      <div style={{ padding: '24px 20px 16px', background: 'linear-gradient(180deg, rgba(255,215,0,0.08) 0%, transparent 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700, #B8860B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#1a0a2e', boxShadow: '0 4px 20px rgba(255,215,0,0.3)' }}>{affiliate && affiliate.avatar_initials || '?'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#FFD700', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, marginBottom: 2 }}>{affiliate && affiliate.tier || 'Divulgadora'}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>Ola, {affiliate && affiliate.name && affiliate.name.split(' ')[0]}!</div>
          </div>
          <div style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 12, padding: '6px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Cupom</div>
            <div style={{ color: '#FFD700', fontWeight: 800, fontSize: 14 }}>{affiliate && affiliate.coupon_code}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '0 20px', marginBottom: 20 }}>
        {tabs.map(function(t) { return (<button key={t.id} onClick={function() { setActiveTab(t.id); }} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 12, background: activeTab === t.id ? 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,165,0,0.1))' : 'rgba(255,255,255,0.03)', color: activeTab === t.id ? '#FFD700' : 'rgba(255,255,255,0.4)', fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottom: activeTab === t.id ? '2px solid #FFD700' : '2px solid transparent' }}><span style={{ display: 'block', fontSize: 18, marginBottom: 2 }}>{t.icon}</span>{t.label}</button>); })}
      </div>

      <div style={{ padding: '0 20px 100px' }}>
        {activeTab === 'painel' && (<div style={{ animation: 'slideUp 0.4s ease-out' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', borderRadius: 20, padding: 20, boxShadow: '0 8px 32px rgba(255,215,0,0.25)' }}>
              <div style={{ color: 'rgba(26,10,46,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Este mes</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#1a0a2e', fontFamily: "'Playfair Display', serif", marginTop: 4 }}>R${animatedEarnings}</div>
              <div style={{ color: 'rgba(26,10,46,0.5)', fontSize: 12, marginTop: 2 }}>{salesCount} vendas</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,255,136,0.05))', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 20, padding: 20 }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Saldo disponivel</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#00ff88', fontFamily: "'Playfair Display', serif", marginTop: 4 }}>R${Number(balance.available_balance).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>disponivel para saque</div>
            </div>
          </div>

          <button onClick={function() { setShowWithdrawModal(true); }} disabled={Number(balance.available_balance) < 10} style={{ width: '100%', padding: 14, marginBottom: 20, background: Number(balance.available_balance) >= 10 ? 'linear-gradient(135deg, #00ff88, #00cc6a)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 14, color: Number(balance.available_balance) >= 10 ? '#1a0a2e' : 'rgba(255,255,255,0.3)', fontWeight: 800, fontSize: 15, cursor: Number(balance.available_balance) >= 10 ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans', sans-serif" }}>💸 Solicitar Saque {Number(balance.available_balance) < 10 && '(min. R$10)'}</button>

          {balance.pending_withdrawals > 0 && (<div style={{ background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.2)', borderRadius: 14, padding: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 20 }}>⏳</span><div style={{ flex: 1 }}><div style={{ color: '#FFA500', fontSize: 13, fontWeight: 700 }}>Saque em processamento</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>R${Number(balance.pending_withdrawals).toLocaleString('pt-BR')} aguardando</div></div></div>)}

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>📸 Postagens da Semana</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{postsWeek}/{postsRequired} feitas</div>
              </div>
              {postsWeek >= 3 && <div style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.2), rgba(0,255,136,0.05))', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 20, padding: '4px 12px', color: '#00ff88', fontSize: 11, fontWeight: 700 }}>🔥 Em dia!</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {weekDays.map(function(d, i) { var isDone = i < postsWeek; var isToday = i === todayIdx; return (<div key={i} style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 10, color: isToday ? '#FFD700' : 'rgba(255,255,255,0.4)', marginBottom: 6, fontWeight: isToday ? 700 : 400 }}>{d}</div><div style={{ width: '100%', aspectRatio: '1', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: isDone ? 'linear-gradient(135deg, rgba(0,255,136,0.2), rgba(0,255,136,0.05))' : isToday ? 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05))' : 'rgba(255,255,255,0.03)', border: isDone ? '2px solid rgba(0,255,136,0.4)' : isToday ? '2px dashed rgba(255,215,0,0.5)' : '1px solid rgba(255,255,255,0.06)' }}>{isDone ? '✅' : isToday ? '📸' : '.'}</div></div>); })}
            </div>
            <button onClick={openPostModal} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #FFD700, #FFA500)', border: 'none', borderRadius: 14, color: '#1a0a2e', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 20px rgba(255,215,0,0.3)' }}>✨ Registrar Postagem de Hoje</button>
            {postConfetti && (<div style={{ textAlign: 'center', marginTop: 16, padding: 16, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 14 }}><div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div><div style={{ color: '#00ff88', fontWeight: 800, fontSize: 16 }}>Parabens! Muito pontual!</div></div>)}
          </div>

          {sales.length > 0 && (<div style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.08), rgba(0,255,136,0.02))', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 20, padding: 20 }}><div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>💎 Ultima Venda</div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{sales[0].product_name}</div><div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{sales[0].buyer_name} - {timeSince(sales[0].created_at)}</div></div><div style={{ color: '#00ff88', fontSize: 24, fontWeight: 900 }}>+R${sales[0].commission_earned}</div></div></div>)}
        </div>)}

        {activeTab === 'vendas' && (<div style={{ animation: 'slideUp 0.4s ease-out' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Suas Vendas</div>
          {sales.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}><div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>Nenhuma venda ainda!</div>}
          {sales.map(function(sale, i) { return (<div key={sale.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0', borderBottom: i < sales.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}><div style={{ width: 44, height: 44, borderRadius: 14, background: i === 0 ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{i === 0 ? '🔔' : '💎'}</div><div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{sale.product_name}</div><div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{sale.buyer_name} - {timeSince(sale.created_at)}</div></div><div style={{ color: '#00ff88', fontSize: 18, fontWeight: 800 }}>+R${sale.commission_earned}</div></div>); })}
        </div>)}

        {activeTab === 'bonus' && (<div style={{ animation: 'slideUp 0.4s ease-out' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Jornada de Bonus</div>
          {BONUS_MILESTONES.map(function(m, i) { var reached = salesCount >= m.target; var isCurrent = i === BONUS_MILESTONES.findIndex(function(b) { return salesCount < b.target; }); return (<div key={m.target} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', marginBottom: 8, borderRadius: 14, background: isCurrent ? 'linear-gradient(90deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05))' : reached ? 'rgba(0,255,136,0.05)' : 'rgba(255,255,255,0.03)', border: isCurrent ? '1px solid rgba(255,215,0,0.3)' : '1px solid rgba(255,255,255,0.05)' }}><div style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: reached ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'rgba(255,255,255,0.05)' }}>{m.icon}</div><div style={{ flex: 1 }}><div style={{ color: reached ? '#00ff88' : isCurrent ? '#FFD700' : 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 14 }}>{m.target} vendas</div><div style={{ color: reached ? '#00ff88' : 'rgba(255,255,255,0.3)', fontSize: 12 }}>{m.reward}</div></div>{reached && <span style={{ color: '#00ff88', fontSize: 18 }}>✓</span>}</div>); })}
        </div>)}

        {activeTab === 'ranking' && (<div style={{ animation: 'slideUp 0.4s ease-out' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}><div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🏆 Ranking do Mes</div></div>
          {ranking.map(function(p, i) { var isUser = p.id === (affiliate && affiliate.id); return (<div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', marginBottom: 8, borderRadius: 14, background: isUser ? 'linear-gradient(90deg, rgba(255,215,0,0.1), rgba(255,215,0,0.03))' : 'rgba(255,255,255,0.03)', border: isUser ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(255,255,255,0.05)' }}><div style={{ width: 28, fontWeight: 900, fontSize: 16, color: p.rank_position <= 3 ? '#FFD700' : 'rgba(255,255,255,0.3)' }}>#{p.rank_position}</div><div style={{ width: 36, height: 36, borderRadius: '50%', background: isUser ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: isUser ? '#1a0a2e' : 'rgba(255,255,255,0.4)' }}>{p.avatar_initials || '?'}</div><div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14, color: isUser ? '#FFD700' : '#fff' }}>{p.name} {isUser && '(Voce)'}</div><div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{p.total_sales} vendas</div></div><div style={{ color: '#00ff88', fontWeight: 800, fontSize: 15 }}>R${Number(p.total_earnings)}</div></div>); })}
        </div>)}
      </div>

      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 100 }}><button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '8px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Sair</button></div>
    </div>
  );
}

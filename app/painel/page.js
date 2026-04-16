'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function PainelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [affiliate, setAffiliate] = useState(null);
  const [balance, setBalance] = useState({ available_balance: 0, pending_withdrawals: 0 });
  const [sales, setSales] = useState([]);
  const [postsWeek, setPostsWeek] = useState(0);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [pixType, setPixType] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMessage, setWithdrawMessage] = useState('');
  const [postPlatform, setPostPlatform] = useState('');
  const [postLink, setPostLink] = useState('');
  const [postMessage, setPostMessage] = useState('');

  useEffect(function() {
    var id = localStorage.getItem('affiliate_id');
    if (!id) { router.push('/login'); return; }
    loadData(id);
  }, []);

  async function loadData(affiliateId) {
    var check = await supabase.from('affiliates').select('*').eq('id', affiliateId).single();
    if (!check.data) { router.push('/login'); return; }
    if (check.data.is_admin) { router.push('/admin'); return; }
    setAffiliate(check.data);
    try {
      var balData = await supabase.from('affiliate_balance').select('*').eq('id', affiliateId).single();
      if (balData.data) setBalance(balData.data);
    } catch(e) {}
    try {
      var salesData = await supabase.from('sales').select('*').eq('affiliate_id', affiliateId).order('created_at', { ascending: false }).limit(20);
      setSales(salesData.data || []);
    } catch(e) {}
    try {
      var weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
      var postsData = await supabase.from('posts').select('id').eq('affiliate_id', affiliateId).gte('created_at', weekStart.toISOString());
      setPostsWeek((postsData.data || []).length);
    } catch(e) {}
    setLoading(false);
  }

  async function handleRequestWithdraw() {
    if (!withdrawAmount || Number(withdrawAmount) < 10) { setWithdrawMessage('Valor minimo R$10'); return; }
    if (Number(withdrawAmount) > Number(balance.available_balance)) { setWithdrawMessage('Saldo insuficiente'); return; }
    if (!pixKey.trim()) { setWithdrawMessage('Informe sua chave PIX'); return; }
    if (!pixType) { setWithdrawMessage('Selecione o tipo de chave'); return; }
    var id = localStorage.getItem('affiliate_id');
    await supabase.from('withdrawals').insert({ affiliate_id: id, amount: Number(withdrawAmount), pix_key: pixKey.trim(), pix_type: pixType, status: 'pending' });
    setWithdrawMessage('Saque solicitado!');
    setTimeout(function() { setShowWithdrawModal(false); setWithdrawAmount(''); setPixKey(''); setPixType(''); setWithdrawMessage(''); loadData(id); }, 2000);
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

  if (loading) return (<div style={{ minHeight: '100vh', background: '#0f0520', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontSize: 40 }}>💎</div></div>);

  var platforms = [{ id: 'instagram', label: 'Instagram', icon: '📸' }, { id: 'tiktok', label: 'TikTok', icon: '🎵' }, { id: 'facebook', label: 'Facebook', icon: '👤' }, { id: 'outro', label: 'Outro', icon: '🌐' }];

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#0f0520', padding: 20, color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700, #B8860B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#1a0a2e' }}>{affiliate && affiliate.avatar_initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#FFD700', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>{affiliate && affiliate.tier}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Ola, {affiliate && affiliate.name && affiliate.name.split(' ')[0]}!</div>
        </div>
        <div style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 12, padding: '6px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Cupom</div>
          <div style={{ color: '#FFD700', fontWeight: 800, fontSize: 14 }}>{affiliate && affiliate.coupon_code}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', borderRadius: 20, padding: 20 }}>
          <div style={{ color: 'rgba(26,10,46,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Vendas</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#1a0a2e' }}>{sales.length}</div>
        </div>
        <div style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 20, padding: 20 }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Saldo</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#00ff88' }}>R${Number(balance.available_balance).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
        </div>
      </div>

      <button onClick={function() { setShowWithdrawModal(true); }} disabled={Number(balance.available_balance) < 10} style={{ width: '100%', padding: 14, marginBottom: 16, background: Number(balance.available_balance) >= 10 ? 'linear-gradient(135deg, #00ff88, #00cc6a)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 14, color: Number(balance.available_balance) >= 10 ? '#1a0a2e' : 'rgba(255,255,255,0.3)', fontWeight: 800, fontSize: 15, cursor: Number(balance.available_balance) >= 10 ? 'pointer' : 'not-allowed' }}>💸 Solicitar Saque</button>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>📸 Postagens da Semana</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>{postsWeek}/5 feitas</div>
        <button onClick={function() { setShowPostModal(true); }} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #FFD700, #FFA500)', border: 'none', borderRadius: 14, color: '#1a0a2e', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>✨ Registrar Postagem de Hoje</button>
      </div>

      {sales.length > 0 && (
        <div style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 20, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>💎 Ultima Venda</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 600 }}>{sales[0].product_name}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{sales[0].buyer_name}</div>
            </div>
            <div style={{ color: '#00ff88', fontSize: 20, fontWeight: 900 }}>+R${sales[0].commission_earned}</div>
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: 20 }}>
          <div style={{ maxWidth: 400, width: '100%', background: '#1a0a2e', border: '2px solid #FFD700', borderRadius: 24, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#FFD700' }}>💸 Solicitar Saque</div>
              <button onClick={function() { setShowWithdrawModal(false); }} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ background: 'rgba(0,255,136,0.08)', borderRadius: 12, padding: 14, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Saldo disponivel</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#00ff88' }}>R${Number(balance.available_balance).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
            </div>
            <input type="number" value={withdrawAmount} onChange={function(e) { setWithdrawAmount(e.target.value); }} placeholder="Valor" style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', marginBottom: 12, outline: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
              {['CPF','Email','Telefone','Aleatoria'].map(function(t) { return (<button key={t} onClick={function() { setPixType(t); }} style={{ padding: 10, borderRadius: 10, border: pixType === t ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.1)', background: pixType === t ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)', color: pixType === t ? '#FFD700' : 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>{t}</button>); })}
            </div>
            <input type="text" value={pixKey} onChange={function(e) { setPixKey(e.target.value); }} placeholder="Chave PIX" style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', marginBottom: 12, outline: 'none' }} />
            {withdrawMessage && (<div style={{ padding: 10, borderRadius: 10, textAlign: 'center', fontSize: 13, marginBottom: 12, background: withdrawMessage.includes('solicitado') ? 'rgba(0,255,136,0.1)' : 'rgba(255,80,80,0.1)', color: withdrawMessage.includes('solicitado') ? '#00ff88' : '#ff6b6b' }}>{withdrawMessage}</div>)}
            <button onClick={handleRequestWithdraw} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #FFD700, #FFA500)', border: 'none', borderRadius: 12, color: '#1a0a2e', fontWeight: 800, cursor: 'pointer' }}>Confirmar</button>
          </div>
        </div>
      )}

      {showPostModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: 20 }}>
          <div style={{ maxWidth: 400, width: '100%', background: '#1a0a2e', border: '2px solid #FFD700', borderRadius: 24, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#FFD700' }}>📸 Registrar Postagem</div>
              <button onClick={function() { setShowPostModal(false); }} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <label style={{ display: 'block', marginBottom: 8, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Rede social</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {platforms.map(function(p) { var sel = postPlatform === p.id; return (<button key={p.id} onClick={function() { setPostPlatform(p.id); }} style={{ padding: 12, borderRadius: 12, border: sel ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.1)', background: sel ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)', color: sel ? '#FFD700' : 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 18 }}>{p.icon}</span>{p.label}</button>); })}
            </div>
            <label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Link ou ID do post</label>
            <input type="text" value={postLink} onChange={function(e) { setPostLink(e.target.value); }} placeholder="https://instagram.com/p/..." style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', marginBottom: 12, outline: 'none' }} />
            {postMessage && (<div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,80,80,0.1)', color: '#ff6b6b', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{postMessage}</div>)}
            <button onClick={handleConfirmPost} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #FFD700, #FFA500)', border: 'none', borderRadius: 12, color: '#1a0a2e', fontWeight: 800, cursor: 'pointer' }}>Confirmar Postagem</button>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 20, right: 20 }}>
        <button onClick={function() { localStorage.clear(); router.push('/login'); }} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '8px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>Sair</button>
      </div>
    </div>
  );
}

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
    if (check.data.email) setWithdrawEmail(check.data.email);
    try { var balData = await supabase.from('affiliate_balance').select('*').eq('id', affiliateId).single(); if (balData.data) setBalance(balData.data); } catch(e) {}
    try { var salesData = await supabase.from('sales').select('*').eq('affiliate_id', affiliateId).order('created_at', { ascending: false }).limit(20); setSales(salesData.data || []); } catch(e) {}
    try { var weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0); var postsData = await supabase.from('posts').select('id').eq('affiliate_id', affiliateId).gte('created_at', weekStart.toISOString()); setPostsWeek((postsData.data || []).length); } catch(e) {}
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

  function viewReceipt(url) { setReceiptImage(url); setShowReceiptModal(true); }
  function formatDate(d) { return new Date(d).toLocaleDateString('pt-BR'); }
  function formatDateTime(d) { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

  if (loading) return (<div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontSize: 40 }}>💎</div></div>);

  var platforms = [{ id: 'instagram', label: 'Instagram', icon: '📸' }, { id: 'tiktok', label: 'TikTok', icon: '🎵' }, { id: 'facebook', label: 'Facebook', icon: '👤' }, { id: 'outro', label: 'Outro', icon: '🌐' }];

  var totalSales = sales.length;
  var totalRevenue = sales.reduce(function(s, v) { return s + Number(v.product_value || 0); }, 0);

  // Determinar próxima meta (primeira que ainda não foi alcançada)
  var nextRewardIndex = rewards.findIndex(function(r) {
    var current = r.target_type === 'sales' ? totalSales : totalRevenue;
    return current < Number(r.target_value);
  });
  if (nextRewardIndex === -1) nextRewardIndex = rewards.length;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: 'linear-gradient(180deg, #000000 0%, #0a0a0a 50%, #000000 100%)', padding: 20, color: '#fff', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700, #B8860B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#000', boxShadow: '0 4px 20px rgba(255,215,0,0.4)' }}>{affiliate && affiliate.avatar_initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#FFD700', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>{affiliate && affiliate.tier}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#FFD700' }}>Ola, {affiliate && affiliate.name && affiliate.name.split(' ')[0]}!</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05))', border: '1px solid #FFD700', borderRadius: 12, padding: '6px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,215,0,0.7)' }}>Cupom</div>
          <div style={{ color: '#FFD700', fontWeight: 800, fontSize: 14 }}>{affiliate && affiliate.coupon_code}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#0a0a0a', border: '1px solid rgba(255,215,0,0.15)', borderRadius: 12, padding: 4 }}>
        {[{id: 'home', l: '🏠 Home'}, {id: 'rewards', l: '🎁 Metas'}, {id: 'withdrawals', l: '💰 Saques'}].map(function(t) {
          return (<button key={t.id} onClick={function() { setActiveTab(t.id); }} style={{ flex: 1, padding: '10px 8px', border: 'none', borderRadius: 8, background: activeTab === t.id ? 'linear-gradient(135deg, #FFD700, #B8860B)' : 'transparent', color: activeTab === t.id ? '#000' : '#FFD700', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t.l}</button>);
        })}
      </div>

      {activeTab === 'home' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)', borderRadius: 20, padding: 20, boxShadow: '0 8px 32px rgba(255,215,0,0.2)' }}>
              <div style={{ color: 'rgba(0,0,0,0.7)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Vendas</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#000' }}>{totalSales}</div>
            </div>
            <div style={{ background: '#0a0a0a', border: '2px solid #FFD700', borderRadius: 20, padding: 20 }}>
              <div style={{ color: '#FFD700', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Saldo</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#FFD700' }}>R${Number(balance.available_balance).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
            </div>
          </div>

          <button onClick={function() { setShowWithdrawModal(true); }} disabled={Number(balance.available_balance) < 10} style={{ width: '100%', padding: 14, marginBottom: 16, background: Number(balance.available_balance) >= 10 ? 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)' : '#0a0a0a', border: Number(balance.available_balance) >= 10 ? 'none' : '1px solid rgba(255,215,0,0.2)', borderRadius: 14, color: Number(balance.available_balance) >= 10 ? '#000' : 'rgba(255,215,0,0.3)', fontWeight: 800, fontSize: 15, cursor: Number(balance.available_balance) >= 10 ? 'pointer' : 'not-allowed' }}>💸 Solicitar Saque</button>

          <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 20, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#FFD700' }}>📸 Postagens da Semana</div>
            <div style={{ fontSize: 13, color: 'rgba(255,215,0,0.5)', marginBottom: 16 }}>{postsWeek}/5 feitas</div>
            <button onClick={function() { setShowPostModal(true); }} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)', border: 'none', borderRadius: 14, color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,215,0,0.3)' }}>✨ Registrar Postagem de Hoje</button>
          </div>

          {sales.length > 0 && (
            <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 20, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#FFD700' }}>💎 Ultima Venda</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 600 }}>{sales[0].product_name}</div>
                  <div style={{ color: 'rgba(255,215,0,0.4)', fontSize: 12 }}>{sales[0].buyer_name}</div>
                </div>
                <div style={{ color: '#FFD700', fontSize: 20, fontWeight: 900 }}>+R${sales[0].commission_earned}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'rewards' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#FFD700', marginBottom: 4 }}>🚀 Sua Jornada</div>
            <div style={{ fontSize: 13, color: 'rgba(255,215,0,0.6)' }}>Suba cada vez mais alto e conquiste as metas!</div>
          </div>

          {rewards.length === 0 && (
            <div style={{ background: '#0a0a0a', border: '1px dashed rgba(255,215,0,0.3)', borderRadius: 16, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎁</div>
              <div style={{ color: '#FFD700', fontSize: 14, fontWeight: 600 }}>Novas metas em breve</div>
              <div style={{ color: 'rgba(255,215,0,0.5)', fontSize: 12, marginTop: 6 }}>Fique atento, logo teremos premios incriveis!</div>
            </div>
          )}

          {rewards.length > 0 && (
            <div style={{ position: 'relative', paddingLeft: 40, paddingRight: 10 }}>
              {/* Linha vertical dourada */}
              <div style={{ position: 'absolute', left: 24, top: 30, bottom: 30, width: 4, background: 'linear-gradient(180deg, #FFD700 0%, #B8860B 100%)', borderRadius: 2, boxShadow: '0 0 20px rgba(255,215,0,0.3)' }}></div>

              {/* Foguete posicionado na altura atual */}
              {(function() {
                var pos;
                if (nextRewardIndex === 0) pos = 0;
                else if (nextRewardIndex >= rewards.length) pos = rewards.length;
                else {
                  var prev = rewards[nextRewardIndex - 1];
                  var next = rewards[nextRewardIndex];
                  var prevVal = Number(prev.target_value);
                  var nextVal = Number(next.target_value);
                  var current = next.target_type === 'sales' ? totalSales : totalRevenue;
                  var progress = (current - prevVal) / (nextVal - prevVal);
                  pos = nextRewardIndex - 1 + Math.max(0, Math.min(1, progress));
                }
                var reversedPos = (rewards.length - pos);
                return (
                  <div style={{ position: 'absolute', left: -2, top: 'calc(' + (reversedPos / rewards.length) * 100 + '% - 20px)', fontSize: 40, filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.6))', transition: 'top 1s ease-out', zIndex: 2, animation: 'float 2s ease-in-out infinite' }}>🚀</div>
                );
              })()}

              {/* Metas de cima pra baixo (maior primeiro) */}
              {rewards.slice().reverse().map(function(r, idx) {
                var realIndex = rewards.length - 1 - idx;
                var current = r.target_type === 'sales' ? totalSales : totalRevenue;
                var target = Number(r.target_value);
                var achieved = current >= target;
                var isNext = realIndex === nextRewardIndex;
                var progress = Math.min(100, (current / target) * 100);

                return (
                  <div key={r.id} style={{ marginBottom: 20, position: 'relative' }}>
                    {/* Bolinha no pé do marco */}
                    <div style={{ position: 'absolute', left: -22, top: 24, width: 24, height: 24, borderRadius: '50%', background: achieved ? 'linear-gradient(135deg, #FFD700, #B8860B)' : isNext ? 'linear-gradient(135deg, #FFD700, #FFA500)' : '#1a1a1a', border: '3px solid ' + (achieved || isNext ? '#FFD700' : '#333'), boxShadow: achieved || isNext ? '0 0 15px rgba(255,215,0,0.6)' : 'none', zIndex: 1 }}>
                      {achieved && <div style={{ textAlign: 'center', color: '#000', fontSize: 12, fontWeight: 900, lineHeight: '18px' }}>✓</div>}
                    </div>

                    <div style={{ background: achieved ? 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05))' : isNext ? 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,215,0,0.02))' : '#0a0a0a', border: achieved ? '2px solid #FFD700' : isNext ? '2px solid #FFD700' : '1px solid rgba(255,215,0,0.2)', borderRadius: 16, padding: 16, boxShadow: isNext ? '0 0 30px rgba(255,215,0,0.2)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{ fontSize: 36, filter: achieved ? 'none' : 'grayscale(0.3)' }}>{r.reward_emoji}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: '#FFD700' }}>{r.reward_title}</div>
                          {r.reward_description && (<div style={{ fontSize: 11, color: 'rgba(255,215,0,0.6)' }}>{r.reward_description}</div>)}
                        </div>
                        {achieved && (<div style={{ padding: '4px 10px', background: '#00ff88', color: '#000', borderRadius: 20, fontSize: 10, fontWeight: 900 }}>CONQUISTADA!</div>)}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                        <div style={{ color: 'rgba(255,215,0,0.6)' }}>
                          {r.target_type === 'sales' ? 'Meta: ' + target + ' vendas' : 'Meta: R$' + Number(target).toLocaleString('pt-BR')}
                        </div>
                        <div style={{ color: '#FFD700', fontWeight: 700 }}>
                          {r.target_type === 'sales' ? current + '/' + target : 'R$' + Number(current).toFixed(0) + '/R$' + Number(target).toFixed(0)}
                        </div>
                      </div>
                      <div style={{ height: 8, background: 'rgba(255,215,0,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: progress + '%', height: '100%', background: 'linear-gradient(90deg, #FFD700, #FFA500)', transition: 'width 0.8s ease-out', boxShadow: '0 0 10px rgba(255,215,0,0.5)' }}></div>
                      </div>
                      {Number(r.reward_value_money) > 0 && (<div style={{ marginTop: 8, fontSize: 11, color: '#00ff88', fontWeight: 700 }}>+ Bonus R$ {Number(r.reward_value_money).toFixed(2)}</div>)}
                    </div>
                  </div>
                );
              })}

              {/* Base/Start */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, padding: 12, background: 'rgba(255,215,0,0.05)', borderRadius: 12, border: '1px dashed rgba(255,215,0,0.3)' }}>
                <div style={{ position: 'absolute', left: 16, width: 20, height: 20, borderRadius: '50%', background: '#FFD700' }}></div>
                <div style={{ marginLeft: 20, color: '#FFD700', fontWeight: 700, fontSize: 13 }}>🏁 Você está aqui</div>
              </div>
            </div>
          )}
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
                <div style={{ fontSize: 13, color: 'rgba(255,215,0,0.7)', lineHeight: 1.5, marginBottom: 20 }}>O prazo de recebimento é de até 24 horas. Fique atento ao seu email.</div>
                <button onClick={closeWithdrawModal} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>Fechar</button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#FFD700' }}>💸 Solicitar Saque</div>
                  <button onClick={closeWithdrawModal} style={{ background: 'none', border: 'none', color: '#FFD700', fontSize: 20, cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 12, padding: 14, marginBottom: 16, textAlign: 'center' }}>
                  <div style={{ color: 'rgba(255,215,0,0.6)', fontSize: 11 }}>SALDO DISPONIVEL</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#FFD700' }}>R${Number(balance.available_balance).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
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
                <button onClick={handleRequestWithdraw} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>Confirmar</button>
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

      <div style={{ position: 'fixed', bottom: 20, right: 20 }}>
        <button onClick={function() { localStorage.clear(); router.push('/login'); }} style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 12, padding: '8px 16px', color: '#FFD700', fontSize: 12, cursor: 'pointer' }}>Sair</button>
      </div>
    </div>
  );
}

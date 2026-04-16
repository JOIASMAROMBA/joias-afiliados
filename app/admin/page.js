'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('visao');
  const [stats, setStats] = useState({ totalSales: 0, totalRevenue: 0, totalAffiliates: 0, postsToday: 0, salesThisMonth: 0, pendingWithdrawals: 0 });
  const [affiliates, setAffiliates] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [paymentList, setPaymentList] = useState([]);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    var id = localStorage.getItem('affiliate_id');
    if (!id) { router.push('/login'); return; }
    var result = await supabase.from('affiliates').select('is_admin').eq('id', id).single();
    if (!result.data || !result.data.is_admin) { router.push('/painel'); return; }
    setIsAdmin(true);
    await loadAllData();
    setLoading(false);
  }

  async function loadAllData() {
    var today = new Date();
    var todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    var monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    var salesAll = await supabase.from('sales').select('commission_earned, product_value, created_at');
    var affAll = await supabase.from('admin_affiliates').select('*');
    var postsToday = await supabase.from('posts').select('id', { count: 'exact' }).gte('created_at', todayStart);
    var withdrawsP = await supabase.from('withdrawals').select('*, affiliates(name, coupon_code, avatar_initials)').eq('status', 'pending').order('created_at', { ascending: true });

    var totalSales = salesAll.data ? salesAll.data.length : 0;
    var totalRevenue = salesAll.data ? salesAll.data.reduce(function(s, v) { return s + Number(v.product_value || 0); }, 0) : 0;
    var salesThisMonth = salesAll.data ? salesAll.data.filter(function(s) { return new Date(s.created_at) >= new Date(monthStart); }).length : 0;
    var commissionsToPay = salesAll.data ? salesAll.data.reduce(function(s, v) { return s + Number(v.commission_earned || 0); }, 0) : 0;

    setStats({
      totalSales: totalSales,
      totalRevenue: totalRevenue,
      totalAffiliates: affAll.data ? affAll.data.length : 0,
      postsToday: postsToday.count || 0,
      salesThisMonth: salesThisMonth,
      pendingWithdrawals: withdrawsP.data ? withdrawsP.data.length : 0,
      commissionsToPay: commissionsToPay
    });

    setAffiliates(affAll.data || []);
    setWithdrawals(withdrawsP.data || []);

    // Lista de pagamento: quem completou 30 dias e tem saldo
    var dueList = (affAll.data || []).filter(function(a) { return a.days_since_signup >= 30 && Number(a.available_balance) > 0; });
    setPaymentList(dueList);
  }

  async function markAsPaid(withdrawalId) {
    await supabase.from('withdrawals').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', withdrawalId);
    await loadAllData();
  }

  async function rejectWithdrawal(withdrawalId) {
    await supabase.from('withdrawals').update({ status: 'rejected' }).eq('id', withdrawalId);
    await loadAllData();
  }

  function getPerformance(affiliate) {
    // 30 dias = ~22 dias úteis esperando 5 posts/semana = ~22 posts
    var expected = Math.min(affiliate.days_since_signup, 30) * 0.7; // 70% dos dias com post
    var actual = affiliate.posts_last_30days || 0;
    var ratio = expected > 0 ? actual / expected : 0;
    if (ratio >= 1) return { color: '#FFD700', bg: 'rgba(255,215,0,0.15)', border: 'rgba(255,215,0,0.4)', label: 'Estrela', icon: '⭐' };
    if (ratio >= 0.8) return { color: '#00ff88', bg: 'rgba(0,255,136,0.12)', border: 'rgba(0,255,136,0.3)', label: 'Otimo', icon: '✓' };
    if (ratio >= 0.5) return { color: '#FFA500', bg: 'rgba(255,165,0,0.12)', border: 'rgba(255,165,0,0.3)', label: 'Regular', icon: '!' };
    return { color: '#ff6b6b', bg: 'rgba(255,107,107,0.12)', border: 'rgba(255,107,107,0.3)', label: 'Ruim', icon: 'X' };
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  }

  if (loading) return (<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontSize: 40, animation: 'pulse 1.5s ease-in-out infinite' }}>👑</div></div>);

  var tabs = [
    { id: 'visao', label: 'Visao Geral', icon: '📊' },
    { id: 'afiliados', label: 'Afiliados', icon: '👥' },
    { id: 'pagamento', label: 'Pagamentos', icon: '💰' },
    { id: 'saques', label: 'Saques', icon: '💸' }
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', minHeight: '100vh', padding: 20 }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, padding: '16px 24px', background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,215,0,0.02))', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 32 }}>👑</div>
          <div>
            <div style={{ fontSize: 11, color: '#FFD700', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>Administrador</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700 }}>Dashboard Admin</div>
          </div>
        </div>
        <button onClick={function() { router.push('/painel'); }} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px 16px', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Ver painel afiliado</button>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabs.map(function(t) { return (
          <button key={t.id} onClick={function() { setActiveTab(t.id); }} style={{ padding: '10px 20px', border: 'none', borderRadius: 12, background: activeTab === t.id ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'rgba(255,255,255,0.05)', color: activeTab === t.id ? '#1a0a2e' : 'rgba(255,255,255,0.5)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span>{t.label}
            {t.id === 'saques' && stats.pendingWithdrawals > 0 && (<span style={{ background: '#ff4444', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 800 }}>{stats.pendingWithdrawals}</span>)}
          </button>
        ); })}
      </div>

      {/* VISAO GERAL */}
      {activeTab === 'visao' && (
        <div style={{ animation: 'slideUp 0.4s ease-out' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Vendas Totais', value: stats.totalSales, icon: '🛒', color: '#FFD700' },
              { label: 'Faturamento', value: 'R$' + stats.totalRevenue.toLocaleString('pt-BR', {minimumFractionDigits: 2}), icon: '💎', color: '#00ff88' },
              { label: 'Vendas Este Mes', value: stats.salesThisMonth, icon: '📈', color: '#FF69B4' },
              { label: 'Afiliados Ativos', value: stats.totalAffiliates, icon: '👥', color: '#7B68EE' },
              { label: 'Posts Hoje', value: stats.postsToday, icon: '📸', color: '#FFA500' },
              { label: 'Comissoes a Pagar', value: 'R$' + (stats.commissionsToPay || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2}), icon: '💰', color: '#FF6B6B' }
            ].map(function(s, i) { return (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>{s.icon}</span>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{s.label}</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: s.color, fontFamily: "'Playfair Display', serif" }}>{s.value}</div>
              </div>
            ); })}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>🏆 Top 30 Afiliados</div>
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {affiliates.slice(0, 30).sort(function(a, b) { return b.total_sales - a.total_sales; }).map(function(a, i) {
                var perf = getPerformance(a);
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ width: 30, textAlign: 'center', fontWeight: 900, fontSize: 14, color: i < 3 ? '#FFD700' : 'rgba(255,255,255,0.3)' }}>#{i + 1}</div>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,215,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#FFD700', flexShrink: 0 }}>{a.avatar_initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{a.coupon_code} · {a.total_sales} vendas</div>
                    </div>
                    <div style={{ background: perf.bg, border: '1px solid ' + perf.border, borderRadius: 10, padding: '4px 10px', color: perf.color, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{perf.icon}</span>{perf.label}
                    </div>
                    <div style={{ color: '#00ff88', fontWeight: 800, fontSize: 14, minWidth: 80, textAlign: 'right' }}>R${Number(a.total_earned).toLocaleString('pt-BR')}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* AFILIADOS */}
      {activeTab === 'afiliados' && (
        <div style={{ animation: 'slideUp 0.4s ease-out' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700 }}>Todos os Afiliados ({affiliates.length})</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>Ordenados pela data de cadastro</div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {affiliates.map(function(a) {
              var perf = getPerformance(a);
              return (
                <div key={a.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700, #FFA500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#1a0a2e', flexShrink: 0 }}>{a.avatar_initials}</div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div>
                    <div style={{ color: '#FFD700', fontSize: 13, fontWeight: 600 }}>{a.coupon_code}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{a.email} · Cadastrado em {formatDate(a.registered_at)} ({a.days_since_signup} dias)</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Vendas</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{a.total_sales}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Posts 30d</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{a.posts_last_30days}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Saldo</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#00ff88' }}>R${Number(a.available_balance).toLocaleString('pt-BR')}</div>
                  </div>
                  <div style={{ background: perf.bg, border: '1px solid ' + perf.border, borderRadius: 10, padding: '8px 14px', color: perf.color, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>{perf.icon}</span>{perf.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PAGAMENTO */}
      {activeTab === 'pagamento' && (
        <div style={{ animation: 'slideUp 0.4s ease-out' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,215,0,0.02))', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 16, padding: 24, marginBottom: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>💰</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, color: '#FFD700', marginBottom: 4 }}>Folha de Pagamento</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Afiliados que completaram 30 dias e tem saldo a receber</div>
            {paymentList.length === 0 && (<div style={{ marginTop: 20, padding: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 12, color: 'rgba(255,255,255,0.4)' }}>Nenhum afiliado pendente hoje!</div>)}
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {paymentList.map(function(a) {
              var perf = getPerformance(a);
              return (
                <div key={a.id} style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 16, padding: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700, #FFA500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#1a0a2e' }}>{a.avatar_initials}</div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div>
                    <div style={{ color: '#FFD700', fontSize: 13 }}>{a.coupon_code} · {a.email}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>Cadastro: {formatDate(a.registered_at)} ({a.days_since_signup} dias)</div>
                  </div>
                  <div style={{ background: perf.bg, border: '1px solid ' + perf.border, borderRadius: 10, padding: '6px 12px', color: perf.color, fontSize: 12, fontWeight: 700 }}>
                    {perf.icon} {perf.label}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700 }}>A PAGAR</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#00ff88' }}>R${Number(a.available_balance).toLocaleString('pt-BR')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SAQUES */}
      {activeTab === 'saques' && (
        <div style={{ animation: 'slideUp 0.4s ease-out' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700 }}>Solicitacoes de Saque ({withdrawals.length})</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>Processar em ate 24h</div>
          </div>
          {withdrawals.length === 0 && (<div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}><div style={{ fontSize: 40, marginBottom: 12 }}>💤</div>Nenhum saque pendente</div>)}
          <div style={{ display: 'grid', gap: 12 }}>
            {withdrawals.map(function(w) {
              var af = w.affiliates || {};
              return (
                <div key={w.id} style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 16, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700, #FFA500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#1a0a2e' }}>{af.avatar_initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{af.name}</div>
                      <div style={{ color: '#FFD700', fontSize: 12 }}>{af.coupon_code}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700 }}>SOLICITADO</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#00ff88' }}>R${Number(w.amount).toLocaleString('pt-BR')}</div>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>CHAVE PIX ({w.pix_type || 'chave'})</div>
                    <div style={{ color: '#FFD700', fontSize: 14, fontWeight: 700, fontFamily: 'monospace', wordBreak: 'break-all' }}>{w.pix_key}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={function() { navigator.clipboard.writeText(w.pix_key); alert('Chave PIX copiada!'); }} style={{ flex: 1, padding: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Copiar PIX</button>
                    <button onClick={function() { if (confirm('Confirmar pagamento de R$' + w.amount + '?')) markAsPaid(w.id); }} style={{ flex: 1, padding: 12, background: 'linear-gradient(135deg, #00ff88, #00cc6a)', border: 'none', borderRadius: 10, color: '#1a0a2e', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Marcar como Pago</button>
                    <button onClick={function() { if (confirm('Rejeitar saque?')) rejectWithdrawal(w.id); }} style={{ padding: '12px 16px', background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 10, color: '#ff6b6b', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>X</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

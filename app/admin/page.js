'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('1');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('sales');
  const [affiliates, setAffiliates] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [adminName, setAdminName] = useState('Admin');
  const [recentPosts, setRecentPosts] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [monthlyTops, setMonthlyTops] = useState([]);

  useEffect(function() { init(); }, []);

  useEffect(function() {
    var interval = setInterval(function() { loadAll(); }, 30000);
    return function() { clearInterval(interval); };
  }, []);

  async function init() {
    var id = localStorage.getItem('affiliate_id');
    if (!id) { router.push('/login'); return; }
    var check = await supabase.from('affiliates').select('is_admin, name').eq('id', id).single();
    if (!check.data || !check.data.is_admin) { router.push('/painel'); return; }
    setAdminName(check.data.name || 'Admin');
    await loadAll();
    setLoading(false);
  }

  async function loadAll() {
    try {
      var affRes = await supabase.from('affiliate_metrics').select('*');
      setAffiliates(affRes.data || []);
    } catch (e) {}
    try {
      var salesRes = await supabase.from('sales').select('*, affiliates(name, coupon_code)').order('created_at', { ascending: false }).limit(500);
      setAllSales(salesRes.data || []);
    } catch (e) {}
    try {
      var withRes = await supabase.from('withdrawals').select('*, affiliates(name, coupon_code, avatar_initials, email)').eq('status', 'pending').order('created_at', { ascending: false });
      setWithdrawals(withRes.data || []);
    } catch (e) {}
    try {
      var postsRes = await supabase.from('recent_posts').select('*').limit(50);
      setRecentPosts(postsRes.data || []);
    } catch (e) {}
    try {
      var monthRes = await supabase.from('monthly_sales').select('*');
      setMonthlySales(monthRes.data || []);
    } catch (e) {}
    try {
      var topsRes = await supabase.from('monthly_top_affiliate').select('*');
      setMonthlyTops(topsRes.data || []);
    } catch (e) {}
  }

  async function markPaid(wid) {
    await supabase.from('withdrawals').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', wid);
    await loadAll();
  }

  async function rejectWith(wid) {
    await supabase.from('withdrawals').update({ status: 'rejected' }).eq('id', wid);
    await loadAll();
  }

  var filteredSales = useMemo(function() {
    if (dateRange === 'all') return allSales;
    var days = parseInt(dateRange);
    if (isNaN(days)) return allSales;
    var cutoff;
    if (days === 1) {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      cutoff = today.getTime();
    } else {
      cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    }
    return allSales.filter(function(s) { return new Date(s.created_at).getTime() >= cutoff; });
  }, [allSales, dateRange]);

  var kpis = useMemo(function() {
    var revenue = filteredSales.reduce(function(s, v) { return s + Number(v.product_value || 0); }, 0);
    var commissions = filteredSales.reduce(function(s, v) { return s + Number(v.commission_earned || 0); }, 0);
    var uniqueAffiliates = new Set(filteredSales.map(function(s) { return s.affiliate_id; })).size;
    var days = parseInt(dateRange) || 30;
    var avgPerDay = filteredSales.length / (days === 1 ? 1 : days);
    return {
      totalSales: filteredSales.length,
      revenue: revenue,
      commissions: commissions,
      netRevenue: revenue - commissions,
      activeAffiliates: uniqueAffiliates,
      totalAffiliates: affiliates.length,
      avgPerDay: avgPerDay,
      avgTicket: filteredSales.length ? revenue / filteredSales.length : 0,
      pendingWithdrawals: withdrawals.length
    };
  }, [filteredSales, affiliates, withdrawals, dateRange]);

  var topAffiliates = useMemo(function() {
    var filtered = affiliates.filter(function(a) {
      if (!searchTerm) return true;
      var q = searchTerm.toLowerCase();
      return (a.name || '').toLowerCase().includes(q) || (a.coupon_code || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q);
    });
    return filtered.sort(function(a, b) {
      if (sortBy === 'sales') return b.total_sales - a.total_sales;
      if (sortBy === 'earned') return Number(b.total_earned) - Number(a.total_earned);
      if (sortBy === 'recent') return new Date(b.registered_at) - new Date(a.registered_at);
      if (sortBy === 'balance') return Number(b.available_balance) - Number(a.available_balance);
      return 0;
    });
  }, [affiliates, searchTerm, sortBy]);

  function formatMoney(v) { return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }
  function formatNumber(v) { return Number(v).toLocaleString('pt-BR'); }
  function formatDate(d) { return new Date(d).toLocaleDateString('pt-BR'); }
  function formatDateTime(d) { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

  function timeSince(d) {
    var diff = Date.now() - new Date(d).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return mins + 'min atras';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h atras';
    var days = Math.floor(hrs / 24);
    return days + 'd atras';
  }

  function getPerformance(a) {
    var expected = Math.min(a.days_since_signup || 30, 30) * 0.7;
    var actual = a.posts_30d || 0;
    var ratio = expected > 0 ? actual / expected : 0;
    if (ratio >= 1) return { label: 'Excelente', color: '#0070F3', bg: '#E6F0FF' };
    if (ratio >= 0.8) return { label: 'Bom', color: '#10B981', bg: '#ECFDF5' };
    if (ratio >= 0.5) return { label: 'Regular', color: '#F59E0B', bg: '#FFFBEB' };
    return { label: 'Baixo', color: '#EF4444', bg: '#FEF2F2' };
  }

  function getPlatformIcon(p) {
    if (p === 'instagram') return '📸';
    if (p === 'tiktok') return '🎵';
    if (p === 'facebook') return '👤';
    return '🌐';
  }

  function getPlatformColor(p) {
    if (p === 'instagram') return '#E1306C';
    if (p === 'tiktok') return '#000000';
    if (p === 'facebook') return '#1877F2';
    return '#666666';
  }

  if (loading) return (<div style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>Carregando...</div>);

  var tabs = [
    { id: 'overview', label: 'Visao Geral' },
    { id: 'posts', label: 'Postagens' },
    { id: 'affiliates', label: 'Afiliados' },
    { id: 'sales', label: 'Vendas' },
    { id: 'payments', label: 'Pagamentos' },
    { id: 'withdrawals', label: 'Saques' }
  ];

  var dateRangeOptions = [
    { v: '1', l: 'Hoje' },
    { v: '3', l: '3 dias' },
    { v: '7', l: '7 dias' },
    { v: '30', l: '30 dias' },
    { v: '90', l: '90 dias' },
    { v: 'all', l: 'Tudo' }
  ];

  var monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', color: '#1A1A1A', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E5E5', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', fontWeight: 800, fontSize: 14 }}>JM</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Joias Maromba</div>
            <div style={{ fontSize: 11, color: '#888' }}>Admin Dashboard</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#666' }}>{adminName}</div>
          <button onClick={function() { router.push('/painel'); }} style={{ background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: '#666', cursor: 'pointer' }}>Painel afiliado</button>
          <button onClick={function() { localStorage.clear(); router.push('/login'); }} style={{ background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: '#666', cursor: 'pointer' }}>Sair</button>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>Dashboard</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Visao geral da performance da sua rede de afiliados</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {dateRangeOptions.map(function(r) {
              return (<button key={r.v} onClick={function() { setDateRange(r.v); }} style={{ padding: '8px 14px', background: dateRange === r.v ? '#1A1A1A' : '#FFFFFF', color: dateRange === r.v ? '#FFFFFF' : '#666', border: '1px solid ' + (dateRange === r.v ? '#1A1A1A' : '#E5E5E5'), borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{r.l}</button>);
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E5E5E5', marginBottom: 24, overflowX: 'auto' }}>
          {tabs.map(function(t) {
            return (<button key={t.id} onClick={function() { setActiveTab(t.id); }} style={{ padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: activeTab === t.id ? '2px solid #1A1A1A' : '2px solid transparent', color: activeTab === t.id ? '#1A1A1A' : '#888', fontSize: 13, fontWeight: activeTab === t.id ? 600 : 500, cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap' }}>
              {t.label}
              {t.id === 'withdrawals' && kpis.pendingWithdrawals > 0 && (<span style={{ marginLeft: 6, background: '#EF4444', color: '#FFF', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{kpis.pendingWithdrawals}</span>)}
            </button>);
          })}
        </div>

        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Faturamento', value: formatMoney(kpis.revenue) },
                { label: 'Vendas', value: formatNumber(kpis.totalSales) },
                { label: 'Comissoes', value: formatMoney(kpis.commissions) },
                { label: 'Lucro liquido', value: formatMoney(kpis.netRevenue) },
                { label: 'Afiliados ativos', value: kpis.activeAffiliates + ' / ' + kpis.totalAffiliates },
                { label: 'Ticket medio', value: formatMoney(kpis.avgTicket) }
              ].map(function(k, i) {
                return (<div key={i} style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{k.value}</div>
                </div>);
              })}
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 24, marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Evolucao de vendas {new Date().getFullYear()}</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 24 }}>Torre por mes, troféu no top afiliado - atualizado em tempo real</div>
              <MonthlyTowersChart monthlySales={monthlySales} monthlyTops={monthlyTops} monthNames={monthNames} formatMoney={formatMoney} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
              <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Top 10 afiliados</div>
                {affiliates.slice().sort(function(a,b){return b.total_sales - a.total_sales;}).slice(0, 10).map(function(a, i) {
                  var perf = getPerformance(a);
                  return (<div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 9 ? '1px solid #F0F0F0' : 'none' }}>
                    <div style={{ width: 24, fontSize: 12, fontWeight: 600, color: i < 3 ? '#1A1A1A' : '#888' }}>{i + 1}</div>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#666' }}>{a.avatar_initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{a.coupon_code} · {a.total_sales} vendas</div>
                    </div>
                    <div style={{ padding: '2px 8px', background: perf.bg, color: perf.color, borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{perf.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#10B981' }}>{formatMoney(a.total_earned)}</div>
                  </div>);
                })}
                {affiliates.length === 0 && (<div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>Nenhum afiliado</div>)}
              </div>

              <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Pagamentos pendentes</div>
                {withdrawals.length === 0 && (<div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>Nenhum saque pendente</div>)}
                {withdrawals.slice(0, 5).map(function(w) {
                  return (<div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F0F0F0' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#92400E' }}>{w.affiliates && w.affiliates.avatar_initials || '?'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{w.affiliates && w.affiliates.name}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{formatDate(w.created_at)}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{formatMoney(w.amount)}</div>
                  </div>);
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'posts' && (
          <div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: '#10B981' }}></div>
              <div style={{ fontSize: 13, color: '#666' }}><strong style={{ color: '#1A1A1A' }}>{recentPosts.length}</strong> postagens registradas · atualiza automaticamente a cada 30s</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E5E5', background: '#FAFAFA', display: 'grid', gridTemplateColumns: '40px 2fr 1fr 1fr 2fr', gap: 12, fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>
                <div></div><div>Afiliado</div><div>Rede</div><div>Data/Hora</div><div>Link / ID do Post</div>
              </div>
              {recentPosts.map(function(p) {
                return (<div key={p.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', display: 'grid', gridTemplateColumns: '40px 2fr 1fr 1fr 2fr', gap: 12, alignItems: 'center', fontSize: 13 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 16, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#666' }}>{p.avatar_initials}</div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{p.affiliate_name}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{p.coupon_code}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>{getPlatformIcon(p.platform)}</span>
                    <span style={{ fontSize: 12, color: getPlatformColor(p.platform), fontWeight: 600, textTransform: 'capitalize' }}>{p.platform}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#666' }}>{formatDateTime(p.created_at)}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>{timeSince(p.created_at)}</div>
                  </div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#1A1A1A', wordBreak: 'break-all' }}>
                    {p.post_identifier ? (p.post_identifier.startsWith('http') ? (<a href={p.post_identifier} target="_blank" rel="noopener" style={{ color: '#0070F3', textDecoration: 'none' }}>{p.post_identifier} ↗</a>) : p.post_identifier) : (<span style={{ color: '#CCC' }}>sem link</span>)}
                  </div>
                </div>);
              })}
              {recentPosts.length === 0 && (<div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Nenhuma postagem registrada ainda</div>)}
            </div>
          </div>
        )}

        {activeTab === 'affiliates' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <input type="text" value={searchTerm} onChange={function(e) { setSearchTerm(e.target.value); }} placeholder="Buscar..." style={{ flex: 1, minWidth: 240, padding: '10px 14px', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 13, outline: 'none' }} />
              <select value={sortBy} onChange={function(e) { setSortBy(e.target.value); }} style={{ padding: '10px 14px', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                <option value="sales">Mais vendas</option>
                <option value="earned">Mais ganhos</option>
                <option value="balance">Maior saldo</option>
                <option value="recent">Mais recentes</option>
              </select>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8 }}>
              {topAffiliates.map(function(a) {
                var perf = getPerformance(a);
                return (<div key={a.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#666' }}>{a.avatar_initials}</div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{a.email} · {a.coupon_code}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#888', fontSize: 10, textTransform: 'uppercase' }}>Vendas</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{a.total_sales}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#888', fontSize: 10, textTransform: 'uppercase' }}>Saldo</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#10B981' }}>{formatMoney(a.available_balance)}</div>
                  </div>
                  <div style={{ padding: '3px 10px', background: perf.bg, color: perf.color, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{perf.label}</div>
                </div>);
              })}
              {topAffiliates.length === 0 && (<div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Nenhum afiliado</div>)}
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E5E5', background: '#FAFAFA', display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr 1fr', gap: 12, fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>
              <div>Data</div><div>Produto</div><div>Cliente</div><div>Afiliado</div><div>Valor</div><div>Comissao</div>
            </div>
            {filteredSales.slice(0, 100).map(function(s) {
              return (<div key={s.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F0F0F0', display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr 1fr', gap: 12, alignItems: 'center', fontSize: 13 }}>
                <div style={{ color: '#888', fontSize: 12 }}>{new Date(s.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                <div style={{ fontWeight: 500 }}>{s.product_name}</div>
                <div style={{ color: '#666' }}>{s.buyer_name}</div>
                <div style={{ color: '#666' }}>{s.affiliates && s.affiliates.coupon_code}</div>
                <div>{formatMoney(s.product_value || 0)}</div>
                <div style={{ color: '#10B981', fontWeight: 600 }}>{formatMoney(s.commission_earned)}</div>
              </div>);
            })}
            {filteredSales.length === 0 && (<div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Nenhuma venda no periodo</div>)}
          </div>
        )}

        {activeTab === 'payments' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8 }}>
            {affiliates.filter(function(a) { return a.days_since_signup >= 30 && Number(a.available_balance) > 0; }).map(function(a) {
              return (<div key={a.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#666' }}>{a.avatar_initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{a.email} · {a.days_since_signup} dias</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#10B981' }}>{formatMoney(a.available_balance)}</div>
              </div>);
            })}
            {affiliates.filter(function(a) { return a.days_since_signup >= 30 && Number(a.available_balance) > 0; }).length === 0 && (<div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Nenhum afiliado com saldo pendente</div>)}
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div>
            {withdrawals.map(function(w) {
              var af = w.affiliates || {};
              return (<div key={w.id} style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 18, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#92400E' }}>{af.avatar_initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{af.name}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{af.coupon_code}</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{formatMoney(w.amount)}</div>
                </div>
                <div style={{ background: '#FAFAFA', border: '1px solid #E5E5E5', borderRadius: 6, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>CHAVE PIX ({w.pix_type})</div>
                  <div style={{ fontSize: 14, fontFamily: 'monospace', wordBreak: 'break-all' }}>{w.pix_key}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={function() { navigator.clipboard.writeText(w.pix_key); alert('Copiado'); }} style={{ padding: '8px 14px', background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#666' }}>Copiar PIX</button>
                  <button onClick={function() { if (confirm('Pagar ' + formatMoney(w.amount) + '?')) markPaid(w.id); }} style={{ flex: 1, padding: 10, background: '#10B981', border: 'none', borderRadius: 6, color: '#FFFFFF', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Marcar como pago</button>
                  <button onClick={function() { if (confirm('Rejeitar?')) rejectWith(w.id); }} style={{ padding: '10px 16px', background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 6, color: '#666', fontSize: 13, cursor: 'pointer' }}>Rejeitar</button>
                </div>
              </div>);
            })}
            {withdrawals.length === 0 && (<div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 40, textAlign: 'center', color: '#888' }}>Nenhuma solicitacao pendente</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

function MonthlyTowersChart({ monthlySales, monthlyTops, monthNames, formatMoney }) {
  var currentMonth = new Date().getMonth() + 1;
  var maxRevenue = Math.max.apply(null, monthlySales.map(function(m) { return Number(m.revenue); }).concat([1]));

  function getMonthData(monthNum) {
    return monthlySales.find(function(m) { return m.month_num === monthNum; }) || { sales_count: 0, revenue: 0 };
  }

  function getTopData(monthNum) {
    return monthlyTops.find(function(m) { return m.month_num === monthNum; });
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 340, padding: '20px 0 0' }}>
      {[1,2,3,4,5,6,7,8,9,10,11,12].map(function(m) {
        var data = getMonthData(m);
        var top = getTopData(m);
        var revenue = Number(data.revenue);
        var heightPct = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
        var isCurrent = m === currentMonth;
        var isFuture = m > currentMonth;

        return (
          <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', minWidth: 0 }}>
            <div style={{ minHeight: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 4 }}>
              {top && !isFuture && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, lineHeight: 1 }}>🏆</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#FFD700', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>{top.coupon_code}</div>
                </div>
              )}
            </div>

            <div style={{ width: '100%', maxWidth: 60, height: Math.max(heightPct, isFuture ? 0 : 2) + '%', minHeight: isFuture ? 0 : 2, background: isFuture ? 'transparent' : (isCurrent ? 'linear-gradient(180deg, #FFD700 0%, #FFA500 100%)' : 'linear-gradient(180deg, #1A1A1A 0%, #333 100%)'), borderRadius: '6px 6px 0 0', transition: 'height 0.5s ease-out', position: 'relative' }}>
              {revenue > 0 && (
                <div style={{ position: 'absolute', top: -20, left: 0, right: 0, textAlign: 'center', fontSize: 10, fontWeight: 700, color: isCurrent ? '#FFA500' : '#666' }}>{data.sales_count}</div>
              )}
            </div>

            <div style={{ width: '100%', maxWidth: 60, height: 3, background: '#1A1A1A', borderRadius: 1 }}></div>

            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: isCurrent ? '#1A1A1A' : '#888' }}>{monthNames[m-1]}</div>

            <div style={{ marginTop: 2, fontSize: 10, color: '#666', whiteSpace: 'nowrap' }}>{revenue > 0 ? formatMoney(revenue) : '–'}</div>
          </div>
        );
      })}
    </div>
  );
}

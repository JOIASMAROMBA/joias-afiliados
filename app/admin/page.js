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
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [allWithdrawals, setAllWithdrawals] = useState([]);
  const [adminName, setAdminName] = useState('Admin');
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);

  useEffect(function() { init(); }, []);

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
    var [affRes, salesRes, metricsRes, withRes] = await Promise.all([
      supabase.from('affiliate_metrics').select('*'),
      supabase.from('sales').select('*, affiliates(name, coupon_code)').order('created_at', { ascending: false }).limit(500),
      supabase.from('daily_metrics').select('*'),
      supabase.from('withdrawals').select('*, affiliates(name, coupon_code, avatar_initials, email)').order('created_at', { ascending: false })
    ]);
    setAffiliates(affRes.data || []);
    setAllSales(salesRes.data || []);
    setDailyMetrics(metricsRes.data || []);
    setAllWithdrawals(withRes.data || []);
    setWithdrawals((withRes.data || []).filter(function(w) { return w.status === 'pending'; }));
  }

  async function markPaid(wid) {
    await supabase.from('withdrawals').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', wid);
    await loadAll();
  }

  async function rejectWith(wid) {
    await supabase.from('withdrawals').update({ status: 'rejected' }).eq('id', wid);
    await loadAll();
  }

  async function toggleBlock(affId, current) {
    await supabase.from('affiliates').update({ blocked: !current }).eq('id', affId);
    await loadAll();
  }

  // Filtered data based on date range
  var filteredSales = useMemo(function() {
    if (dateRange === 'all') return allSales;
    var days = parseInt(dateRange);
    if (isNaN(days)) return allSales;
    var cutoff;
    if (days === 1) {
      // "Hoje" = desde 00:00 do dia atual
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      cutoff = today.getTime();
    } else {
      cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    }
    return allSales.filter(function(s) { return new Date(s.created_at).getTime() >= cutoff; });
  }, [allSales, dateRange]);

  // KPIs
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
      pendingWithdrawals: withdrawals.length,
      pendingAmount: withdrawals.reduce(function(s, w) { return s + Number(w.amount); }, 0)
    };
  }, [filteredSales, affiliates, withdrawals, dateRange]);

  // Previous period for comparison
  var previousKpis = useMemo(function() {
    var days = parseInt(dateRange) || 30;
    if (dateRange === 'all') return { totalSales: 0, revenue: 0 };
    var now = Date.now();
    var prevStart, prevEnd;
    if (days === 1) {
      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      var todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      prevStart = yesterday.getTime();
      prevEnd = todayStart.getTime();
    } else {
      prevStart = now - days * 2 * 24 * 60 * 60 * 1000;
      prevEnd = now - days * 24 * 60 * 60 * 1000;
    }
    var prev = allSales.filter(function(s) {
      var t = new Date(s.created_at).getTime();
      return t >= prevStart && t < prevEnd;
    });
    return { totalSales: prev.length, revenue: prev.reduce(function(s, v) { return s + Number(v.product_value || 0); }, 0) };
  }, [allSales, dateRange]);

  function trend(curr, prev) {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  function periodLabel() {
    if (dateRange === 'all') return 'todo o período';
    if (dateRange === '1') return 'de ontem';
    return 'período anterior';
  }

  // Top affiliates filtered/sorted
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

  function getPerformance(a) {
    var expected = Math.min(a.days_since_signup || 30, 30) * 0.7;
    var actual = a.posts_30d || 0;
    var ratio = expected > 0 ? actual / expected : 0;
    if (ratio >= 1) return { label: 'Excelente', color: '#0070F3', bg: '#E6F0FF' };
    if (ratio >= 0.8) return { label: 'Bom', color: '#10B981', bg: '#ECFDF5' };
    if (ratio >= 0.5) return { label: 'Regular', color: '#F59E0B', bg: '#FFFBEB' };
    return { label: 'Baixo', color: '#EF4444', bg: '#FEF2F2' };
  }

  if (loading) return (<div style={{ minHeight: '100vh', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#666' }}>Carregando...</div></div>);

  var tabs = [
    { id: 'overview', label: 'Visão Geral' },
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

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', color: '#1A1A1A', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif' }}>
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E5E5', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #1A1A1A, #333)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', fontWeight: 800, fontSize: 14 }}>JM</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Joias Maromba</div>
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
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A' }}>Dashboard</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Visão geral da performance da sua rede de afiliados</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {dateRangeOptions.map(function(r) {
              return (
                <button key={r.v} onClick={function() { setDateRange(r.v); }} style={{ padding: '8px 14px', background: dateRange === r.v ? '#1A1A1A' : '#FFFFFF', color: dateRange === r.v ? '#FFFFFF' : '#666', border: '1px solid ' + (dateRange === r.v ? '#1A1A1A' : '#E5E5E5'), borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{r.l}</button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E5E5E5', marginBottom: 24 }}>
          {tabs.map(function(t) {
            return (
              <button key={t.id} onClick={function() { setActiveTab(t.id); }} style={{ padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: activeTab === t.id ? '2px solid #1A1A1A' : '2px solid transparent', color: activeTab === t.id ? '#1A1A1A' : '#888', fontSize: 13, fontWeight: activeTab === t.id ? 600 : 500, cursor: 'pointer', marginBottom: -1 }}>
                {t.label}
                {t.id === 'withdrawals' && kpis.pendingWithdrawals > 0 && (<span style={{ marginLeft: 6, background: '#EF4444', color: '#FFF', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{kpis.pendingWithdrawals}</span>)}
              </button>
            );
          })}
        </div>

        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Faturamento', value: formatMoney(kpis.revenue), trend: trend(kpis.revenue, previousKpis.revenue) },
                { label: 'Vendas', value: formatNumber(kpis.totalSales), trend: trend(kpis.totalSales, previousKpis.totalSales) },
                { label: 'Comissões a pagar', value: formatMoney(kpis.commissions), sub: 'R$ ' + kpis.commissions.toFixed(2) + ' no período' },
                { label: 'Lucro líquido', value: formatMoney(kpis.netRevenue), sub: 'Receita - comissões' },
                { label: 'Afiliados ativos', value: kpis.activeAffiliates + ' / ' + kpis.totalAffiliates, sub: 'Com vendas no período' },
                { label: 'Ticket médio', value: formatMoney(kpis.avgTicket), sub: kpis.avgPerDay.toFixed(1) + ' vendas/dia' }
              ].map(function(k, i) {
                return (
                  <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>{k.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>{k.value}</div>
                    {k.trend !== undefined && (
                      <div style={{ fontSize: 12, color: k.trend > 0 ? '#10B981' : k.trend < 0 ? '#EF4444' : '#888', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span>{k.trend > 0 ? '↑' : k.trend < 0 ? '↓' : '–'}</span>{Math.abs(k.trend)}% vs {periodLabel()}
                      </div>
                    )}
                    {k.sub && (<div style={{ fontSize: 12, color: '#888' }}>{k.sub}</div>)}
                  </div>
                );
              })}
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Evolução de vendas</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Últimos 30 dias</div>
                </div>
              </div>
              <SalesChart data={dailyMetrics.slice(0, 30).reverse()} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
              <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Top 10 afiliados</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>Por volume de vendas totais</div>
                {affiliates.slice().sort(function(a,b){return b.total_sales - a.total_sales;}).slice(0, 10).map(function(a, i) {
                  var perf = getPerformance(a);
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 9 ? '1px solid #F0F0F0' : 'none' }}>
                      <div style={{ width: 24, fontSize: 12, fontWeight: 600, color: i < 3 ? '#1A1A1A' : '#888' }}>{i + 1}</div>
                      <div style={{ width: 32, height: 32, borderRadius: 16, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#666' }}>{a.avatar_initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>{a.coupon_code} · {a.total_sales} vendas</div>
                      </div>
                      <div style={{ padding: '2px 8px', background: perf.bg, color: perf.color, borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{perf.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#10B981', minWidth: 80, textAlign: 'right' }}>{formatMoney(a.total_earned)}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Pagamentos pendentes</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>Aguardando processamento</div>
                {withdrawals.length === 0 && (<div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>Nenhum saque pendente</div>)}
                {withdrawals.slice(0, 5).map(function(w) {
                  return (
                    <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F0F0F0' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 16, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#92400E' }}>{w.affiliates && w.affiliates.avatar_initials || '?'}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{w.affiliates && w.affiliates.name}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>Solicitado em {formatDate(w.created_at)}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{formatMoney(w.amount)}</div>
                    </div>
                  );
                })}
                {withdrawals.length > 5 && (<button onClick={function() { setActiveTab('withdrawals'); }} style={{ marginTop: 12, width: '100%', padding: 8, background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 12, color: '#666', cursor: 'pointer', fontWeight: 500 }}>Ver todos ({withdrawals.length})</button>)}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'affiliates' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <input type="text" value={searchTerm} onChange={function(e) { setSearchTerm(e.target.value); }} placeholder="Buscar por nome, cupom ou email..." style={{ flex: 1, minWidth: 240, padding: '10px 14px', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 13, outline: 'none', background: '#FFFFFF' }} />
              <select value={sortBy} onChange={function(e) { setSortBy(e.target.value); }} style={{ padding: '10px 14px', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 13, background: '#FFFFFF', cursor: 'pointer' }}>
                <option value="sales">Ordenar: mais vendas</option>
                <option value="earned">Ordenar: mais ganhos</option>
                <option value="balance">Ordenar: maior saldo</option>
                <option value="recent">Ordenar: mais recentes</option>
              </select>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E5E5', background: '#FAFAFA', display: 'grid', gridTemplateColumns: '40px 2fr 1fr 1fr 1fr 1fr 1fr 80px', gap: 12, fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                <div></div><div>Afiliado</div><div>Cupom</div><div>Vendas</div><div>Posts 30d</div><div>Saldo</div><div>Performance</div><div></div>
              </div>
              {topAffiliates.map(function(a) {
                var perf = getPerformance(a);
                return (
                  <div key={a.id} onClick={function() { setSelectedAffiliate(a); }} style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', display: 'grid', gridTemplateColumns: '40px 2fr 1fr 1fr 1fr 1fr 1fr 80px', gap: 12, alignItems: 'center', fontSize: 13, cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={function(e) { e.currentTarget.style.background = '#FAFAFA'; }} onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#666' }}>{a.avatar_initials}</div>
                    <div>
                      <div style={{ fontWeight: 500, color: '#1A1A1A' }}>{a.name} {a.blocked && <span style={{ background: '#FEF2F2', color: '#EF4444', padding: '1px 6px', borderRadius: 4, fontSize: 10, marginLeft: 6 }}>BLOQUEADO</span>}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{a.email}</div>
                    </div>
                    <div style={{ color: '#666' }}>{a.coupon_code}</div>
                    <div>
                      <div style={{ color: '#1A1A1A', fontWeight: 600 }}>{a.total_sales}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{a.sales_30d} nos últimos 30d</div>
                    </div>
                    <div>
                      <div style={{ color: '#1A1A1A' }}>{a.posts_30d}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>total: {a.total_posts}</div>
                    </div>
                    <div style={{ color: Number(a.available_balance) > 0 ? '#10B981' : '#888', fontWeight: 600 }}>{formatMoney(a.available_balance)}</div>
                    <div><div style={{ display: 'inline-block', padding: '3px 10px', background: perf.bg, color: perf.color, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{perf.label}</div></div>
                    <div style={{ color: '#888', fontSize: 11 }}>{formatDate(a.registered_at)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E5E5', background: '#FAFAFA', display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr 1fr', gap: 12, fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              <div>Data</div><div>Produto</div><div>Cliente</div><div>Afiliado</div><div>Valor</div><div>Comissão</div>
            </div>
            {filteredSales.slice(0, 100).map(function(s) {
              return (
                <div key={s.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F0F0F0', display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr 1fr', gap: 12, alignItems: 'center', fontSize: 13 }}>
                  <div style={{ color: '#888', fontSize: 12 }}>{new Date(s.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                  <div style={{ fontWeight: 500 }}>{s.product_name}</div>
                  <div style={{ color: '#666' }}>{s.buyer_name}</div>
                  <div style={{ color: '#666' }}>{s.affiliates && s.affiliates.coupon_code}</div>
                  <div style={{ fontWeight: 500 }}>{formatMoney(s.product_value || 0)}</div>
                  <div style={{ color: '#10B981', fontWeight: 600 }}>{formatMoney(s.commission_earned)}</div>
                </div>
              );
            })}
            {filteredSales.length === 0 && (<div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Nenhuma venda no período selecionado</div>)}
          </div>
        )}

        {activeTab === 'payments' && (
          <div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Afiliados com saldo disponível</div>
              <div style={{ fontSize: 12, color: '#888' }}>Com mais de 30 dias de cadastro e saldo positivo</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8 }}>
              {affiliates.filter(function(a) { return a.days_since_signup >= 30 && Number(a.available_balance) > 0; }).map(function(a) {
                var perf = getPerformance(a);
                return (
                  <div key={a.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#666' }}>{a.avatar_initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{a.email} · Cupom: {a.coupon_code} · {a.days_since_signup} dias cadastrado</div>
                    </div>
                    <div style={{ padding: '3px 10px', background: perf.bg, color: perf.color, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{perf.label}</div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#888' }}>A pagar</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#10B981' }}>{formatMoney(a.available_balance)}</div>
                    </div>
                  </div>
                );
              })}
              {affiliates.filter(function(a) { return a.days_since_signup >= 30 && Number(a.available_balance) > 0; }).length === 0 && (<div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Nenhum afiliado com saldo pendente</div>)}
            </div>
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>Pendentes</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{withdrawals.length}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{formatMoney(kpis.pendingAmount)}</div>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>Pagos (total)</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{allWithdrawals.filter(function(w){return w.status==='paid';}).length}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{formatMoney(allWithdrawals.filter(function(w){return w.status==='paid';}).reduce(function(s,w){return s+Number(w.amount);},0))}</div>
              </div>
            </div>

            {withdrawals.map(function(w) {
              var af = w.affiliates || {};
              return (
                <div key={w.id} style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 18, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 20, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#92400E' }}>{af.avatar_initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{af.name}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{af.coupon_code} · {af.email}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Solicitado em {new Date(w.created_at).toLocaleString('pt-BR')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#888' }}>Valor solicitado</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{formatMoney(w.amount)}</div>
                    </div>
                  </div>
                  <div style={{ background: '#FAFAFA', border: '1px solid #E5E5E5', borderRadius: 6, padding: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>CHAVE PIX ({w.pix_type})</div>
                      <div style={{ fontSize: 14, fontFamily: 'monospace', color: '#1A1A1A', wordBreak: 'break-all' }}>{w.pix_key}</div>
                    </div>
                    <button onClick={function() { navigator.clipboard.writeText(w.pix_key); alert('Chave PIX copiada'); }} style={{ padding: '6px 12px', background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#666' }}>Copiar</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={function() { if (confirm('Confirmar pagamento de ' + formatMoney(w.amount) + '?')) markPaid(w.id); }} style={{ flex: 1, padding: 10, background: '#10B981', border: 'none', borderRadius: 6, color: '#FFFFFF', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Marcar como pago</button>
                    <button onClick={function() { if (confirm('Rejeitar solicitação?')) rejectWith(w.id); }} style={{ padding: '10px 16px', background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 6, color: '#666', fontSize: 13, cursor: 'pointer' }}>Rejeitar</button>
                  </div>
                </div>
              );
            })}
            {withdrawals.length === 0 && (<div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 40, textAlign: 'center', color: '#888' }}>Nenhuma solicitação de saque pendente</div>)}

            {allWithdrawals.filter(function(w){return w.status !== 'pending';}).length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#666', marginTop: 24, marginBottom: 12 }}>Histórico</div>
                <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8 }}>
                  {allWithdrawals.filter(function(w){return w.status !== 'pending';}).slice(0, 20).map(function(w) {
                    return (
                      <div key={w.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                        <div style={{ padding: '2px 8px', background: w.status === 'paid' ? '#ECFDF5' : '#FEF2F2', color: w.status === 'paid' ? '#10B981' : '#EF4444', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{w.status === 'paid' ? 'Pago' : 'Rejeitado'}</div>
                        <div style={{ flex: 1 }}>{w.affiliates && w.affiliates.name}</div>
                        <div style={{ color: '#888', fontSize: 12 }}>{formatDate(w.created_at)}</div>
                        <div style={{ fontWeight: 600 }}>{formatMoney(w.amount)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedAffiliate && (<AffiliateDetailModal affiliate={selectedAffiliate} onClose={function() { setSelectedAffiliate(null); }} onToggleBlock={toggleBlock} formatMoney={formatMoney} formatDate={formatDate} />)}
    </div>
  );
}

function SalesChart({ data }) {
  if (!data || data.length === 0) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Sem dados</div>;
  var max = Math.max.apply(null, data.map(function(d) { return d.sales_count; }));
  if (max === 0) max = 1;
  return (
    <div style={{ position: 'relative', height: 180 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 20, top: 0, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        {data.map(function(d, i) {
          var h = (d.sales_count / max) * 100;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
              <div title={d.sales_count + ' vendas em ' + d.day} style={{ width: '100%', height: h + '%', background: 'linear-gradient(180deg, #1A1A1A, #444)', borderRadius: '3px 3px 0 0', minHeight: 2, transition: 'all 0.2s' }}></div>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', fontSize: 9, color: '#AAA' }}>
        {data.map(function(d, i) {
          if (i % 5 !== 0 && i !== data.length - 1) return <div key={i} style={{ flex: 1 }}></div>;
          return (<div key={i} style={{ flex: 1, textAlign: 'center' }}>{new Date(d.day).getDate() + '/' + (new Date(d.day).getMonth() + 1)}</div>);
        })}
      </div>
    </div>
  );
}

function AffiliateDetailModal({ affiliate, onClose, onToggleBlock, formatMoney, formatDate }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#FFFFFF', borderRadius: 12, maxWidth: 600, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#666' }}>{affiliate.avatar_initials}</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{affiliate.name}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{affiliate.email}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 18, color: '#888', cursor: 'pointer', padding: 4 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Cupom', value: affiliate.coupon_code },
              { label: 'Cadastrado em', value: formatDate(affiliate.registered_at) + ' (' + affiliate.days_since_signup + ' dias)' },
              { label: 'Vendas totais', value: affiliate.total_sales },
              { label: 'Vendas 30d', value: affiliate.sales_30d },
              { label: 'Total ganho', value: formatMoney(affiliate.total_earned) },
              { label: 'Total pago', value: formatMoney(affiliate.total_paid) },
              { label: 'Saldo disponível', value: formatMoney(affiliate.available_balance) },
              { label: 'Saques pendentes', value: formatMoney(affiliate.pending_withdrawals) },
              { label: 'Posts 30d', value: affiliate.posts_30d },
              { label: 'Posts totais', value: affiliate.total_posts }
            ].map(function(f, i) {
              return (
                <div key={i}>
                  <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 14, color: '#1A1A1A' }}>{f.value}</div>
                </div>
              );
            })}
          </div>
          <button onClick={function() { if (confirm(affiliate.blocked ? 'Desbloquear afiliado?' : 'Bloquear afiliado?')) { onToggleBlock(affiliate.id, affiliate.blocked); onClose(); } }} style={{ width: '100%', padding: 10, background: affiliate.blocked ? '#10B981' : '#FFFFFF', border: '1px solid ' + (affiliate.blocked ? '#10B981' : '#EF4444'), borderRadius: 6, color: affiliate.blocked ? '#FFFFFF' : '#EF4444', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{affiliate.blocked ? 'Desbloquear afiliado' : 'Bloquear afiliado'}</button>
        </div>
      </div>
    </div>
  );
}

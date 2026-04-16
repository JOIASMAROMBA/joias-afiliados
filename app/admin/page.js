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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [affiliates, setAffiliates] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [adminName, setAdminName] = useState('Admin');
  const [recentPosts, setRecentPosts] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [monthlyTops, setMonthlyTops] = useState([]);
  const [selectedAffiliateFilter, setSelectedAffiliateFilter] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [viewReceiptUrl, setViewReceiptUrl] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [rewardForm, setRewardForm] = useState({ target_type: 'sales', target_value: '', reward_title: '', reward_description: '', reward_emoji: '🎁', reward_value_money: '' });
  const [obligationsAffiliateId, setObligationsAffiliateId] = useState(null);
  const [obligationsList, setObligationsList] = useState([]);
  const [obligationMonth, setObligationMonth] = useState(new Date().getMonth());
  const [obligationYear, setObligationYear] = useState(new Date().getFullYear());

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
    try { var affRes = await supabase.from('affiliate_metrics').select('*'); setAffiliates(affRes.data || []); } catch (e) {}
    try { var salesRes = await supabase.from('sales').select('*, affiliates(name, coupon_code, avatar_initials)').order('created_at', { ascending: false }).limit(500); setAllSales(salesRes.data || []); } catch (e) {}
    try { var withRes = await supabase.from('withdrawals').select('*, affiliates(name, coupon_code, avatar_initials, email)').order('created_at', { ascending: false }); setWithdrawals(withRes.data || []); } catch (e) {}
    try { var postsRes = await supabase.from('recent_posts').select('*').limit(50); setRecentPosts(postsRes.data || []); } catch (e) {}
    try { var monthRes = await supabase.from('monthly_sales').select('*'); setMonthlySales(monthRes.data || []); } catch (e) {}
    try { var topsRes = await supabase.from('monthly_top_affiliate').select('*'); setMonthlyTops(topsRes.data || []); } catch (e) {}
    try { var rwRes = await supabase.from('rewards').select('*').order('target_value', { ascending: true }); setRewards(rwRes.data || []); } catch (e) {}
  }

  async function loadObligations(affiliateId) {
    setObligationsAffiliateId(affiliateId);
    try {
      var res = await supabase.from('posting_obligations').select('*').eq('affiliate_id', affiliateId).eq('active', true);
      setObligationsList(res.data || []);
    } catch(e) { setObligationsList([]); }
  }

  async function toggleRecurringWeekday(weekday) {
    if (!obligationsAffiliateId) return;
    var existing = obligationsList.find(function(o) { return o.obligation_type === 'recurring' && o.weekday === weekday; });
    if (existing) {
      await supabase.from('posting_obligations').delete().eq('id', existing.id);
    } else {
      await supabase.from('posting_obligations').insert({ affiliate_id: obligationsAffiliateId, obligation_type: 'recurring', weekday: weekday, active: true });
    }
    await loadObligations(obligationsAffiliateId);
  }

  async function toggleSpecificDate(dateStr) {
    if (!obligationsAffiliateId) return;
    var existing = obligationsList.find(function(o) { return o.obligation_type === 'specific' && o.specific_date === dateStr; });
    if (existing) {
      await supabase.from('posting_obligations').delete().eq('id', existing.id);
    } else {
      await supabase.from('posting_obligations').insert({ affiliate_id: obligationsAffiliateId, obligation_type: 'specific', specific_date: dateStr, active: true });
    }
    await loadObligations(obligationsAffiliateId);
  }

  async function clearAllObligations() {
    if (!obligationsAffiliateId) return;
    if (!confirm('Limpar TODAS as obrigações deste afiliado?')) return;
    await supabase.from('posting_obligations').delete().eq('affiliate_id', obligationsAffiliateId);
    await loadObligations(obligationsAffiliateId);
  }

  async function markPaid(wid) { await supabase.from('withdrawals').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', wid); await loadAll(); }
  async function rejectWith(wid) { await supabase.from('withdrawals').update({ status: 'rejected' }).eq('id', wid); await loadAll(); }

  async function uploadReceipt(wid, file) {
    if (!file) return;
    setUploadingId(wid);
    try {
      var ext = file.name.split('.').pop();
      var fileName = wid + '_' + Date.now() + '.' + ext;
      var uploadRes = await supabase.storage.from('receipts').upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadRes.error) throw uploadRes.error;
      var urlRes = supabase.storage.from('receipts').getPublicUrl(fileName);
      var publicUrl = urlRes.data.publicUrl;
      await supabase.from('withdrawals').update({ receipt_url: publicUrl, receipt_sent_at: new Date().toISOString() }).eq('id', wid);
      await loadAll();
    } catch (e) { alert('Erro: ' + (e.message || 'desconhecido')); }
    setUploadingId(null);
  }

  function openRewardModal(reward) {
    if (reward) {
      setEditingReward(reward);
      setRewardForm({ target_type: reward.target_type || 'sales', target_value: reward.target_value, reward_title: reward.reward_title, reward_description: reward.reward_description || '', reward_emoji: reward.reward_emoji || '🎁', reward_value_money: reward.reward_value_money || '' });
    } else {
      setEditingReward(null);
      setRewardForm({ target_type: 'sales', target_value: '', reward_title: '', reward_description: '', reward_emoji: '🎁', reward_value_money: '' });
    }
    setShowRewardModal(true);
  }

  async function saveReward() {
    if (!rewardForm.target_value || !rewardForm.reward_title) { alert('Preencha os campos obrigatórios'); return; }
    var data = { target_type: rewardForm.target_type, target_value: Number(rewardForm.target_value), reward_title: rewardForm.reward_title.trim(), reward_description: rewardForm.reward_description.trim(), reward_emoji: rewardForm.reward_emoji || '🎁', reward_value_money: rewardForm.reward_value_money ? Number(rewardForm.reward_value_money) : 0, active: true };
    if (editingReward) await supabase.from('rewards').update(data).eq('id', editingReward.id);
    else await supabase.from('rewards').insert(data);
    setShowRewardModal(false);
    await loadAll();
  }

  async function deleteReward(id) {
    if (!confirm('Tem certeza?')) return;
    await supabase.from('rewards').delete().eq('id', id);
    await loadAll();
  }

  async function toggleRewardActive(reward) {
    await supabase.from('rewards').update({ active: !reward.active }).eq('id', reward.id);
    await loadAll();
  }

  var filteredSales = useMemo(function() {
    if (dateRange === 'all') return allSales;
    var days = parseInt(dateRange);
    if (isNaN(days)) return allSales;
    var cutoff;
    if (days === 1) { var today = new Date(); today.setHours(0, 0, 0, 0); cutoff = today.getTime(); }
    else { cutoff = Date.now() - days * 24 * 60 * 60 * 1000; }
    return allSales.filter(function(s) { return new Date(s.created_at).getTime() >= cutoff; });
  }, [allSales, dateRange]);

  var kpis = useMemo(function() {
    var revenue = filteredSales.reduce(function(s, v) { return s + Number(v.product_value || 0); }, 0);
    var commissions = filteredSales.reduce(function(s, v) { return s + Number(v.commission_earned || 0); }, 0);
    var uniqueAffiliates = new Set(filteredSales.map(function(s) { return s.affiliate_id; })).size;
    return {
      totalSales: filteredSales.length, revenue: revenue, commissions: commissions, netRevenue: revenue - commissions,
      activeAffiliates: uniqueAffiliates, totalAffiliates: affiliates.length,
      avgTicket: filteredSales.length ? revenue / filteredSales.length : 0,
      pendingWithdrawals: withdrawals.filter(function(w) { return w.status === 'pending'; }).length
    };
  }, [filteredSales, affiliates, withdrawals, dateRange]);

  var pendingWithdrawals = withdrawals.filter(function(w) { return w.status === 'pending'; });

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

  var top10 = affiliates.slice().sort(function(a,b){return b.total_sales - a.total_sales;}).slice(0, 10);

  var filteredMonthlySales = useMemo(function() {
    if (!selectedAffiliateFilter) return monthlySales;
    var byMonth = {};
    allSales.filter(function(s) { return s.affiliate_id === selectedAffiliateFilter; }).forEach(function(s) {
      var date = new Date(s.created_at);
      if (date.getFullYear() !== new Date().getFullYear()) return;
      var m = date.getMonth() + 1;
      if (!byMonth[m]) byMonth[m] = { month_num: m, sales_count: 0, revenue: 0 };
      byMonth[m].sales_count += 1;
      byMonth[m].revenue += Number(s.product_value || 0);
    });
    return Object.values(byMonth);
  }, [selectedAffiliateFilter, monthlySales, allSales]);

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
    return Math.floor(hrs / 24) + 'd atras';
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
  function getPlatformIcon(p) { if (p === 'instagram') return '📸'; if (p === 'tiktok') return '🎵'; if (p === 'facebook') return '👤'; return '🌐'; }

  var affiliateColors = ['#FFD700', '#0070F3', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4'];

  if (loading) return (<div style={{ minHeight: '100vh', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>Carregando...</div>);

  var menuItems = [
    { id: 'overview', label: 'Visão Geral', icon: '📊' },
    { id: 'posts', label: 'Postagens', icon: '📸' },
    { id: 'affiliates', label: 'Afiliados', icon: '👥' },
    { id: 'sales', label: 'Vendas', icon: '💰' },
    { id: 'rewards', label: 'Recompensas', icon: '🎁' },
    { id: 'obligations', label: 'Obrigações', icon: '📅' },
    { id: 'payments', label: 'Pagamentos', icon: '💳' },
    { id: 'withdrawals', label: 'Saques', icon: '💸' }
  ];

  var dateRangeOptions = [{ v: '1', l: 'Hoje' }, { v: '3', l: '3 dias' }, { v: '7', l: '7 dias' }, { v: '30', l: '30 dias' }, { v: '90', l: '90 dias' }, { v: 'all', l: 'Tudo' }];
  var monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var monthFullNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var emojiOptions = ['🎁','💰','🛴','✈️','🏖️','🏆','🚗','📱','💻','⌚','👜','💎','🎧','🚲','🎮','📷','🍾','🏝️','🥂','👑'];
  var weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  // ===== Calendário do mês para obrigações =====
  function getMonthCalendar(year, month) {
    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);
    var startWeekday = firstDay.getDay();
    var totalDays = lastDay.getDate();
    var grid = [];
    for (var i = 0; i < startWeekday; i++) grid.push(null);
    for (var d = 1; d <= totalDays; d++) {
      var dateObj = new Date(year, month, d);
      var dateStr = dateObj.toISOString().split('T')[0];
      var weekday = dateObj.getDay();
      var hasRecurring = obligationsList.some(function(o) { return o.obligation_type === 'recurring' && o.weekday === weekday; });
      var hasSpecific = obligationsList.some(function(o) { return o.obligation_type === 'specific' && o.specific_date === dateStr; });
      grid.push({ day: d, dateStr: dateStr, weekday: weekday, hasRecurring: hasRecurring, hasSpecific: hasSpecific });
    }
    return grid;
  }

  var monthGrid = getMonthCalendar(obligationYear, obligationMonth);
  var selectedAffiliateData = obligationsAffiliateId ? affiliates.find(function(a) { return a.id === obligationsAffiliateId; }) : null;

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', color: '#1A1A1A', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', display: 'flex' }}>
      <aside style={{ width: sidebarOpen ? 240 : 68, background: '#FFFFFF', borderRight: '1px solid #E5E5E5', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 12, minHeight: 64 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>JM</div>
          {sidebarOpen && (<div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>Joias Maromba</div><div style={{ fontSize: 11, color: '#888' }}>Admin</div></div>)}
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {menuItems.map(function(item) {
            var isActive = activeTab === item.id;
            var showBadge = item.id === 'withdrawals' && kpis.pendingWithdrawals > 0;
            return (
              <button key={item.id} onClick={function() { setActiveTab(item.id); }} style={{ width: '100%', padding: '10px 12px', marginBottom: 2, background: isActive ? '#1A1A1A' : 'transparent', border: 'none', borderRadius: 8, color: isActive ? '#FFD700' : '#555', fontSize: 13, fontWeight: isActive ? 600 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', position: 'relative' }} onMouseEnter={function(e) { if (!isActive) e.currentTarget.style.background = '#F3F4F6'; }} onMouseLeave={function(e) { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>}
                {sidebarOpen && showBadge && (<span style={{ background: '#EF4444', color: '#FFF', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{kpis.pendingWithdrawals}</span>)}
                {!sidebarOpen && showBadge && (<span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, background: '#EF4444', borderRadius: 4 }} />)}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid #F0F0F0' }}>
          {sidebarOpen && (<div style={{ padding: '8px 12px', marginBottom: 8, background: '#FAFAFA', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 16, background: '#FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{adminName.substring(0, 2).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{adminName}</div><div style={{ fontSize: 10, color: '#888' }}>Admin</div></div>
          </div>)}
          <button onClick={function() { router.push('/painel'); }} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 12, color: '#666', cursor: 'pointer', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}><span>👁️</span>{sidebarOpen && 'Ver painel'}</button>
          <button onClick={function() { localStorage.clear(); router.push('/login'); }} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 12, color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}><span>🚪</span>{sidebarOpen && 'Sair'}</button>
          <button onClick={function() { setSidebarOpen(!sidebarOpen); }} style={{ width: '100%', marginTop: 8, padding: 6, background: 'transparent', border: '1px solid #F0F0F0', borderRadius: 6, fontSize: 14, color: '#AAA', cursor: 'pointer' }}>{sidebarOpen ? '‹' : '›'}</button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: 24, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{(menuItems.find(function(m){return m.id === activeTab;}) || {}).label || 'Dashboard'}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
              {activeTab === 'overview' && 'Visão geral da performance'}
              {activeTab === 'posts' && 'Feed em tempo real de postagens'}
              {activeTab === 'affiliates' && 'Gerenciar afiliados'}
              {activeTab === 'sales' && 'Todas as vendas registradas'}
              {activeTab === 'rewards' && 'Metas e prêmios para afiliados'}
              {activeTab === 'obligations' && 'Marque os dias obrigatórios de postagem por afiliado'}
              {activeTab === 'payments' && 'Afiliados com saldo a pagar'}
              {activeTab === 'withdrawals' && 'Processar saques solicitados'}
            </div>
          </div>
          {(activeTab === 'overview' || activeTab === 'sales') && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {dateRangeOptions.map(function(r) { return (<button key={r.v} onClick={function() { setDateRange(r.v); }} style={{ padding: '8px 14px', background: dateRange === r.v ? '#1A1A1A' : '#FFFFFF', color: dateRange === r.v ? '#FFFFFF' : '#666', border: '1px solid ' + (dateRange === r.v ? '#1A1A1A' : '#E5E5E5'), borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{r.l}</button>); })}
            </div>
          )}
        </div>

        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[{ label: 'Faturamento', value: formatMoney(kpis.revenue) },{ label: 'Vendas', value: formatNumber(kpis.totalSales) },{ label: 'Comissoes', value: formatMoney(kpis.commissions) },{ label: 'Lucro liquido', value: formatMoney(kpis.netRevenue) },{ label: 'Afiliados ativos', value: kpis.activeAffiliates + ' / ' + kpis.totalAffiliates },{ label: 'Ticket medio', value: formatMoney(kpis.avgTicket) }].map(function(k, i) { return (<div key={i} style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 16 }}><div style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div><div style={{ fontSize: 22, fontWeight: 700 }}>{k.value}</div></div>); })}
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 24, marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Evolucao de vendas {new Date().getFullYear()}</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>Clique em um afiliado para ver as vendas dele.</div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 8 }}>
                <button onClick={function() { setSelectedAffiliateFilter(null); }} style={{ minWidth: 100, padding: '8px 14px', background: selectedAffiliateFilter === null ? '#1A1A1A' : '#F3F4F6', color: selectedAffiliateFilter === null ? '#FFD700' : '#666', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}><span style={{ fontSize: 16 }}>🏆</span>Top 1</button>
                {top10.map(function(a, i) {
                  var color = affiliateColors[i % affiliateColors.length];
                  var isSel = selectedAffiliateFilter === a.id;
                  return (<button key={a.id} onClick={function() { setSelectedAffiliateFilter(a.id); }} style={{ minWidth: 110, padding: '6px 12px', background: isSel ? color : 'white', border: '2px solid ' + color, borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', color: isSel ? '#fff' : '#1A1A1A' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.3)' : color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{a.avatar_initials}</div>
                    {a.coupon_code}
                  </button>);
                })}
              </div>

              <MonthlyTowersChart monthlySales={filteredMonthlySales} monthlyTops={monthlyTops} monthNames={monthNames} formatMoney={formatMoney} selectedAffiliate={selectedAffiliateFilter ? affiliates.find(function(a) { return a.id === selectedAffiliateFilter; }) : null} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
              <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Top 10 afiliados</div>
                {top10.map(function(a, i) {
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
              </div>

              <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Pagamentos pendentes</div>
                {pendingWithdrawals.length === 0 && (<div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>Nenhum saque pendente</div>)}
                {pendingWithdrawals.slice(0, 5).map(function(w) {
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

        {activeTab === 'obligations' && (
          <div>
            {!obligationsAffiliateId ? (
              <div>
                <div style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #333 100%)', border: '1px solid #FFD700', borderRadius: 12, padding: 24, marginBottom: 20, color: '#FFD700' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>📅 Obrigações de Postagem</div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>Selecione um afiliado abaixo para configurar os dias obrigatórios</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {affiliates.map(function(a) {
                    return (<button key={a.id} onClick={function() { loadObligations(a.id); }} style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 10, padding: 16, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 20, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#666' }}>{a.avatar_initials}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>{a.coupon_code} · {a.total_sales} vendas</div>
                      </div>
                      <span style={{ color: '#888' }}>›</span>
                    </button>);
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                  <button onClick={function() { setObligationsAffiliateId(null); setObligationsList([]); }} style={{ padding: '8px 14px', background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>‹ Voltar</button>
                  {selectedAffiliateData && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 22, background: '#FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>{selectedAffiliateData.avatar_initials}</div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedAffiliateData.name}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{selectedAffiliateData.coupon_code}</div>
                      </div>
                    </div>
                  )}
                  <button onClick={clearAllObligations} style={{ padding: '8px 14px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#991B1B', cursor: 'pointer', fontWeight: 600 }}>🗑 Limpar tudo</button>
                </div>

                {/* Dias da semana recorrentes */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>📌 Dias da semana recorrentes</div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>Marque os dias da semana em que ESTE afiliado deve postar TODA semana</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                    {weekdayNames.map(function(name, idx) {
                      var isSel = obligationsList.some(function(o) { return o.obligation_type === 'recurring' && o.weekday === idx; });
                      return (<button key={idx} onClick={function() { toggleRecurringWeekday(idx); }} style={{ padding: '14px 8px', background: isSel ? 'linear-gradient(135deg, #FFD700, #B8860B)' : '#F3F4F6', border: '2px solid ' + (isSel ? '#FFD700' : '#E5E5E5'), borderRadius: 10, color: isSel ? '#000' : '#666', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{name}{isSel && <div style={{ fontSize: 16, marginTop: 4 }}>✓</div>}</button>);
                    })}
                  </div>
                </div>

                {/* Datas específicas no calendário */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>📆 Datas específicas (manual)</div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>Clique em datas específicas para marcar como obrigatórias</div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <button onClick={function() { var nm = obligationMonth - 1; if (nm < 0) { setObligationMonth(11); setObligationYear(obligationYear - 1); } else { setObligationMonth(nm); } }} style={{ padding: '6px 12px', background: '#F3F4F6', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>‹</button>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{monthFullNames[obligationMonth]} {obligationYear}</div>
                    <button onClick={function() { var nm = obligationMonth + 1; if (nm > 11) { setObligationMonth(0); setObligationYear(obligationYear + 1); } else { setObligationMonth(nm); } }} style={{ padding: '6px 12px', background: '#F3F4F6', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>›</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                    {weekdayNames.map(function(n, i) { return (<div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#888', padding: 4 }}>{n}</div>); })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                    {monthGrid.map(function(cell, i) {
                      if (!cell) return (<div key={i} style={{ minHeight: 50 }}></div>);
                      var isMarked = cell.hasRecurring || cell.hasSpecific;
                      var bg = cell.hasSpecific ? '#FFD700' : cell.hasRecurring ? '#FEF3C7' : '#FFFFFF';
                      var color = cell.hasSpecific ? '#000' : cell.hasRecurring ? '#92400E' : '#1A1A1A';
                      var border = cell.hasSpecific ? '2px solid #B8860B' : cell.hasRecurring ? '2px solid #FFD700' : '1px solid #E5E5E5';
                      return (<button key={i} onClick={function() { toggleSpecificDate(cell.dateStr); }} style={{ minHeight: 50, padding: 4, background: bg, color: color, border: border, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, position: 'relative' }}>
                        {cell.day}
                        {cell.hasRecurring && !cell.hasSpecific && <div style={{ position: 'absolute', top: 2, right: 2, fontSize: 9 }}>🔁</div>}
                        {cell.hasSpecific && <div style={{ position: 'absolute', top: 2, right: 2, fontSize: 9 }}>📌</div>}
                      </button>);
                    })}
                  </div>

                  <div style={{ marginTop: 16, padding: 12, background: '#F9FAFB', borderRadius: 8, fontSize: 11, color: '#666', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div>🔁 = Dia recorrente da semana</div>
                    <div>📌 = Data específica marcada manualmente</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rewards' && (
          <div>
            <div style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #333 100%)', border: '1px solid #FFD700', borderRadius: 12, padding: 24, marginBottom: 20, color: '#FFD700' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div><div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>🎁 Gerenciar Recompensas</div><div style={{ fontSize: 13, opacity: 0.8 }}>Crie metas e prêmios que motivam seus afiliados</div></div>
                <button onClick={function() { openRewardModal(null); }} style={{ padding: '12px 24px', background: '#FFD700', border: 'none', borderRadius: 8, color: '#1A1A1A', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>+ Nova Recompensa</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {rewards.map(function(r) {
                return (<div key={r.id} style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 12, padding: 20, opacity: r.active ? 1 : 0.5 }}>
                  <div style={{ fontSize: 48, marginBottom: 12, textAlign: 'center' }}>{r.reward_emoji}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>{r.reward_title}</div>
                  {r.reward_description && (<div style={{ fontSize: 12, color: '#666', marginBottom: 12, textAlign: 'center', minHeight: 16 }}>{r.reward_description}</div>)}
                  <div style={{ background: '#FFFBEB', border: '1px solid #FFD700', borderRadius: 8, padding: 12, textAlign: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: '#92400E', textTransform: 'uppercase', fontWeight: 600 }}>META</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{r.target_type === 'sales' ? r.target_value + ' vendas' : formatMoney(r.target_value)}</div>
                  </div>
                  {Number(r.reward_value_money) > 0 && (<div style={{ fontSize: 12, color: '#10B981', fontWeight: 600, textAlign: 'center', marginBottom: 12 }}>Bonus: {formatMoney(r.reward_value_money)}</div>)}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={function() { openRewardModal(r); }} style={{ flex: 1, padding: 8, background: '#F3F4F6', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✎ Editar</button>
                    <button onClick={function() { toggleRewardActive(r); }} style={{ flex: 1, padding: 8, background: r.active ? '#DCFCE7' : '#FEE2E2', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: r.active ? '#166534' : '#991B1B' }}>{r.active ? 'Ativa' : 'Inativa'}</button>
                    <button onClick={function() { deleteReward(r.id); }} style={{ padding: '8px 12px', background: '#FEE2E2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#991B1B' }}>🗑</button>
                  </div>
                </div>);
              })}
              {rewards.length === 0 && (<div style={{ gridColumn: '1 / -1', background: '#FFFFFF', border: '2px dashed #E5E5E5', borderRadius: 12, padding: 60, textAlign: 'center', color: '#888' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎁</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Nenhuma recompensa criada</div>
              </div>)}
            </div>
          </div>
        )}

        {activeTab === 'posts' && (
          <div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: '#10B981' }}></div>
              <div style={{ fontSize: 13, color: '#666' }}><strong>{recentPosts.length}</strong> postagens · atualiza a cada 30s</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E5E5', background: '#FAFAFA', display: 'grid', gridTemplateColumns: '40px 2fr 1fr 1fr 2fr', gap: 12, fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>
                <div></div><div>Afiliado</div><div>Rede</div><div>Data/Hora</div><div>Link / ID</div>
              </div>
              {recentPosts.map(function(p) {
                return (<div key={p.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', display: 'grid', gridTemplateColumns: '40px 2fr 1fr 1fr 2fr', gap: 12, alignItems: 'center', fontSize: 13 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 16, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#666' }}>{p.avatar_initials}</div>
                  <div><div style={{ fontWeight: 500 }}>{p.affiliate_name}</div><div style={{ fontSize: 11, color: '#888' }}>{p.coupon_code}</div></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 16 }}>{getPlatformIcon(p.platform)}</span><span style={{ fontSize: 12, textTransform: 'capitalize' }}>{p.platform}</span></div>
                  <div><div style={{ fontSize: 12, color: '#666' }}>{formatDateTime(p.created_at)}</div><div style={{ fontSize: 10, color: '#888' }}>{timeSince(p.created_at)}</div></div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>{p.post_identifier ? (p.post_identifier.startsWith('http') ? (<a href={p.post_identifier} target="_blank" rel="noopener" style={{ color: '#0070F3' }}>{p.post_identifier} ↗</a>) : p.post_identifier) : (<span style={{ color: '#CCC' }}>sem link</span>)}</div>
                </div>);
              })}
              {recentPosts.length === 0 && (<div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Nenhuma postagem</div>)}
            </div>
          </div>
        )}

        {activeTab === 'affiliates' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <input type="text" value={searchTerm} onChange={function(e) { setSearchTerm(e.target.value); }} placeholder="Buscar..." style={{ flex: 1, minWidth: 240, padding: '10px 14px', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 13 }} />
              <select value={sortBy} onChange={function(e) { setSortBy(e.target.value); }} style={{ padding: '10px 14px', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 13 }}>
                <option value="sales">Mais vendas</option><option value="earned">Mais ganhos</option><option value="balance">Maior saldo</option><option value="recent">Mais recentes</option>
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
                  <div style={{ textAlign: 'center' }}><div style={{ color: '#888', fontSize: 10 }}>Vendas</div><div style={{ fontWeight: 700, fontSize: 16 }}>{a.total_sales}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ color: '#888', fontSize: 10 }}>Saldo</div><div style={{ fontWeight: 700, fontSize: 14, color: '#10B981' }}>{formatMoney(a.available_balance)}</div></div>
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
            {filteredSales.length === 0 && (<div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Nenhuma venda</div>)}
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
            {affiliates.filter(function(a) { return a.days_since_signup >= 30 && Number(a.available_balance) > 0; }).length === 0 && (<div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Nenhum afiliado com saldo</div>)}
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div>
            {withdrawals.map(function(w) {
              var af = w.affiliates || {};
              var isPaid = w.status === 'paid';
              var isRejected = w.status === 'rejected';
              var hasReceipt = !!w.receipt_url;
              return (<div key={w.id} style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 18, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: isPaid ? '#D1FAE5' : isRejected ? '#FEE2E2' : '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{af.avatar_initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{af.name}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{af.coupon_code} · {w.affiliate_email || af.email}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Solicitado em {formatDateTime(w.created_at)}</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{formatMoney(w.amount)}</div>
                </div>
                <div style={{ background: '#FAFAFA', border: '1px solid #E5E5E5', borderRadius: 6, padding: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>CHAVE PIX ({w.pix_type})</div>
                    <div style={{ fontSize: 14, fontFamily: 'monospace', wordBreak: 'break-all' }}>{w.pix_key}</div>
                  </div>
                  <button onClick={function() { navigator.clipboard.writeText(w.pix_key); alert('Copiado'); }} style={{ padding: '6px 10px', background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Copiar</button>
                </div>

                {!isPaid && !isRejected && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={function() { if (confirm('Pagar?')) markPaid(w.id); }} style={{ flex: 1, padding: 12, background: '#EF4444', border: 'none', borderRadius: 6, color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>MARCAR COMO PAGO</button>
                    <button onClick={function() { if (confirm('Rejeitar?')) rejectWith(w.id); }} style={{ padding: '10px 16px', background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Rejeitar</button>
                  </div>
                )}

                {isPaid && (
                  <div>
                    <div style={{ padding: '10px 14px', background: '#10B981', borderRadius: 6, color: '#FFFFFF', fontWeight: 800, fontSize: 13, textAlign: 'center', marginBottom: 10 }}>✓ PAGO em {formatDateTime(w.paid_at)}</div>
                    {!hasReceipt && (
                      <label style={{ display: 'block', padding: 12, background: '#EF4444', borderRadius: 6, color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>
                        {uploadingId === w.id ? 'ENVIANDO...' : '📎 ENVIAR COMPROVANTE'}
                        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={function(e) { if (e.target.files[0]) uploadReceipt(w.id, e.target.files[0]); }} />
                      </label>
                    )}
                    {hasReceipt && (<button onClick={function() { setViewReceiptUrl(w.receipt_url); }} style={{ width: '100%', padding: 12, background: '#10B981', border: 'none', borderRadius: 6, color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✓ COMPROVANTE ENVIADO</button>)}
                  </div>
                )}

                {isRejected && (<div style={{ padding: '10px 14px', background: '#FEE2E2', borderRadius: 6, color: '#991B1B', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>REJEITADO</div>)}
              </div>);
            })}
            {withdrawals.length === 0 && (<div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 40, textAlign: 'center', color: '#888' }}>Nenhuma solicitacao</div>)}
          </div>
        )}
      </main>

      {showRewardModal && (
        <div onClick={function() { setShowRewardModal(false); }} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: 500, width: '100%', background: '#fff', borderRadius: 12, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{editingReward ? 'Editar' : 'Nova'} Recompensa</div>
              <button onClick={function() { setShowRewardModal(false); }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Emoji</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6, marginBottom: 16 }}>
              {emojiOptions.map(function(em) {
                return (<button key={em} onClick={function() { setRewardForm(Object.assign({}, rewardForm, { reward_emoji: em })); }} style={{ padding: 8, fontSize: 20, background: rewardForm.reward_emoji === em ? '#FFD700' : '#F3F4F6', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{em}</button>);
              })}
            </div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Titulo *</label>
            <input type="text" value={rewardForm.reward_title} onChange={function(e) { setRewardForm(Object.assign({}, rewardForm, { reward_title: e.target.value })); }} placeholder="Ex: Viagem para Paris" style={{ width: '100%', padding: 10, border: '1px solid #E5E5E5', borderRadius: 6, marginBottom: 12, fontSize: 14 }} />
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Descricao</label>
            <input type="text" value={rewardForm.reward_description} onChange={function(e) { setRewardForm(Object.assign({}, rewardForm, { reward_description: e.target.value })); }} placeholder="Ex: Tudo pago" style={{ width: '100%', padding: 10, border: '1px solid #E5E5E5', borderRadius: 6, marginBottom: 12, fontSize: 14 }} />
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Tipo de meta</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button onClick={function() { setRewardForm(Object.assign({}, rewardForm, { target_type: 'sales' })); }} style={{ flex: 1, padding: 10, background: rewardForm.target_type === 'sales' ? '#1A1A1A' : '#F3F4F6', color: rewardForm.target_type === 'sales' ? '#FFD700' : '#666', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Numero de vendas</button>
              <button onClick={function() { setRewardForm(Object.assign({}, rewardForm, { target_type: 'revenue' })); }} style={{ flex: 1, padding: 10, background: rewardForm.target_type === 'revenue' ? '#1A1A1A' : '#F3F4F6', color: rewardForm.target_type === 'revenue' ? '#FFD700' : '#666', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Valor em R$</button>
            </div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Meta *</label>
            <input type="number" value={rewardForm.target_value} onChange={function(e) { setRewardForm(Object.assign({}, rewardForm, { target_value: e.target.value })); }} placeholder={rewardForm.target_type === 'sales' ? 'Ex: 50' : 'Ex: 10000'} style={{ width: '100%', padding: 10, border: '1px solid #E5E5E5', borderRadius: 6, marginBottom: 12, fontSize: 14 }} />
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Bonus em dinheiro</label>
            <input type="number" value={rewardForm.reward_value_money} onChange={function(e) { setRewardForm(Object.assign({}, rewardForm, { reward_value_money: e.target.value })); }} placeholder="Ex: 200" style={{ width: '100%', padding: 10, border: '1px solid #E5E5E5', borderRadius: 6, marginBottom: 20, fontSize: 14 }} />
            <button onClick={saveReward} style={{ width: '100%', padding: 12, background: '#1A1A1A', color: '#FFD700', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{editingReward ? 'Salvar' : 'Criar'}</button>
          </div>
        </div>
      )}

      {viewReceiptUrl && (
        <div onClick={function() { setViewReceiptUrl(null); }} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: 600, width: '100%', background: '#fff', borderRadius: 12, padding: 20, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Comprovante</div>
              <button onClick={function() { setViewReceiptUrl(null); }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <img src={viewReceiptUrl} alt="comprovante" style={{ width: '100%', borderRadius: 8 }} />
            <a href={viewReceiptUrl} download target="_blank" rel="noopener" style={{ display: 'block', marginTop: 12, padding: 12, background: '#10B981', borderRadius: 8, color: '#fff', fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>Baixar</a>
          </div>
        </div>
      )}
    </div>
  );
}

function MonthlyTowersChart({ monthlySales, monthlyTops, monthNames, formatMoney, selectedAffiliate }) {
  var currentMonth = new Date().getMonth() + 1;
  var maxRevenue = Math.max.apply(null, (monthlySales || []).map(function(m) { return Number(m.revenue); }).concat([100]));
  var levelStep = maxRevenue > 10000 ? 5000 : maxRevenue > 5000 ? 2500 : maxRevenue > 1000 ? 1000 : maxRevenue > 500 ? 500 : 250;
  var topLevel = Math.ceil(maxRevenue / levelStep) * levelStep;
  if (topLevel === 0) topLevel = levelStep;

  var levels = [];
  for (var i = 0; i <= 4; i++) { levels.push(Math.round((topLevel / 4) * i)); }
  levels.reverse();

  function getMonthData(monthNum) { return (monthlySales || []).find(function(m) { return m.month_num === monthNum; }) || { sales_count: 0, revenue: 0 }; }
  function getTopData(monthNum) { if (selectedAffiliate) return null; return monthlyTops.find(function(m) { return m.month_num === monthNum; }); }

  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', height: 380, position: 'relative' }}>
      <div style={{ width: 70, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 60, paddingBottom: 50, fontSize: 10, color: '#888', textAlign: 'right', paddingRight: 10, flexShrink: 0 }}>
        {levels.map(function(lv, i) { return (<div key={i} style={{ fontSize: 10, fontWeight: 600, color: '#666' }}>R$ {lv.toLocaleString('pt-BR')}</div>); })}
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 60, bottom: 50, left: 0, right: 0, pointerEvents: 'none' }}>
          {levels.map(function(lv, i) { var pct = (i / (levels.length - 1)) * 100; return (<div key={i} style={{ position: 'absolute', top: pct + '%', left: 0, right: 0, borderTop: '1px dashed #E5E5E5' }}></div>); })}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: '100%', paddingTop: 60, paddingBottom: 50, position: 'relative' }}>
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(function(m) {
            var data = getMonthData(m);
            var top = getTopData(m);
            var revenue = Number(data.revenue);
            var heightPct = topLevel > 0 ? (revenue / topLevel) * 100 : 0;
            var isCurrent = m === currentMonth;
            var isFuture = m > currentMonth;
            return (
              <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', minWidth: 0, position: 'relative' }}>
                {top && !isFuture && !selectedAffiliate && (
                  <div style={{ position: 'absolute', top: -55, left: 0, right: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, lineHeight: 1 }}>🏆</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#FFD700', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80, margin: '2px auto 0' }}>{top.coupon_code}</div>
                  </div>
                )}
                {revenue > 0 && (<div style={{ position: 'absolute', bottom: 'calc(' + Math.max(heightPct, 2) + '% + 52px)', fontSize: 10, fontWeight: 700, color: isCurrent ? '#B8860B' : '#666' }}>{data.sales_count}</div>)}
                <div style={{ width: '100%', maxWidth: 60, height: Math.max(heightPct, isFuture ? 0 : 2) + '%', minHeight: isFuture ? 0 : 2, background: isFuture ? 'transparent' : (isCurrent ? 'linear-gradient(180deg, #FFD700 0%, #FFA500 100%)' : 'linear-gradient(180deg, #FFD700 0%, #B8860B 100%)'), borderRadius: '6px 6px 0 0', transition: 'height 0.5s ease-out', boxShadow: isFuture ? 'none' : '0 2px 8px rgba(255,215,0,0.3)' }}></div>
                <div style={{ width: '100%', maxWidth: 60, height: 3, background: '#1A1A1A', borderRadius: 1 }}></div>
                <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: isCurrent ? '#1A1A1A' : '#888' }}>{monthNames[m-1]}</div>
                <div style={{ marginTop: 2, fontSize: 9, color: '#666', whiteSpace: 'nowrap' }}>{revenue > 0 ? formatMoney(revenue) : '–'}</div>
              </div>
            );
          })}
        </div>
        {selectedAffiliate && (<div style={{ position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>Vendas de: <span style={{ color: '#B8860B' }}>{selectedAffiliate.name}</span></div>)}
      </div>
    </div>
  );
}

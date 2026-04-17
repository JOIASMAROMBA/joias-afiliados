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
  const [typeFilter, setTypeFilter] = useState('all'); // all | affiliate | sponsored
  const [affiliates, setAffiliates] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [adminName, setAdminName] = useState('Admin');
  const [recentPosts, setRecentPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [allObligations, setAllObligations] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [monthlyTops, setMonthlyTops] = useState([]);
  const [selectedAffiliateFilter, setSelectedAffiliateFilter] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [materialFolders, setMaterialFolders] = useState([]);
  const [selectedMatFolder, setSelectedMatFolder] = useState(null);
  const [materialFiles, setMaterialFiles] = useState([]);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderType, setNewFolderType] = useState('photo');
  const [newFolderUrgent, setNewFolderUrgent] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
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
  useEffect(function() { var i = setInterval(function() { loadAll(); }, 30000); return function() { clearInterval(i); }; }, []);
  useEffect(function() { if (activeTab === 'materials') loadMaterialFolders(); }, [activeTab]);

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
    try { var salesRes = await supabase.from('sales').select('*, affiliates(name, coupon_code, avatar_initials, is_sponsored)').order('created_at', { ascending: false }).limit(500); setAllSales(salesRes.data || []); } catch (e) {}
    try { var withRes = await supabase.from('withdrawals').select('*, affiliates(name, coupon_code, avatar_initials, email)').order('created_at', { ascending: false }); setWithdrawals(withRes.data || []); } catch (e) {}
    try { var postsRes = await supabase.from('recent_posts').select('*').limit(50); setRecentPosts(postsRes.data || []); } catch (e) {}
    try { var allPostsRes = await supabase.from('posts').select('*').gte('created_at', new Date(Date.now() - 60*24*60*60*1000).toISOString()); setAllPosts(allPostsRes.data || []); } catch (e) {}
    try { var allObRes = await supabase.from('posting_obligations').select('*').eq('active', true); setAllObligations(allObRes.data || []); } catch (e) {}
    try { var monthRes = await supabase.from('monthly_sales').select('*'); setMonthlySales(monthRes.data || []); } catch (e) {}
    try { var topsRes = await supabase.from('monthly_top_affiliate').select('*'); setMonthlyTops(topsRes.data || []); } catch (e) {}
    try { var rwRes = await supabase.from('rewards').select('*').order('target_value', { ascending: true }); setRewards(rwRes.data || []); } catch (e) {}
  }

  async function toggleSponsored(affiliateId, current) {
    await fetch('/api/admin/affiliate/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affiliate_id: affiliateId, is_sponsored: !current }),
    });
    await loadAll();
  }

  async function loadObligations(affiliateId) {
    setObligationsAffiliateId(affiliateId);
    try { var res = await supabase.from('posting_obligations').select('*').eq('affiliate_id', affiliateId).eq('active', true); setObligationsList(res.data || []); } catch(e) { setObligationsList([]); }
  }

  async function apiCall(url, payload) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      let data = {};
      try { data = await res.json(); } catch {}
      if (!res.ok || !data.ok) {
        if (data.error === 'unauthorized' || data.error === 'invalid_session' || res.status === 401) {
          alert('Sessao expirada. Faca login novamente para continuar.');
          localStorage.clear();
          router.push('/login');
          return false;
        }
        alert('Erro: ' + (data.error || ('status ' + res.status)) + (data.detail ? ' - ' + data.detail : ''));
        return false;
      }
      return true;
    } catch (err) {
      alert('Erro de conexao: ' + err.message);
      return false;
    }
  }

  async function toggleRecurringWeekday(weekday) {
    if (!obligationsAffiliateId) return;
    const ok = await apiCall('/api/admin/obligations/update', { action: 'toggle-recurring', affiliate_id: obligationsAffiliateId, weekday });
    if (!ok) return;
    await loadObligations(obligationsAffiliateId);
    await loadAll();
  }

  async function toggleSpecificDate(dateStr) {
    if (!obligationsAffiliateId) return;
    const ok = await apiCall('/api/admin/obligations/update', { action: 'toggle-specific', affiliate_id: obligationsAffiliateId, date: dateStr });
    if (!ok) return;
    await loadObligations(obligationsAffiliateId);
    await loadAll();
  }

  async function clearAllObligations() {
    if (!obligationsAffiliateId) return;
    if (!confirm('Limpar TODAS as obrigações deste afiliado?')) return;
    const ok = await apiCall('/api/admin/obligations/update', { action: 'clear', affiliate_id: obligationsAffiliateId });
    if (!ok) return;
    await loadObligations(obligationsAffiliateId);
    await loadAll();
  }

  async function markPaid(wid) {
    await fetch('/api/admin/withdrawals/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: wid, status: 'paid' }),
    });
    await loadAll();
  }
  async function rejectWith(wid) {
    await fetch('/api/admin/withdrawals/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: wid, status: 'rejected' }),
    });
    await loadAll();
  }

  async function uploadReceipt(wid, file) {
    if (!file) return;
    setUploadingId(wid);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('withdrawal_id', wid);
      const res = await fetch('/api/admin/withdrawals/upload-receipt', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'erro');
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
    if (!rewardForm.target_value || !rewardForm.reward_title) { alert('Preencha os campos'); return; }
    const payload = {
      target_type: rewardForm.target_type,
      target_value: Number(rewardForm.target_value),
      reward_title: rewardForm.reward_title.trim(),
      reward_description: rewardForm.reward_description.trim(),
      reward_emoji: rewardForm.reward_emoji || '🎁',
      reward_value_money: rewardForm.reward_value_money ? Number(rewardForm.reward_value_money) : 0,
      active: true,
    };
    if (editingReward) payload.id = editingReward.id;
    await fetch('/api/admin/rewards/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setShowRewardModal(false);
    await loadAll();
  }

  async function deleteReward(id) {
    if (!confirm('Deletar?')) return;
    await fetch('/api/admin/rewards/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await loadAll();
  }
  async function toggleRewardActive(reward) {
    await fetch('/api/admin/rewards/toggle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: reward.id, active: !reward.active }),
    });
    await loadAll();
  }

  async function loadMaterialFolders() {
    try {
      const res = await fetch('/api/materials/folders');
      const data = await res.json();
      if (data.ok) setMaterialFolders(data.folders || []);
    } catch {}
  }

  async function loadMaterialFiles(folderId) {
    try {
      const res = await fetch('/api/materials/files?folder_id=' + encodeURIComponent(folderId));
      const data = await res.json();
      if (data.ok) setMaterialFiles(data.files || []);
    } catch {}
  }

  async function createFolder() {
    if (!newFolderName.trim()) { alert('Nome obrigatorio'); return; }
    const ok = await apiCall('/api/admin/materials/folder', { action: 'create', name: newFolderName.trim(), type: newFolderType, is_urgent: newFolderUrgent });
    if (!ok) return;
    setShowNewFolderModal(false);
    setNewFolderName(''); setNewFolderType('photo'); setNewFolderUrgent(false);
    await loadMaterialFolders();
  }

  async function deleteFolder(id) {
    if (!confirm('Deletar esta pasta e todos os arquivos dentro dela?')) return;
    const ok = await apiCall('/api/admin/materials/folder', { action: 'delete', id });
    if (!ok) return;
    if (selectedMatFolder?.id === id) { setSelectedMatFolder(null); setMaterialFiles([]); }
    await loadMaterialFolders();
  }

  async function toggleFolderUrgent(folder) {
    const ok = await apiCall('/api/admin/materials/folder', { action: 'update', id: folder.id, is_urgent: !folder.is_urgent });
    if (!ok) return;
    await loadMaterialFolders();
    if (selectedMatFolder?.id === folder.id) setSelectedMatFolder(Object.assign({}, folder, { is_urgent: !folder.is_urgent }));
  }

  async function uploadMaterialFile(file) {
    if (!file || !selectedMatFolder) return;
    setUploadingMaterial(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder_id', selectedMatFolder.id);
      const res = await fetch('/api/admin/materials/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) { alert('Erro: ' + (data.error || 'upload falhou') + (data.detail ? ' - ' + data.detail : '')); }
      else {
        await loadMaterialFiles(selectedMatFolder.id);
        await loadMaterialFolders();
      }
    } catch (e) { alert('Erro: ' + e.message); }
    setUploadingMaterial(false);
  }

  async function deleteMaterialFile(id) {
    if (!confirm('Deletar este arquivo?')) return;
    const ok = await apiCall('/api/admin/materials/file', { action: 'delete', id });
    if (!ok) return;
    if (selectedMatFolder) await loadMaterialFiles(selectedMatFolder.id);
    await loadMaterialFolders();
  }

  // ==== Aplicar filtro de tipo (all/affiliate/sponsored) nos afiliados ====
  function applyTypeFilter(list) {
    if (typeFilter === 'all') return list;
    if (typeFilter === 'sponsored') return list.filter(function(a) { return a.is_sponsored; });
    return list.filter(function(a) { return !a.is_sponsored; });
  }

  var filteredSales = useMemo(function() {
    var sales = allSales;
    if (typeFilter !== 'all') {
      sales = sales.filter(function(s) {
        if (!s.affiliates) return false;
        if (typeFilter === 'sponsored') return s.affiliates.is_sponsored;
        return !s.affiliates.is_sponsored;
      });
    }
    if (dateRange === 'all') return sales;
    var days = parseInt(dateRange);
    if (isNaN(days)) return sales;
    var cutoff;
    if (days === 1) { var today = new Date(); today.setHours(0, 0, 0, 0); cutoff = today.getTime(); }
    else { cutoff = Date.now() - days * 24 * 60 * 60 * 1000; }
    return sales.filter(function(s) { return new Date(s.created_at).getTime() >= cutoff; });
  }, [allSales, dateRange, typeFilter]);

  var filteredAffiliatesByType = useMemo(function() { return applyTypeFilter(affiliates); }, [affiliates, typeFilter]);

  var kpis = useMemo(function() {
    var revenue = filteredSales.reduce(function(s, v) { return s + Number(v.product_value || 0); }, 0);
    var commissions = filteredSales.reduce(function(s, v) { return s + Number(v.commission_earned || 0); }, 0);
    var uniqueAffiliates = new Set(filteredSales.map(function(s) { return s.affiliate_id; })).size;
    return {
      totalSales: filteredSales.length, revenue: revenue, commissions: commissions, netRevenue: revenue - commissions,
      activeAffiliates: uniqueAffiliates, totalAffiliates: filteredAffiliatesByType.length,
      avgTicket: filteredSales.length ? revenue / filteredSales.length : 0,
      pendingWithdrawals: withdrawals.filter(function(w) { return w.status === 'pending'; }).length
    };
  }, [filteredSales, filteredAffiliatesByType, withdrawals]);

  var pendingWithdrawals = withdrawals.filter(function(w) { return w.status === 'pending'; });

  var topAffiliates = useMemo(function() {
    var filtered = applyTypeFilter(affiliates).filter(function(a) {
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
  }, [affiliates, searchTerm, sortBy, typeFilter]);

  var top10 = applyTypeFilter(affiliates).slice().sort(function(a,b){return b.total_sales - a.total_sales;}).slice(0, 10);

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

  // ==== Cálculo de patrocinados em alerta ====
  function getMissedDays(affiliateId) {
    var obs = allObligations.filter(function(o) { return o.affiliate_id === affiliateId; });
    if (obs.length === 0) return [];
    var today = new Date(); today.setHours(0,0,0,0);
    var posts = allPosts.filter(function(p) { return p.affiliate_id === affiliateId; });
    var missed = [];
    // Verifica os ultimos 30 dias
    for (var i = 30; i >= 1; i--) {
      var d = new Date(today); d.setDate(today.getDate() - i);
      var weekday = d.getDay();
      var dateStr = d.toISOString().split('T')[0];
      var isObligatory = obs.some(function(o) {
        if (o.obligation_type === 'recurring') return o.weekday === weekday;
        if (o.obligation_type === 'specific') return o.specific_date === dateStr;
        return false;
      });
      if (!isObligatory) continue;
      var dStart = new Date(d).getTime();
      var dEnd = new Date(d); dEnd.setHours(23,59,59,999);
      var posted = posts.some(function(p) { var pt = new Date(p.created_at).getTime(); return pt >= dStart && pt <= dEnd.getTime(); });
      if (!posted) missed.push({ date: d, dateStr: dateStr });
    }
    return missed;
  }

  var sponsoredAffiliates = affiliates.filter(function(a) { return a.is_sponsored; });
  var sponsoredOK = [];
  var sponsoredAlert = [];
  sponsoredAffiliates.forEach(function(a) {
    var missed = getMissedDays(a.id);
    if (missed.length === 0) sponsoredOK.push({ ...a, missedDays: [] });
    else sponsoredAlert.push({ ...a, missedDays: missed });
  });

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

  if (loading) return (<div style={{ minHeight: '100vh', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</div>);

  var menuItems = [
    { id: 'overview', label: 'Visão Geral', icon: '📊' },
    { id: 'posts', label: 'Postagens', icon: '📸' },
    { id: 'affiliates', label: 'Afiliados', icon: '👥' },
    { id: 'sales', label: 'Vendas', icon: '💰' },
    { id: 'rewards', label: 'Recompensas', icon: '🎁' },
    { id: 'obligations', label: 'Obrigações', icon: '📅', alert: sponsoredAlert.length > 0 },
    { id: 'materials', label: 'Material', icon: '📷' },
    { id: 'payments', label: 'Pagamentos', icon: '💳' },
    { id: 'withdrawals', label: 'Saques', icon: '💸' }
  ];

  var dateRangeOptions = [{ v: '1', l: 'Hoje' }, { v: '3', l: '3 dias' }, { v: '7', l: '7 dias' }, { v: '30', l: '30 dias' }, { v: '90', l: '90 dias' }, { v: 'all', l: 'Tudo' }];
  var monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var monthFullNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var emojiOptions = ['🎁','💰','🛴','✈️','🏖️','🏆','🚗','📱','💻','⌚','👜','💎','🎧','🚲','🎮','📷','🍾','🏝️','🥂','👑'];
  var weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

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

  function getMonthCalendarWithMissed(year, month, missedDays) {
    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);
    var startWeekday = firstDay.getDay();
    var totalDays = lastDay.getDate();
    var grid = [];
    for (var i = 0; i < startWeekday; i++) grid.push(null);
    for (var d = 1; d <= totalDays; d++) {
      var dateObj = new Date(year, month, d);
      var dateStr = dateObj.toISOString().split('T')[0];
      var isMissed = missedDays.some(function(m) { return m.dateStr === dateStr; });
      grid.push({ day: d, dateStr: dateStr, isMissed: isMissed });
    }
    return grid;
  }

  var monthGrid = getMonthCalendar(obligationYear, obligationMonth);
  var selectedAffiliateData = obligationsAffiliateId ? affiliates.find(function(a) { return a.id === obligationsAffiliateId; }) : null;

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', color: '#1A1A1A', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', display: 'flex' }}>
      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar { position: fixed !important; z-index: 100; }
          .admin-content { padding: 16px !important; }
          .admin-kpi-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @keyframes sirenPulse {
          0%, 100% { background-color: rgba(239, 68, 68, 0.1); border-color: #EF4444; box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
          50% { background-color: rgba(239, 68, 68, 0.25); border-color: #DC2626; box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
        @keyframes sirenSpin {
          0%, 100% { transform: rotate(-15deg); }
          50% { transform: rotate(15deg); }
        }
        @keyframes redFlash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes badgeBlink {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>

      <aside className="admin-sidebar" style={{ width: sidebarOpen ? 240 : 68, background: '#FFFFFF', borderRight: '1px solid #E5E5E5', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 12, minHeight: 64 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>JM</div>
          {sidebarOpen && (<div><div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>Joias Maromba</div><div style={{ fontSize: 11, color: '#888' }}>Admin</div></div>)}
        </div>
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {menuItems.map(function(item) {
            var isActive = activeTab === item.id;
            var showBadge = item.id === 'withdrawals' && kpis.pendingWithdrawals > 0;
            return (
              <button key={item.id} onClick={function() { setActiveTab(item.id); }} style={{ width: '100%', padding: '10px 12px', marginBottom: 2, background: isActive ? '#1A1A1A' : 'transparent', border: 'none', borderRadius: 8, color: isActive ? '#FFD700' : '#555', fontSize: 13, fontWeight: isActive ? 600 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', position: 'relative' }}>
                <span style={{ fontSize: 18, flexShrink: 0, animation: item.alert ? 'sirenSpin 0.5s ease-in-out infinite' : 'none' }}>{item.alert ? '🚨' : item.icon}</span>
                {sidebarOpen && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>}
                {sidebarOpen && showBadge && (<span style={{ background: '#EF4444', color: '#FFF', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{kpis.pendingWithdrawals}</span>)}
                {sidebarOpen && item.alert && (<span style={{ background: '#EF4444', color: '#FFF', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700, animation: 'badgeBlink 1s ease-in-out infinite' }}>{sponsoredAlert.length}</span>)}
                {!sidebarOpen && (showBadge || item.alert) && (<span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, background: '#EF4444', borderRadius: 4 }} />)}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{(menuItems.find(function(m){return m.id === activeTab;}) || {}).label || 'Dashboard'}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
              {activeTab === 'overview' && 'Visão geral da performance'}
              {activeTab === 'posts' && 'Feed em tempo real de postagens'}
              {activeTab === 'affiliates' && 'Gerenciar afiliados'}
              {activeTab === 'sales' && 'Todas as vendas registradas'}
              {activeTab === 'rewards' && 'Metas e prêmios'}
              {activeTab === 'obligations' && 'Compromissos de postagem - patrocinados em alerta'}
              {activeTab === 'payments' && 'Saldo a pagar'}
              {activeTab === 'withdrawals' && 'Processar saques'}
            </div>
          </div>
          {(activeTab === 'overview' || activeTab === 'sales') && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {dateRangeOptions.map(function(r) { return (<button key={r.v} onClick={function() { setDateRange(r.v); }} style={{ padding: '8px 14px', background: dateRange === r.v ? '#1A1A1A' : '#FFFFFF', color: dateRange === r.v ? '#FFFFFF' : '#666', border: '1px solid ' + (dateRange === r.v ? '#1A1A1A' : '#E5E5E5'), borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{r.l}</button>); })}
            </div>
          )}
        </div>

        {/* Filtro Todos / Afiliados / Patrocinados */}
        {(activeTab === 'overview' || activeTab === 'affiliates' || activeTab === 'sales') && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {[{v:'all', l:'👥 Todos', count: affiliates.length}, {v:'affiliate', l:'🤝 Afiliados', count: affiliates.filter(function(a){return !a.is_sponsored;}).length}, {v:'sponsored', l:'⭐ Patrocinados', count: affiliates.filter(function(a){return a.is_sponsored;}).length}].map(function(f) {
              var sel = typeFilter === f.v;
              return (<button key={f.v} onClick={function() { setTypeFilter(f.v); }} style={{ padding: '10px 16px', background: sel ? '#1A1A1A' : '#FFFFFF', color: sel ? '#FFD700' : '#555', border: '1px solid ' + (sel ? '#1A1A1A' : '#E5E5E5'), borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                {f.l}
                <span style={{ background: sel ? '#FFD700' : '#F3F4F6', color: sel ? '#1A1A1A' : '#666', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{f.count}</span>
              </button>);
            })}
          </div>
        )}

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
                    <div style={{ width: 24, fontSize: 12, fontWeight: 600 }}>{i + 1}</div>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#666' }}>{a.avatar_initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name} {a.is_sponsored && <span style={{ fontSize: 10 }}>⭐</span>}</div>
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
                {/* SEÇÃO 1: PATROCINADOS EM ALERTA */}
                {sponsoredAlert.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 28, animation: 'sirenSpin 0.5s ease-in-out infinite' }}>🚨</div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#EF4444' }}>PATROCINADOS EM ALERTA — DEVENDO POSTAGEM</div>
                        <div style={{ fontSize: 12, color: '#666' }}>Estes patrocinados não cumpriram dias obrigatórios. Clique pra ver detalhes</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                      {sponsoredAlert.map(function(a) {
                        return (<button key={a.id} onClick={function() { loadObligations(a.id); }} style={{ background: '#FEF2F2', border: '2px solid #EF4444', borderRadius: 10, padding: 16, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, animation: 'sirenPulse 1.2s ease-in-out infinite' }}>
                          <div style={{ width: 44, height: 44, borderRadius: 22, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#991B1B', position: 'relative' }}>
                            {a.avatar_initials}
                            <div style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, background: '#EF4444', borderRadius: 9, fontSize: 10, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, animation: 'badgeBlink 1s ease-in-out infinite' }}>{a.missedDays.length}</div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#991B1B' }}>{a.name}</div>
                            <div style={{ fontSize: 11, color: '#7F1D1D' }}>{a.coupon_code}</div>
                            <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 700, marginTop: 4 }}>⚠️ Devendo {a.missedDays.length} {a.missedDays.length === 1 ? 'postagem' : 'postagens'}</div>
                          </div>
                        </button>);
                      })}
                    </div>
                  </div>
                )}

                {/* SEÇÃO 2: PATROCINADOS POSTANDO OK */}
                {sponsoredOK.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 24 }}>✅</div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#10B981' }}>PATROCINADOS POSTANDO SEM ERRAR</div>
                        <div style={{ fontSize: 12, color: '#666' }}>Patrocinados em dia com as obrigações</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                      {sponsoredOK.map(function(a) {
                        return (<button key={a.id} onClick={function() { loadObligations(a.id); }} style={{ background: '#FFFFFF', border: '2px solid #10B981', borderRadius: 10, padding: 16, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 22, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#065F46' }}>{a.avatar_initials}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{a.name}</div>
                            <div style={{ fontSize: 11, color: '#888' }}>{a.coupon_code}</div>
                            <div style={{ fontSize: 11, color: '#10B981', fontWeight: 700, marginTop: 4 }}>✓ Em dia com as postagens</div>
                          </div>
                        </button>);
                      })}
                    </div>
                  </div>
                )}

                {/* SEÇÃO 3: AFILIADOS NORMAIS */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 24 }}>🤝</div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>AFILIADOS</div>
                      <div style={{ fontSize: 12, color: '#666' }}>Afiliados sem obrigações fixas — clique pra adicionar</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {affiliates.filter(function(a) { return !a.is_sponsored; }).map(function(a) {
                      return (<button key={a.id} onClick={function() { loadObligations(a.id); }} style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 10, padding: 16, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 20, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#666' }}>{a.avatar_initials}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>{a.coupon_code} · {a.total_sales} vendas</div>
                        </div>
                        <span style={{ color: '#888' }}>›</span>
                      </button>);
                    })}
                    {affiliates.filter(function(a) { return !a.is_sponsored; }).length === 0 && (<div style={{ gridColumn: '1/-1', padding: 30, textAlign: 'center', color: '#888' }}>Nenhum afiliado normal</div>)}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                  <button onClick={function() { setObligationsAffiliateId(null); setObligationsList([]); }} style={{ padding: '8px 14px', background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>‹ Voltar</button>
                  {selectedAffiliateData && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 22, background: selectedAffiliateData.is_sponsored ? '#FFD700' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>{selectedAffiliateData.avatar_initials}</div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedAffiliateData.name} {selectedAffiliateData.is_sponsored && <span style={{ fontSize: 12, color: '#FFD700' }}>⭐ PATROCINADO</span>}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{selectedAffiliateData.coupon_code}</div>
                      </div>
                    </div>
                  )}
                  <button onClick={function() { toggleSponsored(obligationsAffiliateId, selectedAffiliateData && selectedAffiliateData.is_sponsored); }} style={{ padding: '8px 14px', background: selectedAffiliateData && selectedAffiliateData.is_sponsored ? '#1A1A1A' : '#FFD700', color: selectedAffiliateData && selectedAffiliateData.is_sponsored ? '#FFD700' : '#1A1A1A', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>{selectedAffiliateData && selectedAffiliateData.is_sponsored ? 'Tornar Afiliado' : '⭐ Marcar Patrocinado'}</button>
                  <button onClick={clearAllObligations} style={{ padding: '8px 14px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 12, color: '#991B1B', cursor: 'pointer', fontWeight: 600 }}>🗑 Limpar tudo</button>
                </div>

                {/* CALENDÁRIO COM DIAS FALHADOS EM VERMELHO */}
                {selectedAffiliateData && selectedAffiliateData.is_sponsored && (function() {
                  var missed = getMissedDays(selectedAffiliateData.id);
                  if (missed.length === 0) return null;
                  return (
                    <div style={{ background: '#FEF2F2', border: '2px solid #EF4444', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{ fontSize: 24, animation: 'sirenSpin 0.5s ease-in-out infinite' }}>🚨</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#991B1B' }}>{missed.length} dia(s) sem postagem nos últimos 30 dias</div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {missed.map(function(m, i) {
                          return (<div key={i} style={{ background: '#EF4444', color: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, animation: 'redFlash 1.2s ease-in-out infinite' }}>{formatDate(m.date)}</div>);
                        })}
                      </div>
                    </div>
                  );
                })()}

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

                <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>📆 Calendário do mês</div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>Vermelho = dia falhado · Amarelo = obrigação · Click pra marcar/desmarcar manual</div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <button onClick={function() { var nm = obligationMonth - 1; if (nm < 0) { setObligationMonth(11); setObligationYear(obligationYear - 1); } else { setObligationMonth(nm); } }} style={{ padding: '6px 12px', background: '#F3F4F6', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>‹</button>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{monthFullNames[obligationMonth]} {obligationYear}</div>
                    <button onClick={function() { var nm = obligationMonth + 1; if (nm > 11) { setObligationMonth(0); setObligationYear(obligationYear + 1); } else { setObligationMonth(nm); } }} style={{ padding: '6px 12px', background: '#F3F4F6', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>›</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                    {weekdayNames.map(function(n, i) { return (<div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#888', padding: 4 }}>{n}</div>); })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                    {(function() {
                      var missedSet = {};
                      if (selectedAffiliateData && selectedAffiliateData.is_sponsored) {
                        getMissedDays(selectedAffiliateData.id).forEach(function(m) { missedSet[m.dateStr] = true; });
                      }
                      return monthGrid.map(function(cell, i) {
                        if (!cell) return (<div key={i} style={{ minHeight: 50 }}></div>);
                        var isMissed = missedSet[cell.dateStr];
                        var bg, color, border, anim = 'none';
                        if (isMissed) { bg = '#EF4444'; color = '#fff'; border = '2px solid #DC2626'; anim = 'redFlash 1.2s ease-in-out infinite'; }
                        else if (cell.hasSpecific) { bg = '#FFD700'; color = '#000'; border = '2px solid #B8860B'; }
                        else if (cell.hasRecurring) { bg = '#FEF3C7'; color = '#92400E'; border = '2px solid #FFD700'; }
                        else { bg = '#FFFFFF'; color = '#1A1A1A'; border = '1px solid #E5E5E5'; }
                        return (<button key={i} onClick={function() { toggleSpecificDate(cell.dateStr); }} style={{ minHeight: 50, padding: 4, background: bg, color: color, border: border, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, position: 'relative', animation: anim }}>
                          {cell.day}
                          {isMissed && <div style={{ position: 'absolute', top: 2, right: 2, fontSize: 9 }}>🚨</div>}
                          {!isMissed && cell.hasRecurring && !cell.hasSpecific && <div style={{ position: 'absolute', top: 2, right: 2, fontSize: 9 }}>🔁</div>}
                          {!isMissed && cell.hasSpecific && <div style={{ position: 'absolute', top: 2, right: 2, fontSize: 9 }}>📌</div>}
                        </button>);
                      });
                    })()}
                  </div>

                  <div style={{ marginTop: 16, padding: 12, background: '#F9FAFB', borderRadius: 8, fontSize: 11, color: '#666', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div>🔁 Recorrente</div>
                    <div>📌 Específico</div>
                    <div>🚨 Falhou</div>
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
                <div><div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>🎁 Gerenciar Recompensas</div><div style={{ fontSize: 13, opacity: 0.8 }}>Crie metas e prêmios</div></div>
                <button onClick={function() { openRewardModal(null); }} style={{ padding: '12px 24px', background: '#FFD700', border: 'none', borderRadius: 8, color: '#1A1A1A', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>+ Nova Recompensa</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {rewards.map(function(r) {
                return (<div key={r.id} style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 12, padding: 20, opacity: r.active ? 1 : 0.5 }}>
                  <div style={{ fontSize: 48, marginBottom: 12, textAlign: 'center' }}>{r.reward_emoji}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>{r.reward_title}</div>
                  {r.reward_description && (<div style={{ fontSize: 12, color: '#666', marginBottom: 12, textAlign: 'center' }}>{r.reward_description}</div>)}
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
                <div style={{ fontSize: 15, fontWeight: 600 }}>Nenhuma recompensa</div>
              </div>)}
            </div>
          </div>
        )}

        {activeTab === 'posts' && (
          <div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#666' }}><strong>{recentPosts.length}</strong> postagens · atualiza a cada 30s</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E5E5', background: '#FAFAFA', display: 'grid', gridTemplateColumns: '40px 2fr 1fr 1fr 2fr', gap: 12, fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>
                <div></div><div>Afiliado</div><div>Rede</div><div>Data/Hora</div><div>Link</div>
              </div>
              {recentPosts.map(function(p) {
                return (<div key={p.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', display: 'grid', gridTemplateColumns: '40px 2fr 1fr 1fr 2fr', gap: 12, alignItems: 'center', fontSize: 13 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 16, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#666' }}>{p.avatar_initials}</div>
                  <div><div style={{ fontWeight: 500 }}>{p.affiliate_name}</div><div style={{ fontSize: 11, color: '#888' }}>{p.coupon_code}</div></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span>{getPlatformIcon(p.platform)}</span><span style={{ fontSize: 12, textTransform: 'capitalize' }}>{p.platform}</span></div>
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
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: a.is_sponsored ? '#FFD700' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: a.is_sponsored ? '#000' : '#666' }}>{a.avatar_initials}</div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{a.name} {a.is_sponsored && <span style={{ fontSize: 10, color: '#FFD700', marginLeft: 6 }}>⭐ PATROCINADO</span>}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{a.email} · {a.coupon_code}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}><div style={{ color: '#888', fontSize: 10 }}>Vendas</div><div style={{ fontWeight: 700, fontSize: 16 }}>{a.total_sales}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ color: '#888', fontSize: 10 }}>Saldo</div><div style={{ fontWeight: 700, fontSize: 14, color: '#10B981' }}>{formatMoney(a.available_balance)}</div></div>
                  <div style={{ padding: '3px 10px', background: perf.bg, color: perf.color, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{perf.label}</div>
                  <button onClick={function() { toggleSponsored(a.id, a.is_sponsored); }} style={{ padding: '6px 10px', background: a.is_sponsored ? '#1A1A1A' : '#FFD700', color: a.is_sponsored ? '#FFD700' : '#1A1A1A', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{a.is_sponsored ? 'Tornar Afiliado' : '⭐ Marcar Patrocinado'}</button>
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
                <div style={{ color: '#666' }}>{s.affiliates && s.affiliates.coupon_code} {s.affiliates && s.affiliates.is_sponsored && <span style={{ color: '#FFD700' }}>⭐</span>}</div>
                <div>{formatMoney(s.product_value || 0)}</div>
                <div style={{ color: '#10B981', fontWeight: 600 }}>{formatMoney(s.commission_earned)}</div>
              </div>);
            })}
            {filteredSales.length === 0 && (<div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Nenhuma venda</div>)}
          </div>
        )}

        {activeTab === 'materials' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>📷 Material para Postar</div>
                <div style={{ fontSize: 13, color: '#666' }}>{selectedMatFolder ? 'Pasta: ' + selectedMatFolder.name : 'Organize fotos e videos para as afiliadas baixarem'}</div>
              </div>
              {!selectedMatFolder && (<button onClick={function() { setShowNewFolderModal(true); }} style={{ padding: '10px 18px', background: '#1A1A1A', border: 'none', borderRadius: 8, color: '#FFD700', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Nova Pasta</button>)}
              {selectedMatFolder && (<button onClick={function() { setSelectedMatFolder(null); setMaterialFiles([]); }} style={{ padding: '10px 18px', background: '#F3F4F6', border: '1px solid #E5E5E5', borderRadius: 8, color: '#666', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>← Voltar</button>)}
            </div>

            {!selectedMatFolder && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {materialFolders.length === 0 && (<div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', background: '#fff', border: '1px dashed #E5E5E5', borderRadius: 12, color: '#888' }}>Nenhuma pasta ainda. Crie uma clicando em "Nova Pasta".</div>)}
                {materialFolders.map(function(f) {
                  return (
                    <div key={f.id} style={{ position: 'relative', background: '#FFFFFF', border: '1px solid ' + (f.is_urgent ? '#FCA5A5' : '#E5E5E5'), borderRadius: 12, padding: 16, boxShadow: f.is_urgent ? '0 0 0 2px rgba(239,68,68,0.1)' : 'none' }}>
                      {f.is_urgent && (<div style={{ position: 'absolute', top: 8, right: 8, padding: '2px 8px', background: '#FEE2E2', color: '#991B1B', fontSize: 10, fontWeight: 800, letterSpacing: 1, borderRadius: 999, animation: 'sirenPulse 1.5s ease-in-out infinite' }}>URGENTE</div>)}
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{f.type === 'video' ? '🎬' : f.type === 'mixed' ? '📁' : '📷'}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{f.name}</div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>{f.file_count} {f.file_count === 1 ? 'arquivo' : 'arquivos'} · {f.type === 'video' ? 'Videos' : f.type === 'mixed' ? 'Mix' : 'Fotos'}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={function() { setSelectedMatFolder(f); loadMaterialFiles(f.id); }} style={{ flex: 1, padding: '8px 12px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Abrir</button>
                        <button onClick={function() { toggleFolderUrgent(f); }} title={f.is_urgent ? 'Remover urgencia' : 'Marcar urgente'} style={{ padding: '8px 10px', background: f.is_urgent ? '#FEE2E2' : '#F3F4F6', border: '1px solid ' + (f.is_urgent ? '#FCA5A5' : '#E5E5E5'), borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>🚨</button>
                        <button onClick={function() { deleteFolder(f.id); }} style={{ padding: '8px 10px', background: '#F3F4F6', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedMatFolder && (
              <>
                <div style={{ background: '#FFFFFF', border: '1px dashed #C9A961', borderRadius: 12, padding: 24, marginBottom: 16, textAlign: 'center' }}>
                  <label style={{ cursor: uploadingMaterial ? 'wait' : 'pointer' }}>
                    <input type="file" accept="image/*,video/*" multiple onChange={function(e) { const files = Array.from(e.target.files || []); files.forEach(function(f) { uploadMaterialFile(f); }); e.target.value = ''; }} disabled={uploadingMaterial} style={{ display: 'none' }} />
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📤</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>{uploadingMaterial ? 'Enviando...' : 'Clique para enviar arquivos'}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Foto (JPG/PNG/GIF/WebP) ou Video (MP4/WebM/MOV) — max 50 MB cada</div>
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {materialFiles.length === 0 && (<div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#888' }}>Nenhum arquivo ainda</div>)}
                  {materialFiles.map(function(file) {
                    return (
                      <div key={file.id} style={{ position: 'relative', aspectRatio: '1 / 1', background: '#F3F4F6', borderRadius: 10, overflow: 'hidden', border: '1px solid #E5E5E5' }}>
                        {file.file_type === 'video' ? (<video src={file.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />) : (<img src={file.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
                        <button onClick={function() { deleteMaterialFile(file.id); }} style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer' }}>✕</button>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px', background: 'rgba(0,0,0,0.75)', fontSize: 10, color: '#fff', fontWeight: 600 }}>{file.file_type === 'video' ? '▶ VIDEO' : '📷 FOTO'}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {showNewFolderModal && (
          <div onClick={function() { setShowNewFolderModal(false); }} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: 420, width: '100%', background: '#FFFFFF', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Nova Pasta</div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Nome</label>
              <input type="text" value={newFolderName} onChange={function(e) { setNewFolderName(e.target.value); }} placeholder="Ex: Fotos de Stories" style={{ width: '100%', padding: 10, border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Tipo</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {[{v:'photo',l:'📷 Fotos'}, {v:'video',l:'🎬 Videos'}, {v:'mixed',l:'📁 Misto'}].map(function(t) { return (<button key={t.v} onClick={function() { setNewFolderType(t.v); }} style={{ flex: 1, padding: 10, background: newFolderType === t.v ? '#1A1A1A' : '#F3F4F6', color: newFolderType === t.v ? '#FFD700' : '#666', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{t.l}</button>); })}
              </div>
              <div onClick={function() { setNewFolderUrgent(!newFolderUrgent); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, marginBottom: 16, background: newFolderUrgent ? '#FEE2E2' : '#F3F4F6', borderRadius: 6, cursor: 'pointer', border: '1px solid ' + (newFolderUrgent ? '#FCA5A5' : '#E5E5E5') }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: '2px solid ' + (newFolderUrgent ? '#DC2626' : '#999'), background: newFolderUrgent ? '#DC2626' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{newFolderUrgent && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>✓</span>}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: newFolderUrgent ? '#991B1B' : '#666' }}>🚨 Marcar como URGENTE (pulsa no painel)</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createFolder} style={{ flex: 1, padding: 12, background: '#1A1A1A', color: '#FFD700', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Criar</button>
                <button onClick={function() { setShowNewFolderModal(false); setNewFolderName(''); setNewFolderUrgent(false); }} style={{ padding: '12px 20px', background: '#F3F4F6', color: '#666', border: '1px solid #E5E5E5', borderRadius: 6, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8 }}>
            {affiliates.filter(function(a) { return a.days_since_signup >= 30 && Number(a.available_balance) > 0; }).map(function(a) {
              return (<div key={a.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#666' }}>{a.avatar_initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{a.email}</div>
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
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{formatDateTime(w.created_at)}</div>
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
                {!isPaid && !isRejected && (<div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={function() { if (confirm('Pagar?')) markPaid(w.id); }} style={{ flex: 1, padding: 12, background: '#EF4444', border: 'none', borderRadius: 6, color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>MARCAR COMO PAGO</button>
                  <button onClick={function() { if (confirm('Rejeitar?')) rejectWith(w.id); }} style={{ padding: '10px 16px', background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Rejeitar</button>
                </div>)}
                {isPaid && (<div>
                  <div style={{ padding: '10px 14px', background: '#10B981', borderRadius: 6, color: '#FFFFFF', fontWeight: 800, fontSize: 13, textAlign: 'center', marginBottom: 10 }}>✓ PAGO em {formatDateTime(w.paid_at)}</div>
                  {!hasReceipt && (<label style={{ display: 'block', padding: 12, background: '#EF4444', borderRadius: 6, color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>
                    {uploadingId === w.id ? 'ENVIANDO...' : '📎 ENVIAR COMPROVANTE'}
                    <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={function(e) { if (e.target.files[0]) uploadReceipt(w.id, e.target.files[0]); }} />
                  </label>)}
                  {hasReceipt && (<button onClick={function() { setViewReceiptUrl(w.receipt_url); }} style={{ width: '100%', padding: 12, background: '#10B981', border: 'none', borderRadius: 6, color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✓ COMPROVANTE ENVIADO</button>)}
                </div>)}
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
            <input type="text" value={rewardForm.reward_title} onChange={function(e) { setRewardForm(Object.assign({}, rewardForm, { reward_title: e.target.value })); }} style={{ width: '100%', padding: 10, border: '1px solid #E5E5E5', borderRadius: 6, marginBottom: 12, fontSize: 14 }} />
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Descricao</label>
            <input type="text" value={rewardForm.reward_description} onChange={function(e) { setRewardForm(Object.assign({}, rewardForm, { reward_description: e.target.value })); }} style={{ width: '100%', padding: 10, border: '1px solid #E5E5E5', borderRadius: 6, marginBottom: 12, fontSize: 14 }} />
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Tipo de meta</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button onClick={function() { setRewardForm(Object.assign({}, rewardForm, { target_type: 'sales' })); }} style={{ flex: 1, padding: 10, background: rewardForm.target_type === 'sales' ? '#1A1A1A' : '#F3F4F6', color: rewardForm.target_type === 'sales' ? '#FFD700' : '#666', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Vendas</button>
              <button onClick={function() { setRewardForm(Object.assign({}, rewardForm, { target_type: 'revenue' })); }} style={{ flex: 1, padding: 10, background: rewardForm.target_type === 'revenue' ? '#1A1A1A' : '#F3F4F6', color: rewardForm.target_type === 'revenue' ? '#FFD700' : '#666', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>R$</button>
            </div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Meta *</label>
            <input type="number" value={rewardForm.target_value} onChange={function(e) { setRewardForm(Object.assign({}, rewardForm, { target_value: e.target.value })); }} style={{ width: '100%', padding: 10, border: '1px solid #E5E5E5', borderRadius: 6, marginBottom: 12, fontSize: 14 }} />
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Bonus dinheiro</label>
            <input type="number" value={rewardForm.reward_value_money} onChange={function(e) { setRewardForm(Object.assign({}, rewardForm, { reward_value_money: e.target.value })); }} style={{ width: '100%', padding: 10, border: '1px solid #E5E5E5', borderRadius: 6, marginBottom: 20, fontSize: 14 }} />
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
                {top && !isFuture && !selectedAffiliate && (<div style={{ position: 'absolute', top: -55, left: 0, right: 0, textAlign: 'center' }}><div style={{ fontSize: 22 }}>🏆</div><div style={{ fontSize: 9, fontWeight: 700, color: '#FFD700', marginTop: 2 }}>{top.coupon_code}</div></div>)}
                {revenue > 0 && (<div style={{ position: 'absolute', bottom: 'calc(' + Math.max(heightPct, 2) + '% + 52px)', fontSize: 10, fontWeight: 700, color: isCurrent ? '#B8860B' : '#666' }}>{data.sales_count}</div>)}
                <div style={{ width: '100%', maxWidth: 60, height: Math.max(heightPct, isFuture ? 0 : 2) + '%', minHeight: isFuture ? 0 : 2, background: isFuture ? 'transparent' : (isCurrent ? 'linear-gradient(180deg, #FFD700 0%, #FFA500 100%)' : 'linear-gradient(180deg, #FFD700 0%, #B8860B 100%)'), borderRadius: '6px 6px 0 0' }}></div>
                <div style={{ width: '100%', maxWidth: 60, height: 3, background: '#1A1A1A', borderRadius: 1 }}></div>
                <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: isCurrent ? '#1A1A1A' : '#888' }}>{monthNames[m-1]}</div>
                <div style={{ marginTop: 2, fontSize: 9, color: '#666' }}>{revenue > 0 ? formatMoney(revenue) : '–'}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

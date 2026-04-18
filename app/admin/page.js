'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, supabaseRealtime, storageProxyUrl } from '../../lib/supabase';

const PLATFORM_DOMAINS = {
  instagram: ['instagram.com', 'instagr.am'],
  facebook: ['facebook.com', 'fb.com', 'fb.me', 'm.facebook.com'],
  tiktok: ['tiktok.com', 'vm.tiktok.com'],
  youtube: ['youtube.com', 'youtu.be', 'm.youtube.com'],
  twitter: ['twitter.com', 'x.com'],
  threads: ['threads.net'],
  kwai: ['kwai.com'],
  pinterest: ['pinterest.com', 'pin.it'],
  whatsapp: ['whatsapp.com', 'wa.me'],
  snapchat: ['snapchat.com'],
  linkedin: ['linkedin.com', 'lnkd.in'],
};
const TRUSTED_DOMAINS = Object.values(PLATFORM_DOMAINS).flat();

function analyzeLink(rawUrl, declaredPlatform) {
  const result = { valid: false, host: '', pathname: '', isTrusted: false, matchesPlatform: false, expected: [] };
  if (!rawUrl) return result;
  let u;
  try { u = new URL(rawUrl); } catch { return result; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return result;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  result.valid = true;
  result.host = host;
  result.pathname = u.pathname || '/';
  result.isTrusted = TRUSTED_DOMAINS.some(function(d) { return host === d || host.endsWith('.' + d); });
  const expected = PLATFORM_DOMAINS[(declaredPlatform || '').toLowerCase()] || [];
  result.expected = expected;
  result.matchesPlatform = expected.length > 0 && expected.some(function(d) { return host === d || host.endsWith('.' + d); });
  return result;
}

function detectContentType(info) {
  if (!info.valid) return null;
  const host = info.host;
  const p = (info.pathname || '').toLowerCase();
  if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am') {
    if (/^\/(reel|reels)\//.test(p)) return { label: 'Reel', icon: '🎞️' };
    if (/^\/stories\//.test(p)) return { label: 'Story', icon: '⏱️' };
    if (/^\/p\//.test(p)) return { label: 'Post (feed)', icon: '📰' };
    if (/^\/tv\//.test(p)) return { label: 'IGTV', icon: '📺' };
    if (/^\/explore\//.test(p)) return { label: 'Explore', icon: '🔍' };
    if (/^\/[^/]+\/?$/.test(p)) return { label: 'Perfil', icon: '👤' };
    return { label: 'Instagram', icon: '📷' };
  }
  if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.com' || host === 'fb.me') {
    if (/^\/(reel|reels)\//.test(p)) return { label: 'Reel', icon: '🎞️' };
    if (/^\/stories\//.test(p) || p.startsWith('/story.php') || /^\/story\//.test(p)) return { label: 'Story', icon: '⏱️' };
    if (/\/posts\//.test(p) || p.startsWith('/photo.php') || /^\/photo\//.test(p) || /^\/permalink\//.test(p)) return { label: 'Post (feed)', icon: '📰' };
    if (/^\/watch\//.test(p) || /^\/video\//.test(p)) return { label: 'Vídeo', icon: '🎬' };
    if (/^\/[^/]+\/?$/.test(p)) return { label: 'Perfil/Página', icon: '👤' };
    return { label: 'Facebook', icon: '📘' };
  }
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') return { label: 'Vídeo (link curto)', icon: '🎬' };
    if (/\/video\//.test(p)) return { label: 'Vídeo', icon: '🎬' };
    if (/^\/@[^/]+\/?$/.test(p)) return { label: 'Perfil', icon: '👤' };
    return { label: 'TikTok', icon: '🎵' };
  }
  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    if (/^\/shorts\//.test(p)) return { label: 'Shorts', icon: '📱' };
    if (/^\/live\//.test(p)) return { label: 'Live', icon: '🔴' };
    if (/^\/watch/.test(p)) return { label: 'Vídeo', icon: '🎬' };
    if (/^\/@[^/]+\/?$/.test(p) || /^\/c\//.test(p) || /^\/channel\//.test(p)) return { label: 'Canal', icon: '👤' };
    return { label: 'YouTube', icon: '▶️' };
  }
  if (host === 'youtu.be') return { label: 'Vídeo (link curto)', icon: '🎬' };
  if (host === 'x.com' || host === 'twitter.com' || host.endsWith('.twitter.com')) {
    if (/\/status\//.test(p)) return { label: 'Post', icon: '📰' };
    if (/^\/[^/]+\/?$/.test(p)) return { label: 'Perfil', icon: '👤' };
    return { label: 'X/Twitter', icon: '𝕏' };
  }
  if (host === 'threads.net') {
    if (/\/post\//.test(p)) return { label: 'Post', icon: '📰' };
    return { label: 'Threads', icon: '@' };
  }
  if (host === 'kwai.com' || host.endsWith('.kwai.com')) return { label: 'Vídeo Kwai', icon: '🎬' };
  if (host === 'pinterest.com' || host.endsWith('.pinterest.com') || host === 'pin.it') return { label: 'Pin', icon: '📌' };
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com') || host === 'lnkd.in') return { label: 'LinkedIn', icon: '💼' };
  if (host === 'snapchat.com' || host.endsWith('.snapchat.com')) return { label: 'Snap', icon: '👻' };
  if (host === 'wa.me' || host === 'whatsapp.com' || host.endsWith('.whatsapp.com')) return { label: 'WhatsApp', icon: '💬' };
  return null;
}

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
  const [linkPreview, setLinkPreview] = useState(null);
  const [newAffiliateIds, setNewAffiliateIds] = useState(new Set());
  const [postsView, setPostsView] = useState('feed');
  const [rankingWindow, setRankingWindow] = useState('today');
  const [affiliatesFull, setAffiliatesFull] = useState([]);
  const [cadastrosFilter, setCadastrosFilter] = useState('new5');
  const [selectedCadastroId, setSelectedCadastroId] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [notifyTarget, setNotifyTarget] = useState(null);
  const [notifyType, setNotifyType] = useState('info');
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifySearch, setNotifySearch] = useState('');
  const [notifySending, setNotifySending] = useState(false);
  const [obligationMonth, setObligationMonth] = useState(new Date().getMonth());
  const [obligationYear, setObligationYear] = useState(new Date().getFullYear());
  const [withdrawalsFilter, setWithdrawalsFilter] = useState('today');
  const [cadastroHistory, setCadastroHistory] = useState(null);
  const [cadastroHistoryLoading, setCadastroHistoryLoading] = useState(false);
  const [vendasManualSearch, setVendasManualSearch] = useState('');
  const [fixedRules, setFixedRules] = useState([]);
  const [fixedSearch, setFixedSearch] = useState('');
  const [fixedModalAffiliate, setFixedModalAffiliate] = useState(null);
  const [fixedAmount, setFixedAmount] = useState('');
  const [fixedPayday, setFixedPayday] = useState('5');
  const [fixedRecurring, setFixedRecurring] = useState(true);
  const [fixedBusy, setFixedBusy] = useState(false);
  const [vendasManualQty, setVendasManualQty] = useState({}); // { [affiliate_id]: number }
  const [vendasManualConfirm, setVendasManualConfirm] = useState(null); // { affiliate, quantity }
  const [vendasManualBusy, setVendasManualBusy] = useState(false);
  const [showExtrato, setShowExtrato] = useState(false);
  const [extratoDate, setExtratoDate] = useState(function() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  });

  useEffect(function() { init(); }, []);
  useEffect(function() { var i = setInterval(function() { loadAll(); }, 30000); return function() { clearInterval(i); }; }, []);
  useEffect(function() { if (activeTab === 'materials') loadMaterialFolders(); }, [activeTab]);
  useEffect(function() {
    function syncViewport() {
      if (typeof window === 'undefined') return;
      if (window.innerWidth <= 768) setSidebarOpen(false);
      else setSidebarOpen(true);
    }
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return function() { window.removeEventListener('resize', syncViewport); };
  }, []);

  useEffect(function() {
    var ch = supabaseRealtime.channel('afiliadas-online');
    ch.on('presence', { event: 'sync' }, function() {
      var state = ch.presenceState();
      var keys = Object.keys(state);
      setOnlineCount(keys.length);
      setOnlineIds(new Set(keys));
    }).subscribe();
    return function() { supabaseRealtime.removeChannel(ch); };
  }, []);

  function isMobileViewport() {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }
  function handleMenuClick(id) {
    setActiveTab(id);
    if (isMobileViewport()) setSidebarOpen(false);
  }

  function NewBadge() {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px 1px 4px', background: 'linear-gradient(135deg, #10B981, #059669)', borderRadius: 20, fontSize: 9, fontWeight: 900, color: '#000', letterSpacing: 0.5, verticalAlign: 'middle', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 0 8px rgba(16,185,129,0.45)' }}>
        <span style={{ display: 'inline-block', animation: 'newStarSpin 1.6s linear infinite', fontSize: 11, lineHeight: 1 }}>⭐</span>
        NEW
      </span>
    );
  }

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
    try {
      var fullRes = await supabase.from('affiliates').select('*').order('created_at', { ascending: false });
      var rows = fullRes.data || [];
      setAffiliatesFull(rows);
      var cutoff = Date.now() - 5 * 24 * 60 * 60 * 1000;
      var set = new Set();
      rows.forEach(function(a) {
        var t = a.created_at ? new Date(a.created_at).getTime() : 0;
        if (t && t >= cutoff) set.add(a.id);
      });
      setNewAffiliateIds(set);
    } catch (e) {}
    try {
      await fetch('/api/admin/fixed?action=process-due').catch(function() {});
      var fxRes = await fetch('/api/admin/fixed');
      var fxData = await fxRes.json().catch(function() { return {}; });
      if (fxData && fxData.ok) setFixedRules(fxData.rules || []);
    } catch (e) {}
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
      pendingWithdrawals: withdrawals.filter(function(w) { return w.status === 'pending'; }).length,
      pendingApproval: (affiliatesFull || []).filter(function(a) { return !a.deleted_at && a.approval_status === 'pending'; }).length
    };
  }, [filteredSales, filteredAffiliatesByType, withdrawals, affiliatesFull]);

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
    { id: 'withdrawals', label: 'Saques', icon: '💸' },
    { id: 'cadastros', label: 'Cadastros', icon: '🗂️' },
    { id: 'vendas-manual', label: 'Vendas Manual', icon: '➕' },
    { id: 'fixed-monthly', label: 'Fixo Mensal', icon: '💠' },
    { id: 'notify', label: 'Notificar', icon: '📣' }
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
        .admin-mobile-topbar { display: none; }
        .admin-sidebar-backdrop { display: none; }
        @media (max-width: 768px) {
          .admin-sidebar {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            height: 100vh !important;
            width: 280px !important;
            z-index: 1001 !important;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1) !important;
            box-shadow: none;
          }
          .admin-sidebar.mobile-open {
            transform: translateX(0);
            box-shadow: 12px 0 48px rgba(0,0,0,0.28);
          }
          .admin-sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0);
            z-index: 1000;
            pointer-events: none;
            transition: background 0.3s ease;
          }
          .admin-sidebar-backdrop.mobile-open {
            background: rgba(0,0,0,0.5);
            pointer-events: auto;
            backdrop-filter: blur(2px);
            -webkit-backdrop-filter: blur(2px);
          }
          .admin-mobile-topbar {
            display: flex;
            position: sticky;
            top: 0;
            z-index: 50;
            align-items: center;
            gap: 12px;
            height: 56px;
            padding: 0 14px;
            background: #FFFFFF;
            border-bottom: 1px solid #E5E5E5;
            margin: -16px -16px 12px -16px;
          }
          .admin-content { padding: 16px !important; }
          .admin-kpi-grid { grid-template-columns: 1fr 1fr !important; }
          .admin-mobile-hide { display: none !important; }
          .admin-notify-grid { grid-template-columns: 1fr !important; }
          .admin-notify-types { grid-template-columns: 1fr !important; }
          .admin-notify-list { max-height: 340px !important; }
          .admin-post-row { gap: 8px !important; padding: 12px !important; font-size: 12px !important; }
          .admin-post-header { padding: 10px 12px !important; gap: 8px !important; font-size: 10px !important; }
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
        @keyframes newStarSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes onlineDotPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.55); }
          50%      { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
        }
      `}</style>

      <div className={"admin-sidebar-backdrop" + (sidebarOpen ? " mobile-open" : "")} onClick={function() { setSidebarOpen(false); }} />

      <aside className={"admin-sidebar" + (sidebarOpen ? " mobile-open" : "")} style={{ width: sidebarOpen ? 240 : 68, background: '#FFFFFF', borderRight: '1px solid #E5E5E5', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 12, minHeight: 64 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>JM</div>
          {sidebarOpen && (<div><div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>Joias Maromba</div><div style={{ fontSize: 11, color: '#888' }}>Admin</div></div>)}
        </div>
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {menuItems.map(function(item) {
            var isActive = activeTab === item.id;
            var badgeCount = 0;
            if (item.id === 'withdrawals') badgeCount = kpis.pendingWithdrawals;
            else if (item.id === 'cadastros') badgeCount = kpis.pendingApproval;
            var showBadge = badgeCount > 0;
            return (
              <button key={item.id} onClick={function() { handleMenuClick(item.id); }} style={{ width: '100%', padding: '10px 12px', marginBottom: 2, background: isActive ? '#1A1A1A' : 'transparent', border: 'none', borderRadius: 8, color: isActive ? '#FFD700' : '#555', fontSize: 13, fontWeight: isActive ? 600 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', position: 'relative' }}>
                <span style={{ fontSize: 18, flexShrink: 0, animation: item.alert ? 'sirenSpin 0.5s ease-in-out infinite' : 'none' }}>{item.alert ? '🚨' : item.icon}</span>
                {sidebarOpen && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>}
                {sidebarOpen && showBadge && (<span style={{ background: '#EF4444', color: '#FFF', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700, animation: 'badgeBlink 1s ease-in-out infinite' }}>{badgeCount}</span>)}
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

      <main className="admin-content" style={{ flex: 1, minWidth: 0, padding: 24, overflow: 'hidden' }}>
        <div className="admin-mobile-topbar">
          <button onClick={function() { setSidebarOpen(true); }} aria-label="Abrir menu" style={{ background: 'transparent', border: 'none', padding: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, width: 40 }}>
            <span style={{ display: 'block', height: 2, background: '#1A1A1A', borderRadius: 2 }} />
            <span style={{ display: 'block', height: 2, background: '#1A1A1A', borderRadius: 2 }} />
            <span style={{ display: 'block', height: 2, background: '#1A1A1A', borderRadius: 2 }} />
          </button>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(menuItems.find(function(m){return m.id === activeTab;}) || {}).label || 'Dashboard'}</span>
            <span title={onlineCount + ' afiliadas online'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px 2px 5px', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 14, fontSize: 11, fontWeight: 800, color: '#065F46', flexShrink: 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: '#10B981', animation: 'onlineDotPulse 1.6s ease-in-out infinite' }} />
              {onlineCount}
            </span>
          </div>
          {kpis.pendingWithdrawals > 0 && (
            <span style={{ background: '#EF4444', color: '#FFF', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{kpis.pendingWithdrawals}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span>{(menuItems.find(function(m){return m.id === activeTab;}) || {}).label || 'Dashboard'}</span>
              <span title={onlineCount + ' afiliadas online agora'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px 4px 8px', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 20, fontSize: 13, fontWeight: 800, color: '#065F46' }}>
                <span style={{ width: 9, height: 9, borderRadius: 5, background: '#10B981', animation: 'onlineDotPulse 1.6s ease-in-out infinite' }} />
                {onlineCount} online
              </span>
            </div>
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
                      <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{a.name}</span>{newAffiliateIds.has(a.id) && <NewBadge />}{a.is_sponsored && <span style={{ fontSize: 10, flexShrink: 0 }}>⭐</span>}</div>
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
                      <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{w.affiliates && w.affiliates.name}</span>{w.affiliate_id && newAffiliateIds.has(w.affiliate_id) && <NewBadge />}</div>
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
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{a.name}</span>{newAffiliateIds.has(a.id) && <NewBadge />}</div>
                            <div style={{ fontSize: 11, color: '#7F1D1D' }}>{a.coupon_code}</div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '3px 10px', background: '#DC2626', borderRadius: 6, color: '#FFF', fontWeight: 900, fontSize: 12, letterSpacing: 1, animation: 'badgeBlink 1.2s ease-in-out infinite' }}>
                              ⚠️ DEVENDO {a.missedDays.length} {a.missedDays.length === 1 ? 'DIA' : 'DIAS'}
                            </div>
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
                            <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{a.name}</span>{newAffiliateIds.has(a.id) && <NewBadge />}</div>
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
                          <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{a.name}</span>{newAffiliateIds.has(a.id) && <NewBadge />}</div>
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
                        <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{selectedAffiliateData.name}</span>{newAffiliateIds.has(selectedAffiliateData.id) && <NewBadge />}{selectedAffiliateData.is_sponsored && <span style={{ fontSize: 12, color: '#FFD700', flexShrink: 0 }}>⭐ PATROCINADO</span>}</div>
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
            <div style={{ display: 'flex', gap: 4, background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 10, padding: 4, marginBottom: 12 }}>
              {[{ id: 'feed', label: '📰 Feed em tempo real' }, { id: 'ranking', label: '🏆 Quem mais posta' }].map(function(v) {
                var active = postsView === v.id;
                return (<button key={v.id} onClick={function() { setPostsView(v.id); }} style={{ flex: 1, padding: '10px 12px', background: active ? '#1A1A1A' : 'transparent', border: 'none', borderRadius: 7, color: active ? '#FFD700' : '#555', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{v.label}</button>);
              })}
            </div>

            {postsView === 'ranking' && (function() {
              var now = Date.now();
              var windows = { today: (function() { var d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })(), '7d': now - 7*24*60*60*1000, '15d': now - 15*24*60*60*1000, '30d': now - 30*24*60*60*1000 };
              var since = windows[rankingWindow] || windows.today;
              var counts = {};
              (allPosts || []).forEach(function(p) {
                var t = new Date(p.created_at).getTime();
                if (t < since) return;
                counts[p.affiliate_id] = (counts[p.affiliate_id] || 0) + 1;
              });
              var ranking = Object.keys(counts).map(function(id) {
                var aff = affiliates.find(function(a) { return a.id === id; });
                return { id: id, count: counts[id], name: aff ? aff.name : 'Afiliado removido', coupon: aff ? aff.coupon_code : '', avatar: aff ? aff.avatar_initials : '??' };
              }).sort(function(a, b) { return b.count - a.count; });
              var windowLabels = { today: 'hoje', '7d': 'nos últimos 7 dias', '15d': 'nos últimos 15 dias', '30d': 'nos últimos 30 dias' };
              return (
                <div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {[{ id: 'today', label: 'Hoje' }, { id: '7d', label: '7 dias' }, { id: '15d', label: '15 dias' }, { id: '30d', label: '30 dias' }].map(function(f) {
                      var active = rankingWindow === f.id;
                      return (<button key={f.id} onClick={function() { setRankingWindow(f.id); }} style={{ padding: '8px 16px', background: active ? '#1A1A1A' : '#FFFFFF', border: '1px solid ' + (active ? '#1A1A1A' : '#E5E5E5'), borderRadius: 20, color: active ? '#FFD700' : '#555', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{f.label}</button>);
                    })}
                  </div>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 13, color: '#666' }}>
                    <strong>{ranking.length}</strong> afiliadas postaram {windowLabels[rankingWindow]} · <strong>{ranking.reduce(function(s, r) { return s + r.count; }, 0)}</strong> posts no total
                  </div>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 10, overflow: 'hidden' }}>
                    {ranking.length === 0 && (<div style={{ padding: 48, textAlign: 'center', color: '#888' }}>Nenhuma postagem no período</div>)}
                    {ranking.map(function(r, i) {
                      var trophy = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : ('#' + (i+1));
                      var isTop = i === 0;
                      return (
                        <div key={r.id} style={{ padding: '14px 16px', borderBottom: i < ranking.length - 1 ? '1px solid #F0F0F0' : 'none', display: 'grid', gridTemplateColumns: '44px 44px minmax(0, 1fr) auto', gap: 12, alignItems: 'center', background: isTop ? 'linear-gradient(90deg, rgba(255,215,0,0.12), transparent 70%)' : 'transparent' }}>
                          <div style={{ fontSize: isTop ? 26 : 16, fontWeight: 800, textAlign: 'center', color: i < 3 ? '#1A1A1A' : '#888' }}>{trophy}</div>
                          <div style={{ width: 40, height: 40, borderRadius: 20, background: isTop ? 'linear-gradient(135deg, #FFD700, #B8860B)' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: isTop ? '#1A1A1A' : '#666', flexShrink: 0 }}>{r.avatar}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{r.name}</span>
                              {newAffiliateIds.has(r.id) && <NewBadge />}
                            </div>
                            <div style={{ fontSize: 11, color: '#888' }}>{r.coupon}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: isTop ? '#B8860B' : '#1A1A1A', lineHeight: 1 }}>{r.count}</div>
                            <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>{r.count === 1 ? 'post' : 'posts'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {postsView === 'feed' && (<>
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#666' }}><strong>{recentPosts.length}</strong> postagens · atualiza a cada 30s</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8 }}>
              <div className="admin-post-header" style={{ padding: '12px 16px', borderBottom: '1px solid #E5E5E5', background: '#FAFAFA', display: 'grid', gridTemplateColumns: '40px 2fr 1fr 1fr 2fr', gap: 12, fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>
                <div></div><div>Afiliado</div><div>Rede</div><div>Data/Hora</div><div>Link</div>
              </div>
              {recentPosts.map(function(p) {
                return (<div key={p.id} className="admin-post-row" style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', display: 'grid', gridTemplateColumns: '40px minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr)', gap: 12, alignItems: 'center', fontSize: 13 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 16, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#666', flexShrink: 0 }}>{p.avatar_initials}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={p.affiliate_name}>{p.affiliate_name}</span>{newAffiliateIds.has(p.affiliate_id) && <NewBadge />}</div>
                    <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.coupon_code}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><span>{getPlatformIcon(p.platform)}</span><span style={{ fontSize: 12, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.platform}</span></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatDateTime(p.created_at)}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>{timeSince(p.created_at)}</div>
                  </div>
                  <div style={{ fontSize: 12, minWidth: 0, whiteSpace: 'nowrap' }}>{(function() {
                    if (!p.post_identifier) return <span style={{ color: '#CCC' }}>sem link</span>;
                    var isUrl = /^https?:\/\//i.test(p.post_identifier);
                    var info = isUrl ? analyzeLink(p.post_identifier, p.platform) : { valid: false };
                    var suspicious = isUrl && (!info.isTrusted || (info.expected.length > 0 && !info.matchesPlatform));
                    var color = !isUrl ? '#1A1A1A' : (suspicious ? '#B45309' : '#0070F3');
                    return (
                      <button onClick={function() { setLinkPreview({ url: p.post_identifier, platform: p.platform, affiliate: p.affiliate_name, isUrl: isUrl }); }} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: color, fontWeight: 700, textDecoration: 'underline', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                        {!isUrl && <span title="Texto inválido — não abrível">⛔</span>}
                        {isUrl && suspicious && <span title="Link suspeito">⚠️</span>}
                        LINK
                      </button>
                    );
                  })()}</div>
                </div>);
              })}
              {recentPosts.length === 0 && (<div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Nenhuma postagem</div>)}
            </div>
            </>)}
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
                    <div style={{ fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{a.name}</span>{newAffiliateIds.has(a.id) && <NewBadge />}{a.is_sponsored && <span style={{ fontSize: 10, color: '#FFD700', flexShrink: 0 }}>⭐ PATROCINADO</span>}</div>
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
                  <div style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{a.name}</span>{newAffiliateIds.has(a.id) && <NewBadge />}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{a.email}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#10B981' }}>{formatMoney(a.available_balance)}</div>
              </div>);
            })}
            {affiliates.filter(function(a) { return a.days_since_signup >= 30 && Number(a.available_balance) > 0; }).length === 0 && (<div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Nenhum afiliado com saldo</div>)}
          </div>
        )}

        {activeTab === 'withdrawals' && (function() {
          var nowTs = Date.now();
          var startToday = new Date(); startToday.setHours(0,0,0,0);
          var startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0,0,0,0);
          var startYear = new Date(new Date().getFullYear(), 0, 1);
          function inPeriod(iso) {
            if (!iso) return false;
            var t = new Date(iso).getTime();
            if (withdrawalsFilter === 'today') return t >= startToday.getTime();
            if (withdrawalsFilter === '7d') return nowTs - t <= 7 * 86400000;
            if (withdrawalsFilter === '15d') return nowTs - t <= 15 * 86400000;
            if (withdrawalsFilter === '30d') return nowTs - t <= 30 * 86400000;
            if (withdrawalsFilter === 'month') return t >= startMonth.getTime();
            if (withdrawalsFilter === 'year') return t >= startYear.getTime();
            return true;
          }
          var paidInPeriod = (withdrawals || []).filter(function(w) { return w.status === 'paid' && inPeriod(w.paid_at || w.created_at); });
          var totalAmount = paidInPeriod.reduce(function(s, w) { return s + Number(w.amount || 0); }, 0);
          var FILTERS = [
            { id: 'today', label: 'HOJE' },
            { id: '7d', label: '7 DIAS' },
            { id: '15d', label: '15 DIAS' },
            { id: '30d', label: '30 DIAS' },
            { id: 'month', label: 'MÊS' },
            { id: 'year', label: 'ANO' },
            { id: 'all', label: 'TUDO' },
          ];
          return (<div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Total de saques</div>
                <button onClick={function() { setShowExtrato(true); }} style={{ marginLeft: 'auto', padding: '7px 14px', background: '#1A1A1A', color: '#FFD700', border: 'none', borderRadius: 20, fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: 0.5 }}>📄 EXTRATO</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {FILTERS.map(function(f) {
                  var active = withdrawalsFilter === f.id;
                  return (<button key={f.id} onClick={function() { setWithdrawalsFilter(f.id); }} style={{ padding: '6px 12px', background: active ? '#1A1A1A' : '#FFFFFF', color: active ? '#FFD700' : '#1A1A1A', border: '1px solid ' + (active ? '#1A1A1A' : '#E5E5E5'), borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5 }}>{f.label}</button>);
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: 12, background: '#FAFAFA', borderRadius: 8, border: '1px solid #E5E5E5' }}>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Transferências</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{paidInPeriod.length}</div>
                </div>
                <div style={{ padding: 12, background: '#FAFAFA', borderRadius: 8, border: '1px solid #E5E5E5' }}>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Total pago</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#10B981' }}>{formatMoney(totalAmount)}</div>
                </div>
              </div>
            </div>
            {withdrawals.map(function(w) {
              var af = w.affiliates || {};
              var isPaid = w.status === 'paid';
              var isRejected = w.status === 'rejected';
              var hasReceipt = !!w.receipt_url;
              return (<div key={w.id} style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 18, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: isPaid ? '#D1FAE5' : isRejected ? '#FEE2E2' : '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{af.avatar_initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{af.name}</span>{newAffiliateIds.has(af.id) && <NewBadge />}</div>
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
          </div>);
        })()}

        {activeTab === 'cadastros' && (function() {
          var now = Date.now();
          var thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0);
          var thisYear = new Date(new Date().getFullYear(), 0, 1);
          function passFilter(createdAtIso) {
            if (!createdAtIso) return cadastrosFilter === 'all';
            var t = new Date(createdAtIso).getTime();
            if (cadastrosFilter === 'new5') return now - t <= 5 * 86400000;
            if (cadastrosFilter === '7d') return now - t <= 7 * 86400000;
            if (cadastrosFilter === '30d') return now - t <= 30 * 86400000;
            if (cadastrosFilter === 'month') return t >= thisMonth.getTime();
            if (cadastrosFilter === 'year') return t >= thisYear.getTime();
            return true;
          }
          var activeAffiliates = (affiliatesFull || []).filter(function(a) { return !a.deleted_at; });
          var deletedAffiliates = (affiliatesFull || []).filter(function(a) { return a.deleted_at; });
          var pendingAffiliates = activeAffiliates.filter(function(a) { return a.approval_status === 'pending'; });
          var sourceList = cadastrosFilter === 'deleted' ? deletedAffiliates : (cadastrosFilter === 'pending' ? pendingAffiliates : activeAffiliates);
          var filtered = cadastrosFilter === 'deleted'
            ? deletedAffiliates.slice().sort(function(a, b) { return new Date(b.deleted_at) - new Date(a.deleted_at); })
            : cadastrosFilter === 'pending'
              ? pendingAffiliates.slice().sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); })
              : sourceList.filter(function(a) { return passFilter(a.created_at); });
          var totalAll = activeAffiliates.length;
          var statsCards = [
            { label: 'Total', value: totalAll, tint: '#1A1A1A' },
            { label: 'Últimos 5 dias', value: activeAffiliates.filter(function(a) { return a.created_at && now - new Date(a.created_at).getTime() <= 5 * 86400000; }).length, tint: '#10B981' },
            { label: '30 dias', value: activeAffiliates.filter(function(a) { return a.created_at && now - new Date(a.created_at).getTime() <= 30 * 86400000; }).length, tint: '#3B82F6' },
            { label: 'Este mês', value: activeAffiliates.filter(function(a) { return a.created_at && new Date(a.created_at).getTime() >= thisMonth.getTime(); }).length, tint: '#8B5CF6' },
            { label: 'Este ano', value: activeAffiliates.filter(function(a) { return a.created_at && new Date(a.created_at).getTime() >= thisYear.getTime(); }).length, tint: '#F59E0B' },
          ];
          var filterOptions = [
            { id: 'pending', label: '⏳ Aguardando liberação (' + pendingAffiliates.length + ')' },
            { id: 'new5', label: '✨ Novos (5 dias)' },
            { id: '7d', label: '7 dias' },
            { id: '30d', label: '30 dias' },
            { id: 'month', label: 'Este mês' },
            { id: 'year', label: 'Este ano' },
            { id: 'all', label: 'Todos' },
            { id: 'deleted', label: '🗑️ Deletadas (' + deletedAffiliates.length + ')' },
          ];
          function fmtDate(iso) {
            if (!iso) return '—';
            var d = new Date(iso);
            return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          }
          return (
            <div>
              <div className="admin-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
                {statsCards.map(function(s) {
                  return (
                    <div key={s.label} style={{ background: '#FFF', border: '1px solid #E5E5E5', borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>{s.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: s.tint, marginTop: 4, lineHeight: 1 }}>{s.value}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {filterOptions.map(function(f) {
                  var active = cadastrosFilter === f.id;
                  var shouldPulse = f.id === 'pending' && pendingAffiliates.length > 0 && !active;
                  return (<button
                    key={f.id}
                    onClick={function() { setCadastrosFilter(f.id); }}
                    style={{
                      padding: '8px 14px',
                      background: active ? '#1A1A1A' : (shouldPulse ? '#FEE2E2' : '#FFF'),
                      border: '1px solid ' + (active ? '#1A1A1A' : (shouldPulse ? '#EF4444' : '#E5E5E5')),
                      borderRadius: 20,
                      color: active ? '#FFD700' : (shouldPulse ? '#991B1B' : '#555'),
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      animation: shouldPulse ? 'badgeBlink 1s ease-in-out infinite' : 'none',
                    }}
                  >{f.label}</button>);
                })}
              </div>

              <div style={{ background: '#FFF', border: '1px solid #E5E5E5', borderRadius: 10, padding: '12px 16px', marginBottom: 10, fontSize: 13, color: '#666' }}>
                <strong style={{ color: '#1A1A1A' }}>{filtered.length}</strong> {filtered.length === 1 ? 'cadastro' : 'cadastros'} no filtro selecionado
              </div>

              <div style={{ background: '#FFF', border: '1px solid #E5E5E5', borderRadius: 10, overflow: 'hidden' }}>
                {filtered.length === 0 && (<div style={{ padding: 48, textAlign: 'center', color: '#888' }}>Nenhum cadastro nesse período</div>)}
                {filtered.map(function(a, i) {
                  var isOnline = onlineIds.has(a.id);
                  return (
                    <button key={a.id} onClick={function() { setSelectedCadastroId(a.id); }} style={{ width: '100%', padding: '14px 16px', borderBottom: i < filtered.length - 1 ? '1px solid #F0F0F0' : 'none', display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) auto', gap: 12, alignItems: 'center', background: 'transparent', border: 'none', borderBottomColor: i < filtered.length - 1 ? '#F0F0F0' : 'transparent', borderBottomWidth: 1, borderBottomStyle: 'solid', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 20, background: a.avatar_url ? 'transparent' : '#F3F4F6', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#666', flexShrink: 0 }}>
                        {a.avatar_url ? <img src={storageProxyUrl(a.avatar_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : a.avatar_initials}
                        {isOnline && <span style={{ position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 6, background: '#10B981', border: '2px solid #FFF', animation: 'onlineDotPulse 1.6s ease-in-out infinite' }} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{a.name}</span>
                          {newAffiliateIds.has(a.id) && <NewBadge />}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#C9A961', marginTop: 1, letterSpacing: 0.5 }}>{a.coupon_code}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#888' }}>{fmtDate(a.created_at)}</div>
                        <div style={{ fontSize: 11, color: '#BBB', marginTop: 2 }}>›</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {activeTab === 'vendas-manual' && (function() {
          var mm = new Date(); mm.setDate(1); mm.setHours(0,0,0,0);
          var monthStart = mm.getTime();
          var salesByAf = {};
          (allSales || []).forEach(function(s) {
            var t = s.created_at ? new Date(s.created_at).getTime() : 0;
            if (t >= monthStart && s.affiliate_id) {
              salesByAf[s.affiliate_id] = (salesByAf[s.affiliate_id] || 0) + 1;
            }
          });
          var pool = (affiliatesFull || []).filter(function(a) { return !a.is_admin && !a.blocked; });
          var top10 = pool.slice().sort(function(a, b) { return (salesByAf[b.id] || 0) - (salesByAf[a.id] || 0); }).slice(0, 10).filter(function(a) { return (salesByAf[a.id] || 0) > 0; });
          var q = vendasManualSearch.trim().toLowerCase();
          var searchResults = q ? pool.filter(function(a) {
            return (a.coupon_code || '').toLowerCase().includes(q) || (a.name || '').toLowerCase().includes(q);
          }).slice(0, 20) : [];

          function getQty(id) { return Math.max(1, Number(vendasManualQty[id]) || 1); }
          function setQty(id, n) {
            var clamped = Math.max(1, Math.min(50, Math.floor(n)));
            setVendasManualQty(function(prev) { var p = Object.assign({}, prev); p[id] = clamped; return p; });
          }
          function incQty(id) { setQty(id, getQty(id) + 1); }
          function decQty(id) { setQty(id, getQty(id) - 1); }
          function askAdd(a) { setVendasManualConfirm({ affiliate: a, quantity: getQty(a.id) }); }

          function Card(props) {
            var a = props.affiliate;
            var count = salesByAf[a.id] || 0;
            var qty = getQty(a.id);
            var rank = props.rank;
            return (
              <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {typeof rank === 'number' && (
                  <div style={{ width: 26, height: 26, borderRadius: 13, background: rank <= 3 ? '#FFD700' : '#F3F4F6', color: rank <= 3 ? '#1a1306' : '#666', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{rank}</div>
                )}
                <div style={{ width: 38, height: 38, borderRadius: 19, background: a.avatar_url ? 'transparent' : 'linear-gradient(135deg, #E8CF8B, #C9A961)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1a1306', flexShrink: 0 }}>
                  {a.avatar_url ? <img src={storageProxyUrl(a.avatar_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : a.avatar_initials}
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 120 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace', letterSpacing: 0.5 }}>{a.coupon_code}</span>
                    <span title="vendas no mes" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', background: '#FEF3C7', borderRadius: 10, fontSize: 10, fontWeight: 700, color: '#92400E' }}>🏷️ {count}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button onClick={function() { decQty(a.id); }} disabled={qty <= 1} style={{ width: 30, height: 30, borderRadius: 15, background: qty <= 1 ? '#F3F4F6' : '#FFFFFF', border: '1px solid #E5E5E5', fontSize: 16, fontWeight: 700, cursor: qty <= 1 ? 'not-allowed' : 'pointer', color: qty <= 1 ? '#CCC' : '#1A1A1A', lineHeight: 1 }}>−</button>
                  <div style={{ minWidth: 36, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', background: '#1A1A1A', color: '#FFD700', borderRadius: 6, fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{qty}</div>
                  <button onClick={function() { incQty(a.id); }} disabled={qty >= 50} style={{ width: 30, height: 30, borderRadius: 15, background: '#FFFFFF', border: '1px solid #E5E5E5', fontSize: 16, fontWeight: 700, cursor: 'pointer', color: '#1A1A1A', lineHeight: 1 }}>+</button>
                  <button onClick={function() { askAdd(a); }} style={{ padding: '6px 12px', background: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: 0.5 }}>ADD</button>
                </div>
              </div>
            );
          }

          return (<div>
            <div style={{ background: '#FFF7E6', border: '1px solid #FFD700', borderRadius: 10, padding: 10, marginBottom: 14, fontSize: 12, color: '#6B4E00' }}>
              <b>⚠️ Ferramenta manual.</b> Insere vendas direto no sistema, usa o valor de comissao da afiliada e dispara notificacao. Nao afeta o fluxo automatico do webhook.
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>Buscar por cupom ou nome</div>
              <input
                type="text"
                value={vendasManualSearch}
                onChange={function(e) { setVendasManualSearch(e.target.value); }}
                placeholder="Digite o cupom (ex: MARIA10) ou nome..."
                style={{ width: '100%', padding: 12, border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              {q && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {searchResults.length === 0 && (<div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>Nenhum resultado</div>)}
                  {searchResults.map(function(a) { return <Card key={a.id} affiliate={a} />; })}
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: '#1A1A1A' }}>🏆 TOP 10 DO MES</div>
                <div style={{ fontSize: 11, color: '#888' }}>{(function() { var names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; var d = new Date(); return names[d.getMonth()] + '/' + d.getFullYear(); })()}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {top10.length === 0 && (<div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13, background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 10 }}>Ninguem vendeu este mes ainda</div>)}
                {top10.map(function(a, idx) { return <Card key={a.id} affiliate={a} rank={idx + 1} />; })}
              </div>
            </div>
          </div>);
        })()}

        {activeTab === 'fixed-monthly' && (function() {
          var q = fixedSearch.trim().toLowerCase();
          var pool = (affiliatesFull || []).filter(function(a) { return !a.is_admin && !a.deleted_at; });
          var searchResults = q ? pool.filter(function(a) {
            return (a.coupon_code || '').toLowerCase().includes(q) || (a.name || '').toLowerCase().includes(q);
          }).slice(0, 20) : [];
          var activeRules = (fixedRules || []).filter(function(r) { return r.active; });
          var inactiveRules = (fixedRules || []).filter(function(r) { return !r.active; });

          function openModal(a) {
            setFixedModalAffiliate(a);
            setFixedAmount('');
            setFixedPayday('5');
            setFixedRecurring(true);
          }

          async function submitRule() {
            if (!fixedModalAffiliate) return;
            var amt = Number(fixedAmount.replace(',', '.'));
            if (!amt || amt <= 0) { alert('Informe um valor valido'); return; }
            var payday = Math.floor(Number(fixedPayday));
            if (!payday || payday < 1 || payday > 31) { alert('Dia invalido (1-31)'); return; }
            setFixedBusy(true);
            try {
              var res = await fetch('/api/admin/fixed?action=create', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ affiliate_id: fixedModalAffiliate.id, amount: amt, payday: payday, recurring: fixedRecurring }),
              });
              var data = await res.json().catch(function() { return {}; });
              if (!res.ok || !data.ok) { alert('Erro: ' + (data.error || 'falha')); setFixedBusy(false); return; }
              setFixedModalAffiliate(null);
              await loadAll();
            } catch (e) { alert('Erro: ' + e.message); }
            setFixedBusy(false);
          }

          async function deleteRule(r) {
            if (!confirm('Excluir regra de ' + (r.affiliates && r.affiliates.name) + '? Pagamentos ja feitos NAO serao revertidos.')) return;
            try {
              var res = await fetch('/api/admin/fixed?action=delete', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rule_id: r.id }),
              });
              var d = await res.json().catch(function() { return {}; });
              if (!res.ok || !d.ok) { alert('Erro: ' + (d.error || 'falha')); return; }
              await loadAll();
            } catch (e) { alert('Erro: ' + e.message); }
          }

          async function toggleRule(r) {
            try {
              var res = await fetch('/api/admin/fixed?action=toggle', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rule_id: r.id }),
              });
              var d = await res.json().catch(function() { return {}; });
              if (!res.ok || !d.ok) { alert('Erro: ' + (d.error || 'falha')); return; }
              await loadAll();
            } catch (e) { alert('Erro: ' + e.message); }
          }

          async function payNow(r) {
            if (!confirm('Creditar R$' + Number(r.amount).toFixed(2).replace('.', ',') + ' agora para ' + (r.affiliates && r.affiliates.name) + '?')) return;
            try {
              var res = await fetch('/api/admin/fixed?action=pay-now', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rule_id: r.id }),
              });
              var d = await res.json().catch(function() { return {}; });
              if (!res.ok || !d.ok) { alert('Erro: ' + (d.error || 'falha')); return; }
              alert('Pagamento creditado.');
              await loadAll();
            } catch (e) { alert('Erro: ' + e.message); }
          }

          function fmtMoney(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ','); }
          function fmtDate(iso) { if (!iso) return '—'; var d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }

          function RuleCard(props) {
            var r = props.rule;
            var a = r.affiliates || {};
            return (
              <div style={{ background: r.active ? '#FFFFFF' : '#FAFAFA', border: '1px solid ' + (r.active ? '#FFD700' : '#E5E5E5'), borderRadius: 10, padding: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ width: 38, height: 38, borderRadius: 19, background: a.avatar_url ? 'transparent' : 'linear-gradient(135deg, #E8CF8B, #C9A961)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1a1306', flexShrink: 0 }}>
                  {a.avatar_url ? <img src={storageProxyUrl(a.avatar_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : a.avatar_initials}
                </div>
                <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name || '—'}</div>
                  <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace', marginTop: 2 }}>{a.coupon_code}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, flex: '1 1 auto', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Valor</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#C9A961' }}>{fmtMoney(r.amount)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Dia</div>
                    <div style={{ fontSize: 15, fontWeight: 900 }}>{r.payday}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Tipo</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: r.recurring ? '#10B981' : '#888' }}>{r.recurring ? 'RECORRENTE' : 'Única'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={function() { toggleRule(r); }} style={{ padding: '6px 10px', background: '#FFFFFF', color: r.active ? '#991B1B' : '#065F46', border: '1px solid ' + (r.active ? '#FCA5A5' : '#6EE7B7'), borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{r.active ? 'Pausar' : 'Ativar'}</button>
                  <button onClick={function() { deleteRule(r); }} style={{ padding: '6px 10px', background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ flexBasis: '100%', fontSize: 10, color: '#888' }}>Último pagamento: {fmtDate(r.last_paid_at)}</div>
              </div>
            );
          }

          return (<div>
            <div style={{ background: 'linear-gradient(135deg, #1A1306 0%, #0a0604 100%)', border: '1px solid rgba(201,169,97,0.35)', borderRadius: 12, padding: 16, marginBottom: 14, color: '#FFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>💠</span>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#C9A961', letterSpacing: 1 }}>FIXO MENSAL</div>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>Pagamento mensal fixo para afiliadas patrocinadas. O valor entra no saldo disponível na hora (não fica bloqueado 8 dias). Se recorrente, processa automaticamente todo mês no dia escolhido.</div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>Adicionar fixo mensal - buscar afiliada</div>
              <input
                type="text"
                value={fixedSearch}
                onChange={function(e) { setFixedSearch(e.target.value); }}
                placeholder="Digite o cupom ou nome..."
                style={{ width: '100%', padding: 12, border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              {q && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {searchResults.length === 0 && (<div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>Nenhum resultado</div>)}
                  {searchResults.map(function(a) {
                    return (
                      <div key={a.id} style={{ background: '#FAFAFA', border: '1px solid #E5E5E5', borderRadius: 8, padding: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 17, background: a.avatar_url ? 'transparent' : 'linear-gradient(135deg, #E8CF8B, #C9A961)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#1a1306', flexShrink: 0 }}>
                          {a.avatar_url ? <img src={storageProxyUrl(a.avatar_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : a.avatar_initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{a.coupon_code}</div>
                        </div>
                        <button onClick={function() { openModal(a); }} style={{ padding: '7px 14px', background: 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)', color: '#1a1306', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: 0.5 }}>+ ADICIONAR</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: '#888', fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Regras Ativas ({activeRules.length})</div>
            {activeRules.length === 0 && (<div style={{ background: '#FFF', border: '1px solid #E5E5E5', borderRadius: 10, padding: 30, textAlign: 'center', color: '#888', fontSize: 13, marginBottom: 16 }}>Nenhuma regra ativa</div>)}
            {activeRules.map(function(r) { return <RuleCard key={r.id} rule={r} />; })}

            {inactiveRules.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: '#888', fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 20 }}>Pausadas ({inactiveRules.length})</div>
                {inactiveRules.map(function(r) { return <RuleCard key={r.id} rule={r} />; })}
              </>
            )}
          </div>);
        })()}

        {activeTab === 'notify' && (function() {
          var q = notifySearch.trim().toLowerCase();
          var list = (affiliatesFull || []).filter(function(a) {
            if (a.is_admin) return false;
            if (!q) return true;
            return (a.name || '').toLowerCase().includes(q) || (a.coupon_code || '').toLowerCase().includes(q);
          }).slice(0, 30);

          async function sendNotification(type) {
            if (!notifyTarget) { alert('Selecione uma afiliada'); return; }
            var msg = notifyMessage.trim();
            if (!msg) { alert('Escreva a mensagem'); return; }
            setNotifySending(true);
            try {
              var res = await fetch('/api/admin/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ affiliate_id: notifyTarget.id, type: type, title: notifyTitle.trim() || null, message: msg }) });
              var data = await res.json().catch(function() { return {}; });
              if (!res.ok || !data.ok) { alert('Erro: ' + (data.error || 'falha ao enviar')); setNotifySending(false); return; }
              if (type === 'warning' && data.banned) {
                alert('Notificação enviada. Esta foi a 2ª advertência — afiliada BANIDA automaticamente.');
              } else if (type === 'warning') {
                alert('Notificação enviada (advertência ' + data.warnings_count + '/2).');
              } else {
                alert('Mensagem enviada.');
              }
              setNotifyMessage(''); setNotifyTitle('');
              await loadAll();
            } catch (e) { alert('Erro: ' + e.message); }
            setNotifySending(false);
          }
          async function confirmBan() {
            if (!notifyTarget) return;
            if (!confirm('BANIR ' + notifyTarget.name + ' permanentemente? Ela perderá acesso ao painel imediatamente.')) return;
            setNotifySending(true);
            try {
              var res = await fetch('/api/admin/ban', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ affiliate_id: notifyTarget.id }) });
              var data = await res.json().catch(function() { return {}; });
              if (!res.ok || !data.ok) { alert('Erro: ' + (data.error || 'falha')); setNotifySending(false); return; }
              alert('Afiliada banida.');
              await loadAll();
            } catch (e) { alert('Erro: ' + e.message); }
            setNotifySending(false);
          }
          async function unban() {
            if (!notifyTarget) return;
            if (!confirm('Desbloquear ' + notifyTarget.name + ' e zerar advertências?')) return;
            setNotifySending(true);
            try {
              var res = await fetch('/api/admin/ban', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ affiliate_id: notifyTarget.id, action: 'unban' }) });
              var data = await res.json().catch(function() { return {}; });
              if (!res.ok || !data.ok) { alert('Erro: ' + (data.error || 'falha')); setNotifySending(false); return; }
              alert('Desbloqueada.');
              await loadAll();
            } catch (e) { alert('Erro: ' + e.message); }
            setNotifySending(false);
          }

          return (
            <div className="admin-notify-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 320px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
              <div style={{ background: '#FFF', border: '1px solid #E5E5E5', borderRadius: 10, overflow: 'hidden', minWidth: 0 }}>
                <div style={{ padding: 12, borderBottom: '1px solid #E5E5E5', background: '#FAFAFA' }}>
                  <input value={notifySearch} onChange={function(e) { setNotifySearch(e.target.value); }} placeholder="Buscar por nome ou cupom" style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div className="admin-notify-list" style={{ maxHeight: 520, overflowY: 'auto' }}>
                  {list.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>Nenhum afiliado</div>}
                  {list.map(function(a) {
                    var selected = notifyTarget && notifyTarget.id === a.id;
                    return (
                      <button key={a.id} onClick={function() { setNotifyTarget(a); }} style={{ width: '100%', padding: '10px 14px', borderBottom: '1px solid #F0F0F0', background: selected ? '#FEF3C7' : 'transparent', border: 'none', borderLeft: selected ? '4px solid #F59E0B' : '4px solid transparent', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 16, background: a.avatar_url ? 'transparent' : '#F3F4F6', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#666', flexShrink: 0 }}>
                          {a.avatar_url ? <img src={storageProxyUrl(a.avatar_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : a.avatar_initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{a.name}</span>
                            {newAffiliateIds.has(a.id) && <NewBadge />}
                          </div>
                          <div style={{ fontSize: 11, color: '#C9A961', fontWeight: 700 }}>{a.coupon_code}</div>
                        </div>
                        {a.blocked && <span style={{ fontSize: 10, fontWeight: 800, color: '#FFF', background: '#DC2626', padding: '2px 6px', borderRadius: 10 }}>BANIDA</span>}
                        {!a.blocked && Number(a.warnings_count || 0) >= 1 && <span style={{ fontSize: 10, fontWeight: 800, color: '#92400E', background: '#FEF3C7', padding: '2px 6px', borderRadius: 10 }}>⚠ {a.warnings_count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!notifyTarget && (
                <div style={{ background: '#FFF', border: '2px dashed #E5E5E5', borderRadius: 10, padding: 60, textAlign: 'center', color: '#888' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>👈</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Selecione uma afiliada</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>Busque por cupom ou nome ao lado e clique para enviar mensagem</div>
                </div>
              )}

              {notifyTarget && (
                <div style={{ background: '#FFF', border: '1px solid #E5E5E5', borderRadius: 10, padding: 20, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #F0F0F0' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 22, background: notifyTarget.avatar_url ? 'transparent' : 'linear-gradient(135deg, #FFD700, #B8860B)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                      {notifyTarget.avatar_url ? <img src={storageProxyUrl(notifyTarget.avatar_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : notifyTarget.avatar_initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{notifyTarget.name}</div>
                      <div style={{ fontSize: 12, color: '#C9A961', fontWeight: 700 }}>{notifyTarget.coupon_code}</div>
                      {notifyTarget.blocked && <div style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', marginTop: 4 }}>⛔ BANIDA</div>}
                      {!notifyTarget.blocked && Number(notifyTarget.warnings_count || 0) >= 1 && <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginTop: 4 }}>⚠ {notifyTarget.warnings_count} advertência(s) — mais 1 = ban automático</div>}
                    </div>
                    <button onClick={function() { setNotifyTarget(null); setNotifyMessage(''); setNotifyTitle(''); }} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888', padding: 4 }}>✕</button>
                  </div>

                  {notifyTarget.blocked ? (
                    <div>
                      <div style={{ padding: 14, background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, color: '#991B1B', fontSize: 13, marginBottom: 14 }}>
                        Esta afiliada está banida. Ela não consegue mais acessar o painel nem ver notificações.
                      </div>
                      <button onClick={unban} disabled={notifySending} style={{ width: '100%', padding: 12, background: '#10B981', color: '#FFF', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: notifySending ? 0.6 : 1 }}>Desbloquear e zerar advertências</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 12, color: '#666', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Tipo de mensagem</div>
                      <div className="admin-notify-types" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                        {[
                          { id: 'praise', label: '🎉 Parabenizar', bg: '#10B981' },
                          { id: 'info', label: '📢 Aviso', bg: '#3B82F6' },
                          { id: 'warning', label: '⚠️ Advertir', bg: '#DC2626' },
                        ].map(function(opt) {
                          var selected = notifyType === opt.id;
                          return (<button key={opt.id} onClick={function() { setNotifyType(opt.id); }} style={{ padding: '10px 12px', background: selected ? opt.bg : '#F3F4F6', color: selected ? '#FFF' : '#444', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{opt.label}</button>);
                        })}
                      </div>

                      <div style={{ fontSize: 12, color: '#666', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Título (opcional)</div>
                      <input value={notifyTitle} onChange={function(e) { setNotifyTitle(e.target.value); }} maxLength={120} placeholder="Ex: Você bateu 20 vendas!" style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 13, outline: 'none', marginBottom: 12 }} />

                      <div style={{ fontSize: 12, color: '#666', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Mensagem</div>
                      <textarea value={notifyMessage} onChange={function(e) { setNotifyMessage(e.target.value); }} maxLength={2000} rows={6} placeholder={notifyType === 'praise' ? 'Parabéns pelo seu desempenho! Você está...' : notifyType === 'warning' ? 'Identificamos que você divulgou... Isso viola o item X dos termos.' : 'Gostaríamos de informar que...'} style={{ width: '100%', padding: 12, border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical', marginBottom: 14 }} />

                      {notifyType === 'warning' && Number(notifyTarget.warnings_count || 0) >= 1 && (
                        <div style={{ padding: 12, background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, color: '#991B1B', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
                          ⛔ Esta afiliada já tem {notifyTarget.warnings_count} advertência(s). Enviar outra advertência vai BANI-LA automaticamente.
                        </div>
                      )}

                      <button onClick={function() { sendNotification(notifyType); }} disabled={notifySending || !notifyMessage.trim()} style={{ width: '100%', padding: 14, background: notifyType === 'praise' ? '#10B981' : notifyType === 'warning' ? '#DC2626' : '#3B82F6', color: '#FFF', border: 'none', borderRadius: 10, fontWeight: 900, fontSize: 14, cursor: (notifySending || !notifyMessage.trim()) ? 'not-allowed' : 'pointer', opacity: (notifySending || !notifyMessage.trim()) ? 0.6 : 1, marginBottom: 10 }}>
                        {notifySending ? 'Enviando...' : 'ENVIAR MENSAGEM'}
                      </button>

                      <button onClick={confirmBan} disabled={notifySending} style={{ width: '100%', padding: 11, background: '#FFF', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: notifySending ? 0.6 : 1 }}>
                        🚫 Banir permanentemente agora
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
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

      {fixedModalAffiliate && (function() {
        var a = fixedModalAffiliate;
        function formatBRL(digits) {
          if (!digits) return '';
          var cents = parseInt(digits, 10);
          if (!Number.isFinite(cents)) return '';
          var reais = (cents / 100).toFixed(2);
          return 'R$ ' + reais.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
        async function submit() {
          var digits = String(fixedAmount).replace(/\D/g, '');
          var amt = digits ? parseInt(digits, 10) / 100 : 0;
          if (!amt || amt <= 0) { alert('Informe um valor valido'); return; }
          var payday = Math.floor(Number(fixedPayday));
          if (!payday || payday < 1 || payday > 31) { alert('Dia invalido (1-31)'); return; }
          setFixedBusy(true);
          try {
            var res = await fetch('/api/admin/fixed?action=create', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ affiliate_id: a.id, amount: amt, payday: payday, recurring: fixedRecurring }),
            });
            var data = await res.json().catch(function() { return {}; });
            if (!res.ok || !data.ok) { alert('Erro: ' + (data.error || 'falha')); setFixedBusy(false); return; }
            setFixedModalAffiliate(null);
            await loadAll();
          } catch (e) { alert('Erro: ' + e.message); }
          setFixedBusy(false);
        }
        return (
          <div onClick={function() { if (!fixedBusy) setFixedModalAffiliate(null); }} style={{ position: 'fixed', inset: 0, zIndex: 9800, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: 440, width: '100%', background: 'linear-gradient(180deg, #1a1306, #0a0604)', border: '2px solid #C9A961', borderRadius: 14, padding: 22, color: '#FFF', boxShadow: '0 20px 80px rgba(201,169,97,0.35)' }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 34 }}>💠</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#C9A961', marginTop: 4, letterSpacing: 1 }}>FIXO MENSAL</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{a.name} · <span style={{ fontFamily: 'monospace' }}>{a.coupon_code}</span></div>
              </div>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(201,169,97,0.8)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>Valor mensal</label>
              <input type="text" inputMode="numeric" value={formatBRL(fixedAmount)} onChange={function(e) { setFixedAmount(e.target.value.replace(/\D/g, '').slice(0, 10)); }} placeholder="R$ 0,00" style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,169,97,0.4)', borderRadius: 10, color: '#fff', fontSize: 18, fontWeight: 800, outline: 'none', marginBottom: 14, boxSizing: 'border-box' }} />
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(201,169,97,0.8)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>Dia do pagamento (1–31)</label>
              <input type="number" min={1} max={31} value={fixedPayday} onChange={function(e) { setFixedPayday(e.target.value.replace(/\D/g, '').slice(0, 2)); }} style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,169,97,0.4)', borderRadius: 10, color: '#fff', fontSize: 16, fontWeight: 700, outline: 'none', marginBottom: 14, boxSizing: 'border-box' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'rgba(201,169,97,0.05)', border: '1px solid rgba(201,169,97,0.25)', borderRadius: 10, cursor: 'pointer', marginBottom: 14 }}>
                <input type="checkbox" checked={fixedRecurring} onChange={function(e) { setFixedRecurring(e.target.checked); }} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A961' }}>Recorrente (todo mês)</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{fixedRecurring ? 'Paga automaticamente todo mês no dia escolhido' : 'Apenas esta parcela (pagamento único)'}</div>
                </div>
              </label>
              <div style={{ padding: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, marginBottom: 16, fontSize: 11, color: 'rgba(167,243,208,0.9)', lineHeight: 1.5 }}>💡 A primeira parcela é creditada imediatamente no saldo DISPONÍVEL (sem bloqueio de 8 dias). A afiliada é notificada.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={function() { if (!fixedBusy) setFixedModalAffiliate(null); }} disabled={fixedBusy} style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 700, cursor: fixedBusy ? 'not-allowed' : 'pointer' }}>Cancelar</button>
                <button onClick={submit} disabled={fixedBusy} style={{ flex: 2, padding: 12, background: 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)', border: 'none', borderRadius: 10, color: '#1a1306', fontSize: 14, fontWeight: 900, cursor: fixedBusy ? 'wait' : 'pointer', letterSpacing: 0.5, opacity: fixedBusy ? 0.7 : 1 }}>{fixedBusy ? 'CRIANDO...' : '💠 CRIAR E PAGAR'}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {vendasManualConfirm && (function() {
        var a = vendasManualConfirm.affiliate;
        var qty = vendasManualConfirm.quantity;
        var commission = Number(a.commission_value || 25);
        var total = commission * qty;
        async function doConfirm() {
          if (vendasManualBusy) return;
          setVendasManualBusy(true);
          try {
            var res = await fetch('/api/admin/sales/manual-insert', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ affiliate_id: a.id, quantity: qty }),
            });
            var data = await res.json().catch(function() { return {}; });
            if (!res.ok || !data.ok) {
              alert('Erro: ' + (data.error || 'falha ao inserir'));
            } else {
              setVendasManualQty(function(prev) { var p = Object.assign({}, prev); p[a.id] = 1; return p; });
              setVendasManualConfirm(null);
              await loadAll();
            }
          } catch (e) {
            alert('Erro de conexao: ' + (e && e.message ? e.message : 'erro'));
          }
          setVendasManualBusy(false);
        }
        return (
          <div onClick={function() { if (!vendasManualBusy) setVendasManualConfirm(null); }} style={{ position: 'fixed', inset: 0, zIndex: 9800, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: 420, width: '100%', background: '#FFF', borderRadius: 14, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
              <div style={{ textAlign: 'center', fontSize: 34, marginBottom: 6 }}>🛒</div>
              <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Tem certeza?</div>
              <div style={{ background: '#FAFAFA', border: '1px solid #E5E5E5', borderRadius: 10, padding: 14, marginBottom: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Inserir {qty} {qty === 1 ? 'venda' : 'vendas'} para</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: '#888', fontFamily: 'monospace', letterSpacing: 0.5, marginBottom: 10 }}>{a.coupon_code}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ padding: 8, background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', fontWeight: 700 }}>Cada</div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>R$ {commission.toFixed(2).replace('.', ',')}</div>
                  </div>
                  <div style={{ padding: 8, background: '#D1FAE5', border: '1px solid #10B981', borderRadius: 8 }}>
                    <div style={{ fontSize: 9, color: '#065F46', textTransform: 'uppercase', fontWeight: 700 }}>Total</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#065F46' }}>R$ {total.toFixed(2).replace('.', ',')}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={function() { if (!vendasManualBusy) setVendasManualConfirm(null); }} disabled={vendasManualBusy} style={{ flex: 1, padding: 12, background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: vendasManualBusy ? 'not-allowed' : 'pointer', color: '#1A1A1A' }}>NAO</button>
                <button onClick={doConfirm} disabled={vendasManualBusy} style={{ flex: 1, padding: 12, background: '#10B981', border: 'none', borderRadius: 8, color: '#FFF', fontSize: 14, fontWeight: 800, cursor: vendasManualBusy ? 'wait' : 'pointer', letterSpacing: 0.5 }}>{vendasManualBusy ? 'INSERINDO...' : 'SIM'}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {showExtrato && (function() {
        var paidOnDay = (withdrawals || []).filter(function(w) {
          if (w.status !== 'paid') return false;
          var iso = w.paid_at || w.created_at;
          if (!iso) return false;
          var d = new Date(iso);
          var local = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          return local === extratoDate;
        });
        var total = paidOnDay.reduce(function(s, w) { return s + Number(w.amount || 0); }, 0);
        return (
          <div onClick={function() { setShowExtrato(false); }} style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: 620, width: '100%', background: '#FFF', borderRadius: 12, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: 16, borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Extrato de saques</div>
                <button onClick={function() { setShowExtrato(false); }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ padding: 16, borderBottom: '1px solid #E5E5E5' }}>
                <label style={{ display: 'block', fontSize: 11, color: '#666', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>Escolha o dia</label>
                <input type="date" value={extratoDate} onChange={function(e) { setExtratoDate(e.target.value); }} style={{ width: '100%', padding: 10, border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14 }} />
                <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, padding: 10, background: '#FAFAFA', borderRadius: 8, border: '1px solid #E5E5E5' }}>
                    <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Transferências</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{paidOnDay.length}</div>
                  </div>
                  <div style={{ flex: 1, padding: 10, background: '#FAFAFA', borderRadius: 8, border: '1px solid #E5E5E5' }}>
                    <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Total</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#10B981' }}>{formatMoney(total)}</div>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {paidOnDay.length === 0 && (<div style={{ textAlign: 'center', color: '#888', padding: 30, fontSize: 13 }}>Nenhum saque pago neste dia</div>)}
                {paidOnDay.map(function(w) {
                  var af = w.affiliates || {};
                  return (<div key={w.id} style={{ border: '1px solid #E5E5E5', borderRadius: 10, padding: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 19, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#065F46', flexShrink: 0 }}>{af.avatar_initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{af.name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{af.coupon_code} · {formatDateTime(w.paid_at || w.created_at)}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#10B981' }}>{formatMoney(w.amount)}</div>
                      {w.receipt_url ? (
                        <button onClick={function() { setViewReceiptUrl(w.receipt_url); }} style={{ marginTop: 4, padding: '4px 10px', background: '#10B981', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5 }}>COMPROVANTE</button>
                      ) : (
                        <div style={{ marginTop: 4, fontSize: 10, color: '#888' }}>sem comprovante</div>
                      )}
                    </div>
                  </div>);
                })}
              </div>
            </div>
          </div>
        );
      })()}

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

      {selectedCadastroId && (function() {
        var a = (affiliatesFull || []).find(function(x) { return x.id === selectedCadastroId; });
        if (!a) return null;
        var isOnline = onlineIds.has(a.id);
        var isNew = newAffiliateIds.has(a.id);
        function fmtDate(iso) {
          if (!iso) return '—';
          var d = new Date(iso);
          return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        var whatsappDigits = (a.whatsapp || a.phone || '').replace(/\D/g, '');
        var whatsappUrl = whatsappDigits.length >= 10 ? 'https://wa.me/' + (whatsappDigits.length === 11 || whatsappDigits.length === 10 ? '55' + whatsappDigits : whatsappDigits) : null;
        function fmtPhone(d) {
          if (!d) return '';
          var s = String(d).replace(/\D/g, '');
          if (s.length === 11) return '(' + s.slice(0, 2) + ') ' + s.slice(2, 7) + '-' + s.slice(7);
          if (s.length === 10) return '(' + s.slice(0, 2) + ') ' + s.slice(2, 6) + '-' + s.slice(6);
          return String(d);
        }
        function fmtMoney(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ','); }
        function approvalLabel(s) {
          if (s === 'approved') return { text: 'Aprovada', bg: '#D1FAE5', fg: '#065F46' };
          if (s === 'rejected') return { text: 'Recusada', bg: '#FEE2E2', fg: '#991B1B' };
          return { text: 'Aguardando liberação', bg: '#FEF3C7', fg: '#92400E' };
        }
        function Row(props) {
          return (
            <div style={{ background: '#FFF', padding: '10px 14px', display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12, alignItems: 'center', borderBottom: props.last ? 'none' : '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.3 }}>{props.label}</div>
              <div style={{ fontSize: 13, color: '#1A1A1A', wordBreak: 'break-word' }}>{props.value}</div>
            </div>
          );
        }
        function Section(props) {
          return (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#888', fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>{props.title}</div>
              <div style={{ background: '#FFF', border: '1px solid #E5E5E5', borderRadius: 10, overflow: 'hidden' }}>
                {props.children}
              </div>
            </div>
          );
        }
        var contactRows = [];
        if (a.email) contactRows.push({ label: 'Email', value: a.email });
        if (whatsappDigits) contactRows.push({ label: 'WhatsApp', value: fmtPhone(whatsappDigits) });
        if (a.phone && a.phone !== a.whatsapp) contactRows.push({ label: 'Telefone', value: fmtPhone(a.phone) });
        if (a.city) contactRows.push({ label: 'Cidade', value: a.city });
        if (a.state) contactRows.push({ label: 'Estado', value: a.state });
        if (a.age) contactRows.push({ label: 'Idade', value: a.age });
        if (a.birthday) contactRows.push({ label: 'Aniversário', value: a.birthday });

        var socialRows = [];
        if (a.instagram) socialRows.push({ label: 'Instagram', value: a.instagram });
        if (a.facebook) socialRows.push({ label: 'Facebook', value: a.facebook });
        if (a.tiktok) socialRows.push({ label: 'TikTok', value: a.tiktok });
        if (a.social_outro) socialRows.push({ label: 'Outros', value: a.social_outro });
        if (Array.isArray(a.platforms) && a.platforms.length > 0) socialRows.push({ label: 'Plataformas', value: a.platforms.join(', ') });

        var financeRows = [];
        financeRows.push({ label: 'Comissão', value: fmtMoney(a.commission_value) });
        if (a.commission_type) financeRows.push({ label: 'Tipo', value: a.commission_type === 'fixed_per_sale' ? 'Fixa por venda' : String(a.commission_type) });
        if (a.pix_key) financeRows.push({ label: 'Chave PIX', value: a.pix_key + (a.pix_type ? ' (' + a.pix_type + ')' : '') });
        if (a.weekly_goal) financeRows.push({ label: 'Meta semanal', value: a.weekly_goal });
        if (a.weekly_posts_goal) financeRows.push({ label: 'Meta posts/semana', value: a.weekly_posts_goal });

        var ap = approvalLabel(a.approval_status);
        var statusRows = [];
        statusRows.push({ label: 'Status', value: (<span style={{ display: 'inline-block', padding: '3px 10px', background: ap.bg, color: ap.fg, borderRadius: 12, fontSize: 11, fontWeight: 800 }}>{ap.text}</span>) });
        statusRows.push({ label: 'Ativa', value: a.active === false ? 'Não' : 'Sim' });
        if (a.tier) statusRows.push({ label: 'Classificação', value: a.tier });
        if (a.is_sponsored) statusRows.push({ label: 'Patrocinada', value: 'Sim' });
        if (a.blocked) statusRows.push({ label: 'Bloqueada', value: 'Sim' });
        if (a.is_admin) statusRows.push({ label: 'Admin', value: 'Sim' });
        if (typeof a.warnings_count === 'number' && a.warnings_count > 0) statusRows.push({ label: 'Advertências', value: a.warnings_count });

        var dateRows = [];
        if (a.created_at) dateRows.push({ label: 'Cadastro', value: fmtDate(a.created_at) });
        if (a.accepted_terms_at) dateRows.push({ label: 'Aceitou termos', value: fmtDate(a.accepted_terms_at) });
        if (a.approved_at) dateRows.push({ label: 'Aprovada em', value: fmtDate(a.approved_at) });
        if (a.rejected_at) dateRows.push({ label: 'Recusada em', value: fmtDate(a.rejected_at) });
        if (a.updated_at) dateRows.push({ label: 'Atualizado', value: fmtDate(a.updated_at) });

        if (a.notes) financeRows.push({ label: 'Observações', value: a.notes });
        return (
          <div onClick={function() { setSelectedCadastroId(null); }} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#FFF', borderRadius: 14, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ padding: 22, background: 'linear-gradient(135deg, #1A1A1A, #333)', color: '#FFF', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 32, background: a.avatar_url ? 'transparent' : 'linear-gradient(135deg, #FFD700, #B8860B)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#1A1A1A', flexShrink: 0 }}>
                  {a.avatar_url ? <img src={storageProxyUrl(a.avatar_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : a.avatar_initials}
                  {isOnline && <span style={{ position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, background: '#10B981', border: '3px solid #1A1A1A', animation: 'onlineDotPulse 1.6s ease-in-out infinite' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{a.name}</span>
                    {isNew && <NewBadge />}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#FFD700', marginTop: 2, letterSpacing: 1 }}>{a.coupon_code}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Cadastrada em {fmtDate(a.created_at)}</div>
                </div>
                <button onClick={function() { setSelectedCadastroId(null); }} style={{ background: 'transparent', border: 'none', color: '#FFF', fontSize: 22, cursor: 'pointer', padding: 4 }}>✕</button>
              </div>

              <div style={{ padding: 20 }}>
                {a.approval_status === 'pending' && !a.deleted_at && (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 18 }}>⏳</span>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#92400E' }}>AGUARDANDO LIBERAÇÃO</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#78350F', marginBottom: 10, lineHeight: 1.4 }}>Confira os dados. Ao liberar, será enviado email de aprovação e a afiliada poderá usar o painel. Ao recusar, a conta é bloqueada e ela recebe email com o contato.</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={async function() {
                          if (!confirm('Liberar cadastro de ' + a.name + '? Ela receberá email de aprovação.')) return;
                          try {
                            var r = await fetch('/api/admin/affiliates/approve', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ affiliate_id: a.id, action: 'approve' }),
                            });
                            var d = await r.json().catch(function() { return {}; });
                            if (!r.ok || !d.ok) { alert('Erro: ' + (d.error || 'falha')); return; }
                            alert('Cadastro liberado' + (d.email_sent ? ' e email enviado.' : ' (email falhou — verificar).'));
                            setSelectedCadastroId(null);
                            await loadAll();
                          } catch(e) { alert('Erro: ' + e.message); }
                        }}
                        style={{ flex: 1, padding: 12, background: '#10B981', color: '#FFF', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 0.5 }}
                      >✓ LIBERAR</button>
                      <button
                        onClick={async function() {
                          var reason = window.prompt('Motivo da recusa (opcional — aparecerá no email da afiliada):', '');
                          if (reason === null) return;
                          try {
                            var r = await fetch('/api/admin/affiliates/approve', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ affiliate_id: a.id, action: 'reject', reason: reason || null }),
                            });
                            var d = await r.json().catch(function() { return {}; });
                            if (!r.ok || !d.ok) { alert('Erro: ' + (d.error || 'falha')); return; }
                            alert('Cadastro recusado' + (d.email_sent ? ' e email enviado.' : '.'));
                            setSelectedCadastroId(null);
                            await loadAll();
                          } catch(e) { alert('Erro: ' + e.message); }
                        }}
                        style={{ padding: '12px 16px', background: '#FFF', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 0.5 }}
                      >✕ Recusar</button>
                    </div>
                  </div>
                )}

                {a.approval_status === 'rejected' && !a.deleted_at && (
                  <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>🚫</span>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#991B1B' }}>CADASTRO RECUSADO</div>
                    </div>
                    {a.rejection_reason && (<div style={{ fontSize: 11, color: '#7F1D1D' }}>Motivo: {a.rejection_reason}</div>)}
                    <button
                      onClick={async function() {
                        if (!confirm('Reverter recusa e aprovar ' + a.name + '?')) return;
                        try {
                          var r = await fetch('/api/admin/affiliates/approve', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ affiliate_id: a.id, action: 'approve' }),
                          });
                          var d = await r.json().catch(function() { return {}; });
                          if (!r.ok || !d.ok) { alert('Erro: ' + (d.error || 'falha')); return; }
                          alert('Aprovada.');
                          setSelectedCadastroId(null);
                          await loadAll();
                        } catch(e) { alert('Erro: ' + e.message); }
                      }}
                      style={{ marginTop: 10, width: '100%', padding: 10, background: '#10B981', color: '#FFF', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                    >Reverter e Aprovar</button>
                  </div>
                )}

                {a.deleted_at && (
                  <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>🗑️</span>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#991B1B' }}>CONTA DELETADA</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#7F1D1D' }}>Em {fmtDate(a.deleted_at)}</div>
                    {a.deletion_reason && (<div style={{ fontSize: 11, color: '#7F1D1D', marginTop: 3 }}>Motivo: {a.deletion_reason}</div>)}
                    <div style={{ fontSize: 11, color: '#7F1D1D', marginTop: 6, fontStyle: 'italic' }}>Dados preservados. Login bloqueado. Pode ser restaurada a qualquer momento.</div>
                  </div>
                )}
                {isOnline && !a.deleted_at && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 8px', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 20, fontSize: 12, fontWeight: 800, color: '#065F46', marginBottom: 14 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: '#10B981', animation: 'onlineDotPulse 1.6s ease-in-out infinite' }} />
                    Online agora
                  </div>
                )}

                {whatsappUrl && (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, background: '#25D366', borderRadius: 10, color: '#FFF', fontWeight: 800, fontSize: 14, textDecoration: 'none', marginBottom: 14 }}>
                    💬 Abrir conversa no WhatsApp
                  </a>
                )}

                <div style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)', border: '2px solid #FFD700', borderRadius: 12, padding: 18, marginBottom: 14, position: 'relative', overflow: 'hidden', boxShadow: '0 4px 20px rgba(255,215,0,0.2)' }}>
                  <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,215,0,0.03) 10px, rgba(255,215,0,0.03) 20px)', pointerEvents: 'none' }} />
                  <div style={{ position: 'relative' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,215,0,0.7)', fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Cupom exclusivo</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#FFD700', letterSpacing: 4, fontFamily: 'monospace', textShadow: '0 0 20px rgba(255,215,0,0.3)' }}>{a.coupon_code}</div>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Comissão por venda: <strong style={{ color: '#FFD700' }}>{fmtMoney(a.commission_value)}</strong></div>
                  </div>
                </div>

                <Section title="Contato">
                  {contactRows.map(function(r, i) { return <Row key={r.label} label={r.label} value={r.value} last={i === contactRows.length - 1} />; })}
                  {contactRows.length === 0 && (<div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 12 }}>—</div>)}
                </Section>

                {socialRows.length > 0 && (
                  <Section title="Redes Sociais">
                    {socialRows.map(function(r, i) { return <Row key={r.label} label={r.label} value={r.value} last={i === socialRows.length - 1} />; })}
                  </Section>
                )}

                <Section title="Status">
                  {statusRows.map(function(r, i) { return <Row key={r.label} label={r.label} value={r.value} last={i === statusRows.length - 1} />; })}
                </Section>

                <Section title="Financeiro">
                  {financeRows.map(function(r, i) { return <Row key={r.label} label={r.label} value={r.value} last={i === financeRows.length - 1} />; })}
                </Section>

                <Section title="Datas">
                  {dateRows.map(function(r, i) { return <Row key={r.label} label={r.label} value={r.value} last={i === dateRows.length - 1} />; })}
                </Section>

                {a.deleted_at && (
                  <div style={{ marginTop: 18 }}>
                    <button
                      onClick={async function() {
                        if (cadastroHistoryLoading) return;
                        setCadastroHistoryLoading(true);
                        setCadastroHistory(null);
                        try {
                          var r = await fetch('/api/admin/affiliates/history?affiliate_id=' + encodeURIComponent(a.id));
                          var d = await r.json().catch(function() { return {}; });
                          if (!r.ok || !d.ok) { alert('Erro: ' + (d.error || 'falha')); }
                          else { setCadastroHistory(d); }
                        } catch(e) { alert('Erro: ' + e.message); }
                        setCadastroHistoryLoading(false);
                      }}
                      style={{ width: '100%', padding: 11, background: '#1A1A1A', color: '#FFD700', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: 'pointer', letterSpacing: 0.8, textTransform: 'uppercase' }}
                    >{cadastroHistoryLoading ? 'Carregando...' : (cadastroHistory && cadastroHistory.affiliate && cadastroHistory.affiliate.id === a.id ? '🔄 Recarregar Histórico (60 dias)' : '📜 Ver Histórico Completo (60 dias)')}</button>

                    {cadastroHistory && cadastroHistory.affiliate && cadastroHistory.affiliate.id === a.id && (function() {
                      var h = cadastroHistory;
                      var bal = h.balance || {};
                      var t = h.totals_60d || {};
                      return (
                        <div style={{ marginTop: 14, padding: 14, background: '#FAFAFA', border: '1px solid #E5E5E5', borderRadius: 10 }}>
                          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5, marginBottom: 10 }}>Saldos preservados</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                            <div style={{ padding: 10, background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 8 }}>
                              <div style={{ fontSize: 9, color: '#065F46', fontWeight: 700, textTransform: 'uppercase' }}>Disponível</div>
                              <div style={{ fontSize: 16, fontWeight: 900, color: '#065F46' }}>R$ {Number(bal.available_balance || 0).toFixed(2).replace('.', ',')}</div>
                            </div>
                            <div style={{ padding: 10, background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 8 }}>
                              <div style={{ fontSize: 9, color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>A liberar</div>
                              <div style={{ fontSize: 16, fontWeight: 900, color: '#555' }}>R$ {Number(bal.blocked_balance || 0).toFixed(2).replace('.', ',')}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5, marginBottom: 8 }}>Últimos 60 dias</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12, fontSize: 11 }}>
                            <div style={{ padding: 8, background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 6, textAlign: 'center' }}>
                              <div style={{ color: '#888', fontSize: 9 }}>VENDAS</div>
                              <div style={{ fontWeight: 800, fontSize: 14 }}>{t.sales_count || 0}</div>
                            </div>
                            <div style={{ padding: 8, background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 6, textAlign: 'center' }}>
                              <div style={{ color: '#888', fontSize: 9 }}>COMISSAO</div>
                              <div style={{ fontWeight: 800, fontSize: 14 }}>R${Number(t.sales_commission || 0).toFixed(2).replace('.', ',')}</div>
                            </div>
                            <div style={{ padding: 8, background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 6, textAlign: 'center' }}>
                              <div style={{ color: '#888', fontSize: 9 }}>POSTS</div>
                              <div style={{ fontWeight: 800, fontSize: 14 }}>{t.posts_count || 0}</div>
                            </div>
                          </div>
                          {(h.sales && h.sales.length > 0) && (
                            <>
                              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Vendas ({h.sales.length})</div>
                              <div style={{ maxHeight: 140, overflowY: 'auto', background: '#FFF', border: '1px solid #E5E5E5', borderRadius: 6, marginBottom: 10 }}>
                                {h.sales.slice(0, 30).map(function(s) {
                                  return (<div key={s.id} style={{ padding: '6px 10px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span>{fmtDate(s.created_at)}</span>
                                    <span style={{ fontWeight: 700, color: '#10B981' }}>+R${Number(s.commission_earned).toFixed(2).replace('.', ',')}</span>
                                  </div>);
                                })}
                              </div>
                            </>
                          )}
                          {(h.withdrawals && h.withdrawals.length > 0) && (
                            <>
                              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Saques ({h.withdrawals.length})</div>
                              <div style={{ maxHeight: 120, overflowY: 'auto', background: '#FFF', border: '1px solid #E5E5E5', borderRadius: 6, marginBottom: 10 }}>
                                {h.withdrawals.map(function(w) {
                                  return (<div key={w.id} style={{ padding: '6px 10px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span>{fmtDate(w.created_at)} <span style={{ color: '#888' }}>({w.status})</span></span>
                                    <span style={{ fontWeight: 700 }}>R${Number(w.amount).toFixed(2).replace('.', ',')}</span>
                                  </div>);
                                })}
                              </div>
                            </>
                          )}
                          {(h.posts && h.posts.length > 0) && (
                            <>
                              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Posts ({h.posts.length})</div>
                              <div style={{ maxHeight: 100, overflowY: 'auto', background: '#FFF', border: '1px solid #E5E5E5', borderRadius: 6 }}>
                                {h.posts.slice(0, 20).map(function(p) {
                                  return (<div key={p.id} style={{ padding: '6px 10px', borderBottom: '1px solid #F3F4F6', fontSize: 11 }}>{fmtDate(p.created_at)} · {p.platform || '—'}</div>);
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    <button
                      onClick={async function() {
                        if (!confirm('Restaurar ' + a.name + '? Ela volta a poder logar e os saldos voltam ao painel dela.')) return;
                        try {
                          var r = await fetch('/api/admin/affiliates/restore', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ affiliate_id: a.id }),
                          });
                          var d = await r.json().catch(function() { return {}; });
                          if (!r.ok || !d.ok) { alert('Erro: ' + (d.error || 'falha')); return; }
                          alert('Afiliada restaurada.');
                          setSelectedCadastroId(null);
                          setCadastroHistory(null);
                          await loadAll();
                        } catch(e) { alert('Erro: ' + e.message); }
                      }}
                      style={{ marginTop: 12, width: '100%', padding: 12, background: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 0.5 }}
                    >♻️ RESTAURAR CONTA</button>
                  </div>
                )}

                {!a.is_admin && !a.deleted_at && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed #E5E5E5' }}>
                    <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>Zona de Perigo</div>
                    <button
                      onClick={async function() {
                        var confirmText = 'DELETAR ' + (a.coupon_code || '');
                        var resp = window.prompt('Vai marcar ' + a.name + ' como DELETADA. Os dados (saldo, vendas, saques) sao preservados e a conta pode ser restaurada depois. O login dela fica bloqueado. Para confirmar, digite:\n\n' + confirmText);
                        if (resp !== confirmText) { if (resp !== null) alert('Texto nao confere. Operacao cancelada.'); return; }
                        try {
                          var r = await fetch('/api/admin/affiliates/delete', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ affiliate_id: a.id }),
                          });
                          var d = await r.json().catch(function() { return {}; });
                          if (!r.ok || !d.ok) { alert('Erro: ' + (d.error || 'falha ao deletar') + (d.detail ? ' - ' + d.detail : '')); return; }
                          alert('Conta marcada como deletada. Dados preservados.');
                          setSelectedCadastroId(null);
                          await loadAll();
                        } catch (err) {
                          alert('Erro de conexao: ' + (err && err.message ? err.message : 'erro'));
                        }
                      }}
                      style={{ width: '100%', padding: 12, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 0.5 }}
                    >🗑️ DELETAR AFILIADA</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {linkPreview && (function() {
        var info = analyzeLink(linkPreview.url, linkPreview.platform);
        var content = detectContentType(info);
        var trustedMatch = info.valid && info.isTrusted && (info.expected.length === 0 || info.matchesPlatform);
        var platformMismatch = info.valid && info.expected.length > 0 && !info.matchesPlatform;
        var untrusted = info.valid && !info.isTrusted;
        var invalid = !info.valid;
        var showVirusAlert = untrusted;
        return (
          <div onClick={function() { setLinkPreview(null); }} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: showVirusAlert ? 'rgba(60,0,0,0.75)' : 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={function(e) { e.stopPropagation(); }} style={{ background: '#FFF', borderRadius: 14, padding: 24, maxWidth: 480, width: '100%', boxShadow: showVirusAlert ? '0 0 60px rgba(239,68,68,0.55)' : '0 20px 60px rgba(0,0,0,0.3)', border: showVirusAlert ? '2px solid #EF4444' : 'none' }}>

              {showVirusAlert && (
                <div style={{ margin: '-24px -24px 16px -24px', padding: '18px 20px', background: 'linear-gradient(135deg, #7F1D1D, #DC2626)', borderRadius: '12px 12px 0 0', color: '#FFF', display: 'flex', alignItems: 'center', gap: 14, animation: 'sirenPulse 0.8s ease-in-out infinite' }}>
                  <span style={{ fontSize: 38, display: 'inline-block', animation: 'sirenSpin 0.5s ease-in-out infinite', transformOrigin: 'center' }}>🚨</span>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1, lineHeight: 1.1, animation: 'redFlash 0.8s ease-in-out infinite' }}>ALERTA DE VÍRUS</div>
                    <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>Link não reconhecido — pode ser phishing ou malware</div>
                  </div>
                  <span style={{ fontSize: 38, display: 'inline-block', animation: 'sirenSpin 0.5s ease-in-out infinite reverse', transformOrigin: 'center' }}>🚨</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#1A1A1A' }}>Conferir link antes de abrir</div>
                <button onClick={function() { setLinkPreview(null); }} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999', padding: 4 }}>✕</button>
              </div>

              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Enviado por <strong>{linkPreview.affiliate}</strong> · Rede declarada: <strong style={{ textTransform: 'capitalize' }}>{linkPreview.platform}</strong></div>

              {content && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '4px 10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#1D4ED8' }}>
                  <span>{content.icon}</span>
                  <span>Tipo: {content.label}</span>
                </div>
              )}

              <div style={{ marginTop: 12, padding: 12, background: '#F8F9FA', border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', color: '#0070F3' }}>
                {linkPreview.url}
              </div>

              {info.valid && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>Domínio: <strong style={{ color: '#1A1A1A' }}>{info.host}</strong></div>
              )}

              {invalid && (
                <div style={{ marginTop: 14, padding: 12, background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 8, color: '#374151', fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Não é possível abrir</div>
                  O afiliado digitou um texto que não é um link válido (não começa com <code>http</code> ou <code>https</code>). Para abrir, peça que reenvie copiando o link completo.
                </div>
              )}
              {!invalid && untrusted && (
                <div style={{ marginTop: 14, padding: 12, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, color: '#991B1B', fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Domínio desconhecido</div>
                  Não é de uma rede social reconhecida (Instagram, Facebook, TikTok, YouTube, X/Twitter, Threads, Pinterest, LinkedIn, Kwai, WhatsApp, Snapchat). Confirme com a afiliada antes de abrir.
                </div>
              )}
              {!invalid && !untrusted && platformMismatch && (
                <div style={{ marginTop: 14, padding: 12, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, color: '#92400E', fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Rede declarada não confere</div>
                  A afiliada selecionou <strong style={{ textTransform: 'capitalize' }}>{linkPreview.platform}</strong> mas o link aponta para <strong>{info.host}</strong>. Verifique antes de abrir.
                </div>
              )}
              {trustedMatch && (
                <div style={{ marginTop: 14, padding: 12, background: '#ECFDF5', border: '1px solid #86EFAC', borderRadius: 8, color: '#065F46', fontSize: 13, fontWeight: 600 }}>
                  ✓ Link de rede oficial ({info.host})
                </div>
              )}

              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginTop: 18, marginBottom: 12 }}>Deseja abrir este link?</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={function() { setLinkPreview(null); }} style={{ flex: 1, padding: '12px 16px', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 8, color: '#374151', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  Não
                </button>
                <button onClick={function() { window.open(linkPreview.url, '_blank', 'noopener,noreferrer'); setLinkPreview(null); }} disabled={invalid} style={{ flex: 1, padding: '12px 16px', background: invalid ? '#E5E7EB' : (untrusted ? '#DC2626' : (platformMismatch ? '#F59E0B' : '#10B981')), border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: invalid ? 'not-allowed' : 'pointer', opacity: invalid ? 0.6 : 1 }}>
                  {untrusted ? 'Sim, abrir mesmo assim' : (platformMismatch ? 'Sim, abrir' : 'Sim, abrir')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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

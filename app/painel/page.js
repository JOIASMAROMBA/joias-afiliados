'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, supabaseRealtime, storageProxyUrl } from '../../lib/supabase';

export default function PainelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [affiliate, setAffiliate] = useState(null);
  const [balance, setBalance] = useState({ available_balance: 0, blocked_balance: 0, pending_withdrawals: 0 });
  const [showReleaseDatesModal, setShowReleaseDatesModal] = useState(false);
  const [fixedMonthly, setFixedMonthly] = useState(null);
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
  const [withdrawCodeStep, setWithdrawCodeStep] = useState(false);
  const [withdrawCode, setWithdrawCode] = useState('');
  const [withdrawSending, setWithdrawSending] = useState(false);
  const [postPlatform, setPostPlatform] = useState('');
  const [postLink, setPostLink] = useState('');
  const [postMessage, setPostMessage] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [motivationalPhrase, setMotivationalPhrase] = useState('');
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [materialFolders, setMaterialFolders] = useState([]);
  const [selectedMaterialFolder, setSelectedMaterialFolder] = useState(null);
  const [materialFiles, setMaterialFiles] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pendingNotifications, setPendingNotifications] = useState([]);
  const [showApprovedModal, setShowApprovedModal] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [showConductView, setShowConductView] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [pushStatus, setPushStatus] = useState('idle'); // idle | unsupported | denied | disabled | enabled | busy
  const [pushBannerDismissed, setPushBannerDismissed] = useState(false);

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
    try { if (localStorage.getItem('push_banner_dismissed') === '1') setPushBannerDismissed(true); } catch(e) {}
  }, []);

  useEffect(function() {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushStatus('unsupported');
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(function() {});
    if (Notification.permission === 'denied') { setPushStatus('denied'); return; }
    navigator.serviceWorker.ready.then(function(reg) {
      return reg.pushManager.getSubscription();
    }).then(function(sub) {
      if (sub) setPushStatus('enabled');
      else setPushStatus(Notification.permission === 'granted' ? 'disabled' : 'idle');
    }).catch(function() {});
  }, []);

  function urlB64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  async function enablePush() {
    if (pushStatus === 'busy') return;
    setPushStatus('busy');
    try {
      var publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) { alert('Servidor nao configurado para notificacoes.'); setPushStatus('idle'); return; }
      var perm = await Notification.requestPermission();
      if (perm !== 'granted') { setPushStatus(perm === 'denied' ? 'denied' : 'idle'); return; }
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(publicKey),
        });
      }
      var res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON ? sub.toJSON() : sub, userAgent: navigator.userAgent }),
      });
      if (!res.ok) { setPushStatus('idle'); alert('Falha ao registrar. Tente novamente.'); return; }
      setPushStatus('enabled');
    } catch (e) {
      setPushStatus('idle');
      alert('Nao foi possivel ativar: ' + (e && e.message ? e.message : 'erro'));
    }
  }

  async function disablePush() {
    if (pushStatus === 'busy') return;
    setPushStatus('busy');
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (sub) {
        try { await fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }); } catch(e) {}
        try { await sub.unsubscribe(); } catch(e) {}
      }
      setPushStatus('disabled');
    } catch(e) {
      setPushStatus('idle');
    }
  }

  function dismissPushBanner() {
    setPushBannerDismissed(true);
    try { localStorage.setItem('push_banner_dismissed', '1'); } catch(e) {}
  }

  useEffect(function() {
    var interval = setInterval(function() {
      setMotivationalPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
    }, 8000);
    return function() { clearInterval(interval); };
  }, []);

  useEffect(function() {
    if (!affiliate) return;
    var channel = supabaseRealtime
      .channel('painel-live-' + affiliate.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards' }, function() { loadData(affiliate.id); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: 'affiliate_id=eq.' + affiliate.id }, function() { loadData(affiliate.id); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals', filter: 'affiliate_id=eq.' + affiliate.id }, function() { loadData(affiliate.id); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posting_obligations', filter: 'affiliate_id=eq.' + affiliate.id }, function() { loadData(affiliate.id); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'affiliates', filter: 'id=eq.' + affiliate.id }, function() { loadData(affiliate.id); })
      .subscribe();
    var presenceCh = supabaseRealtime.channel('afiliadas-online', { config: { presence: { key: affiliate.id } } });
    presenceCh.subscribe(function(status) {
      if (status === 'SUBSCRIBED') {
        presenceCh.track({ id: affiliate.id, name: affiliate.name, coupon: affiliate.coupon_code, at: Date.now() });
      }
    });
    return function() {
      supabaseRealtime.removeChannel(channel);
      supabaseRealtime.removeChannel(presenceCh);
    };
  }, [affiliate && affiliate.id]);

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
    try {
      var fxRes = await supabase.from('monthly_fixed_payments').select('*').eq('affiliate_id', affiliateId).eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
      setFixedMonthly(fxRes.data || null);
    } catch(e) { setFixedMonthly(null); }
    if (!check.data.accepted_terms_at) setShowTerms(true);
    if (check.data.approval_status === 'approved' && !check.data.approval_seen_at) setShowApprovedModal(true);
    try {
      var nRes = await fetch('/api/notifications/list');
      var nData = await nRes.json();
      if (nData && nData.ok && Array.isArray(nData.notifications)) setPendingNotifications(nData.notifications);
    } catch(e) {}
    setLoading(false);
  }

  async function dismissApprovedModal() {
    setShowApprovedModal(false);
    try { await fetch('/api/profile/mark-approval-seen', { method: 'POST' }); } catch(e) {}
  }

  async function acceptTerms() {
    setAcceptingTerms(true);
    try {
      var res = await fetch('/api/auth/accept-terms', { method: 'POST' });
      var data = await res.json().catch(function() { return {}; });
      if (data && data.ok) setShowTerms(false);
    } catch(e) {}
    setAcceptingTerms(false);
  }

  async function dismissNotification(id) {
    setPendingNotifications(function(prev) { return prev.filter(function(n) { return n.id !== id; }); });
    try { await fetch('/api/notifications/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) }); } catch(e) {}
  }

  function formatCurrency(digits) {
    if (!digits) return '';
    const cents = parseInt(digits, 10);
    const reais = (cents / 100).toFixed(2);
    return 'R$ ' + reais.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function handleAmountChange(e) {
    const digits = e.target.value.replace(/\D/g, '');
    setWithdrawAmount(digits);
  }

  async function handleRequestWithdraw() {
    const amountNum = withdrawAmount ? parseInt(withdrawAmount, 10) / 100 : 0;
    if (!amountNum || amountNum < 10) { setWithdrawMessage('Valor minimo R$10'); return; }
    if (amountNum > Number(balance.available_balance)) { setWithdrawMessage('Saldo insuficiente'); return; }
    if (!pixType) { setWithdrawMessage('Selecione o tipo de chave PIX'); return; }
    if (!pixKey.trim()) { setWithdrawMessage('Informe sua chave PIX'); return; }
    if (!withdrawEmail.trim() || !withdrawEmail.includes('@')) { setWithdrawMessage('Email invalido'); return; }
    setWithdrawMessage('');
    setWithdrawSending(true);
    try {
      const res = await fetch('/api/withdrawals/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          pix_key: pixKey.trim(),
          pix_type: pixType,
          email: withdrawEmail.trim(),
        }),
      });
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok || !data.ok) {
        const map = {
          invalid_amount: 'Valor invalido (minimo R$10).',
          invalid_pix_type: 'Tipo de chave PIX invalido.',
          invalid_pix_key: 'Chave PIX invalida para o tipo escolhido.',
          invalid_email: 'Email invalido.',
          insufficient_balance: 'Saldo insuficiente. Disponivel: R$' + (data.available || 0),
          has_pending: 'Voce ja tem um saque pendente. Aguarde o admin processar.',
          too_many_codes: 'Muitos codigos solicitados. Aguarde alguns minutos.',
          email_not_configured: 'Servico de email indisponivel. Contate o suporte.',
          send_failed: 'Nao foi possivel enviar o email. Verifique o endereco.',
          unauthorized: 'Sessao expirada. Faca login novamente.',
        };
        setWithdrawMessage(map[data.error] || 'Erro ao solicitar codigo.');
        setWithdrawSending(false);
        return;
      }
      setWithdrawCodeStep(true);
      setWithdrawCode('');
      setWithdrawSending(false);
    } catch (err) {
      setWithdrawMessage('Erro de conexao. Tente novamente.');
      setWithdrawSending(false);
    }
  }

  async function handleConfirmWithdrawCode() {
    const amountNum = withdrawAmount ? parseInt(withdrawAmount, 10) / 100 : 0;
    if (!/^\d{6}$/.test(withdrawCode.trim())) { setWithdrawMessage('Digite o codigo de 6 digitos.'); return; }
    setWithdrawMessage('');
    setWithdrawSending(true);
    try {
      const res = await fetch('/api/withdrawals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          pix_key: pixKey.trim(),
          pix_type: pixType,
          email: withdrawEmail.trim(),
          code: withdrawCode.trim(),
        }),
      });
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok || !data.ok) {
        const map = {
          invalid_code: 'Codigo invalido.',
          no_active_code: 'Codigo nao encontrado. Volte e solicite outro.',
          code_expired: 'Codigo expirou. Volte e solicite outro.',
          wrong_code: 'Codigo incorreto.',
          code_mismatch: 'Dados nao conferem. Volte e solicite outro codigo.',
          too_many_attempts: 'Muitas tentativas erradas. Solicite outro codigo.',
          insufficient_balance: 'Saldo insuficiente.',
          has_pending: 'Voce ja tem saque pendente.',
          daily_limit_reached: 'Limite diario atingido.',
        };
        setWithdrawMessage(map[data.error] || 'Erro ao confirmar saque.');
        setWithdrawSending(false);
        return;
      }
      setWithdrawSuccess(true);
      setWithdrawCodeStep(false);
      setWithdrawSending(false);
    } catch (err) {
      setWithdrawMessage('Erro de conexao. Tente novamente.');
      setWithdrawSending(false);
    }
  }

  function closeWithdrawModal() {
    setShowWithdrawModal(false);
    setWithdrawAmount(''); setPixKey(''); setPixType(''); setWithdrawMessage(''); setWithdrawSuccess(false);
    setWithdrawCodeStep(false); setWithdrawCode(''); setWithdrawSending(false);
    var id = localStorage.getItem('affiliate_id');
    if (id) loadData(id);
  }

  async function handleConfirmPost() {
    if (!postPlatform) { setPostMessage('Selecione a rede social'); return; }
    if (!postLink.trim()) { setPostMessage('Cole o link ou ID do post'); return; }
    try {
      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: postPlatform, post_link: postLink.trim() }),
      });
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok || !data.ok) {
        setPostMessage('Erro: ' + (data.error || 'falha ao registrar'));
        return;
      }
      setShowPostModal(false);
      setPostPlatform(''); setPostLink(''); setPostMessage('');
      loadData(affiliate.id);
    } catch (err) {
      setPostMessage('Erro de conexao.');
    }
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
    if (file.size > 5 * 1024 * 1024) { setEditMessage('Imagem muito grande (max 5MB)'); return; }
    setUploadingAvatar(true);
    setEditMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: form });
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok || !data.ok) {
        const map = {
          invalid_image: 'Arquivo invalido. Use JPG, PNG, GIF ou WebP.',
          file_too_large: 'Imagem muito grande (max 5MB).',
          no_file: 'Selecione um arquivo.',
          unauthorized: 'Sessao expirada. Faca login de novo.',
        };
        setEditMessage(map[data.error] || ('Erro: ' + (data.error || 'desconhecido')));
        setUploadingAvatar(false);
        return;
      }
      setEditAvatarUrl(data.url);
    } catch (err) {
      setEditMessage('Erro: ' + err.message);
    }
    setUploadingAvatar(false);
  }

  async function saveProfile() {
    if (!editName.trim()) { setEditMessage('Nome nao pode estar vazio'); return; }
    if (!editEmail.trim()) { setEditMessage('Email nao pode estar vazio'); return; }
    setSavingProfile(true);
    try {
      const payload = {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        phone: editPhone.trim(),
        avatar_url: editAvatarUrl || '',
      };
      if (editPassword.trim()) payload.password = editPassword.trim();
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const map = {
          unauthorized: 'Sessao expirada. Faca login novamente.',
          invalid_email: 'Email invalido.',
          name_too_short: 'Nome muito curto.',
          password_must_be_6_digits: 'Senha deve ter exatamente 6 digitos numericos.',
          email_taken: 'Esse email ja esta em uso por outra conta.',
          duplicate: 'Esse dado ja esta em uso.',
          db_error: 'Erro no banco: ' + (data.detail || ''),
        };
        setEditMessage(map[data.error] || ('Erro: ' + (data.error || 'desconhecido')));
        setSavingProfile(false);
        return;
      }
      setShowEditProfile(false);
      setSavingProfile(false);
      loadData(affiliate.id);
    } catch (err) {
      setEditMessage('Erro de conexao: ' + err.message);
      setSavingProfile(false);
    }
  }

  async function openMaterialsModal() {
    setShowMaterialsModal(true);
    setSelectedMaterialFolder(null);
    setLoadingMaterials(true);
    try {
      const res = await fetch('/api/materials/folders');
      const data = await res.json();
      if (data.ok) setMaterialFolders(data.folders || []);
    } catch {}
    setLoadingMaterials(false);
  }

  async function openMaterialFolder(folder) {
    setSelectedMaterialFolder(folder);
    setLoadingMaterials(true);
    try {
      const res = await fetch('/api/materials/files?folder_id=' + encodeURIComponent(folder.id));
      const data = await res.json();
      if (data.ok) setMaterialFiles(data.files || []);
    } catch {}
    setLoadingMaterials(false);
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

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 78, animation: 'diamondSpin 2.2s linear infinite', display: 'inline-block', lineHeight: 1 }}>💎</div>
    </div>
  );

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

  var isPending = affiliate && affiliate.approval_status === 'pending';
  var isRejected = affiliate && affiliate.approval_status === 'rejected';
  var isBlocked = isPending || isRejected;

  return (<>
    {isPending && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 20000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 440, width: '100%', background: 'linear-gradient(180deg, #1a1306, #0a0604)', border: '2px solid #C9A961', borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: '0 20px 80px rgba(201,169,97,0.35), 0 0 60px rgba(201,169,97,0.15)', animation: 'approvedPop 0.5s ease-out' }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>⏳</div>
          <div style={{ fontSize: 11, color: '#C9A961', letterSpacing: 3, fontWeight: 800, textTransform: 'uppercase', marginBottom: 10 }}>Programa de Afiliados</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#C9A961', marginBottom: 14, lineHeight: 1.25, letterSpacing: -0.3 }}>Seu cadastro está em análise</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginBottom: 18 }}>Validamos cada cadastro em até <strong style={{ color: '#C9A961' }}>48 horas</strong>. Você receberá um email assim que for aprovado.</div>
          <div style={{ padding: 14, background: 'rgba(201,169,97,0.08)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'rgba(201,169,97,0.7)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Cupom reservado</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#FFF', fontFamily: 'monospace', letterSpacing: 3 }}>{affiliate && affiliate.coupon_code}</div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 18 }}>Em caso de dúvida: <strong style={{ color: '#C9A961' }}>contato@joiasmaromba.com.br</strong></div>
          <button onClick={function() { localStorage.clear(); router.push('/login'); }} style={{ width: '100%', padding: 12, background: 'transparent', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 10, color: 'rgba(201,169,97,0.7)', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}>Sair</button>
        </div>
      </div>
    )}

    {isRejected && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 20000, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 440, width: '100%', background: 'linear-gradient(180deg, #1a0606, #0a0404)', border: '2px solid #EF4444', borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: '0 20px 80px rgba(239,68,68,0.3)', animation: 'approvedPop 0.5s ease-out' }}>
          <div style={{ fontSize: 56, marginBottom: 10, animation: 'sadShake 1s ease-in-out 0.4s 2' }}>😔</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#EF4444', marginBottom: 14, lineHeight: 1.25 }}>Seu cadastro foi recusado</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginBottom: 18 }}>Entre em contato pelo email abaixo para mais informações:</div>
          {affiliate && affiliate.rejection_reason && (
            <div style={{ padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 14, textAlign: 'left' }}>
              <div style={{ fontSize: 10, color: '#FCA5A5', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Motivo</div>
              <div style={{ fontSize: 12, color: '#fff' }}>{affiliate.rejection_reason}</div>
            </div>
          )}
          <a href="mailto:contato@joiasmaromba.com.br" style={{ display: 'block', padding: 14, background: 'linear-gradient(135deg, #E8CF8B, #C9A961)', borderRadius: 12, color: '#000', fontWeight: 900, fontSize: 13, textDecoration: 'none', letterSpacing: 1, marginBottom: 14 }}>📧 CONTATO@JOIASMAROMBA.COM</a>
          <button onClick={function() { localStorage.clear(); router.push('/login'); }} style={{ width: '100%', padding: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}>Sair</button>
        </div>
      </div>
    )}

    {showApprovedModal && !isBlocked && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 20001, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {(function() { var items = []; for (var i = 0; i < 36; i++) { var left = Math.random() * 100; var delay = Math.random() * 1.6; var dur = 2.8 + Math.random() * 2.2; var size = 8 + Math.random() * 8; var hue = ['#C9A961', '#E8CF8B', '#8B6914', '#B8860B', '#D4AF37'][i % 5]; var dx = (Math.random() - 0.5) * 60; items.push(<span key={i} style={{ position: 'absolute', top: -30, left: left + 'vw', width: size, height: size * 0.4, background: hue, borderRadius: 2, animation: 'confettiFall ' + dur + 's linear ' + delay + 's infinite', ['--dx']: dx + 'vw', boxShadow: '0 0 10px ' + hue }} />); } return items; })()}
        </div>
        <div style={{ maxWidth: 440, width: '100%', background: 'linear-gradient(180deg, #1a1306, #000)', border: '2px solid #C9A961', borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: '0 0 80px rgba(201,169,97,0.35), 0 0 40px rgba(201,169,97,0.2)', animation: 'approvedPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)', position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 11, color: '#C9A961', letterSpacing: 4, fontWeight: 900, textTransform: 'uppercase', marginBottom: 8 }}>Programa de Afiliadas</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#C9A961', marginBottom: 10, lineHeight: 1.2, textShadow: '0 0 20px rgba(201,169,97,0.4)' }}>Seu cadastro foi aprovado!</div>
          <div style={{ fontSize: 15, color: '#E8CF8B', marginBottom: 20, fontWeight: 600 }}>Boas vendas! 💎</div>
          <div style={{ padding: 14, background: 'rgba(201,169,97,0.08)', border: '1px solid rgba(201,169,97,0.4)', borderRadius: 12, marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: 'rgba(201,169,97,0.7)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Seu cupom</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#FFF', fontFamily: 'monospace', letterSpacing: 3 }}>{affiliate && affiliate.coupon_code}</div>
          </div>
          <button onClick={dismissApprovedModal} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)', border: 'none', borderRadius: 12, color: '#1a1306', fontWeight: 900, fontSize: 14, cursor: 'pointer', letterSpacing: 1, boxShadow: '0 4px 20px rgba(201,169,97,0.4)' }}>💎 COMEÇAR A VENDER</button>
        </div>
      </div>
    )}

    <div className="painel-root" style={{ margin: '0 auto', minHeight: '100vh', background: '#000', padding: 20, color: '#fff', position: 'relative', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'SF Pro Display', sans-serif", filter: isBlocked ? 'blur(10px)' : 'none', pointerEvents: isBlocked ? 'none' : 'auto', userSelect: isBlocked ? 'none' : 'auto' }}>
      <style>{`
        .painel-root { max-width: 480px; }
        .painel-home-grid { display: block; }
        .painel-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .painel-rewards-wrap { max-width: 100%; }
        @media (min-width: 900px) {
          .painel-root { max-width: 1100px; padding: 32px 40px; }
          .painel-home-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            align-items: start;
          }
          .painel-home-grid > .full-width { grid-column: 1 / -1; }
          .painel-tabs { max-width: 600px; margin-left: auto; margin-right: auto; }
          .painel-rewards-wrap { max-width: 720px; margin: 0 auto; }
          .painel-withdrawals { max-width: 720px; margin: 0 auto; }
          .painel-header {
            max-width: 900px;
            margin-left: auto;
            margin-right: auto;
          }
        }
        @keyframes magicTrail {
          0%, 100% { left: -60%; }
          50% { left: 100%; }
        }
        @keyframes magicGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(201,169,97,0.4), 0 0 40px rgba(201,169,97,0.2), inset 0 0 20px rgba(201,169,97,0.1); border-color: #C9A961; }
          50% { box-shadow: 0 0 40px rgba(201,169,97,0.8), 0 0 80px rgba(201,169,97,0.4), inset 0 0 30px rgba(201,169,97,0.2); border-color: #FFF8DC; }
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
          0%, 100% { box-shadow: 0 0 30px rgba(201,169,97,0.4), 0 0 60px rgba(255,140,0,0.2), inset 0 0 30px rgba(201,169,97,0.08); }
          50% { box-shadow: 0 0 50px rgba(201,169,97,0.7), 0 0 100px rgba(255,140,0,0.4), inset 0 0 40px rgba(201,169,97,0.15); }
        }
        @keyframes obligationPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(201,169,97,0.6); }
          50% { box-shadow: 0 0 0 6px rgba(201,169,97,0); }
        }
        @keyframes starSpin {
          0% { transform: perspective(200px) rotateZ(-18deg) rotateY(0deg) scale(1); }
          25% { transform: perspective(200px) rotateZ(-18deg) rotateY(360deg) scale(1.25); }
          50%, 100% { transform: perspective(200px) rotateZ(-18deg) rotateY(720deg) scale(1); }
        }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      {pushStatus !== 'enabled' && pushStatus !== 'unsupported' && !pushBannerDismissed && (
        <div style={{ background: 'linear-gradient(135deg, #C9A961, #E8CF8B)', color: '#1a1306', padding: '10px 12px', borderRadius: 10, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 12px rgba(201,169,97,0.35)' }}>
          <div style={{ fontSize: 20 }}>🔔</div>
          <div style={{ flex: 1, fontSize: 12, lineHeight: 1.3 }}>
            {pushStatus === 'denied' ? (
              <span><b>Notificacoes bloqueadas.</b> Libere nas configuracoes do navegador para avisar quando vender.</span>
            ) : (
              <span><b>Receba aviso na hora da venda!</b> Mesmo com o site fechado.</span>
            )}
          </div>
          {pushStatus !== 'denied' && (
            <button onClick={enablePush} disabled={pushStatus === 'busy'} style={{ padding: '7px 12px', background: '#000', color: '#FFD700', border: 'none', borderRadius: 20, fontWeight: 800, fontSize: 11, cursor: 'pointer', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{pushStatus === 'busy' ? '...' : 'ATIVAR'}</button>
          )}
          <button onClick={dismissPushBanner} aria-label="fechar" style={{ background: 'transparent', border: 'none', color: '#1a1306', fontSize: 16, cursor: 'pointer', padding: '0 4px' }}>✕</button>
        </div>
      )}
      {pushStatus === 'enabled' && (
        <div style={{ display: 'none' }} data-push-enabled onClick={disablePush} />
      )}

      <div className="painel-header" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div onClick={openEditProfile} style={{ width: 52, height: 52, borderRadius: '50%', background: affiliate && affiliate.avatar_url ? 'transparent' : 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#1a1306', boxShadow: '0 4px 20px rgba(201,169,97,0.3)', overflow: 'hidden', cursor: 'pointer', border: '1.5px solid rgba(201,169,97,0.6)' }}>
          {affiliate && affiliate.avatar_url ? (<img src={storageProxyUrl(affiliate.avatar_url)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (affiliate && affiliate.avatar_initials)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#fff', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>AFILIADO</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Ola, {affiliate && affiliate.name && affiliate.name.split(' ')[0]}!</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 2 }}>
            <div onClick={openEditProfile} style={{ fontSize: 10, color: 'rgba(201,169,97,0.7)', cursor: 'pointer', textDecoration: 'underline' }}>Editar perfil</div>
            <div onClick={function() { localStorage.clear(); router.push('/login'); }} style={{ fontSize: 10, color: 'rgba(201,169,97,0.7)', cursor: 'pointer', textDecoration: 'underline' }}>Sair</div>
          </div>
        </div>
        <div style={{ background: '#F5C518', color: '#000', padding: '8px 10px', borderRadius: 6, fontWeight: 900, letterSpacing: 1, boxShadow: '0 2px 12px rgba(245,197,24,0.45)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative', minWidth: 68 }}>
          <span style={{ position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: '#000' }}></span>
          <span style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: '#000' }}></span>
          <span style={{ fontSize: 9, letterSpacing: 1.5 }}>CUPOM:</span>
          <span style={{ fontSize: 13, borderTop: '1.5px dashed #000', paddingTop: 3, width: '100%', textAlign: 'center' }}>{affiliate && affiliate.coupon_code}</span>
        </div>
      </div>

      <div className="painel-tabs" style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(201,169,97,0.15)', borderRadius: 12, padding: 4, position: 'relative' }}>
        {[{id: 'home', l: '🏠 Home', magic: false}, {id: 'rewards', l: '✨ PREMIOS', magic: true}, {id: 'withdrawals', l: '💰 Saques', magic: false}].map(function(t) {
          var isActive = activeTab === t.id;
          return (
            <div key={t.id} style={{ flex: 1, position: 'relative' }}>
              {t.magic && !isActive && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', borderRadius: 8, pointerEvents: 'none', zIndex: 0 }}>
                  <div style={{ position: 'absolute', top: '-30%', bottom: '-30%', width: '60%', background: 'radial-gradient(ellipse at center, rgba(201,169,97,0.9) 0%, rgba(255,140,0,0.5) 35%, rgba(201,169,97,0.15) 65%, transparent 100%)', filter: 'blur(6px)', animation: 'magicTrail 2.5s ease-in-out infinite' }} />
                </div>
              )}
              <button onClick={function() { setActiveTab(t.id); }} style={{ width: '100%', padding: '10px 8px', borderRadius: 8, background: isActive ? 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)' : 'transparent', color: isActive ? '#000' : '#C9A961', fontSize: 12, fontWeight: 800, cursor: 'pointer', position: 'relative', zIndex: 1, border: t.magic && !isActive ? '1px solid #C9A961' : 'none', animation: t.magic && !isActive ? 'magicGlow 2s ease-in-out infinite' : 'none' }}>{t.l}</button>
            </div>
          );
        })}
      </div>

      {activeTab === 'home' && (
        <div className="painel-home-grid">
          <div style={{ background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(201,169,97,0.15)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#C9A961' }}>📊 Suas Vendas</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[{v:'1', l:'Hoje'}, {v:'7', l:'7 dias'}, {v:'30', l:'30 dias'}].map(function(f) {
                  var sel = salesFilter === f.v;
                  return (<button key={f.v} onClick={function() { setSalesFilter(f.v); }} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: sel ? 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)' : 'rgba(201,169,97,0.05)', color: sel ? '#000' : 'rgba(201,169,97,0.6)', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>{f.l}</button>);
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'linear-gradient(135deg, #C9A961 0%, #8B6914 100%)', borderRadius: 14, padding: 14 }}>
                <div style={{ color: 'rgba(0,0,0,0.7)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Vendas</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#000' }}>{filteredCount}</div>
              </div>
              <div style={{ background: '#000', border: '1.5px solid #C9A961', borderRadius: 14, padding: 14 }}>
                <div style={{ color: '#C9A961', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Faturado</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#C9A961' }}>R${Number(filteredRevenue).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
              </div>
            </div>
          </div>

          {fixedMonthly && fixedMonthly.active && (
            <div style={{ position: 'relative', background: 'linear-gradient(135deg, #1a1306 0%, #2a1f08 40%, #1a1306 100%)', border: '2px solid #FFD700', borderRadius: 16, padding: 18, marginBottom: 16, overflow: 'hidden', animation: 'goldPulse 2.4s ease-in-out infinite' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.18) 50%, transparent 100%)', backgroundSize: '200% 100%', animation: 'goldShimmer 3.5s linear infinite', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {[{t:12,l:18},{t:22,l:78},{t:48,l:8},{t:62,l:92},{t:34,l:52},{t:78,l:30},{t:18,l:60},{t:70,l:72}].map(function(p, i) { return (<span key={i} style={{ position: 'absolute', top: p.t + '%', left: p.l + '%', fontSize: 10, color: '#FFD700', animation: 'goldSparkle ' + (2 + (i % 3) * 0.6) + 's ease-in-out ' + (i * 0.25) + 's infinite', textShadow: '0 0 6px rgba(255,215,0,0.9)' }}>✦</span>); })}
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>💠</span>
                  <span style={{ fontSize: 10, color: '#FFD700', letterSpacing: 3, fontWeight: 900, textTransform: 'uppercase', textShadow: '0 0 8px rgba(255,215,0,0.6)' }}>Privilégio Exclusivo</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,215,0,0.85)', letterSpacing: 1 }}>FIXO MENSAL</div>
                  <div style={{
                    fontSize: 28,
                    fontWeight: 900,
                    letterSpacing: -0.5,
                    background: 'linear-gradient(90deg, #FFD700 0%, #FFF4B8 25%, #FFD700 50%, #C9A961 75%, #FFD700 100%)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'goldShimmer 3s linear infinite',
                    textShadow: '0 0 30px rgba(255,215,0,0.5)',
                  }}>R${Number(fixedMonthly.amount || 0).toFixed(2).replace('.', ',')}</div>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,215,0,0.7)', marginTop: 4, letterSpacing: 0.8, fontWeight: 600, textTransform: 'uppercase' }}>Liberado todo dia {fixedMonthly.payday}</div>
              </div>
            </div>
          )}

          <div style={{ background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '2px solid #00ff88', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 0 30px rgba(0,255,136,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 20, flex: 1, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Saldo Disponível</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#00ff88', lineHeight: 1.1, letterSpacing: -0.5, marginTop: 2 }}>R${Number(balance.available_balance).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                </div>
                <div onClick={function() { setShowReleaseDatesModal(true); }} style={{ cursor: 'pointer' }}>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Saldo a Liberar</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: 'rgba(255,255,255,0.5)', lineHeight: 1.1, letterSpacing: -0.5, marginTop: 2 }}>R${Number(balance.blocked_balance || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                </div>
              </div>
              <div style={{ fontSize: 36, lineHeight: 1 }}>💰</div>
            </div>
            <button onClick={function() { setShowWithdrawModal(true); }} disabled={Number(balance.available_balance) < 10} style={{ width: '100%', padding: 14, background: Number(balance.available_balance) >= 10 ? 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)' : '#1a1a1a', border: 'none', borderRadius: 14, color: Number(balance.available_balance) >= 10 ? '#000' : 'rgba(0,255,136,0.3)', fontWeight: 800, fontSize: 15, cursor: Number(balance.available_balance) >= 10 ? 'pointer' : 'not-allowed', boxShadow: Number(balance.available_balance) >= 10 ? '0 4px 20px rgba(0,255,136,0.4)' : 'none' }}>💸 Solicitar Saque</button>
            <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.4 }}>Cada venda fica bloqueada por 8 dias antes de liberar para saque.</div>
            <button onClick={function() { setShowReleaseDatesModal(true); }} style={{ marginTop: 10, width: '100%', padding: '9px 12px', background: 'transparent', border: '1px solid rgba(201,169,97,0.5)', borderRadius: 10, color: '#C9A961', fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}>📅 Datas de Liberação</button>
          </div>

          <div className="full-width" style={{ background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(201,169,97,0.2)', borderRadius: 16, padding: 18, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#C9A961' }}>📸 Sua Semana de Postagens</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 12 }}>
              {weekDays.map(function(d, i) {
                var bg, border, opacity = 1, label = '', labelColor = '';
                if (d.posted) { bg = 'linear-gradient(135deg, #00ff88, #00cc6a)'; border = '2px solid #00ff88'; label = '✓'; labelColor = '#00ff88'; }
                else if (d.missed) { bg = 'rgba(255,80,80,0.15)'; border = '2px solid #ff4444'; label = '✗'; labelColor = '#ff4444'; }
                else if (d.isObligatory && d.isFuture) { bg = 'linear-gradient(135deg, rgba(201,169,97,0.25), rgba(255,140,0,0.1))'; border = '2px solid #C9A961'; label = '!'; labelColor = '#C9A961'; }
                else if (d.isToday) { bg = 'rgba(201,169,97,0.1)'; border = '2px solid rgba(201,169,97,0.5)'; label = ''; }
                else if (d.isFuture) { bg = 'rgba(255,255,255,0.02)'; border = '1px dashed rgba(201,169,97,0.15)'; opacity = 0.4; }
                else { bg = 'rgba(255,255,255,0.04)'; border = '1px solid rgba(201,169,97,0.1)'; opacity = 0.55; }

                return (
                  <div key={i} style={{ background: bg, border: border, borderRadius: 10, padding: '8px 4px', textAlign: 'center', opacity: opacity, animation: d.isObligatory && d.isFuture ? 'obligationPulse 2s ease-in-out infinite' : 'none', position: 'relative', minHeight: 70 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: d.isToday ? '#C9A961' : 'rgba(201,169,97,0.6)', marginBottom: 2 }}>{weekdayShort[d.date.getDay()]}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: d.posted ? '#000' : d.missed ? '#ff4444' : d.isToday ? '#C9A961' : '#fff' }}>{d.date.getDate()}</div>
                    {label && (<div style={{ fontSize: 14, color: labelColor, fontWeight: 900, marginTop: 2 }}>{label}</div>)}
                    {d.posted && !d.missed && (<div style={{ fontSize: 7, color: '#000', fontWeight: 800, marginTop: 1 }}>POSTADO</div>)}
                    {d.missed && (<div style={{ fontSize: 7, color: '#ff4444', fontWeight: 800, marginTop: 1 }}>FALHOU 😔</div>)}
                  </div>
                );
              })}
            </div>

            <button onClick={function() { setShowPostModal(true); }} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #C9A961 0%, #8B6914 100%)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 20px rgba(201,169,97,0.3)' }}>✨ Registrar Postagem de Hoje</button>

            {obligations.length > 0 && (
              <div style={{ marginTop: 12, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: pendingMissed > 0 ? '#ff6b6b' : '#00ff88' }}>
                  {pendingMissed === 0 ? '🎉 Parabéns! Você não falhou nenhum dia ainda!' : '⚠️ Você deixou de postar ' + pendingMissed + ' ' + (pendingMissed === 1 ? 'vez' : 'vezes') + '. Compense postando outro dia!'}
                  {compensated > 0 && pendingMissed > 0 && (<div style={{ fontSize: 10, marginTop: 4, color: '#00ff88' }}>(Você ja compensou {compensated})</div>)}
                </div>
              </div>
            )}
          </div>

          <div onClick={openMaterialsModal} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, rgba(15,15,15,0.85), rgba(26,19,6,0.85))', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(201,169,97,0.35)', borderRadius: 16, padding: 0, marginBottom: 16, overflow: 'hidden', display: 'flex', alignItems: 'stretch', minHeight: 150, boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)', animation: 'materialHeartbeat 1.6s ease-in-out infinite', transformOrigin: 'center' }}>
            <div style={{ position: 'relative', width: 130, flexShrink: 0, overflow: 'hidden', background: '#000' }}>
              <img src="/pic.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85, display: 'block', position: 'absolute', inset: 0 }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(15,15,15,0.9) 100%)', pointerEvents: 'none' }} />
            </div>
            <div style={{ flex: 1, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, color: '#C9A961', filter: 'drop-shadow(0 0 6px rgba(201,169,97,0.6))', fontWeight: 900 }}>◆</span>
                <span style={{ fontSize: 9, color: '#C9A961', letterSpacing: 2.5, fontWeight: 700, textTransform: 'uppercase' }}>Exclusivo</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#C9A961', letterSpacing: 1, lineHeight: 1.1, textShadow: '0 0 20px rgba(201,169,97,0.3)', whiteSpace: 'nowrap' }}>MATERIAL PARA POSTAR</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4, letterSpacing: 0.5 }}>Fotos e vídeos para divulgar →</div>
            </div>
          </div>

          {allSales.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg, rgba(15,15,15,0.85), rgba(26,19,6,0.85))', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 16, padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'stretch', minHeight: 150, boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
              <div style={{ position: 'relative', width: 130, flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(135deg, #1a1306, #0a0a0a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'relative', background: '#C9A961', borderRadius: 8, width: 72, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#0a0a0a' }}></span>
                  <span style={{ position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#0a0a0a' }}></span>
                  <span style={{ fontSize: 28, fontWeight: 900, color: '#000', letterSpacing: -1 }}>$</span>
                </div>
              </div>
              <div style={{ flex: 1, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: '#C9A961', letterSpacing: 2.5, fontWeight: 700, textTransform: 'uppercase', textShadow: '0 0 20px rgba(201,169,97,0.3)', whiteSpace: 'nowrap' }}>Ultima Venda no seu Cupom</div>
                {(function() {
                  var s = allSales[0];
                  var isManual = !!(s && (String(s.external_order_id || '').indexOf('manual-') === 0 || /inser[çc]ao manual/i.test(s.buyer_name || '')));
                  var commissionStr = Number(s.commission_earned || 0).toFixed(2).replace('.', ',');
                  var dt = s.created_at ? new Date(s.created_at) : null;
                  var dtStr = dt ? dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' às ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <>
                      {!isManual && s.buyer_name && (
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6, fontWeight: 600 }}>{s.buyer_name}{s.buyer_city && <span style={{ color: 'rgba(201,169,97,0.5)', marginLeft: 6, fontWeight: 400 }}>· {s.buyer_city}</span>}</div>
                      )}
                      {dtStr && (
                        <div style={{ fontSize: 11, color: 'rgba(201,169,97,0.6)', marginTop: isManual ? 6 : 2, fontWeight: 500 }}>🕒 {dtStr}</div>
                      )}
                      <div style={{ marginTop: 6, textAlign: 'center' }}>
                        <div style={{ lineHeight: 1.2 }}>
                          <span style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>VOCÊ GANHOU </span>
                          <span style={{ color: '#C9A961', fontSize: 18, fontWeight: 900, textShadow: '0 0 20px rgba(201,169,97,0.3)' }}>R${commissionStr}</span>
                        </div>
                        <div style={{ color: '#fff', fontSize: 10, fontWeight: 700, marginTop: 2, letterSpacing: 0.5, opacity: 0.85 }}>POR ESSA VENDA</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'rewards' && (
        <div className="painel-rewards-wrap">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 4 }}>🚀 Sua Jornada de Prêmios</div>
            <div style={{ fontSize: 13, color: 'rgba(201,169,97,0.6)' }}>Cada venda te impulsiona mais alto!</div>
          </div>

          {rewards.length === 0 && (
            <div style={{ background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px dashed rgba(201,169,97,0.3)', borderRadius: 16, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎁</div>
              <div style={{ color: '#C9A961', fontSize: 14, fontWeight: 600 }}>Novos prêmios em breve</div>
            </div>
          )}

          {rewards.length > 0 && (
            <div style={{ position: 'relative', paddingLeft: 60, paddingRight: 10, minHeight: rewards.length * 150 + 'px' }}>
              <div style={{ position: 'absolute', left: 44, top: 0, bottom: 40, width: 4, background: 'linear-gradient(180deg, #C9A961 0%, #8B6914 100%)', borderRadius: 2, boxShadow: '0 0 20px rgba(201,169,97,0.3)' }}></div>

              {(function() {
                var reversedPos = rewards.length - rocketPos;
                var topCalc = (reversedPos / rewards.length) * 100;
                return (
                  <div style={{ position: 'absolute', left: 0, width: 64, top: 'calc(' + topCalc + '% + 10px)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, zIndex: 3, transition: 'top 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)', animation: 'floatRocket 2s ease-in-out infinite' }}>
                    <div style={{ background: 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)', color: '#000', padding: '4px 8px', borderRadius: 10, fontSize: 11, fontWeight: 900, boxShadow: '0 0 15px rgba(201,169,97,0.6)', whiteSpace: 'nowrap' }}>{totalSales}</div>
                    <div style={{ fontSize: 36, filter: 'drop-shadow(0 0 20px rgba(201,169,97,0.8))' }}>🚀</div>
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
                  bg: 'linear-gradient(135deg, rgba(201,169,97,0.25), rgba(255,140,0,0.1), rgba(201,169,97,0.05))',
                  border: '2px solid #C9A961',
                  badge: '👑 LENDÁRIO',
                  badgeBg: 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)',
                  emojiSize: 48,
                  emojiAnim: 'pulseEmoji 2s ease-in-out infinite',
                  titleColor: '#FFF8DC',
                  titleShadow: '0 0 10px rgba(201,169,97,0.6)',
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
                    <div style={{ position: 'absolute', left: -30, top: -16, width: 32, height: 32, background: achieved ? 'linear-gradient(135deg, #00ff88, #00cc6a)' : isTop ? 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)' : isMid ? 'linear-gradient(135deg, #E8E8E8, #A8A8A8)' : 'linear-gradient(135deg, #CD7F32, #8B4513)', clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)', filter: 'drop-shadow(0 0 8px ' + (achieved ? 'rgba(0,255,136,0.8)' : isTop ? 'rgba(201,169,97,0.9)' : isMid ? 'rgba(232,232,232,0.6)' : 'rgba(205,127,50,0.6)') + ')', zIndex: 2, animation: 'starSpin 3s ease-in-out infinite', transformOrigin: 'center center' }}></div>
                    {[1, 2, 3].map(function(n) {
                      return (<div key={n} style={{ position: 'absolute', left: -19, top: (n * 25) + '%', width: 10, height: 10, borderRadius: '50%', background: 'rgba(201,169,97,0.3)', border: '2px solid rgba(201,169,97,0.5)', zIndex: 1 }}></div>);
                    })}

                    <div style={{ background: tierStyles.bg, border: tierStyles.border, borderRadius: 16, padding: 18, position: 'relative', overflow: 'hidden', animation: tierStyles.cardAnim }}>
                      {!achieved && (<div style={{ position: 'absolute', top: 0, right: 0, padding: '4px 12px', background: tierStyles.badgeBg, color: '#000', borderRadius: '0 16px 0 12px', fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>{tierStyles.badge}</div>)}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, marginTop: !achieved ? 10 : 0 }}>
                        <div style={{ fontSize: tierStyles.emojiSize, animation: tierStyles.emojiAnim }}>{r.reward_emoji}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: isTop ? 17 : 15, fontWeight: 900, color: tierStyles.titleColor, textShadow: tierStyles.titleShadow }}>{r.reward_title}</div>
                          {r.reward_description && (<div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{r.reward_description}</div>)}
                        </div>
                        {achieved && (<div style={{ padding: '6px 12px', background: '#00ff88', color: '#000', borderRadius: 16, fontSize: 10, fontWeight: 900 }}>CONQUISTADA!</div>)}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                        <div style={{ color: 'rgba(255,255,255,0.6)' }}>{r.target_type === 'sales' ? 'Meta: ' + target + ' vendas' : 'Meta: R$' + Number(target).toLocaleString('pt-BR')}</div>
                        <div style={{ color: isTop ? '#C9A961' : isMid ? '#E8E8E8' : '#FFD8A8', fontWeight: 700 }}>{r.target_type === 'sales' ? current + '/' + target : 'R$' + Number(current).toFixed(0) + '/R$' + Number(target).toFixed(0)}</div>
                      </div>
                      <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: progress + '%', height: '100%', background: isTop ? 'linear-gradient(90deg, #C9A961, #8B6914, #C9A961)' : isMid ? 'linear-gradient(90deg, #E8E8E8, #A8A8A8)' : 'linear-gradient(90deg, #CD7F32, #DAA520)', backgroundSize: '200% 100%', transition: 'width 0.8s ease-out', animation: isTop ? 'shimmerProgress 2s linear infinite' : 'none' }}></div>
                      </div>
                      {Number(r.reward_value_money) > 0 && (<div style={{ marginTop: 10, fontSize: 12, color: '#00ff88', fontWeight: 800 }}>💰 + Bonus R$ {Number(r.reward_value_money).toFixed(2)}</div>)}
                    </div>
                  </div>
                );
              })}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, padding: 12, background: 'rgba(201,169,97,0.05)', borderRadius: 12, border: '1px dashed rgba(201,169,97,0.3)', position: 'relative' }}>
                <div style={{ position: 'absolute', left: -22, width: 20, height: 20, borderRadius: '50%', background: '#C9A961' }}></div>
                <div style={{ color: '#C9A961', fontWeight: 700, fontSize: 13 }}>🏁 Ponto de partida</div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 30, textAlign: 'center', animation: 'fadeMotivation 3s ease-in-out infinite' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.4 }}>{motivationalPhrase}</div>
          </div>
        </div>
      )}

      {activeTab === 'withdrawals' && (
        <div className="painel-withdrawals">
          <div style={{ background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '2px solid #00ff88', borderRadius: 16, padding: 20, marginBottom: 18, boxShadow: '0 0 30px rgba(0,255,136,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 20, flex: 1, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Saldo Disponível</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#00ff88', lineHeight: 1.1, letterSpacing: -0.5, marginTop: 2 }}>R${Number(balance.available_balance).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                </div>
                <div onClick={function() { setShowReleaseDatesModal(true); }} style={{ cursor: 'pointer' }}>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Saldo a Liberar</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: 'rgba(255,255,255,0.5)', lineHeight: 1.1, letterSpacing: -0.5, marginTop: 2 }}>R${Number(balance.blocked_balance || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                </div>
              </div>
              <div style={{ fontSize: 36, lineHeight: 1 }}>💰</div>
            </div>
            <button onClick={function() { setShowWithdrawModal(true); }} disabled={Number(balance.available_balance) < 10} style={{ width: '100%', padding: 14, background: Number(balance.available_balance) >= 10 ? 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)' : '#1a1a1a', border: 'none', borderRadius: 14, color: Number(balance.available_balance) >= 10 ? '#000' : 'rgba(0,255,136,0.3)', fontWeight: 800, fontSize: 15, cursor: Number(balance.available_balance) >= 10 ? 'pointer' : 'not-allowed', boxShadow: Number(balance.available_balance) >= 10 ? '0 4px 20px rgba(0,255,136,0.4)' : 'none' }}>💸 Realizar Outro Saque</button>
            <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.4 }}>Cada venda fica bloqueada por 8 dias antes de liberar para saque.</div>
            <button onClick={function() { setShowReleaseDatesModal(true); }} style={{ marginTop: 10, width: '100%', padding: '9px 12px', background: 'transparent', border: '1px solid rgba(201,169,97,0.5)', borderRadius: 10, color: '#C9A961', fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}>📅 Datas de Liberação</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(201,169,97,0.2)' }} />
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(201,169,97,0.8)', letterSpacing: 2, textTransform: 'uppercase' }}>Histórico de Saques</div>
            <div style={{ flex: 1, height: 1, background: 'rgba(201,169,97,0.2)' }} />
          </div>

          {myWithdrawals.length === 0 && (<div style={{ background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(201,169,97,0.15)', borderRadius: 16, padding: 40, textAlign: 'center', color: 'rgba(201,169,97,0.5)' }}>Nenhum saque solicitado ainda</div>)}
          {myWithdrawals.map(function(w) {
            var isPaid = w.status === 'paid';
            var isRejected = w.status === 'rejected';
            var statusColor = isPaid ? '#00ff88' : isRejected ? '#ff6b6b' : '#C9A961';
            var statusBg = isPaid ? 'rgba(0,255,136,0.1)' : isRejected ? 'rgba(255,107,107,0.1)' : 'rgba(201,169,97,0.1)';
            var statusLabel = isPaid ? 'PAGO ✓' : isRejected ? 'REJEITADO' : 'PENDENTE';
            return (<div key={w.id} style={{ background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid ' + statusColor, borderRadius: 16, padding: 18, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#C9A961' }}>R${Number(w.amount).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                  <div style={{ fontSize: 11, color: 'rgba(201,169,97,0.5)', marginTop: 2 }}>Solicitado em {formatDateTime(w.created_at)}</div>
                </div>
                <div style={{ padding: '4px 12px', borderRadius: 16, background: statusBg, color: statusColor, fontSize: 11, fontWeight: 800 }}>{statusLabel}</div>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(201,169,97,0.4)' }}>PIX ({w.pix_type}): {w.pix_key}</div>
              {isPaid && w.paid_at && (<div style={{ fontSize: 11, color: '#00ff88', marginTop: 6 }}>Pago em {formatDateTime(w.paid_at)}</div>)}
              {isPaid && w.receipt_url && (<button onClick={function() { viewReceipt(w.receipt_url); }} style={{ marginTop: 12, width: '100%', padding: 10, background: 'linear-gradient(135deg, #00ff88, #00cc6a)', border: 'none', borderRadius: 10, color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>📄 Ver Comprovante</button>)}
            </div>);
          })}
        </div>
      )}

      {showWithdrawModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', padding: 20 }}>
          <div style={{ maxWidth: 400, width: '100%', background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '2px solid #C9A961', borderRadius: 18, padding: 28, boxShadow: '0 0 60px rgba(201,169,97,0.3)' }}>
            {withdrawSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 50, marginBottom: 16 }}>✅</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#C9A961', marginBottom: 12 }}>Solicitação confirmada!</div>
                <div style={{ fontSize: 13, color: 'rgba(201,169,97,0.7)', lineHeight: 1.5, marginBottom: 20 }}>O prazo de recebimento é de até 24 horas. Fique atenta ao seu email.</div>
                <button onClick={closeWithdrawModal} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #C9A961 0%, #8B6914 100%)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>Fechar</button>
              </div>
            ) : withdrawCodeStep ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#C9A961' }}>🔐 Confirmar Saque</div>
                  <button onClick={closeWithdrawModal} style={{ background: 'none', border: 'none', color: '#C9A961', fontSize: 20, cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ background: 'rgba(201,169,97,0.08)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#C9A961', fontWeight: 700, marginBottom: 4 }}>📧 Enviamos um código para</div>
                  <div style={{ fontSize: 13, color: '#fff', wordBreak: 'break-all' }}>{withdrawEmail}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.4 }}>Abre seu email (ou spam) e digita o código de 6 dígitos abaixo. Expira em 10 minutos.</div>
                </div>
                <label style={{ display: 'block', marginBottom: 6, color: 'rgba(201,169,97,0.7)', fontSize: 12, fontWeight: 700 }}>CÓDIGO DE CONFIRMAÇÃO</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={withdrawCode}
                  onChange={function(e) { setWithdrawCode(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
                  placeholder="000000"
                  autoFocus
                  style={{ width: '100%', padding: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 12, color: '#C9A961', fontSize: 26, fontWeight: 900, marginBottom: 14, outline: 'none', textAlign: 'center', letterSpacing: 10 }}
                />
                {withdrawMessage && (<div style={{ padding: 10, borderRadius: 10, textAlign: 'center', fontSize: 13, marginBottom: 12, background: 'rgba(255,80,80,0.1)', color: '#ff6b6b' }}>{withdrawMessage}</div>)}
                <button onClick={handleConfirmWithdrawCode} disabled={withdrawSending} style={{ width: '100%', padding: 14, background: withdrawSending ? 'rgba(0,255,136,0.35)' : 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 800, fontSize: 15, cursor: withdrawSending ? 'wait' : 'pointer', marginBottom: 8 }}>{withdrawSending ? 'Confirmando...' : 'Confirmar Saque'}</button>
                <button onClick={function() { setWithdrawCodeStep(false); setWithdrawCode(''); setWithdrawMessage(''); }} style={{ width: '100%', padding: 10, background: 'transparent', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 12, color: 'rgba(201,169,97,0.7)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>← Voltar</button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#C9A961' }}>💸 Solicitar Saque</div>
                  <button onClick={closeWithdrawModal} style={{ background: 'none', border: 'none', color: '#C9A961', fontSize: 20, cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 12, padding: 14, marginBottom: 16, textAlign: 'center' }}>
                  <div style={{ color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>SALDO DISPONIVEL</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#00ff88' }}>R${Number(balance.available_balance).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                </div>
                <label style={{ display: 'block', marginBottom: 6, color: 'rgba(201,169,97,0.7)', fontSize: 12, fontWeight: 700 }}>QUANTO DESEJA SACAR?</label>
                <input type="text" inputMode="numeric" value={formatCurrency(withdrawAmount)} onChange={handleAmountChange} placeholder="R$ 0,00" style={{ width: '100%', padding: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 12, color: '#C9A961', fontSize: 18, marginBottom: 14, outline: 'none', fontWeight: 700, letterSpacing: 0.5 }} />
                <label style={{ display: 'block', marginBottom: 6, color: 'rgba(201,169,97,0.7)', fontSize: 12, fontWeight: 700 }}>QUAL SUA CHAVE PIX?</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                  {['CPF','Email','Telefone','Aleatoria'].map(function(t) { return (<button key={t} onClick={function() { setPixType(t); }} style={{ padding: 10, borderRadius: 10, border: pixType === t ? '2px solid #C9A961' : '1px solid rgba(201,169,97,0.2)', background: pixType === t ? 'rgba(201,169,97,0.15)' : 'rgba(255,255,255,0.03)', color: pixType === t ? '#C9A961' : 'rgba(201,169,97,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t}</button>); })}
                </div>
                <input type="text" value={pixKey} onChange={function(e) { setPixKey(e.target.value); }} placeholder="Digite sua chave PIX" style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 12, color: '#C9A961', marginBottom: 14, outline: 'none' }} />
                <label style={{ display: 'block', marginBottom: 6, color: 'rgba(201,169,97,0.7)', fontSize: 12, fontWeight: 700 }}>DIGITE SEU EMAIL PARA RECEBER O COMPROVANTE</label>
                <input type="email" value={withdrawEmail} onChange={function(e) { setWithdrawEmail(e.target.value); }} placeholder="seu@email.com" style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 12, color: '#C9A961', marginBottom: 14, outline: 'none' }} />
                <div style={{ padding: 10, borderRadius: 10, fontSize: 11, marginBottom: 12, background: 'rgba(201,169,97,0.08)', color: 'rgba(201,169,97,0.85)', lineHeight: 1.5 }}>🔐 Por segurança, enviaremos um código para seu email antes de confirmar o saque.</div>
                {withdrawMessage && (<div style={{ padding: 10, borderRadius: 10, textAlign: 'center', fontSize: 13, marginBottom: 12, background: 'rgba(255,80,80,0.1)', color: '#ff6b6b' }}>{withdrawMessage}</div>)}
                <button onClick={handleRequestWithdraw} disabled={withdrawSending} style={{ width: '100%', padding: 14, background: withdrawSending ? 'rgba(0,255,136,0.35)' : 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 800, fontSize: 15, cursor: withdrawSending ? 'wait' : 'pointer' }}>{withdrawSending ? 'Enviando código...' : 'Enviar código por email'}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showPostModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', padding: 20 }}>
          <div style={{ maxWidth: 400, width: '100%', background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '2px solid #C9A961', borderRadius: 18, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#C9A961' }}>📸 Registrar Postagem</div>
              <button onClick={function() { setShowPostModal(false); }} style={{ background: 'none', border: 'none', color: '#C9A961', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <label style={{ display: 'block', marginBottom: 8, color: 'rgba(201,169,97,0.7)', fontSize: 12, fontWeight: 700 }}>REDE SOCIAL</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {platforms.map(function(p) { var sel = postPlatform === p.id; return (<button key={p.id} onClick={function() { setPostPlatform(p.id); }} style={{ padding: 12, borderRadius: 12, border: sel ? '2px solid #C9A961' : '1px solid rgba(201,169,97,0.2)', background: sel ? 'rgba(201,169,97,0.15)' : 'rgba(255,255,255,0.03)', color: sel ? '#C9A961' : 'rgba(201,169,97,0.5)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 18 }}>{p.icon}</span>{p.label}</button>); })}
            </div>
            <label style={{ display: 'block', marginBottom: 6, color: 'rgba(201,169,97,0.7)', fontSize: 12, fontWeight: 700 }}>LINK OU ID DO POST</label>
            <input type="text" value={postLink} onChange={function(e) { setPostLink(e.target.value); }} placeholder="https://instagram.com/p/..." style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 12, color: '#C9A961', marginBottom: 12, outline: 'none' }} />
            {postMessage && (<div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,80,80,0.1)', color: '#ff6b6b', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{postMessage}</div>)}
            <button onClick={handleConfirmPost} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #C9A961 0%, #8B6914 100%)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 800, cursor: 'pointer' }}>Confirmar Postagem</button>
          </div>
        </div>
      )}

      {showReleaseDatesModal && (function() {
        var LOCK_MS = 8 * 24 * 60 * 60 * 1000;
        var nowTs = Date.now();
        var blockedRows = (allSales || [])
          .filter(function(s) {
            var t = s.created_at ? new Date(s.created_at).getTime() : 0;
            return t > 0 && (nowTs - t) < LOCK_MS;
          })
          .map(function(s) {
            var created = new Date(s.created_at).getTime();
            var release = created + LOCK_MS;
            var daysLeft = Math.max(0, Math.ceil((release - nowTs) / 86400000));
            return { id: s.id, amount: Number(s.commission_earned || 0), created_at: s.created_at, release_at: new Date(release).toISOString(), days_left: daysLeft };
          })
          .sort(function(a, b) { return new Date(a.release_at) - new Date(b.release_at); });
        var totalBlocked = blockedRows.reduce(function(sum, r) { return sum + r.amount; }, 0);
        function fmtDate(iso) {
          var d = new Date(iso);
          return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
        }
        return (
          <div onClick={function() { setShowReleaseDatesModal(false); }} style={{ position: 'fixed', inset: 0, zIndex: 9800, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: 520, width: '100%', background: 'linear-gradient(180deg, #1a1306, #0a0604)', border: '1px solid rgba(201,169,97,0.35)', borderRadius: 16, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: 18, borderBottom: '1px solid rgba(201,169,97,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#C9A961' }}>📅 Datas de Liberação</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>Cada venda libera 8 dias após entrar</div>
                </div>
                <button onClick={function() { setShowReleaseDatesModal(false); }} style={{ background: 'transparent', border: 'none', color: '#C9A961', fontSize: 22, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ padding: 16, borderBottom: '1px solid rgba(201,169,97,0.15)', background: 'rgba(201,169,97,0.05)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Total bloqueado</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#C9A961' }}>R${totalBlocked.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{blockedRows.length} {blockedRows.length === 1 ? 'venda bloqueada' : 'vendas bloqueadas'}</div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                {blockedRows.length === 0 && (<div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: 36, fontSize: 13 }}>Nenhuma venda bloqueada no momento.<br/>Tudo liberado para saque! ✓</div>)}
                {blockedRows.map(function(r) {
                  return (
                    <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,169,97,0.15)', borderRadius: 10, padding: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(201,169,97,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🔒</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#C9A961' }}>R${r.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Venda em {fmtDate(r.created_at)}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700 }}>Libera em</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#00ff88' }}>{fmtDate(r.release_at)}</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{r.days_left === 0 ? 'hoje' : r.days_left === 1 ? 'em 1 dia' : 'em ' + r.days_left + ' dias'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {showReceiptModal && (
        <div onClick={function() { setShowReceiptModal(false); }} style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.95)', padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: 500, width: '100%', background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '2px solid #C9A961', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#C9A961' }}>📄 Comprovante</div>
              <button onClick={function() { setShowReceiptModal(false); }} style={{ background: 'none', border: 'none', color: '#C9A961', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <img src={receiptImage} alt="Comprovante" style={{ width: '100%', borderRadius: 8 }} />
            <a href={receiptImage} download target="_blank" rel="noopener" style={{ display: 'block', marginTop: 12, padding: 12, background: 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)', borderRadius: 10, color: '#000', fontWeight: 800, textAlign: 'center', textDecoration: 'none', fontSize: 14 }}>⬇ Baixar</a>
          </div>
        </div>
      )}

      {showMaterialsModal && (
        <div onClick={function() { setShowMaterialsModal(false); }} style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: 720, width: '100%', maxHeight: '92vh', background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 16, padding: 24, overflowY: 'auto', boxShadow: '0 20px 80px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(201,169,97,0.15)' }}>
              <div>
                {selectedMaterialFolder ? (
                  <>
                    <button onClick={function() { setSelectedMaterialFolder(null); setMaterialFiles([]); }} style={{ background: 'none', border: 'none', color: '#C9A961', fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>← Voltar</button>
                    <div style={{ fontSize: 20, color: '#fff', fontWeight: 700, letterSpacing: -0.3 }}>{selectedMaterialFolder.name}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: '#C9A961', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Material para postar</div>
                    <div style={{ fontSize: 20, color: '#fff', fontWeight: 700, letterSpacing: -0.3 }}>Escolha uma pasta</div>
                  </>
                )}
              </div>
              <button onClick={function() { setShowMaterialsModal(false); }} style={{ background: 'none', border: 'none', color: '#C9A961', fontSize: 24, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
            </div>

            {loadingMaterials && (<div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.5)' }}>Carregando...</div>)}

            {!loadingMaterials && !selectedMaterialFolder && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {materialFolders.length === 0 && (<div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>Nenhuma pasta disponível ainda</div>)}
                {materialFolders.map(function(f) {
                  return (
                    <button key={f.id} onClick={function() { openMaterialFolder(f); }} style={{ position: 'relative', background: f.is_urgent ? 'linear-gradient(135deg, rgba(255,80,80,0.1), rgba(255,80,80,0.02))' : 'rgba(255,255,255,0.03)', border: '1px solid ' + (f.is_urgent ? 'rgba(255,80,80,0.4)' : 'rgba(201,169,97,0.2)'), borderRadius: 12, padding: '18px 16px', color: '#fff', textAlign: 'left', cursor: 'pointer', transition: 'all 0.3s', animation: f.is_urgent ? 'obligationPulse 1.8s ease-in-out infinite' : 'none' }}>
                      {f.is_urgent && (<div style={{ position: 'absolute', top: 8, right: 8, background: '#ff4444', color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: 1, padding: '2px 8px', borderRadius: 999 }}>URGENTE</div>)}
                      <div style={{ fontSize: 28, marginBottom: 8 }}>{f.type === 'video' ? '🎬' : f.type === 'mixed' ? '📁' : '📷'}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(201,169,97,0.7)', letterSpacing: 0.5 }}>{f.file_count} {f.file_count === 1 ? 'arquivo' : 'arquivos'}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {!loadingMaterials && selectedMaterialFolder && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {materialFiles.length === 0 && (<div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>Esta pasta ainda está vazia</div>)}
                {materialFiles.map(function(file) {
                  return (
                    <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" download style={{ position: 'relative', aspectRatio: '1 / 1', background: '#0a0a0a', border: '1px solid rgba(201,169,97,0.15)', borderRadius: 10, overflow: 'hidden', display: 'block', textDecoration: 'none' }}>
                      {file.file_type === 'video' ? (
                        <video src={file.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                      ) : (
                        <img src={file.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px', background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.85))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: '#C9A961', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{file.file_type === 'video' ? '▶ Vídeo' : '⇣ Baixar'}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '40px 20px 30px', marginTop: 30, borderTop: '1px solid rgba(201,169,97,0.1)' }}>
        <button onClick={function() { setShowConductView(true); }} style={{ background: 'none', border: 'none', padding: 6, color: '#C9A961', fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', cursor: 'pointer', display: 'block', margin: '0 auto 12px auto' }}>
          TERMOS DE CONDUTA
        </button>
        <button onClick={function() { setShowContact(true); }} style={{ background: 'none', border: 'none', padding: 6, color: '#C9A961', fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', cursor: 'pointer', display: 'block', margin: '0 auto' }}>
          CONTATO
        </button>
      </div>

      {showConductView && (
        <div onClick={function() { setShowConductView(false); }} style={{ position: 'fixed', inset: 0, zIndex: 10800, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'linear-gradient(180deg, #1a1306 0%, #0f0a03 100%)', border: '2px solid #C9A961', borderRadius: 16, padding: 24, color: '#FFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#C9A961', letterSpacing: 1 }}>💎 TERMOS DE CONDUTA</div>
              <button onClick={function() { setShowConductView(false); }} style={{ background: 'transparent', border: 'none', color: '#C9A961', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.82)' }}>
              <p style={{ marginBottom: 12 }}>Ao divulgar produtos <strong style={{ color: '#C9A961' }}>Joias Maromba</strong>, você concorda com estas regras.</p>

              <div style={{ marginBottom: 14, padding: 12, background: 'rgba(201,169,97,0.08)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 8 }}>
                <div style={{ fontWeight: 800, color: '#C9A961', marginBottom: 6 }}>1. DIVULGAÇÃO HONESTA</div>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  <li>Não faça promessas falsas sobre efeitos, durabilidade ou material.</li>
                  <li>Não invente descontos, promoções ou condições que não existem.</li>
                  <li><strong style={{ color: '#FFD700' }}>É proibido informar ao cliente desconto superior a 3%</strong> — o valor oficial concedido pelo cupom é de 3% sobre a compra. Divulgar qualquer percentual maior configura propaganda enganosa e gera advertência imediata.</li>
                  <li>Use apenas o site oficial <strong>joiasmaromba.com.br</strong>. Links falsos/clones são proibidos.</li>
                  <li>Prefira os materiais oficiais do painel.</li>
                </ul>
              </div>

              <div style={{ marginBottom: 14, padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8 }}>
                <div style={{ fontWeight: 800, color: '#FCA5A5', marginBottom: 6 }}>2. CONTEÚDO PROIBIDO</div>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  <li>Nudez ou conteúdo sexual</li>
                  <li>Menores de 18 anos</li>
                  <li>Maus-tratos a animais ou humanos</li>
                  <li>Política partidária ou religião</li>
                  <li>Discurso de ódio, preconceito, racismo</li>
                  <li>Drogas ilícitas ou apologia a vícios</li>
                </ul>
              </div>

              <div style={{ padding: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 8 }}>
                <div style={{ fontWeight: 800, color: '#FCD34D', marginBottom: 6 }}>3. MEDIDAS DISCIPLINARES</div>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  <li><strong>Notificação</strong> na 1ª ocorrência</li>
                  <li><strong>Banimento definitivo</strong> na 2ª</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {showContact && (
        <div onClick={function() { setShowContact(false); }} style={{ position: 'fixed', inset: 0, zIndex: 10800, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: 380, width: '100%', background: 'linear-gradient(180deg, #1a1306 0%, #0f0a03 100%)', border: '2px solid #C9A961', borderRadius: 16, padding: 28, textAlign: 'center', color: '#FFF' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✉️</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#C9A961', letterSpacing: 2, marginBottom: 14 }}>CONTATO</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>Fale com a gente pelo email:</div>
            <a href="mailto:contato@joiasmaromba.com" style={{ display: 'block', fontSize: 15, fontWeight: 800, color: '#FFF', background: 'rgba(201,169,97,0.12)', border: '1px solid rgba(201,169,97,0.4)', borderRadius: 10, padding: '12px 14px', textDecoration: 'none', letterSpacing: 0.5, marginBottom: 14 }}>
              contato@joiasmaromba.com
            </a>
            <button onClick={function() { try { navigator.clipboard.writeText('contato@joiasmaromba.com'); } catch(e) {} setShowContact(false); }} style={{ background: 'none', border: 'none', color: '#C9A961', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', padding: 6 }}>
              Copiar email
            </button>
          </div>
        </div>
      )}

      {showEditProfile && (
        <div onClick={function() { if (!savingProfile && !uploadingAvatar) setShowEditProfile(false); }} style={{ position: 'fixed', inset: 0, zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.92)', padding: 20 }}>
          <div onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: 440, width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '2px solid #C9A961', borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#C9A961' }}>👤 Editar Perfil</div>
              <button onClick={function() { if (!savingProfile && !uploadingAvatar) setShowEditProfile(false); }} style={{ background: 'none', border: 'none', color: '#C9A961', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: editAvatarUrl ? 'transparent' : 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: '#000', boxShadow: '0 4px 20px rgba(201,169,97,0.5)', overflow: 'hidden', border: '3px solid #C9A961', marginBottom: 12 }}>
                {editAvatarUrl ? (<img src={storageProxyUrl(editAvatarUrl)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (affiliate && affiliate.avatar_initials)}
              </div>
              <label style={{ cursor: uploadingAvatar ? 'wait' : 'pointer', padding: '8px 16px', background: 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)', borderRadius: 10, color: '#000', fontWeight: 800, fontSize: 12, opacity: uploadingAvatar ? 0.6 : 1 }}>
                {uploadingAvatar ? 'Enviando...' : '📷 Escolher Foto'}
                <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} style={{ display: 'none' }} />
              </label>
              {editAvatarUrl && (
                <button onClick={function() { setEditAvatarUrl(''); }} style={{ marginTop: 8, background: 'none', border: 'none', color: 'rgba(255,107,107,0.8)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>Remover foto</button>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(201,169,97,0.7)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Cupom (bloqueado)</label>
              <div
                onClick={function() { alert('O cupom nao pode ser alterado depois de criado. Para solicitar mudanca, envie email para contato@joiasmaromba.com.br'); }}
                style={{ width: '100%', padding: '12px 14px', background: 'rgba(201,169,97,0.1)', border: '1px dashed rgba(201,169,97,0.4)', borderRadius: 10, color: '#C9A961', fontSize: 14, fontFamily: 'monospace', letterSpacing: 2, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              >
                <span>{affiliate && affiliate.coupon_code}</span>
                <span style={{ fontSize: 14 }}>🔒</span>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(201,169,97,0.5)', marginTop: 4, lineHeight: 1.4 }}>Cupom nao pode ser alterado. Para solicitar mudanca, envie email para <strong>contato@joiasmaromba.com.br</strong>.</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(201,169,97,0.7)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Nome completo</label>
              <input type="text" value={editName} onChange={function(e) { setEditName(e.target.value); }} style={{ width: '100%', padding: '12px 14px', background: 'rgba(201,169,97,0.05)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(201,169,97,0.7)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Email</label>
              <input type="email" value={editEmail} onChange={function(e) { setEditEmail(e.target.value); }} style={{ width: '100%', padding: '12px 14px', background: 'rgba(201,169,97,0.05)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(201,169,97,0.7)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Telefone / WhatsApp</label>
              <input type="text" value={editPhone} onChange={function(e) { setEditPhone(e.target.value); }} placeholder="(00) 00000-0000" style={{ width: '100%', padding: '12px 14px', background: 'rgba(201,169,97,0.05)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(201,169,97,0.7)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Nova senha (opcional)</label>
              <input type="password" value={editPassword} onChange={function(e) { setEditPassword(e.target.value); }} maxLength={6} placeholder="6 digitos" style={{ width: '100%', padding: '12px 14px', background: 'rgba(201,169,97,0.05)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', letterSpacing: 4 }} />
              <div style={{ fontSize: 10, color: 'rgba(201,169,97,0.5)', marginTop: 4 }}>Deixe em branco para manter a senha atual</div>
            </div>

            {editMessage && (<div style={{ marginBottom: 12, padding: 10, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8, color: '#ff6b6b', fontSize: 12, textAlign: 'center' }}>{editMessage}</div>)}

            <button onClick={saveProfile} disabled={savingProfile || uploadingAvatar} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)', border: 'none', borderRadius: 12, color: '#000', fontWeight: 900, fontSize: 14, cursor: savingProfile ? 'wait' : 'pointer', opacity: (savingProfile || uploadingAvatar) ? 0.6 : 1, boxShadow: '0 4px 20px rgba(201,169,97,0.4)' }}>
              {savingProfile ? 'Salvando...' : '💾 Salvar Alteracoes'}
            </button>
          </div>
        </div>
      )}

      {showTerms && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 11000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(8px)' }}>
          <div style={{ maxWidth: 560, width: '100%', maxHeight: '92vh', overflowY: 'auto', background: 'linear-gradient(180deg, #1a1306 0%, #0f0a03 100%)', border: '2px solid #C9A961', borderRadius: 16, padding: 24, color: '#FFF', boxShadow: '0 20px 80px rgba(201,169,97,0.25)' }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 38 }}>💎</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#C9A961', marginTop: 4, letterSpacing: 1 }}>TERMOS DE CONDUTA</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>Programa de Afiliadas Joias Maromba</div>
            </div>

            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.82)' }}>
              <p style={{ marginBottom: 12 }}>Ao usar o painel e divulgar produtos da marca <strong style={{ color: '#C9A961' }}>Joias Maromba</strong>, você aceita expressamente as regras abaixo. A marca foi construída com anos de dedicação — divulgue com responsabilidade.</p>

              <div style={{ marginBottom: 14, padding: 12, background: 'rgba(201,169,97,0.08)', border: '1px solid rgba(201,169,97,0.3)', borderRadius: 8 }}>
                <div style={{ fontWeight: 800, color: '#C9A961', marginBottom: 6 }}>1. DIVULGAÇÃO HONESTA</div>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  <li>Não faça promessas falsas sobre efeitos, durabilidade ou material das joias.</li>
                  <li>Não invente descontos, promoções, brindes ou condições que não existem.</li>
                  <li><strong style={{ color: '#FFD700' }}>É proibido informar ao cliente desconto superior a 3%</strong> — o valor oficial concedido pelo cupom é de 3% sobre a compra. Divulgar qualquer percentual maior configura propaganda enganosa e gera advertência imediata.</li>
                  <li>Divulgue apenas o site oficial: <strong>joiasmaromba.com.br</strong>. Links falsos, encurtadores suspeitos ou clones são terminantemente proibidos.</li>
                  <li>Use preferencialmente os materiais oficiais fornecidos no painel.</li>
                </ul>
              </div>

              <div style={{ marginBottom: 14, padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8 }}>
                <div style={{ fontWeight: 800, color: '#FCA5A5', marginBottom: 6 }}>2. CONTEÚDO PROIBIDO</div>
                <div style={{ marginBottom: 6 }}>É terminantemente vedado associar a marca a:</div>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  <li>Nudez, conteúdo sexual ou sensual explícito</li>
                  <li>Crianças e adolescentes menores de 18 anos</li>
                  <li>Maus-tratos a animais ou humanos</li>
                  <li>Discurso político partidário ou religioso</li>
                  <li>Discurso de ódio, preconceito, racismo</li>
                  <li>Drogas ilícitas ou apologia a vícios</li>
                </ul>
              </div>

              <div style={{ marginBottom: 14, padding: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 8 }}>
                <div style={{ fontWeight: 800, color: '#FCD34D', marginBottom: 6 }}>3. MEDIDAS DISCIPLINARES</div>
                <div>Em caso de descumprimento, a marca pode:</div>
                <ul style={{ paddingLeft: 18, margin: '4px 0 0 0' }}>
                  <li><strong>NOTIFICAR</strong> você (primeira ocorrência — advertência formal)</li>
                  <li><strong>BANIR DEFINITIVAMENTE</strong> na segunda notificação ou em caso grave</li>
                </ul>
                <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Após banimento, o acesso ao painel é encerrado e comissões pendentes são analisadas caso a caso.</div>
              </div>

              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 14, textAlign: 'center' }}>Ao clicar em <strong style={{ color: '#C9A961' }}>ACEITO</strong> você declara ter lido, compreendido e se comprometido a seguir integralmente estas regras.</p>
            </div>

            <button onClick={acceptTerms} disabled={acceptingTerms} style={{ width: '100%', marginTop: 18, padding: 14, background: 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)', border: 'none', borderRadius: 10, color: '#000', fontWeight: 900, fontSize: 15, letterSpacing: 1, cursor: acceptingTerms ? 'wait' : 'pointer', opacity: acceptingTerms ? 0.6 : 1, boxShadow: '0 4px 20px rgba(201,169,97,0.4)' }}>
              {acceptingTerms ? 'Registrando...' : '✓ ACEITO OS TERMOS'}
            </button>
          </div>
        </div>
      )}

      {!showTerms && pendingNotifications.length > 0 && (function() {
        var n = pendingNotifications[0];
        var isPraise = n.type === 'praise';
        var isWarning = n.type === 'warning';
        var theme = isPraise
          ? { bg: 'linear-gradient(135deg, #059669, #10B981)', border: '#10B981', shadow: 'rgba(16,185,129,0.4)', icon: '🎉', heading: 'PARABÉNS!' }
          : isWarning
          ? { bg: 'linear-gradient(135deg, #7F1D1D, #DC2626)', border: '#DC2626', shadow: 'rgba(220,38,38,0.5)', icon: '⚠️', heading: 'NOTIFICAÇÃO OFICIAL' }
          : { bg: 'linear-gradient(135deg, #1E3A8A, #2563EB)', border: '#3B82F6', shadow: 'rgba(59,130,246,0.4)', icon: '📢', heading: 'AVISO' };
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10500, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ maxWidth: 440, width: '100%', background: '#0F0F0F', borderRadius: 14, overflow: 'hidden', border: '2px solid ' + theme.border, boxShadow: '0 20px 60px ' + theme.shadow }}>
              <div style={{ background: theme.bg, padding: 22, color: '#FFF', textAlign: 'center' }}>
                <div style={{ fontSize: 42, lineHeight: 1 }}>{theme.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6, letterSpacing: 1 }}>{theme.heading}</div>
                {n.title && <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, opacity: 0.9 }}>{n.title}</div>}
              </div>
              <div style={{ padding: 22, color: '#FFF' }}>
                <div style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.9)' }}>{n.message}</div>
                {isWarning && (
                  <div style={{ marginTop: 14, padding: 10, background: 'rgba(220,38,38,0.18)', border: '1px solid rgba(220,38,38,0.5)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#FCA5A5', textAlign: 'center' }}>
                    ⛔ Ao receber outra notificação você será <strong>banida permanentemente</strong> da plataforma.
                  </div>
                )}
                <button onClick={function() { dismissNotification(n.id); }} style={{ width: '100%', marginTop: 16, padding: 13, background: isWarning ? '#DC2626' : isPraise ? '#10B981' : '#3B82F6', border: 'none', borderRadius: 10, color: '#FFF', fontWeight: 800, fontSize: 14, letterSpacing: 0.5, cursor: 'pointer' }}>
                  {isWarning ? 'Entendi e vou corrigir' : isPraise ? 'Obrigada!' : 'Ok, entendi'}
                </button>
                {pendingNotifications.length > 1 && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 10 }}>+{pendingNotifications.length - 1} {pendingNotifications.length - 1 === 1 ? 'mensagem' : 'mensagens'} a seguir</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  </>);
}

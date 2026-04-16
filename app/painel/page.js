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
  const [sales, setSales] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [activeTab, setActiveTab] = useState('painel');
  const [showBonusPopup, setShowBonusPopup] = useState(false);
  const [bonusMilestone, setBonusMilestone] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [latestSale, setLatestSale] = useState(null);
  const [postConfetti, setPostConfetti] = useState(false);
  const [animatedEarnings, setAnimatedEarnings] = useState(0);

  useEffect(() => {
    const id = localStorage.getItem('affiliate_id');
    if (!id) { router.push('/login'); return; }
    loadData(id);
  }, []);

  async function loadData(affiliateId) {
    const { data: dashData } = await supabase.from('affiliate_dashboard').select('*').eq('id', affiliateId).single();
    if (!dashData) { router.push('/login'); return; }
    setAffiliate(dashData);
    const { data: salesData } = await supabase.from('sales').select('*').eq('affiliate_id', affiliateId).order('created_at', { ascending: false }).limit(20);
    setSales(salesData || []);
    const { data: rankData } = await supabase.from('monthly_ranking').select('*').limit(10);
    setRanking(rankData || []);
    const salesCount = dashData.sales_this_month || 0;
    const unlocked = getUnlockedMilestones(salesCount);
    if (unlocked.length > 0) {
      const lastUnlocked = unlocked[unlocked.length - 1];
      const { data: existingBonus } = await supabase.from('bonuses').select('id').eq('affiliate_id', affiliateId).eq('milestone_target', lastUnlocked.target).single();
      if (!existingBonus) {
        setBonusMilestone(lastUnlocked);
        setShowBonusPopup(true);
        await supabase.from('bonuses').insert({ affiliate_id: affiliateId, milestone_target: lastUnlocked.target, bonus_value: lastUnlocked.rewardValue, month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      }
    }
    if (salesData && salesData.length > 0) {
      const newest = salesData[0];
      const timeDiff = Date.now() - new Date(newest.created_at).getTime();
      if (timeDiff < 24 * 60 * 60 * 1000) { setLatestSale(newest); setTimeout(() => setShowToast(true), 1500); }
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!affiliate) return;
    const end = affiliate.earnings_this_month || 0;
    let start = 0;
    const step = end / (1500 / 16);
    const iv = setInterval(() => { start += step; if (start >= end) { start = end; clearInterval(iv); } setAnimatedEarnings(Math.round(start)); }, 16);
    return () => clearInterval(iv);
  }, [affiliate]);

  useEffect(() => {
    const id = localStorage.getItem('affiliate_id');
    if (!id) return;
    const channel = supabase.channel('sales-realtime').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales', filter: 'affiliate_id=eq.' + id }, (payload) => {
      setLatestSale(payload.new); setShowToast(true); setSales(prev => [payload.new, ...prev]);
      setAffiliate(prev => prev ? { ...prev, sales_this_month: (prev.sales_this_month || 0) + 1, earnings_this_month: (prev.earnings_this_month || 0) + (payload.new.commission_earned || 30), earnings_total: (prev.earnings_total || 0) + (payload.new.commission_earned || 30) } : prev);
    }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handlePostConfirm = async () => {
    const id = localStorage.getItem('affiliate_id');
    const now = new Date();
    await supabase.from('posts').insert({ affiliate_id: id, post_type: 'instagram', week_number: Math.ceil(now.getDate() / 7), year: now.getFullYear() });
    setPostConfetti(true);
    setAffiliate(prev => prev ? { ...prev, posts_this_week: (prev.posts_this_week || 0) + 1 } : prev);
    setTimeout(() => setPostConfetti(false), 3000);
  };

  const handleLogout = () => { localStorage.removeItem('affiliate_id'); localStorage.removeItem('affiliate_name'); localStorage.removeItem('affiliate_coupon'); router.push('/login'); };

  if (loading) return (<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontSize: 40, animation: 'pulse 1.5s ease-in-out infinite' }}>💎</div></div>);

  const salesCount = affiliate?.sales_this_month || 0;
  const earnings = affiliate?.earnings_this_month || 0;
  const totalEarnings = affiliate?.earnings_total || 0;
  const postsWeek = affiliate?.posts_this_week || 0;
  const postsRequired = 5;
  const tabs = [{ id: 'painel', label: 'Painel', icon: '🏠' }, { id: 'vendas', label: 'Vendas', icon: '💰' }, { id: 'bonus', label: 'Bonus', icon: '🚀' }, { id: 'ranking', label: 'Ranking', icon: '🏆' }];
  const weekDays = ['Seg','Ter','Qua','Qui','Sex','Sab','Dom'];
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;

  function timeSince(dateStr) { const diff = Date.now() - new Date(dateStr).getTime(); const mins = Math.floor(diff / 60000); if (mins < 60) return 'ha ' + mins + ' min'; const hrs = Math.floor(mins / 60); if (hrs < 24) return 'ha ' + hrs + 'h'; return 'ontem'; }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', position: 'relative' }}>
      {showBonusPopup && bonusMilestone && <BonusPopup milestone={bonusMilestone} onClose={() => setShowBonusPopup(false)} />}
      {showToast && latestSale && <SaleToast sale={latestSale} onClose={() =

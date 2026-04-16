'use client';
import { useState, useEffect } from 'react';

export default function BonusPopup({ milestone, onClose }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 600);
    const t3 = setTimeout(() => setPhase(3), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(145deg, #1a0a2e 0%, #2d1b4e 50%, #1a0a2e 100%)', border: '3px solid #FFD700', borderRadius: 28, padding: '44px 32px 36px', maxWidth: 360, width: '90%', textAlign: 'center', boxShadow: '0 0 80px rgba(255,215,0,0.4)', transform: phase >= 1 ? 'scale(1)' : 'scale(0.3)', opacity: phase >= 1 ? 1 : 0, transition: 'all 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700, #FFA500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, boxShadow: '0 0 40px rgba(255,215,0,0.6)', animation: 'megaPulse 1.5s ease-in-out infinite' }}>{milestone.icon}</div>
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 3, fontWeight: 700, marginBottom: 10, opacity: phase >= 2 ? 1 : 0, transition: 'opacity 0.4s ease 0.2s' }}>PARABENS!</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 12, opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? 'translateY(0)' : 'translateY(10px)', transition: 'all 0.4s ease 0.3s' }}>Voce alcancou {milestone.target} vendas!</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#FFD700', marginBottom: 4, opacity: phase >= 3 ? 1 : 0, transition: 'opacity 0.4s ease 0.5s' }}>VOCE CONQUISTOU MAIS</div>
          <div style={{ fontSize: 56, fontWeight: 900, color: '#00ff88', textShadow: '0 0 30px rgba(0,255,136,0.5)', lineHeight: 1.1, opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? 'scale(1)' : 'scale(0.5)', transition: 'all 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.6s' }}>+{milestone.reward}</div>
          <div style={{ fontSize: 18, color: '#FFD700', marginTop: 4, fontWeight: 800, opacity: phase >= 3 ? 1 : 0, transition: 'opacity 0.4s ease 0.8s' }}>DE BONUS!</div>
          <button onClick={onClose} style={{ marginTop: 28, padding: '14px 44px', background: 'linear-gradient(135deg, #FFD700, #FFA500)', border: 'none', borderRadius: 16, color: '#1a0a2e', fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", boxShadow: '0 4px 24px rgba(255,215,0,0.4)', opacity: phase >= 3 ? 1 : 0, transition: 'opacity 0.4s ease 1s' }}>INCRIVEL!</button>
        </div>
      </div>
    </div>
  );
}

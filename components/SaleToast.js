'use client';

export default function SaleToast({ sale, onClose }) {
  if (!sale) return null;
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, left: 20, zIndex: 9999, background: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 100%)', border: '2px solid #FFD700', borderRadius: 16, padding: '18px 20px', boxShadow: '0 8px 32px rgba(255,215,0,0.3)', animation: 'slideDown 0.5s cubic-bezier(0.34,1.56,0.64,1)', maxWidth: 400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700, #FFA500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, animation: 'megaPulse 1s ease-in-out infinite', flexShrink: 0 }}>💰</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#FFD700', fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700 }}>NOVA VENDA!</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>agora mesmo</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18 }}>X</button>
      </div>
      <div style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>{sale.buyer_name || 'Alguem'} comprou <strong style={{ color: '#FFD700' }}>{sale.product_name}</strong></div>
      <div style={{ color: '#00ff88', fontSize: 22, fontWeight: 800, textShadow: '0 0 20px rgba(0,255,136,0.4)' }}>+R${sale.commission_earned || 30},00 pra voce!</div>
    </div>
  );
}

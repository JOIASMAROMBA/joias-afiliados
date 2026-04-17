'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    const id = localStorage.getItem('affiliate_id');
    if (id) {
      router.push('/painel');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0520 0%, #1a0a2e 40%, #0d0a1a 100%)',
    }}>
      <div style={{ position: 'relative', width: 160, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(201,169,97,0.55) 0%, rgba(201,169,97,0.2) 38%, transparent 70%)', filter: 'blur(26px)', animation: 'diamondGlow 2.2s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: 14, width: 80, height: 10, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(201,169,97,0.55) 0%, transparent 70%)', filter: 'blur(3px)', animation: 'diamondFloor 2.2s linear infinite' }} />
        <div style={{ fontSize: 78, animation: 'diamondSpin 2.2s linear infinite', position: 'relative', zIndex: 1, transformStyle: 'preserve-3d', display: 'inline-block', lineHeight: 1 }}>💎</div>
      </div>
    </div>
  );
}

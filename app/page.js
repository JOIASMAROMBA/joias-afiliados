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
      <div style={{ fontSize: 40, animation: 'pulse 1.5s ease-in-out infinite' }}>💎</div>
    </div>
  );
}

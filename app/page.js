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
      background: '#000',
    }}>
      <div style={{ fontSize: 78, animation: 'diamondSpin 2.2s linear infinite', display: 'inline-block', lineHeight: 1 }}>💎</div>
    </div>
  );
}

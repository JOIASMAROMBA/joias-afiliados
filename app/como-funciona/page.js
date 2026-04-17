'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ComoFuncionaPage() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState(null);

  const steps = [
    {
      n: '01',
      title: 'Cadastre-se',
      desc: 'É grátis, leva 1 minuto. Preencha seus dados e já sai com seu cupom ativo.',
      icon: '✦',
      color: '#C9A961',
    },
    {
      n: '02',
      title: 'Escolha seu cupom',
      desc: 'Crie um código único — ex: SEUNOME15. Ele será sua identidade nas vendas.',
      icon: '$',
      color: '#E8CF8B',
      isTicket: true,
    },
    {
      n: '03',
      title: 'Pegue nosso material exclusivo',
      desc: 'No painel você baixa fotos e vídeos prontos das joias, selecionados para bombar nas redes.',
      icon: '◆',
      color: '#C9A961',
    },
    {
      n: '04',
      title: 'Divulgue nas suas redes',
      desc: 'Posta no Instagram, TikTok, Facebook, Stories. Sua rede de contatos vira seu cliente.',
      icon: '◈',
      color: '#C9A961',
    },
    {
      n: '05',
      title: 'Venda e ganhe R$25',
      desc: 'Cada peça vendida usando seu cupom = R$25 direto na sua conta. Sem teto, sem limite.',
      icon: '◇',
      color: '#E8CF8B',
    },
    {
      n: '06',
      title: 'Receba via PIX em até 24h',
      desc: 'Solicite saque quando quiser. Cai no seu PIX em até 24 horas, automaticamente.',
      icon: '⚡',
      color: '#C9A961',
    },
  ];

  const benefits = [
    { icon: '✓', title: 'Zero investimento', desc: 'Nada pra pagar, nada pra comprar. Só divulga.' },
    { icon: '✓', title: 'Material pronto', desc: 'Fotos e vídeos exclusivos toda semana.' },
    { icon: '✓', title: 'Comissão justa', desc: 'R$25 por peça vendida, sem pegadinha.' },
    { icon: '✓', title: 'Saque rápido', desc: 'PIX em 24h, quando você pedir.' },
    { icon: '✓', title: 'Sem meta obrigatória', desc: 'Você escolhe quanto postar, quanto ganhar.' },
    { icon: '✓', title: 'Suporte dedicado', desc: 'A gente tá junto pra você bombar.' },
  ];

  const faqs = [
    { q: 'Preciso pagar alguma coisa?', a: 'Não. O cadastro é 100% gratuito. Você não compra, não paga taxa, nada.' },
    { q: 'Como recebo?', a: 'Pelo PIX. Quando quiser solicitar saque (valor mínimo R$10), cai em até 24 horas direto na sua chave PIX.' },
    { q: 'Tem meta de vendas?', a: 'Não existe meta obrigatória. Você vende o quanto quiser e recebe por cada venda realizada com seu cupom.' },
    { q: 'E se eu não vender?', a: 'Sem problema. Não há multa nem cobrança. O cadastro e o acesso continuam gratuitos.' },
    { q: 'Como as pessoas usam meu cupom?', a: 'Elas colocam seu código no momento da compra no site. O desconto aparece pra ela e a comissão fica pra você.' },
    { q: 'Posso ver quanto vendi?', a: 'Sim. Seu painel mostra em tempo real cada venda, comissão acumulada, saldo disponível e histórico.' },
  ];

  const styles = {
    root: {
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'SF Pro Display', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    },
    gridBg: {
      position: 'fixed',
      inset: 0,
      backgroundImage: 'linear-gradient(rgba(201,169,97,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,97,0.04) 1px, transparent 1px)',
      backgroundSize: '80px 80px',
      pointerEvents: 'none',
      zIndex: 0,
    },
    glow: {
      position: 'fixed',
      top: '20%', left: '50%',
      width: 800, height: 800,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(201,169,97,0.08) 0%, transparent 70%)',
      transform: 'translateX(-50%)',
      pointerEvents: 'none',
      zIndex: 0,
      filter: 'blur(20px)',
    },
    content: {
      position: 'relative',
      zIndex: 1,
      maxWidth: 1200,
      margin: '0 auto',
      padding: '40px 24px',
    },
  };

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatSlow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes shimmerGold {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .step-card { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .step-card:hover { transform: translateY(-4px); border-color: rgba(201,169,97,0.4) !important; box-shadow: 0 20px 40px rgba(201,169,97,0.1); }
        .benefit-card { transition: all 0.3s; }
        .benefit-card:hover { background: rgba(201,169,97,0.05); border-color: rgba(201,169,97,0.25); }
        .faq-item { transition: all 0.3s; }
        .cta-button { transition: all 0.3s; }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(201,169,97,0.4); }
        @media (min-width: 900px) {
          .steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
          .benefits-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
          .hero-title { font-size: 64px !important; }
          .hero-subtitle { font-size: 18px !important; }
          .section-title { font-size: 42px !important; }
        }
        @media (max-width: 899px) {
          .steps-grid, .benefits-grid { display: flex; flex-direction: column; gap: 14px; }
        }
      `}</style>

      <div style={styles.gridBg} />
      <div style={styles.glow} />

      <div style={styles.content}>
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 60, padding: '8px 0' }}>
          <img src="/logo.png" alt="Joias Maromba" style={{ height: 56, opacity: 0.9, filter: 'drop-shadow(0 2px 12px rgba(201,169,97,0.3))' }} />
          <button onClick={() => router.push('/login')} style={{ background: 'transparent', border: '1px solid rgba(201,169,97,0.4)', borderRadius: 10, padding: '10px 20px', color: '#C9A961', fontSize: 13, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', textTransform: 'uppercase' }}>Entrar</button>
        </nav>

        <section style={{ textAlign: 'center', padding: '40px 0 80px', animation: 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <div style={{ display: 'inline-block', padding: '6px 14px', background: 'rgba(201,169,97,0.08)', border: '1px solid rgba(201,169,97,0.25)', borderRadius: 999, marginBottom: 20 }}>
            <span style={{ fontSize: 11, color: '#C9A961', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase' }}>◆ Programa de Afiliadas</span>
          </div>
          <h1 className="hero-title" style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05, margin: 0, marginBottom: 20 }}>
            Ganhe <span style={{ background: 'linear-gradient(135deg, #E8CF8B, #C9A961, #8B6914)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>R$ 25</span> por venda
            <br />divulgando nossas joias
          </h1>
          <p className="hero-subtitle" style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', maxWidth: 620, margin: '0 auto 36px', lineHeight: 1.6 }}>
            Sem investimento. Sem meta. Sem pegadinha. Se cadastre agora e comece a faturar divulgando joias exclusivas pra sua rede.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="cta-button" onClick={() => router.push('/cadastro')} style={{ background: 'linear-gradient(135deg, #E8CF8B 0%, #C9A961 50%, #8B6914 100%)', border: '1px solid rgba(201,169,97,0.6)', borderRadius: 10, padding: '16px 32px', color: '#1a1306', fontWeight: 700, fontSize: 15, letterSpacing: 0.5, cursor: 'pointer', boxShadow: '0 8px 24px rgba(201,169,97,0.3)' }}>Começar agora →</button>
            <button className="cta-button" onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '16px 32px', color: '#fff', fontWeight: 600, fontSize: 15, letterSpacing: 0.5, cursor: 'pointer' }}>Ver como funciona</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginTop: 56, flexWrap: 'wrap' }}>
            {[{ v: 'R$25', l: 'por venda' }, { v: '24h', l: 'pagamento' }, { v: '0', l: 'investimento' }].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, background: 'linear-gradient(135deg, #E8CF8B, #C9A961)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: -1 }}>{s.v}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="como-funciona" style={{ padding: '60px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, color: '#C9A961', letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>Passo a passo</div>
            <h2 className="section-title" style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: -1 }}>Como funciona</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', maxWidth: 500, margin: '12px auto 0' }}>Em 6 passos simples você já está ganhando comissão.</p>
          </div>

          <div className="steps-grid">
            {steps.map((s, i) => (
              <div key={i} className="step-card" style={{ background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 28, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 16, right: 20, fontSize: 42, fontWeight: 900, color: 'rgba(201,169,97,0.12)', letterSpacing: -2 }}>{s.n}</div>
                <div style={{ width: 56, height: 56, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'rgba(201,169,97,0.08)', border: '1px solid rgba(201,169,97,0.2)', position: 'relative' }}>
                  {s.isTicket ? (
                    <div style={{ position: 'relative', background: '#C9A961', borderRadius: 5, width: 42, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ position: 'absolute', left: -5, top: '50%', transform: 'translateY(-50%)', width: 9, height: 9, borderRadius: '50%', background: 'rgba(15,15,15,0.95)' }}></span>
                      <span style={{ position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)', width: 9, height: 9, borderRadius: '50%', background: 'rgba(15,15,15,0.95)' }}></span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: '#000' }}>$</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 26, color: s.color, fontWeight: 900, filter: 'drop-shadow(0 0 8px rgba(201,169,97,0.4))' }}>{s.icon}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#C9A961', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Passo {s.n}</div>
                <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0, marginBottom: 8, letterSpacing: -0.3 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: '60px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 11, color: '#C9A961', letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>Vantagens</div>
            <h2 className="section-title" style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: -1 }}>Por que ser afiliada?</h2>
          </div>
          <div className="benefits-grid">
            {benefits.map((b, i) => (
              <div key={i} className="benefit-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: 'rgba(201,169,97,0.15)', border: '1px solid rgba(201,169,97,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A961', fontWeight: 900, fontSize: 13 }}>{b.icon}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: '60px 0', maxWidth: 760, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 11, color: '#C9A961', letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>Dúvidas</div>
            <h2 className="section-title" style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: -1 }}>Perguntas frequentes</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {faqs.map((f, i) => (
              <div key={i} className="faq-item" style={{ background: 'rgba(15,15,15,0.6)', backdropFilter: 'blur(40px)', border: '1px solid ' + (openFaq === i ? 'rgba(201,169,97,0.3)' : 'rgba(255,255,255,0.06)'), borderRadius: 12, overflow: 'hidden' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', padding: '18px 20px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{f.q}</span>
                  <span style={{ fontSize: 20, color: '#C9A961', transition: 'transform 0.3s', transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0)', flexShrink: 0 }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 20px 18px', fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, animation: 'fadeInUp 0.3s ease' }}>{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: '60px 0 80px', textAlign: 'center' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(201,169,97,0.1), rgba(201,169,97,0.02))', border: '1px solid rgba(201,169,97,0.25)', borderRadius: 24, padding: '56px 32px', maxWidth: 720, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -100, left: '50%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,169,97,0.15) 0%, transparent 70%)', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, color: '#C9A961', letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase', marginBottom: 14 }}>◆ Pronta para começar?</div>
              <h2 style={{ fontSize: 32, fontWeight: 800, margin: 0, marginBottom: 12, letterSpacing: -1 }}>Sua primeira venda está a <span style={{ color: '#C9A961' }}>1 clique</span></h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', maxWidth: 440, margin: '0 auto 28px', lineHeight: 1.6 }}>Leva 1 minuto pra se cadastrar. É grátis. Você sai do cadastro já com seu cupom e começa a divulgar hoje.</p>
              <button className="cta-button" onClick={() => router.push('/cadastro')} style={{ background: 'linear-gradient(135deg, #E8CF8B 0%, #C9A961 50%, #8B6914 100%)', border: '1px solid rgba(201,169,97,0.6)', borderRadius: 10, padding: '18px 40px', color: '#1a1306', fontWeight: 800, fontSize: 16, letterSpacing: 0.5, cursor: 'pointer', boxShadow: '0 12px 32px rgba(201,169,97,0.35)' }}>Quero me cadastrar →</button>
              <div style={{ marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>🔒 Cadastro 100% gratuito · Sem cartão · Sem compromisso</div>
            </div>
          </div>
        </section>

        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '30px 0 20px', textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: 1 }}>
          <div style={{ marginBottom: 6 }}>JOIAS MAROMBA · JV9 COMPANY LTDA · CNPJ 46.368.706/0001-01</div>
          <div>© 2026 Todos os direitos reservados</div>
        </footer>
      </div>
    </div>
  );
}

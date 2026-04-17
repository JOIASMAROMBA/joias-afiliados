import './globals.css';

export const metadata = {
  title: 'Painel de Afiliados | Joias',
  description: 'Divulgue e ganhe R$25 por peça vendida',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#000000',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" style={{ background: '#000' }}>
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Joias Afiliados" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="manifest" href="/manifest.json" />
        <style dangerouslySetInnerHTML={{ __html: 'html,body{background:#000 !important;}' }} />
      </head>
      <body style={{ background: '#000', margin: 0 }}>{children}</body>
    </html>
  );
}

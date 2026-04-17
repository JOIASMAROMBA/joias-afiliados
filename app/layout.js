import './globals.css';

export const metadata = {
  title: 'Painel de Afiliados | Joias',
  description: 'Divulgue e ganhe R$25 por peça vendida',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" style={{ background: '#000' }}>
      <head>
        <meta name="theme-color" content="#000000" />
        <style dangerouslySetInnerHTML={{ __html: 'html,body{background:#000 !important;}' }} />
      </head>
      <body style={{ background: '#000', margin: 0 }}>{children}</body>
    </html>
  );
}

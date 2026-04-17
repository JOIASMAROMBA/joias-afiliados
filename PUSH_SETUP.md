# Setup de Notificacoes Push - Joias Maromba Afiliados

## 1. Rodar o SQL no Supabase
SQL Editor > cole e execute o conteudo de `supabase_push_setup.sql`.

## 2. Adicionar 4 variaveis de ambiente no Vercel
Project Settings > Environment Variables (Production + Preview + Development):

```
VAPID_PUBLIC_KEY=BL2I8D4Y8SFowCjmZ2r-nQwmsRvqLHIp-HHYMOuTU3LZv2wSpMk9wJ7bPNa1jDybLrphg8K3kwc_vMJ4amkoCfA
VAPID_PRIVATE_KEY=T4fWBczyuj_3C3IfedFq9M27rWwN8CgbTPIpYd5u8oo
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BL2I8D4Y8SFowCjmZ2r-nQwmsRvqLHIp-HHYMOuTU3LZv2wSpMk9wJ7bPNa1jDybLrphg8K3kwc_vMJ4amkoCfA
VAPID_SUBJECT=mailto:renanforumn@gmail.com
```

Depois Redeploy (trigger manual no Vercel ou push qualquer).

## 3. Testar
- Abrir https://joias-afiliados-12hf.vercel.app/painel num Android/Chrome desktop
- Banner dourado "Receba aviso na hora da venda" aparece no topo > clicar ATIVAR
- Permitir notificacoes
- Fazer uma venda de teste (ou chamar o webhook manualmente) e verificar se o popup chega mesmo com aba fechada

## 4. iOS (importante)
iPhone SO recebe push se:
- iOS 16.4 ou superior
- Afiliada abre Safari > botao Compartilhar > "Adicionar a Tela de Inicio"
- Abre o icone na home screen e entao ativa notificacoes pelo banner

Sem esse passo, o botao "ATIVAR" nao faz nada no iPhone.

## 5. Trocar o icone (opcional)
Hoje o manifest usa /logo.png. Para melhor qualidade, gerar 2 PNGs quadrados:
- public/icon-192.png (192x192)
- public/icon-512.png (512x512)
E atualizar public/manifest.json + app/layout.js para apontar para eles.

# Roadmap

## Simplificação visual
- [ ] Organizar navegação, saldo e posições; separar controles do robô e recolher detalhes extras
- [ ] Conferir navegação e aparência no celular e computador
- [ ] Exclusões definitivas de funções — aguardando indicação do usuário

## Em andamento
- [ ] Aba Pesquisa (chat de pesquisa de estratégias, somente leitura)
  - [x] Tabelas strategy_leads + audit_log (RLS admin)
  - [x] Agente de pesquisa dentro do serviço ai-market-analysis (sem chaves de exchange; sem apagar TradingView)
  - [x] Front-end: aba Pesquisa (chat, URLs, ficha, leads)
  - [x] Deploy + bloqueio sem login testado (401)
  - [ ] Pesquisa real logado — não testável aqui (backend externo); usuário testar
- [x] .env: plataforma exige que fique versionado (só chaves públicas)

## Pendências antigas
- [x] Chave Bybit padrão: HMAC publicado, RSA removido/desativado; saldo e posições reais verificados no painel, sem enviar ordens
- [ ] Chat de trading: testar com IA real (Groq)
- [x] Alertas de acesso a tabelas corrigidos (resta: senhas vazadas = plano Pro do Supabase)
- [ ] B3 (WINZ25/WDOF26) não operacional — migração b3_* nunca aplicada
- [ ] FreeLLMAPI sem endereço público (Cloudflare Tunnel pendente)

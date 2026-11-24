# Roadmap

## Em andamento
- [ ] Aba Pesquisa (chat de pesquisa de estratégias, somente leitura)
  - [x] Tabelas strategy_leads + audit_log (RLS admin)
  - [ ] Agente de pesquisa dentro do serviço ai-market-analysis (sem chaves de exchange; sem apagar TradingView)
  - [ ] Front-end: aba Pesquisa (chat, URLs, ficha, leads)
  - [ ] Deploy e teste (401/403, rate limit, ficha válida)
- [ ] .env: remover do versionamento + criar .env.example (.gitignore é gerenciado pela plataforma — pendente)

## Pendências antigas
- [ ] Chave Bybit expirada — usuário criar Subconta de IA e cadastrar nova chave
- [ ] Chat de trading: testar com IA real (Groq)
- [ ] 40 alertas de segurança no banco (senhas vazadas desligada etc.)
- [ ] B3 (WINZ25/WDOF26) não operacional — migração b3_* nunca aplicada
- [ ] FreeLLMAPI sem endereço público (Cloudflare Tunnel pendente)

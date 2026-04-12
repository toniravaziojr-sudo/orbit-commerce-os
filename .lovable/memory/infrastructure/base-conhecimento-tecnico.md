# Memory: infrastructure/base-conhecimento-tecnico
Updated: 2026-04-12

Base de Conhecimento Técnico do sistema (doc completo em docs/tecnico/base-de-conhecimento-tecnico.md). Registra problemas→soluções, anti-patterns e decisões arquiteturais. DEVE ser consultado antes de qualquer correção ou implementação.

## Lições Registradas (resumo):
1. **useEffect + array derivado** → loop infinito, UI não responde → usar useMemo + useRef flag
2. **Valores hardcoded em edge functions** → buscar do banco por tenant
3. **CHECK constraint com now()** → usar triggers de validação
4. **PIX/Boleto expiração** → 100% via API (Pagar.me: expires_in, MP: date_of_expiration)
5. **Parcelamento cartão** → 100% via API em ambos gateways
6. **Schemas reservados Supabase** → nunca alterar (auth, storage, realtime, etc)
7. **Cron** → fallback apenas, nunca fluxo primário
8. **Memória IA** → nunca memorizar diagnósticos da IA, só fatos explícitos do usuário
9. **payment_method_discounts** → fonte unificada de descontos + parcelas + expiração
10. **WhatsApp Meta** → sempre System User Token, verificar WABA produção vs teste, Cloudflare Worker sincronizado
11. **Builder defaults** → templates salvos no DB sobrescrevem defaults novos do código
12. **Queries de menu** → nunca usar .limit() arbitrário
13. **Formulários de entidade** → sempre incluir campo de upload se a tabela tem coluna de imagem
14. **Frete com valor zero** → logar falhas dos provedores claramente, nunca retornar R$0 silenciosamente
15. **Fluxos de campanha** → Blog e Mídia Social devem ser separados (prop campaignType)

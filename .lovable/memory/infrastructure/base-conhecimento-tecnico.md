# Memory: infrastructure/base-conhecimento-tecnico
Updated: 2026-04-12

Base de Conhecimento Técnico do sistema (doc completo em docs/tecnico/base-de-conhecimento-tecnico.md). Registra problemas→soluções, anti-patterns e decisões arquiteturais. DEVE ser consultado antes de qualquer correção ou implementação.

Principais lições registradas:
1. useEffect com array derivado como dep → loop infinito (usar useMemo + useRef flag)
2. Valores hardcoded em edge functions → buscar do banco por tenant
3. CHECK constraints com now() → usar triggers
4. Expiração PIX/Boleto é controlada 100% via API (Pagar.me: expires_in, MP: date_of_expiration)
5. Parcelamento cartão é 100% via API em ambos gateways
6. Nunca alterar schemas reservados do Supabase
7. Cron é fallback, não fluxo primário
8. Nunca memorizar diagnósticos de IA automaticamente
9. payment_method_discounts é fonte unificada de descontos + parcelas + expiração
10. Billing SaaS vs Vendas do Lojista são completamente isolados

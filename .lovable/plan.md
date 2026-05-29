# Plano — Migração das abas de Logística

## Checklist
- Docs lidos: `docs/especificacoes/erp/logistica.md`, `docs/especificacoes/sistema/configuracoes.md`, `docs/especificacoes/sistema/hub-integracoes.md`, `docs/especificacoes/transversais/mapa-ui.md`.
- Regra crítica do hub-integracoes ("apenas configuração de conexão do tenant, sem operações") → respeitada: a aba nova em Integrações é cards de credenciais de transportadoras do lojista.
- Sem mudança de regra de negócio, banco, edge function ou contrato. Apenas realocação de UI.

## Migrações

1. **Meios de Transporte** sai de `/shipping` → vira aba **"Meios de Envio"** em `/integrations` (logo após Pagamentos). Reusa o componente atual de cards/credenciais.
2. **Conversão de Carrinho** (sub-aba de Frete Grátis) sai de `/shipping` → vira aba **"Conversão de Carrinho"** em **Aumentar Ticket** (`/offers`), após "Variações".
3. **Frete Grátis** (regras + método padrão) e **Frete Personalizado** saem de `/shipping` → ambas viram sub-abas de uma nova aba **"Meios de Envio"** em **Configurações** (`/system/settings`), ao lado de "Pagamentos" e "Fiscal".
4. Módulo **Logística** passa a ter apenas Dashboard · Remessas · Rastreios.

## Compatibilidade (redirects)
- `/shipping?tab=meios-transporte` → `/integrations?tab=shipping`
- `/shipping?tab=frete-gratis` → `/system/settings?tab=shipping&aba=regras-frete-gratis`
- `/shipping?tab=frete-personalizado` → `/system/settings?tab=shipping&aba=frete-personalizado`

## Validação técnica
- Cada nova aba carrega sem erro e mantém CRUD original.
- URLs antigas redirecionam corretamente.
- Build limpo (sem imports órfãos, sem TS error).

## Documentação a atualizar
- `mapa-ui.md`, `erp/logistica.md`, `sistema/configuracoes.md`, `sistema/hub-integracoes.md`.

Status: aprovado → executando.



## 📋 CHECKLIST DE CONFORMIDADE
- ✅ Doc de Regras do Sistema considerado (Layer 2)
- ✅ Docs formais identificados por camada
- ✅ Fluxo afetado: Storefront público → Carrinho → Checkout
- ✅ Fonte de verdade: Cloudflare Worker `shops-router` + `storefront_prerendered_pages` + `storefront-html`
- ✅ Módulos impactados: Storefront, Checkout, Carrinho, Catálogo, Builder
- ✅ Impacto cruzado: todas as lojas com domínio próprio
- ✅ UI impactada: Não (sem mudança de tela; `mapa-ui.md` não precisa atualizar)
- 📌 Situação: Aguardando confirmação para executar

---

## 🛠️ PLANO DE CORREÇÃO (mantido)

**Frente 1 — Reativar entrega de HTML pronto pelo Worker [CRÍTICO]**  
Corrigir `shops-router` para chamar a renderização antes de cair no SPA vazio. Impacto: -70-80% no tempo de exibição.

**Frente 2 — Recriar e manter o cache vivo [CRÍTICO]**  
Regerar todas as páginas obsoletas + cron diário de saúde + alerta quando >20% ficar obsoleto. Impacto: elimina geração ao vivo de 3,7s.

**Frente 3 — Corrigir bug silencioso da coluna inexistente [ALTO]**  
Localizar e corrigir a consulta com referência à coluna `position` que não existe.

**Frente 4 — Esqueleto HTML para checkout/carrinho [MÉDIO]**  
Servir esqueleto visual no primeiro byte + pré-anunciar pacote do checkout. Impacto: elimina tela branca de 1-2s.

**Frente 5 — Otimizar componente de checkout [MÉDIO/baixo prazo, rodada separada]**  
Quebrar em pedaços sob demanda + adiar scripts secundários. Impacto: +200-400ms na primeira interação.

**Sequência de execução:** Frente 3 → Frente 2 → Frente 1 → medição → Frente 4 → (Frente 5 em rodada separada)

---

## ✅ VALIDAÇÃO TÉCNICA OBRIGATÓRIA

Para cada frente, antes de declarar concluída:

| Validação | Critério |
|---|---|
| HTML real entregue na primeira visita | >100KB (não 951b) |
| Tempo até primeiro byte (TTFB) | <800ms |
| Tempo até conteúdo visível | <1,5s (vs 4-6s hoje) |
| Cache funcionando | Cabeçalho indicando modo "pré-renderizado" |
| Checkout sem tela branca | Primeiro pixel <500ms |
| Sem regressão | Testar 3 tenants (Respeite o Homem + 2 outros) |
| Sem regressão no admin | Painel administrativo navegável |
| Sem regressão em formulários | Carrinho → checkout → seleção de pagamento |
| Logs de erro 24h | Sem aumento de taxa de erro |

**Comparativo antes/depois real:** vou medir 3 lojas em 5 páginas críticas (home, categoria, produto, carrinho, checkout) antes e depois e entregar tabela com ganhos efetivos.

---

## 📝 DOCUMENTAÇÃO (CORRIGIDA — TUDO NOS DOCS FORMAIS)

**Layer 2 — Doc de Regras do Sistema** (`docs/REGRAS-DO-SISTEMA.md`)
- Adicionar regra macro: "Contrato Worker ↔ HTML pré-renderizado: o Worker deve sempre tentar entregar HTML pré-renderizado antes de qualquer fallback para SPA"
- Adicionar regra macro: "Saúde do cache de pré-renderização é obrigatória — taxa de páginas obsoletas não pode ultrapassar 20% sem alerta"

**Layer 3 — Especificação Storefront** (`docs/especificacoes/storefront/`)
- Atualizar arquitetura Content-First: contrato Worker, fallbacks, ordem de tentativa
- Atualizar Pipeline de Revalidação: incluir cron diário de saúde + critérios de alerta
- Documentar fluxo completo: requisição → Worker → cache → fallback ao vivo → SPA

**Layer 3 transversal — Padrões Operacionais** (`docs/especificacoes/transversais/padroes-operacionais.md`)
- Adicionar padrão de monitoramento de saúde de cache (regra geral aplicável a outros caches)

**Layer 5 — Base de Conhecimento Técnico** (`docs/tecnico/base-de-conhecimento-tecnico.md`)
- Registrar lição: bug da coluna `position` inexistente → causa → solução → como evitar

**Layer 5 — Incidente** (novo arquivo: `docs/tecnico/incidentes/2026-04-storefront-checkout-lentidao.md`)
- Problema → diagnóstico → causa raiz → correção aplicada → validação técnica → métricas antes/depois → lições

**Layer 6 — Memória (apenas UMA, curta, anti-regressão)**
- `mem://constraints/storefront-worker-prerender-bypass` — lembrete curto para mim: "Nunca aceitar HTML <2KB do Worker em rota pública sem investigar bypass do pré-render. Doc oficial: ver Layer 2 e Layer 3 Storefront."
- Atualizar `mem://index.md` referenciando essa nova memória

**Mapa de UI:** sem mudança de tela → `mapa-ui.md` não precisa ser atualizado.

---

## ⏱️ EXECUÇÃO

Frentes 1 a 4 + documentação completa em uma rodada (~45-60 min).  
Frente 5 em rodada separada após validação das anteriores.

**Risco:** Médio. Toda mudança validada antes de declarar concluída. Lojas continuam vendendo durante a correção.

📌 **STATUS:** Aguardando sua confirmação para executar.


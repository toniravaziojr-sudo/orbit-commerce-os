
## Pensamento

📋 CHECKLIST DE CONFORMIDADE:
- Doc de Regras do Sistema: pendente releitura na execução
- Doc formal do tema: `docs/especificacoes/marketing/meta-tracking.md` + memórias `infrastructure/marketing/meta-tracking-standard` (v8.26.0) e `constraints/meta-tracking-quality-strategy` — referenciados
- Fluxo afetado: emissão Pixel + CAPI (PageView, ViewContent, AddToCart, Lead, Purchase) e ciclo de vida do evento Purchase na página de obrigado
- Fonte de verdade: cookies `_fbp`/`_fbc` + `_sf_vid` (navegador) + `marketing_events_log` (server) + `store_settings.checkout_config.purchaseEventTiming` (configuração soberana do tenant)
- Módulos impactados: ThankYouContent, useMarketingEvents, marketingTracker, MarketingTrackerProvider, edge `meta-capi`, edge `storefront-html`
- Impacto cruzado: qualquer alteração em CAPI afeta TODOS os tenants (não só `respeiteohomem`) — exige cuidado anti-regressão dobrado
- UI impactada: não
- Situação: Plano aprovado pelo usuário — execução autorizada

---

## Princípio de Segurança (anti-regressão)

**Não vou mexer em:**
- ❌ `purchaseEventTiming` de nenhum tenant (regra soberana do dono da loja).
- ❌ Padrão global do sistema (continua como está).
- ❌ Lógica de quando disparar Purchase (continua governada pelo modo do tenant).
- ❌ Estrutura de eventos existentes que já funcionam.

**Vou mexer apenas em:**
- ✅ Persistência do controle de "já disparei" (memória → localStorage).
- ✅ Formato do `event_id` (padronização sem quebrar histórico).
- ✅ Captura/persistência de `_fbp` e `_fbc` no servidor (adição, não substituição).
- ✅ Enriquecimento de `user_data` em ViewContent/AddToCart quando contato já existir (adição).
- ✅ Garantia de `client_ip_address` correto (CF-Connecting-IP) e `client_user_agent` em 100% das chamadas CAPI.

---

## Execução em Etapas

### Etapa 1 — Frente A (persistência do dedup do Purchase)
- Trocar `purchaseTrackedRef` (useRef) por verificação em `localStorage` no `ThankYouContent.tsx`.
- Chave: `sf_purchase_fired_<tenant>_<orderNumber>`, valor: timestamp ISO.
- TTL de 30 dias com limpeza automática de chaves antigas no carregamento.
- Antes de chamar `trackPurchase`, checar se já existe a chave; se sim, log silencioso e retorno.
- Vale tanto para Pixel (browser) quanto CAPI (server) porque ambos saem do mesmo ponto.

### Etapa 2 — Frente B (normalização de `event_id`)
- Centralizar no `generateDeterministicPurchaseEventId` o formato único: `purchase_<modo>_<numero_limpo>`.
- `numero_limpo` = só dígitos (remove `#`, espaço, hífen).
- Mesmo cálculo aplicado no edge `meta-capi` (server) para garantir paridade absoluta browser↔server.
- Não alterar eventos antigos no log — só os novos passam a sair no formato único.

### Etapa 3 — Frente E1+E2 (`_fbp` e `_fbc` sintéticos no edge)
- Em `storefront-html`, ao renderizar a primeira página da sessão:
  - Ler cookie `_fbp` da request. Se vazio, gerar sintético `fb.1.<timestamp_ms>.<random>` e gravar via `Set-Cookie` (Path=/, HttpOnly=false, SameSite=Lax, Max-Age=90 dias).
  - Detectar `?fbclid=` na URL; se presente, montar `_fbc` no formato `fb.1.<timestamp_ms>.<fbclid>` e gravar via `Set-Cookie` com mesmas regras.
- O navegador encontra os cookies já prontos no primeiro carregamento → `fbq('init')` respeita → todas as chamadas CAPI subsequentes têm `_fbp`/`_fbc` reais.

### Etapa 4 — Frente E3 (enriquecimento `user_data` em meio de funil)
- No `useMarketingEvents`, quando `ViewContent` ou `AddToCart` for disparado e o cliente já tiver contato capturado em `checkout_sessions` ou estiver logado:
  - Passar `userData` (email, phone, name, city, state, zip) hashed via SHA-256 no edge `meta-capi`.
- Se não houver contato, comportamento atual permanece (sem `user_data`).
- Lead e Purchase já fazem isso — só estendendo para os 2 eventos de meio de funil.

### Etapa 5 — Frente E4 (IP e User-Agent corretos no CAPI)
- No edge `meta-capi`, garantir extração de:
  - `client_ip_address` = `req.headers.get('CF-Connecting-IP')` (fallback `X-Forwarded-For` primeira parte, fallback `X-Real-IP`).
  - `client_user_agent` = `req.headers.get('User-Agent')` da request original (não do servidor).
- Validar que ambos vão em 100% das chamadas, sem exceção.

### Etapa 6 — Validação Técnica Final (obrigatória)
Vou executar (no tenant `respeiteohomem`):
1. Consulta SQL: contar pedidos reais hoje em fuso BRT, conferir contagem 1:1 com painel.
2. Consulta SQL: verificar últimos 20 eventos no `marketing_events_log` após deploy — confirmar formato único de `event_id` e presença de `_fbp` no payload.
3. Simular reabertura da página de obrigado de um pedido recente — confirmar que NÃO gera novo registro no log.
4. Conferir logs do edge `meta-capi` — confirmar `client_ip_address` (formato Cloudflare) e `client_user_agent` (string de browser real) em 100% das requests.
5. Conferir logs do edge `storefront-html` — confirmar Set-Cookie de `_fbp`/`_fbc` em primeira visita.

Bloco obrigatório:
```
🔍 VALIDAÇÃO TÉCNICA EXECUTADA:
- [item testado]
- [resultado: ✅ | ❌]
- [pendência do usuário, se aplicável]
```

### Etapa 7 — Documentação completa (governança)
1. **`docs/especificacoes/marketing/meta-tracking.md`** (Layer 3):
   - Nova seção: "Regras de Emissão do Evento Purchase" — ambos os modos válidos, persistência 30d obrigatória, formato único de `event_id`.
   - Nova seção: "Estratégia de Cobertura de Identificadores" — `_fbp`/`_fbc` sintéticos no edge, `user_data` em meio de funil, IP/UA corretos.
   - Nova seção: "Tabela de Causas Comuns de Inflação Aparente vs Real".
   - Changelog: registrar correção de hoje (data, sintoma, causa, fix, impacto medido).

2. **`docs/especificacoes/storefront/pagina-obrigado.md`** (Layer 3):
   - Contrato "1 disparo por pedido por dispositivo (30d)".

3. **`.lovable/memory/constraints/purchase-event-emission-rules.md`** (memória anti-regressão NOVA):
   - Regra 1: persistência 30d obrigatória no `localStorage`.
   - Regra 2: `event_id` formato único `purchase_<modo>_<numero_limpo>`.
   - Regra 3: `purchaseEventTiming` é soberania do tenant — proibido alterar sem autorização explícita.
   - Regra 4: antes de declarar inflação, conferir BRT e dedup Pixel↔CAPI (2 eventos = 1 conversão).

4. **`.lovable/memory/constraints/meta-tracking-quality-strategy.md`** (atualização):
   - Adicionar as 4 técnicas: cookie sintético `_fbp`, captura `fbclid`, `user_data` em meio de funil, `CF-Connecting-IP` obrigatório.

5. **`.lovable/memory/infrastructure/marketing/meta-tracking-standard.md`** (bump versão):
   - v8.26.0 → v8.27.0 com referência às novas regras.

6. **`.lovable/memory/governance/recent-topics.md`**: rotacionar slot (auditando antes se já está nos docs).

7. **`docs/REGRAS-DO-SISTEMA.md`** (Layer 2):
   - Regra macro nova: "Eventos de marketing devem ter cobertura ≥95% de identificadores próprios da plataforma (`_fbp`/`_fbc` para Meta) — IP é sinal complementar, nunca primário."

---

## Bloco de fechamento obrigatório

Ao final, vou entregar:
- Bloco `🔍 VALIDAÇÃO TÉCNICA EXECUTADA` preenchido.
- Bloco `📝 DOCUMENTAÇÃO NECESSÁRIA` ou `✅ Sem atualização documental necessária` (será o primeiro).
- `📌 STATUS DA ENTREGA`: avançando de "Diagnóstico" → "Ajuste aplicado — pendente de validação" → "Corrigido e validado" só após validação técnica passar.

---

## Ordem de execução
1. Etapas 1+2 (código frontend — A+B)
2. Etapas 3+4+5 (edges — E1/E2/E3/E4)
3. Deploy e Etapa 6 (validação técnica)
4. Etapa 7 (documentação completa + memórias)

**Estimativa:** 1 loop completo. Tudo junto, sem mexer em nada que possa regredir.

📌 STATUS: Plano aprovado — pronto para sair do modo Plan e executar.

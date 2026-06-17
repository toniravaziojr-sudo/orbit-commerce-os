# Assistente único de aprovação de Proposta de Campanha

## Escopo
- Aplica-se SOMENTE a **propostas de campanha** (geradas após o Plano Estratégico ser aprovado).
- O **Plano Estratégico continua igual** — sem alterações no fluxo dele.

## Decisões confirmadas
1. Campanha e Conjuntos chegam **pré-preenchidos pela IA**, prontos para revisar/editar inline.
2. **Publicar na Meta = aprovar.** Não existe mais botão "Aprovar proposta".
3. Rodapé com dois botões em todas as etapas:
   - **Cancelar campanha** — confirmação + toast; a proposta some da fila.
   - **Ajustar proposta** — texto livre; IA regenera Campanha/Conjuntos (consome créditos).
4. Etapa **Anúncios** — controle direto do lojista:
   - Edita manualmente título, texto principal, descrição, CTA, link.
   - Insere criativo de 3 formas: **Gerar com IA** · **Subir do PC** (vai para o Drive) · **Escolher do Drive**.
   - Pré-visualização do anúncio montado.
   - **Regenerar copy com IA** por anúncio (isolado, consome créditos — aviso visível).
5. Etapa **Publicar** — resumo consolidado + botão **Publicar na Meta** (com confirmação).
   - **Bloqueia publicação** se faltar criativo em qualquer anúncio, com aviso claro em PT-BR.
6. Edições inline **sobrescrevem** a proposta da IA. Na 1ª edição da sessão aparece o aviso: *"Suas alterações vão sobrescrever a proposta original. Para voltar, use Ajustar proposta."*
7. Após publicar, ajustes só pelo painel da Meta ou pelo chat com a IA. O assistente não reabre em modo edição.

## Resultado final
Um único assistente do início ao fim. O lojista revisa tudo pronto, edita o que quiser, monta os anúncios e publica. A publicação é a aprovação.

## Entrega em fases
- **Fase 1** ✅ Esqueleto navegável (5 etapas).
- **Fase 2** ✅ Rodapé novo (Cancelar + Ajustar).
- **Fase 3** ✅ Etapa Publicar com resumo + bloqueio se faltar criativo.
- **Fase 4** ✅ Edição inline (Campanha + Conjuntos) com aviso de sobrescrita, persistindo em `action_data`.
- **Fase 5 (próxima) — Etapa Anúncios com criativo (gerar/upload/Drive) + copy editável + regenerar.**
- **Fase 6 — Documentação + memória anti-regressão.**

Cada fase é entregue e validada antes da próxima — evita um lote único enorme sem chance de teste.

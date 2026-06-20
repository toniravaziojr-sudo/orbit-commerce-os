## Status

Onda 1+2 aplicadas + ambiente do tenant Respeite o Homem limpo para
teste do zero (2026-06-20). Onda 3 (paridade Meta por objetivo) próxima.

## Contexto

1) Publicação da proposta "Fast Upgrade" (ABO) falhava com erro genérico
   da Meta (code 100 / subcode 4834011) porque o publicador enviava
   `bid_strategy` no nível da campanha mesmo sem orçamento de campanha
   (CBO). Corrigido em 2026-06-19: ABO não envia bid_strategy nem
   daily_budget no nível da campanha; CBO mantém comportamento.

2) Feedbacks dados no wizard (título/texto/descrição/imagem) nem sempre
   apareciam como aprendizados na UI. Causa: gravação acontecia DEPOIS
   da chamada de IA; se a IA falhava ou vinha vazia/truncada, o
   aprendizado era perdido silenciosamente.

3) Cards de aprendizado mostravam texto técnico ("Campo headline do
   anúncio #1 regenerado") em vez de tarja humana legível.

## Correções aplicadas (onda 1+2)

- Edge `ads-creative-inline-generate`: `regen_copy_field` agora grava
  aprendizado ANTES da chamada da IA, com título humano
  ("Feedback de Título — Shampoo Calvície Zero") e metadata
  (subtype, field, field_label_pt, product_name, funnel_stage).
- Edge `ads-creative-inline-generate`: `regen_image` idem — grava antes
  do gerador (e também em caso de produto não resolvido, com flag
  `product_resolved=false`). Removido duplicate pós-sucesso.
- Edge `ads-creative-revise` (revisão final legada): mesmo padrão para
  `regenerate_image` e `regenerate_copy`. Title humano + product_name no
  metadata.
- UI `AdsAILearningsTab`: nova tarja colorida no topo do card
  ("Feedback de Título/Texto/Descrição/Copy/Imagem — Produto") quando o
  aprendizado vem de feedback inline. Não muda fluxo, só apresentação.
- Hook `useAdsAILearnings`: expõe `metadata` na tipagem.

## Próxima etapa — Onda 3: auditoria de paridade Meta por objetivo

Escopo enxuto (sem teste real de publicação por objetivo, para não
gastar processamento desnecessário):
- Campanha: special_ad_categories, ABO vs CBO (já ok).
- Conjunto: optimization_goal × billing_event × destination_type
  coerentes com objective; promoted_object obrigatório por objetivo.
- Anúncio: call_to_action e link/page_welcome_message/lead_gen_form_id
  compatíveis.
- Cobertura: Vendas, Conversões, Tráfego, Engajamento, Leads,
  Reconhecimento, Mensagens, Vídeo.
- Saída: correções pontuais no tradutor proposta→Meta; objetivos sem
  cobertura segura ficam sinalizados como pendência (não arriscamos
  publicação silenciosa).

## Validação pendente do usuário

1. Dar 1 feedback de título e 1 de imagem no wizard de qualquer
   campanha → confirmar que aparecem na aba Aprendizados com a tarja
   "Feedback de … — [Produto]".
2. Republicar "Fast Upgrade" (já corrigida) — confirmar criação ABO sem
   erro de parâmetro inválido.

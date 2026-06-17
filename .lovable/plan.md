# Passo a passo guiado de aprovação de campanha

## Escopo
- Aplica-se SOMENTE a **propostas de campanha** (geradas após o Plano Estratégico ser aprovado).
- O **Plano Estratégico continua igual** — sem alterações no fluxo dele.

## Decisões confirmadas pelo lojista
1. Campanha e Conjuntos chegam **com todos os dados já preenchidos** pela IA, prontos para revisar/editar inline.
2. A **publicação na última etapa É a aprovação**. Não existe mais botão "Aprovar proposta" — a aprovação efetiva é o clique em "Publicar na Meta".
3. Rodapé do dialog passa a ter apenas dois botões:
   - **Cancelar campanha** — disponível em todas as 5 etapas. Pede confirmação; ao confirmar, a proposta some da fila e a UI mostra um aviso "Campanha cancelada".
   - **Ajustar proposta** — texto livre; a IA regenera as configurações de Campanha e/ou Conjunto. Usado para mudanças em nível de campanha/conjunto.
4. Na etapa de Anúncios, o lojista tem controle direto, sem precisar pedir para a IA:
   - **Edita manualmente** título, texto principal, descrição, CTA, link.
   - Insere o criativo de três formas: **Gerar com IA**, **Subir do PC** (salva no Drive da loja) ou **Escolher do Drive**.
   - **Pré-visualiza** o anúncio montado (criativo + copy).
   - Pode regenerar copy/criativo por IA item a item, sem afetar os outros anúncios.
5. Após publicar, ajustes acontecem ou direto no painel da Meta, ou via chat com a IA — o dialog não reabre em modo edição.

## Resultado final
Lojista percorre um único dialog guiado com 5 etapas (Visão geral → Campanha → Conjuntos → Anúncios → Publicar). Tudo já preenchido pela IA; ele revisa, ajusta inline ou pede regeneração; na etapa de anúncios assume o controle do criativo/copy; finaliza com "Publicar na Meta" — a publicação é a aprovação.

## Execução em fases

**Fase 1 — Esqueleto navegável (concluída).**
Estepador horizontal de 5 passos com Voltar/Avançar e chips para múltiplos conjuntos/anúncios.

**Fase 2 — Rodapé novo + dados pré-preenchidos nas etapas Campanha e Conjuntos (em andamento).**
- Remover botão "Aprovar proposta".
- Trocar "Recusar proposta" por **Cancelar campanha** com confirmação e toast.
- Manter "Ajustar proposta" (texto livre que regenera campanha/conjuntos via IA).
- Garantir que Campanha e Conjuntos mostrem todos os dados preenchidos (já é assim hoje em maior parte; reforçar leitura/edição inline).
- Edição inline de Campanha (nome, objetivo, orçamento, datas, lance) e Conjuntos (público, idade, gênero, região, posicionamentos, evento de conversão, orçamento).

**Fase 3 — Etapa de Anúncios com controle total.**
- Edição inline de título, texto principal, descrição, CTA, link de destino.
- Três caminhos de criativo: Gerar com IA / Subir do PC (vai para o Drive) / Escolher do Drive.
- Pré-visualização do anúncio (criativo + copy).
- Botão "Regenerar copy com IA" por anúncio.

**Fase 4 — Etapa Publicar.**
Resumo consolidado + botão único **Publicar na Meta** (com confirmação). Publicação efetiva = aprovação. Bloqueio de edição depois de publicado.

**Fase 5 — Documentação + memória anti-regressão.**
Atualizar `docs/especificacoes/marketing/gestor-trafego.md`, `docs/especificacoes/transversais/mapa-ui.md` e substituir a memória `ads-proposal-modal-unified.md` pelo novo contrato.

## Próximo passo
Iniciar **Fase 2** agora.

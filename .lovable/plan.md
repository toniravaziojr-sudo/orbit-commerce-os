## Objetivo
Sincronização 100% bidirecional entre o sistema e o Mercado Livre, feita com arquitetura sólida, UI/UX clara, testes de validação e documentação oficial 100% alinhada ao comportamento final.

## Diagnóstico
- **Sistema → ML:** funciona. Excluir aqui um anúncio publicado manda o comando de finalizar no ML e remove daqui. Só o texto do aviso atual está confuso.
- **ML → Sistema:** hoje só roda 1×/dia (cron das 5h). Se o lojista mexer direto no painel do ML, o sistema demora até 24h para refletir. **Esse é o gap.**
- **Causa raiz:** o sistema já recebe notificações em tempo real do ML, mas só usa para perguntas dos compradores. Não escuta as notificações de mudança de anúncio.

## O que vai ser feito

### 1) Escuta em tempo real do ML para anúncios
Passar a ouvir as notificações de mudança de anúncio. Toda vez que o ML avisar que algo mudou, o sistema reflete aqui em segundos, sem esperar o cron.

Regras de reflexo automático:
- **Ativado no ML** → fica como **Ativo** aqui.
- **Pausado no ML** (lojista ou ML) → fica como **Pausado** aqui.
- **Excluído no ML** (anúncio que ainda não tinha sido publicado — rascunho/incompleto apagado de fato) → **removido daqui** automaticamente.
- **Desativado/Finalizado no ML** (já estava publicado e foi encerrado — caminho normal) → fica como **Inativo** aqui, vai para a nova aba "Inativos".
- **Preço/estoque alterado no ML** → atualizado aqui.

O cron diário das 5h continua, agora como rede de segurança caso alguma notificação se perca.

### 2) Nova aba "Inativos" na tela de Anúncios
Hoje a tela tem **Rascunhos, Publicados, Pendências**. Adiciono **"Inativos"** — anúncios finalizados no ML, preservados para consulta. Cada item mostra: motivo do encerramento (finalizado pelo lojista, expirado, encerrado pelo ML), data, link permanente do ML e botão "Ver no Mercado Livre".

### 3) Aviso correto ao excluir daqui
Substituo o texto atual pelo aprovado:
> "Este anúncio será desativado (finalizado) no Mercado Livre — sai do ar e o link público para de funcionar. O Mercado Livre não permite exclusão definitiva de anúncios já publicados; ele fica apenas no histórico interno do ML. Aqui no sistema o anúncio será removido. Deseja continuar?"

Aplica à exclusão individual e em massa.

### 4) UI/UX de sincronização clara
- **Cabeçalho da aba Anúncios:** selo **"Sincronizado em tempo real com o Mercado Livre"** com bolinha verde + horário do último sinal recebido. Se ficar mais de 1h sem receber sinal, bolinha vira âmbar com tooltip "Sem sinal recente — usando reconciliação diária às 5h".
- **Cada anúncio:** ícone discreto indicando a **origem da última mudança** — "alterado aqui", "alterado no painel do ML pelo lojista" ou "alterado automaticamente pelo Mercado Livre". Tooltip ao passar o mouse, com data/hora em BRT.
- **Status `Inativo`:** badge cinza, distinto dos badges de Publicado/Pausado/Rascunho/Erro.
- **Transições:** quando a notificação chegar com a aba aberta, o item atualiza no ato (sem refresh manual), com micro-animação de destaque por 2s para o lojista perceber.

### 5) Pré-requisito do app no Mercado Livre
Para a escuta em tempo real funcionar, o app que conecta ao ML precisa estar assinando os tópicos de anúncio (hoje só assina perguntas). É configuração one-time da plataforma, feita por mim na entrega. Sem custo para o lojista.

## Validações que serão executadas antes do fechamento

### Validação técnica (executada pela IA)
- **Banco:** verificar que o novo status "Inativo" e a coluna de origem da última mudança foram criados sem quebrar registros existentes; verificar grants e RLS.
- **Webhook:** simular cada tipo de notificação do ML (ativo, pausado, fechado com sub_status `deleted`, fechado normal, preço, estoque) e conferir o estado final do anúncio aqui.
- **Cron de fallback:** rodar o cron manualmente após dessincronizar de propósito um anúncio no banco; conferir que reconcilia.
- **Edge function de exclusão:** disparar exclusão local em anúncios em cada estado (rascunho, publicado, pausado, incompleto) e validar a resposta do ML.
- **Logs:** garantir que toda transição de status fica registrada com origem.

### Validação lógica (testes automatizados)
- Mapeamento ML→sistema cobrindo todos os pares de `status` × `sub_status` documentados.
- Regra de decisão "remover daqui vs marcar como Inativo" baseada no histórico de status local.
- Idempotência do webhook (mesma notificação chegando 2x não duplica nada e não regride status).
- Ordem de eventos fora de sequência (notificação antiga chegando depois da nova) é descartada pela data do evento.

### Validação funcional (no tenant `respeiteohomem`)
- Publicar 1 anúncio de teste, pausar pelo painel do ML → ver virar Pausado aqui em segundos.
- Reativar pelo painel do ML → ver voltar para Ativo aqui.
- Finalizar pelo painel do ML → ver ir para aba Inativos aqui.
- Criar rascunho diretamente no ML e excluí-lo lá → ver sumir daqui.
- Excluir aqui um anúncio publicado → confirmar texto novo do aviso e final em "Finalizado" no ML.
- Alterar preço no painel do ML → ver atualizar aqui.

## Documentação que será atualizada na mesma entrega
- **Especificação do Mercado Livre** (`docs/especificacoes/marketplaces/mercado-livre.md`): nova escuta em tempo real, nova aba Inativos, tabela de mapeamento de status atualizada, regra "excluído vs desativado", novo aviso de exclusão, indicador de origem da mudança, cron como fallback.
- **Mapa de UI** (`docs/especificacoes/transversais/mapa-ui.md`): nova aba Inativos, novo selo de sincronização em tempo real, novo ícone de origem da mudança, novo texto de exclusão.
- **Regras do Sistema** (`docs/REGRAS-DO-SISTEMA.md`): incluir o princípio "ML é fonte de verdade do estado público do anúncio; sistema reflete em tempo real respeitando as limitações da API ML".
- **Base de conhecimento técnico** (`docs/tecnico/base-de-conhecimento-tecnico.md`): registrar a decisão "webhook + cron como fallback" e a regra de idempotência por data do evento.
- **Memória** (`mem://features/marketplaces/meli-listings-bidirectional-sync`): atualizar para refletir o novo modelo (tempo real + fallback diário + status Inativo + origem da mudança).

## Resultado final
- Mudou no ML → reflete aqui em segundos, sem o lojista atualizar a página.
- Mudou aqui → reflete no ML imediatamente, como já é hoje.
- O lojista enxerga o status real, a origem da última mudança e o histórico dos finalizados.
- O aviso de exclusão deixa claro o que o ML permite e o que não permite.
- Tudo validado tecnicamente, logicamente e funcionalmente antes de eu declarar concluído.
- Docs oficiais 100% alinhados ao comportamento final.

## Bloco técnico (opcional)
- **`meli-webhook`** passa a tratar os topics `items` e `items_prices`: ao receber, busca o item no ML e aplica o mesmo mapeamento de status já existente em `meli-sync-listings` (`active→published`, `paused→paused`, `under_review→publishing`, `inactive→paused`, `closed→inactive`/`delete` conforme histórico do registro).
- **Regra de `closed`:** se `meli_listings` local nunca atingiu `published`/`paused` (histórico só passou por `draft`/`publishing`/`error`) → `DELETE` da linha. Caso contrário → novo status local `inactive` preservando `sub_status` e motivo em `error_message`. Adicionar `inactive` ao enum local, à UI e às policies.
- **Origem da última mudança:** nova coluna `last_status_change_source` em `meli_listings` (`local_user` / `meli_user` / `meli_auto`) + `last_status_change_at`. Mutations locais gravam `local_user`; webhook grava `meli_user` ou `meli_auto` conforme o topic/payload.
- **Idempotência:** webhook descarta payload com `sent` anterior ao `last_status_change_at` salvo (proteção contra eventos fora de ordem). Deduplicação por `(resource, sent)`.
- **Selo de tempo real:** novo campo `last_webhook_at` em `marketplace_connections` atualizado pelo webhook a cada evento aceito. Header consome `max(last_webhook_at, last_sync_at)`.
- **Realtime UI:** subscription em `meli_listings` filtrada por `tenant_id` apenas enquanto a aba está visível (cleanup no unmount; pausa em `visibilitychange=hidden`) para não vazar canais nem gerar custo ocioso.
- **App do ML:** adicionar topics `items` e `items_prices` no DevCenter (callback já configurada). Validar no fechamento com log do primeiro evento de cada topic recebido no tenant `respeiteohomem`.
- **Cron 05h BRT:** mantido. Passa a logar quantos itens corrigiu — métrica de saúde da escuta em tempo real (deve tender a zero).
- **Testes:** suíte Deno em `supabase/functions/meli-webhook/__tests__/` cobrindo mapeamento de status, idempotência e ordem de eventos; testes de UI (vitest) para a aba Inativos, badge de sincronização e tooltip de origem.
- **Sem mudança** em `meli-publish-listing` (delete já funciona). Sem mudança em pedidos e perguntas.

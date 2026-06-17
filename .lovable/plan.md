# Plano — Onda H.4 / H.5 (Gestor de Anúncios)

## Confirmações do usuário
1. **Aumentar Ticket como ferramenta opcional.** A IA SEMPRE tenta casar a ideia com Order Bump / Upsell / Cross-sell / Compre Junto cadastrados. Se não houver oferta compatível, ela **ignora silenciosamente** e busca outra ideia válida — nunca bloqueia, nunca pede para o lojista cadastrar.
2. **Feedback vira aprendizado.** Toda regeneração (criativo OU copy) exige campo de feedback explicando o porquê e como o lojista quer; cada feedback é gravado como aprendizado da IA, igual às etapas anteriores.
3. **Ordem de execução** é decisão técnica, priorizando solidez, segurança e eficácia.

## Ordem de execução (definida)

### Etapa 1 — Vínculo proposta ↔ criativo (correção estrutural)
Hoje a geração da imagem sobrescreve o "marcador" que liga o criativo à proposta, e a proposta não avança sozinha. Será corrigido na origem: o vínculo passa a ser gravado no momento da criação do job e não pode mais ser perdido durante a geração.

### Etapa 2 — Aumentar Ticket como insumo da Estrategista
A Estrategista passa a ler as ofertas ativas do lojista antes de propor campanhas que dependam de oferta combinada (upgrade, combo, cross-sell). Se houver oferta compatível, a campanha é amarrada nela (mesmos produtos, mesmo link). Se não houver, a IA escolhe outro tipo de campanha. Sem bloqueio para o lojista. Também passa a aplicar automaticamente a regra "público frio para carro-chefe exclui clientes existentes".

### Etapa 3 — Revisão final com edição real (imagem + copy + aprendizado)
Na tela de revisão final, para cada criativo o lojista terá:

- **Imagem:** aceitar a da IA / regenerar com feedback / substituir por upload do computador / escolher do Meu Drive.
- **Copy (título, texto principal, descrição):** editar à mão / regenerar com feedback.
- **Toda regeneração exige feedback obrigatório** (campo curto explicando o porquê). Esse feedback alimenta o aprendizado da IA.
- Botão "Publicar no Meta" só fica ativo quando todos os criativos da proposta tiverem imagem + copy aprovados pelo lojista.

## Status
- Correção emergencial aplicada antes da continuidade das etapas: fonte dos ativos Meta alinhada — análise estratégica e Estrategista passam a usar os ativos reais conectados pela integração como fonte primária; configuração interna fica apenas como override avançado.
- Etapa 1: em implementação
- Etapa 2: em implementação
- Etapa 3: próxima leva (UI maior, será entregue na sequência)

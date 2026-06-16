## Auditoria atual

**Bugs reais no motor de prontidão (causando falsos bloqueadores no Respeite o Homem):**

1. O motor exige **Evento de conversão** e **Janela de atribuição** vindos de uma tabela de "configuração de produção" que está vazia — então sempre bloqueia, mesmo com integração Meta 100% ativa.
2. **Evento de conversão** está como campo manual; deveria ser derivado do objetivo da campanha (venda → Compra, lead → Lead, tráfego → Visualização de conteúdo).
3. **Janela de atribuição** está como campo manual; deveria usar o padrão do Meta (7 dias clique / 1 dia visualização para venda).
4. **Claims permitidas** bloqueia para qualquer produto; deveria bloquear só em categoria sensível (cosmético, suplemento).
5. **Tom de voz**, **Diferenciais do produto** e **Restrições da marca** estão como bloqueadores; devem virar avisos (não bloqueiam).
6. Telas adicionadas na rodada anterior (Página/Instagram/Pixel/Evento/Janela manuais por conta de anúncios) **viraram retrabalho** do que já existe na integração Meta — devem sair.

**Soft items que permanecem como bloqueadores reais:**
- Promessa principal aprovada (sempre)
- Claims permitidas (só em categoria sensível)
- Categoria regulatória do produto (já existe no cadastro)
- Logo, paleta e imagem principal do produto (já existem nas configurações da loja e cadastro do produto)

## Plano

### 1. Corrigir o motor de prontidão
- Ler **Conexão, Conta, Página, Instagram, Pixel, API de Conversões** direto da integração Meta ativa. Zero dependência da tabela "configuração de produção".
- **Evento de conversão**: derivar do objetivo da campanha. Venda → Compra. Lead → Lead. Tráfego → Visualização de conteúdo. Sem bloqueio e sem campo manual.
- **Janela de atribuição**: assumir padrão do Meta (7 dias clique / 1 dia visualização para venda). Sem bloqueio e sem campo manual.
- **UTM**: cair em padrão da plataforma quando proposta/conta não definir. Sem bloqueio.

### 2. Ajustar regras de marca e produto
- **Promessa principal**: continua bloqueador.
- **Claims permitidas**: bloqueia só se a categoria do produto for sensível (cosmético, suplemento). Fora disso, aviso.
- **Tom de voz**, **Diferenciais**, **Restrições/claims proibidas**: viram aviso (não bloqueiam).

### 3. Alinhar o motor estratégico (geração de propostas)
- O mesmo recorte vale para o gerador de propostas: quando a tabela de produção não tiver dados, usar derivação por objetivo + padrão Meta. Garante que proposta nasce já com evento e janela corretos, sem exigir formulário manual.

### 4. Limpar telas que viraram retrabalho
- Remover do card da conta de anúncios os campos manuais de Página, Instagram, Pixel, Evento de conversão e Janela de atribuição.
- Manter o card de **Regras da marca** (promessa, claims, tom de voz, restrições) — global e override por conta. Esses são contexto estratégico real.
- O card de bloqueios na proposta mostra no máximo 3 itens + botão "Ver todos" (regra já existente, garantir).

### 5. Validação técnica no Respeite o Homem
- Confirmar que, com integração Meta ativa + promessa cadastrada, as propostas atuais saem de "configurações pendentes" para "pronta para gerar".
- Listar exatamente quais propostas ficam liberadas e quais ainda têm bloqueador real, com o motivo em linguagem clara.

### 6. Documentação e anti-regressão
- Atualizar o doc do Gestor de Tráfego e o mapa de UI refletindo: motor lê da integração Meta; evento e janela são automáticos; lista enxuta de bloqueadores soft.
- Atualizar a regra anti-regressão para impedir que Página/Pixel/Evento/Janela voltem a ser tratados como campo manual.

### Fora do escopo (precisa sua aprovação separada)
- Adicionar campo "Diferenciais do produto" no cadastro de produto. Hoje continua como aviso e não bloqueia nada.

### Detalhes técnicos (opcional)
- `creativeReadinessGate.ts`: remover bloqueio de `conversion_event_set` e `attribution_window_set` (passam a ser sempre `true` no payload). Bloqueios de claims, tom, diferenciais e restrições viram avisos exceto promessa principal e claims em categoria sensível.
- `readinessLoader.ts`: deriva evento/janela a partir de `campaign.objective` quando `ads_meta_production_config` não tem o registro. Mantém a tabela só como override avançado.
- `accountDefaults.ts` e `campaignProposals.ts`: fallback equivalente para o motor estratégico (mesma derivação por objetivo).
- `MetaProductionConfigCard.tsx` e `AdsAccountConfig.tsx`: remover seções de Página/Instagram/Pixel/Evento/Janela. Manter override de UTM como avançado opcional.

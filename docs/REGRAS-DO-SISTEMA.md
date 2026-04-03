# DOC DE REGRAS DO SISTEMA

> **Status:** 🟢 Ativo  
> **Versão:** 2.3.0  
> **Camada:** Layer 2 — Regras do Sistema  
> **Última atualização:** 2026-04-03

---

## ESTRUTURA DOCUMENTAL (4 CAMADAS)

Este documento é a **fonte de verdade canônica** para regras estruturais, fluxos canônicos, contratos entre módulos e fontes de verdade do sistema.

A migração do legado (`docs/REGRAS.md` e `docs/regras/*.md`) foi concluída em 2026-04-03. Todo conteúdo funcional foi absorvido pela nova estrutura. Os arquivos legados foram removidos.

**Documentos da nova estrutura (Layer 1-4):**

| Layer | Documento | Status |
|-------|-----------|--------|
| 1 — Governança | Knowledge (Custom Instructions) | ✅ Ativo |
| 2 — Regras do Sistema | **Este documento** | ✅ Ativo |
| 3 — Especificações dos Módulos | `docs/ESPECIFICACOES-DOS-MODULOS.md` (índice) + `docs/especificacoes/` (modulares) | ✅ Ativo |
| 4 — Manual do Sistema | `docs/MANUAL-DO-SISTEMA.md` | ✅ Ativo |

---

## 1. PAPEL DE CADA CAMADA DOCUMENTAL

| Camada | Documento | Governa | Autoridade |
|--------|-----------|---------|------------|
| 1 — Governança | Knowledge (Custom Instructions) | Conduta da IA: como agir, ler, propor, validar, encerrar | Comportamento |
| 2 — Regras do Sistema | Este documento | Estrutura macro, fluxos canônicos, contratos, fontes de verdade, segurança | Estrutural |
| 3 — Especificações | Docs de especificação por módulo | Comportamento funcional detalhado por módulo (telas, botões, estados) | Funcional |
| 4 — Manual do Sistema | Manual técnico consolidado | Referência ampla, arquitetura, inventário, schema, contexto geral | Referência |

Nenhuma camada inferior sobrepõe a superior no seu domínio de autoridade.

---

## 2. AUTORIDADE POR TIPO DE CONFLITO

| Tipo de Conflito | Quem Resolve |
|------------------|-------------|
| Como a IA deve agir, responder, propor ou validar | Knowledge (Layer 1) |
| Regra estrutural, fluxo canônico, contrato entre módulos, fonte de verdade | Este documento (Layer 2) |
| Detalhe funcional de módulo (tela, bloco, botão, estado) | Doc de Especificação do módulo (Layer 3) |
| Dúvida de contexto, inventário, schema ou arquitetura geral | Manual do Sistema (Layer 4) |
| Conflito não resolvido entre camadas | Parar e pedir esclarecimento ao usuário |

---

## 3. PRINCÍPIOS NÃO NEGOCIÁVEIS

### 3.1 Multi-Tenancy
- Tudo é tenant-scoped. Toda operação valida `tenant_id`.
- Proibido vazamento de dados, tokens ou credenciais entre tenants.
- Nunca criar solução específica por tenant sem instrução explícita do usuário.

### 3.2 Core do Sistema
- **Produtos, Clientes e Pedidos** são a base e fonte de verdade primária.
- Qualquer módulo periférico interage com o core via contratos definidos neste documento.
- Write direto nas tabelas core por módulo externo ou integração é proibido sem contrato explícito.

### 3.3 Segurança vs Velocidade
- Core transacional, financeiro, fiscal, tenant, segurança e dados sensíveis: **segurança vence**.
- Ajustes visuais, conforto operacional e melhorias não críticas: **velocidade pode vencer**.
- Nunca aplicar "velocidade vence" como regra genérica.

### 3.4 Separação Admin vs Storefront
- **Admin (Comando Central):** sistema SaaS, UI fixa, tema azul marinho.
- **Storefront (Loja Pública):** loja do tenant, herda tema do tenant.
- Alteração em um contexto nunca deve afetar o outro acidentalmente.
- Componentes compartilhados exigem auditoria de impacto cruzado.

### 3.5 Feature Incompleta e Escopo de Lançamento
- Todo módulo ou recurso visível na navegação do Comando Central para todos os usuários faz parte do **core de lançamento** do sistema.
- Módulos ou funcionalidades marcados como "em construção" ficam restritos a **tenants especiais e administradores da plataforma**, permanecendo ocultos para lojistas em planos padrão.
- Esconder feature incompleta via feature flag. Nunca deixar UI quebrada em produção.
- A presença de um recurso na interface oficial exige cobertura completa no Doc de Regras do Sistema e nos Docs de Especificação correspondentes.

### 3.6 Build
- Nenhum ajuste é considerado concluído se build, lint ou typecheck falharem.

### 3.7 Dados Prontos na UI (Zero Sync on Load)
- Nenhuma tela do Comando Central deve disparar criação, sincronização ou reconciliação de dados ao ser acessada pelo usuário.
- Quando o usuário abre qualquer módulo, os dados já devem estar disponíveis no banco — prontos para consulta imediata.
- A responsabilidade de manter os dados atualizados é exclusivamente do **backend** (triggers, webhooks, cron/fallback).
- O frontend apenas **lê** os dados existentes. Botões de atualização manual (refresh) podem existir como ação explícita do usuário, mas nunca como mecanismo automático ao carregar a tela.
- Violação desta regra gera a percepção de lentidão ou de que o sistema "só funciona quando o usuário acessa a tela", o que é inaceitável.

---

## 4. CRITICIDADE DOS FLUXOS

| Nível | Descrição | Exemplos |
|-------|-----------|----------|
| **Crítico** | Indisponibilidade = perda financeira ou operacional imediata | Checkout → Pagamento → Pedido, sincronização de estoque, integrações de pagamento e fiscal |
| **Alto** | Degradação afeta operação diária | Builder (publicação), gestão de pedidos, logística, CRM |
| **Médio** | Impacto operacional contornável a curto prazo | Blog, avaliações, campanhas, relatórios, importação |
| **Baixo** | Comodidade, sem impacto operacional imediato | Preferências visuais, widgets informativos, tutoriais |

A classificação de criticidade determina a ordem de prioridade para correção, testes e rollout.

---

## 5. FONTES DE VERDADE POR DOMÍNIO

| Domínio | Fonte de Verdade Primária | Reconciliação |
|---------|--------------------------|---------------|
| Pedidos | Tabela `orders` (core interno) | Gateway confirma → core persiste |
| Produtos | Tabela `products` (core interno) | Marketplaces sincronizam via core |
| Clientes | Tabela `customers` (core interno) | Tags e métricas recalculadas por triggers internos |
| Estoque | Tabelas `product_variants` + `stock_movements` | Reserva (soft lock) na criação do pedido; baixa definitiva no pagamento aprovado; liberação automática na falha, expiração ou cancelamento |
| Pagamentos | Gateway externo é fonte de verdade do status de pagamento | Config interna = espelho operacional para UI e automações. Em divergência, gateway prevalece e sistema alerta. |
| Fiscal (NF-e) | Provedor fiscal externo | Core registra referência e status |
| Frete/Logística | Transportadora/provedor logístico para tracking | Status de negócio do pedido = core interno |
| Atribuição de venda | Core interno = fonte primária | Plataformas externas = complementar, respeitando janelas de atribuição |
| Billing/Planos | Core interno (tabelas `billing_*`) | Mercado Pago = provedor de cobrança |
| Email Marketing | Core interno (listas, subscribers) | Disparos via provedor externo |

### Hierarquia de reconciliação
1. Core interno é a fonte primária.
2. Integrações externas confirmam ou complementam.
3. Em caso de divergência, o core prevalece — exceto quando o externo é a fonte de verdade declarada (ex: gateway para status de pagamento).
4. Divergências devem gerar alerta e log, nunca correção silenciosa.

---

## 6. FLUXOS CANÔNICOS (MACRO)

Esta seção define apenas a sequência macro. Detalhes funcionais (timings, mensagens, campos) ficam nos docs de especificação dos módulos.

### 6.1 Checkout → Pedido
1. Cliente monta carrinho na loja.
2. Inicia checkout (dados pessoais, endereço, frete, pagamento).
3. Pedido criado com status `pending`. **Estoque reservado (soft lock).**
4. Gateway processa pagamento.
5. Webhook/polling confirma pagamento → status `approved`. **Baixa definitiva do estoque.**
6. Pedido aprovado dispara: atualização de métricas do cliente, tag "Cliente", NF-e, notificações.
7. Falha, expiração ou cancelamento do pagamento → **estoque reservado é liberado automaticamente.**

### 6.2 State Machine do Pedido
- Os status do pedido seguem uma máquina de estados definida.
- Transições inválidas são rejeitadas.
- Toda transição gera log de auditoria.
- Detalhes da máquina de estados ficam no doc de especificação de Pedidos.

### 6.3 Builder — Draft vs Published
- Todo conteúdo editado no builder é **draft** até publicação explícita.
- Preview em tempo real: qualquer ajuste reflete imediatamente no preview do builder.
- Publicação: conteúdo entra no ar na loja pública somente após ação explícita de "Publicar".
- Draft e publicado são versões independentes.

### 6.4 Lifecycle do Contato

| Estado | Definição | Origem |
|--------|-----------|--------|
| **Lead** | Contato capturado, sem opt-in confirmado | Formulário, popup, webhook, captura passiva |
| **Subscriber** | Contato com opt-in válido para comunicação | Confirmação de opt-in (email, WhatsApp) |
| **Customer** | Entidade registrada no módulo de clientes | Pedido aprovado, importação ou criação manual |

- Lead **não** vira customer automaticamente. A conversão exige pedido aprovado, importação ou criação manual.
- Subscriber **não** implica customer. Um subscriber pode nunca ter comprado.
- Customer é válido mesmo **sem** pedido aprovado (importação, criação manual).
- Customer recebe tag sistêmica "Cliente" automaticamente na criação (qualquer origem).
- Métricas do cliente (total_orders, total_spent, ticket médio) são recalculadas por triggers internos.

### 6.5 Expiração/Validade de Pagamento
- A validade real de cada forma de pagamento segue a regra da operadora/gateway.
- Quando o gateway expuser essa informação de forma confiável, o sistema deve puxar automaticamente.
- Quando não expuser, o sistema usa a configuração interna definida pelo usuário.
- A configuração interna funciona como espelho operacional para UI, automações e recuperação.
- Em caso de divergência, a validade real do pagamento segue o gateway.
- O sistema deve alertar a divergência e usar a configuração interna apenas como referência operacional até sincronizar corretamente.

### 6.6 Checkout Abandonado
- Checkout não finalizado dispara sequência de recuperação.
- Detalhes (timings, canais, tentativas) ficam no doc de especificação.

---

## 7. CONTRATOS ENTRE MÓDULOS

Contratos definem a interface entre módulos: o que cada módulo fornece, o que consome, e o comportamento em caso de falha.

### 7.1 Pedido ↔ Estoque
- Criação do pedido (`pending`) → **reserva de estoque (soft lock).**
- Pagamento aprovado (`approved`) → **baixa definitiva do estoque.**
- Falha, expiração ou cancelamento do pagamento → **liberação automática do estoque reservado.**
- Estoque insuficiente: **comportamento padrão é alerta** (não bloqueia criação do pedido). Bloqueio hard é **configurável pelo lojista** nas configurações da loja.

### 7.2 Pedido ↔ Fiscal
- Pedido aprovado solicita emissão de NF-e ao provedor fiscal.
- Falha na emissão não bloqueia o pedido, mas gera alerta e fila de retentativa.
- NF-e emitida é vinculada ao pedido como referência.

### 7.3 Pedido ↔ Logística
- Pedido aprovado + NF-e gera solicitação de envio.
- Status logístico (tracking) é independente do status de negócio do pedido.
- Reconciliação entre status interno e tracking externo é periódica.

### 7.4 Pedido ↔ Cliente
- Pedido aprovado atualiza métricas do cliente (total_orders, total_spent, first_order_at, last_order_at).
- Tag sistêmica "Cliente" é atribuída automaticamente.
- Cliente sem email continua válido; subscriber/list_member exige email.

### 7.5 Pedido ↔ Gateway
- Gateway é fonte de verdade para status de pagamento.
- Core registra e reconcilia.
- Webhook é o caminho principal; polling é fallback.

### 7.6 Pedido ↔ Afiliados
- Pedido com cookie/referência de afiliado gera conversão.
- Comissão calculada conforme regras do programa de afiliados do tenant.
- Atribuição respeita janela de atribuição configurada.

### 7.7 Pedido ↔ Marketplace
- Pedidos originados de marketplaces são sincronizados com o core.
- Core é fonte de verdade para status interno.
- Marketplace é notificado de mudanças de status via API.

### 7.8 Builder ↔ Storefront
- Builder produz draft. Storefront consome apenas conteúdo publicado.
- Bloco com erro no builder: erro visível para o usuário.
- Bloco com erro no storefront público: fallback seguro + log estruturado + sinalização ao admin, sem quebrar a página, sem mascarar o erro silenciosamente.

### 7.9 Email Marketing ↔ Clientes
- Subscribers e listas são gerenciados pelo módulo de Email Marketing.
- Tag sistêmica "Cliente" é atribuída pelo core na criação do registro no módulo de Clientes (qualquer origem: pedido aprovado, importação ou criação manual), não pelo módulo de Email Marketing.
- Email Marketing consome tags para segmentação, mas não é dono da atribuição.

---

## 8. INTEGRAÇÕES EXTERNAS

### 8.1 Separação Obrigatória: Billing SaaS vs Pagamentos da Loja

O sistema possui **dois fluxos de pagamento distintos e isolados**:

| Fluxo | Finalidade | Exemplo de Provedor |
|-------|-----------|---------------------|
| **Billing da Plataforma** | Cobrança da assinatura SaaS do lojista | Mercado Pago (assinaturas) |
| **Pagamentos da Loja** | Cobranças do checkout dos clientes finais do tenant | Pagar.me, Mercado Pago, PagBank |

- Os dois fluxos **nunca se misturam** operacionalmente, mesmo que usem o mesmo provedor.
- Um provedor pode existir simultaneamente nos dois fluxos sem conflito.

### 8.2 Multi-Gateway por Tenant
- O sistema suporta **múltiplos gateways ativos simultaneamente** por tenant.
- O lojista pode definir qual provedor será usado para cada **método de pagamento** (ex: Pagar.me para cartão, Mercado Pago para Pix).
- O sistema prioriza integrações com suporte a **checkout transparente** e reconciliação via webhook.

### 8.3 Classificação de Integrações

| Tipo | Exemplos | Regra |
|------|----------|-------|
| **Gateway de Pagamento** | Pagar.me, Mercado Pago, PagBank, Stripe | Provedores de infraestrutura. Gateway é fonte de verdade para status de pagamento. Core reconcilia. |
| **Método de Pagamento** | Pix, Boleto, Cartão de Crédito | Formas de pagamento processadas através de um gateway. Não são gateways em si. |
| Fiscal | Provedor NF-e | Emissão assíncrona com retentativa. Falha não bloqueia pedido. |
| Logística | Correios, Melhor Envio | Tracking externo. Status de negócio é do core. |
| Marketplace | Shopee, Mercado Livre | Sincronização bidirecional. Core é primário. |
| Marketing | Meta Ads, Google Ads, TikTok | Atribuição complementar. Respeitar janelas das plataformas. |
| Comunicação | WhatsApp, SMTP | Canal de entrega. Falha não bloqueia operação. |

### 8.4 Regras Universais de Integração
- Credenciais são tenant-scoped e armazenadas de forma segura.
- Falha em integração externa nunca deve derrubar operação core.
- Toda integração deve ter: retry com backoff, log de falha, alerta ao admin.
- Degradação graceful: se a integração está fora, o sistema continua funcionando com capacidade reduzida.

---

## 9. AGENTES DE IA E ORQUESTRAÇÃO

### 9.1 Definições Canônicas

**Agente de IA** = entidade autônoma do sistema com escopo próprio, papel definido, regras próprias de permissão, capacidade de raciocinar por etapas dentro do seu domínio, trilha de auditoria e eventual interação com usuário, sistema e outros agentes.

**Função de IA** = capacidade embutida em um módulo para gerar, sugerir, preencher ou analisar algo, sem ser entidade autônoma do sistema. Exemplos: geração de criativos, preenchimento de SEO, sugestão de blocos, geração de landing pages.

### 9.2 Agentes Oficiais (3)

| Agente | Escopo | Execução | Restrição Principal |
|--------|--------|----------|---------------------|
| **Assistente IA (ChatGPT)** | Pesquisa, orientação, resolução de dúvidas | Não executa tarefas no sistema | Somente chat |
| **Auxiliar de Comando** | Qualquer ação que o usuário poderia fazer manualmente | Executa após aprovação do usuário | Solicitação → Resumo → Aprovação → Execução → Feedback |
| **Gestor de Tráfego IA** | Tráfego pago (campanhas, criativos, orçamento) | Executa ações de tráfego | Criativos e aumento de orçamento acima do limite exigem aprovação manual |

### 9.3 Regras Universais dos Agentes
- Todo agente conhece a estrutura do sistema e opera dentro do escopo de permissões do seu domínio e da autorização do usuário. O acesso a dados do tenant é limitado ao necessário para a função do agente.
- Nenhum agente executa ação destrutiva sem aprovação explícita.
- Toda execução gera log de auditoria.
- Créditos de IA são consumidos por uso e controlados pelo plano do tenant.

### 9.4 Promoção de Função a Agente
- Uma função de IA só se torna agente se ganhar: escopo próprio, regras próprias de permissão, autonomia de execução própria e trilha de auditoria própria.
- A promoção exige confirmação explícita do usuário e registro neste documento.

---

## 10. BUILDER, STOREFRONT E ADMIN

### 10.1 Separação de Contextos
- **Admin:** sistema SaaS fixo. Tema azul marinho. Não depende de configuração do tenant.
- **Storefront:** loja pública do tenant. Tema customizável pelo tenant.
- **Builder:** editor visual dentro do admin. Preview em tempo real.

### 10.2 Draft vs Published
- Toda edição no builder é draft.
- Preview reflete o draft em tempo real.
- Publicação é ação explícita, imediata e visível ao público; qualquer reversão exige nova publicação ou mecanismo formal de rollback.
- Storefront público consome apenas o último snapshot publicado.

### 10.3 Tratamento de Erros em Blocos

| Contexto | Comportamento |
|----------|--------------|
| Builder (admin) | Erro visível para o usuário com informação do problema |
| Storefront (público) | Fallback seguro (não quebra a página) + log estruturado + sinalização ao admin. Nunca `return null` silencioso. |

### 10.4 Blocos em Refatoração
- Blocos que ainda precisam de refatoração devem ter tratamento seguro de erro conforme 10.3.
- Proibido mascarar problema de bloco com fallback invisível.

---

## 11. ATRIBUIÇÃO, DESCONTOS E OFERTAS

### 11.1 Atribuição de Venda
- Atribuição interna do sistema é a fonte primária e exata.
- Atribuição das plataformas externas (Meta, Google, TikTok) é complementar.
- O sistema respeita as janelas de atribuição oficiais de cada plataforma antes de consolidar.

### 11.2 Matriz de Coexistência — Descontos e Ofertas

| Mecanismo | Coexiste com | Limite |
|-----------|-------------|--------|
| Cupom de desconto | Promoção, Bump, Upsell, Ofertas | Máximo 1 cupom por checkout |
| Promoção (preço promocional) | Cupom, Bump, Upsell | Sem limite de coexistência |
| Bump (oferta no checkout) | Cupom, Promoção, Upsell | Adicional ao pedido |
| Upsell (pós-compra) | Cupom, Promoção, Bump | Adicional ao pedido |

- Nenhum desses mecanismos anula o outro.
- Cupom pode aplicar no carrinho inteiro ou em produto específico, conforme regra definida pelo usuário ao criar o cupom.
- Esses mecanismos não são mutuamente excludentes.

---

## 12. LOGÍSTICA

### 12.1 Separação de Status
- **Status de negócio do pedido** = core interno (pending, approved, shipped, delivered, cancelled, etc.).
- **Status de tracking/rastreamento** = transportadora/provedor logístico.
- São domínios separados. O sistema reconcilia periodicamente.

### 12.2 Reconciliação
- Tracking externo atualiza eventos logísticos.
- Transição de status de negócio do pedido depende de regras internas, não apenas do tracking.
- Divergências geram alerta, não correção automática silenciosa.

---

## 13. AÇÕES DESTRUTIVAS

### 13.1 Definição
Ação destrutiva = exclusão, limpeza, recriação, migração em massa, reset, reassociação em lote ou qualquer operação que não pode ser trivialmente revertida.

### 13.2 Trava Obrigatória
- Toda ação destrutiva exige autorização explícita do usuário.
- Antes de executar, informar: o que será afetado, em qual fluxo/módulo, risco, como validar, como reverter.
- Dupla confirmação para dados core (pedidos, clientes, produtos).

### 13.3 Dados Protegidos
- Pedidos nunca são excluídos fisicamente (soft delete ou arquivamento).
- Clientes com pedidos não podem ser excluídos.
- Produtos vinculados a pedidos não podem ser excluídos.

---

## 14. ROLLOUT

### 14.1 Regra Padrão
- Todas as alterações são aplicadas para **todos os tenants** do sistema simultaneamente.
- Exceção somente por instrução explícita do usuário para tenant específico.

### 14.2 Módulos em Construção
- Módulos/funcionalidades marcados como "em construção" ficam visíveis apenas para tenants especiais e admin.
- A liberação para todos os tenants ocorre após validação e confirmação do usuário.

### 14.3 Refatorações Sensíveis
- Mudança estrutural, refatoração de fluxo crítico ou alteração de contrato entre módulos segue validação adicional antes da liberação geral.

---

## 15. FECHAMENTO OBRIGATÓRIO

Nenhum ajuste pode ser considerado concluído sem:

1. Validar o sintoma original.
2. Validar o fluxo completo (não apenas o ponto de correção).
3. Validar os módulos conectados mais relevantes.
4. Verificar se a correção não conflita com este documento.
5. Verificar se não criou regressão conhecida.
6. Informar claramente o que foi corrigido, o que foi impactado e como testar.

Se houver dúvida sobre fechamento, não declarar "resolvido".

---

## 16. ANTI-REGRESSÃO

### 16.1 Regras
- Toda correção estrutural deve considerar impacto direto e indireto.
- Não alterar base compartilhada, regra global ou comportamento sensível sem mapear efeito lateral.
- Se o erro já apareceu mais de uma vez, instalar diagnóstico antes da próxima correção.

### 16.2 Diagnóstico Obrigatório
- Erros recorrentes entre sessões devem ser registrados na seção 17.
- Antes da terceira tentativa de correção do mesmo problema, parar e revisar a abordagem.

---

## 17. ERROS RECORRENTES — PADRÕES DE FALHA

Registro de padrões de falha que já apareceram mais de uma vez, para evitar repetição de diagnóstico incorreto. Detalhes técnicos específicos (nomes de triggers, funções, queries) ficam nos docs de especificação dos módulos afetados.

| # | Padrão de Falha | Módulo | Causa Real | Sessão de Registro |
|---|-----------------|--------|------------|-------------------|
| 1 | Trigger de tagging de cliente reportado como usando status ou operação incorretos | Pedidos/Clientes | Diagnóstico falso. O trigger opera corretamente com o status canônico e sem operações destrutivas. | 2026-04-03 |
| 2 | Trigger de métricas de cliente inflaciona contadores | Pedidos/Clientes | Trigger disparava em todo INSERT de pedido independente do status, sem filtrar por pagamento aprovado. | 2026-04-03 |
| — | — | — | — | — |

---

## 18. PROTOCOLO DE INCLUSÃO DE NOVOS RECURSOS

Antes de implementar qualquer novo recurso (módulo, submódulo, função, integração, agente, edge function, tela, bloco, automação, relatório, configuração ou outro), seguir obrigatoriamente:

### Checklist de 10 Etapas

| # | Etapa | Descrição |
|---|-------|-----------|
| 1 | Classificação | Que tipo de recurso é? (módulo, função, integração, bloco, etc.) |
| 2 | Domínio dono | Qual módulo/área é responsável? |
| 3 | Fonte de verdade | Onde os dados deste recurso vivem? |
| 4 | Impacto cruzado | Quais módulos são afetados? |
| 5 | Criticidade | Qual o nível (Crítico, Alto, Médio, Baixo)? |
| 6 | Alocação documental | Em qual doc de especificação será documentado? |
| 7 | Contratos | Quais contratos com outros módulos precisam ser definidos? |
| 8 | Rollout | Segue regra padrão (todos os tenants) ou precisa de exceção? |
| 9 | Segurança | Precisa de RLS, validação de tenant, trava destrutiva? |
| 10 | Confirmação | Usuário confirmou a implementação? |

### Proibições
- Proibido implementar novo recurso sem classificar.
- Proibido inventar encaixe estrutural sem registrar.
- Proibido criar novo doc, módulo, regra estrutural ou alocação documental sem declarar onde será registrado e pedir confirmação.
- Se a novidade estiver ambígua, parar e pedir direcionamento.

---

## 19. MAPEAMENTO ARQUIVO → DOC

### 19.1 Docs de Especificação Ativos (Legado em Transição)

Os docs abaixo pertencem à estrutura antiga (`docs/regras/*.md`). Durante a transição, continuam sendo consultados para detalhes funcionais dos módulos. Serão substituídos pelos novos docs de especificação (Layer 3) quando estes estiverem prontos.

| Módulo | Doc de Especificação (legado) | Status |
|--------|-------------------------------|--------|
| Pedidos | `docs/regras/pedidos.md` | ✅ Ready |
| Checkouts Abandonados | `docs/regras/checkouts-abandonados.md` | ✅ Ready |
| Produtos | `docs/regras/produtos.md` | ✅ Ready |
| Categorias | `docs/regras/categorias.md` | ✅ Ready |
| Clientes | `docs/regras/clientes.md` | ✅ Ready |
| Descontos | `docs/regras/descontos.md` | ✅ Ready |
| Loja Virtual | `docs/regras/loja-virtual.md` | ✅ Ready |
| Builder | `docs/regras/builder.md` | ✅ Ready |
| Header | `docs/regras/header.md` | ✅ Ready |
| Footer | `docs/regras/footer.md` | ✅ Ready |
| Carrinho | `docs/regras/carrinho.md` | ✅ Ready |
| Checkout | `docs/regras/checkout.md` | ✅ Ready |
| Página de Produto | `docs/regras/pagina-produto.md` | ✅ Ready |
| Página de Categoria | `docs/regras/pagina-categoria.md` | ✅ Ready |
| Página de Obrigado | `docs/regras/pagina-obrigado.md` | ✅ Ready |
| Páginas Institucionais | `docs/regras/paginas-institucionais.md` | ✅ Ready |
| Blog | `docs/regras/blog.md` | ✅ Ready |
| Ofertas (Bump/Upsell) | `docs/regras/ofertas.md` | ✅ Ready |
| Avaliações | `docs/regras/avaliacoes.md` | ✅ Ready |
| Mídias/Uploads | `docs/regras/midias-uploads.md` | ✅ Ready |
| Geração de Imagens IA | `docs/regras/geracao-imagens-ai.md` | ✅ Ready |
| Campanhas | `docs/regras/campanhas.md` | ✅ Ready |
| Pacotes IA | `docs/regras/pacotes-ia.md` | ✅ Ready |
| Central de Comando | `docs/regras/central-comando.md` | ✅ Ready |
| Usuários e Permissões | `docs/regras/usuarios-permissoes.md` | ✅ Ready |
| Planos e Billing | `docs/regras/planos-billing.md` | ✅ Ready |
| Configurações do Sistema | `docs/regras/configuracoes-sistema.md` | ✅ Ready |
| Emails da Plataforma | `docs/regras/platform-emails.md` | ✅ Ready |
| Platform Admin | `docs/regras/platform-admin.md` | ✅ Ready |
| Auxiliar de Comando | `docs/regras/auxiliar-comando.md` | ✅ Ready |
| Importação | `docs/regras/importacao.md` | ✅ Ready |
| Afiliados | `docs/regras/afiliados.md` | ✅ Ready |
| Shopee | `docs/regras/shopee.md` | ✅ Ready |
| Domínios | `docs/regras/dominios.md` | ✅ Ready |
| Feature Rollout | `docs/regras/feature-rollout.md` | ✅ Ready |
| Edge Functions | `docs/regras/edge-functions.md` | ✅ Ready |
| Tenants | `docs/regras/tenants.md` | ✅ Ready |
| Regras Gerais | `docs/regras/regras-gerais.md` | ✅ Ready |
| Marketing Integrações | `docs/regras/marketing-integracoes.md` | 🟧 Pending |
| Email Marketing | `docs/regras/email-marketing.md` | 🟧 Pending |
| CRM | `docs/regras/crm.md` | 🟧 Pending |
| Suporte | `docs/regras/suporte.md` | 🟧 Pending |
| ERP | `docs/regras/erp.md` | 🟧 Pending |
| Logística | `docs/regras/logistica.md` | 🟧 Pending |
| Influencers | `docs/regras/influencers.md` | 🟧 Pending |
| Mercado Livre | `docs/regras/mercado-livre.md` | 🟧 Pending |
| Hub de Integrações | `docs/regras/integracoes.md` | 🟧 Pending |

### 19.2 Docs Removidos

| Doc | Motivo | Data |
|-----|--------|------|
| `docs/regras/olist.md` | Integração descontinuada. Excluído fisicamente. | 2026-04-03 |

---

## 20. REGRAS DE MANUTENÇÃO DOS DOCUMENTOS

### 20.1 Imutabilidade
- Documentos estruturais (Layer 2 e Layer 3) não podem ser alterados silenciosamente pela IA.
- Alteração somente por comando explícito do usuário ou pelo fluxo propose-confirm-apply.

### 20.2 Protocolo Propose-Confirm-Apply
1. Se uma implementação impactar este documento ou um doc de especificação, identificar quais docs foram impactados.
2. Explicar por que precisam ser atualizados.
3. Propor o texto de atualização.
4. Pedir confirmação explícita do usuário.
5. Aplicar somente após confirmação.

### 20.3 Bloco de Documentação Pendente
Toda entrega que impacte docs estruturais deve finalizar com:

```
📝 DOCUMENTAÇÃO NECESSÁRIA:
- Doc(s) impactado(s):
- Motivo:
- Proposta de atualização:
- Aguardando confirmação para atualizar
```

O trabalho só é considerado 100% fechado quando a documentação estiver aplicada ou explicitamente pendente de confirmação do usuário.

---

## 21. AVALIAÇÕES — REGRA ESTRUTURAL

### Classificação Canônica
- **Avaliação verificada:** feita por cliente com pedido aprovado. Exibe marcação "Cliente verificado".
- **Avaliação não verificada:** feita sem vínculo com pedido aprovado ou importada.
- **Conteúdo gerado por IA / material promocional:** deve ser claramente identificado como tal.

### Regra de Aprovação
- Toda avaliação passa por aprovação manual antes de ser publicada.

---

## 22. PLANOS — REGRA ESTRUTURAL

### Planos Canônicos
O sistema opera com **3 planos**:
1. **Básico**
2. **Médio**
3. **Completo**

Detalhes de cada plano (features, limites, preços, créditos) ficam no doc de especificação `planos-billing.md`.

---

## 23. TENANTS ÂNCORA

| Tenant | Email | Tenant ID | Descrição |
|--------|-------|-----------|-----------|
| **Super Admin (Platform)** | `toniravaziojr@gmail.com` | `cc000000-0000-0000-0000-000000000001` | Admin da plataforma com Admin Mode Toggle |
| **Tenant Base Especial** | `respeiteohomem@gmail.com` | `d1a4d0ed-8842-495e-b741-540a9a345b25` | Tenant cliente especial (plan=unlimited, is_special=true) |

- "Somente no tenant base especial" = **SPECIAL ONLY** (não afetar platform/admin nem customers comuns).
- Esses IDs são referência operacional. Não usar como hardcode em lógica de negócio — usar hooks canônicos (§24).

---

## 24. HOOKS DE ACESSO AO TENANT

| Hook | Status | Descrição |
|------|--------|-----------|
| **`useTenantAccess`** | ✅ **CANÔNICO** | Hook unificado. Retorna: `tenantType`, `plan`, `isSpecial`, `isPlatform`, `isPlatformTenant`, `isCustomerTenant`, `isUnlimited`, `planLevel`, `canAccess(feature)`, `showStatusIndicators`, `overrides` |
| `useTenantType` | ⚠️ **DEPRECATED** | Wrapper fino sobre `useTenantAccess`. Mantido para backwards compat. Usar `useTenantAccess` em código novo. |
| `useIsSpecialTenant` | ⚠️ **DEPRECATED** | Wrapper fino sobre `useTenantAccess().showStatusIndicators`. Usar `useTenantAccess` em código novo. |
| **`usePlatformOperator`** | ✅ Ativo | Verifica se o usuário é admin da plataforma (tabela `platform_admins`). Eixo separado do tenant access. |
| **`usePermissions`** | ✅ Ativo | RBAC de sub-usuários (owner/admin/operator/viewer). Eixo separado. |

### Regras de Uso

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Usar `useTenantType` em código novo | Usar `useTenantAccess` |
| Usar `useIsSpecialTenant` em código novo | Usar `useTenantAccess().showStatusIndicators` |
| Criar novo hook para dados do tenant | Adicionar ao `useTenantAccess` |

### Auth / RLS (Resumo Operacional)

| Aspecto | Descrição |
|---------|-----------|
| **Auth** | `auth.users` → `profiles` (id igual) |
| **Multi-tenancy** | `tenants` + `user_roles`; `profiles.current_tenant_id` = tenant ativo |
| **Roles** | Usar `hasRole()` (nunca hardcoded) |
| **Platform admins** | Tabela `platform_admins` (separado). Platform admin não precisa de tenant para acessar |

---

## 25. LOCAIS CANÔNICOS DE FUNCIONALIDADE

| Local Canônico | Responsabilidade |
|----------------|------------------|
| **Integrações (hub)** | Conectar/configurar integrações e credenciais globais |
| **Atendimento** | Todas as mensagens de todos os canais (incluindo Mercado Livre: `channel_type='mercadolivre'`) |
| **Marketplaces** | Operações específicas do marketplace (proibido "Mensagens" como aba principal) |
| **Fiscal (NFe)** | Módulo fiscal/certificado — **não é "integração"** |
| **Logística (/shipping)** | Frete e transportadoras — **não fica em Integrações** |
| **Meu Drive (public.files)** | Fonte de verdade de arquivos/mídias do tenant |
| **Usuários e Permissões** | Equipe do tenant — não confundir com `platform_admins` |

---

## 26. CREDENCIAIS GLOBAIS (platform_credentials)

| Regra | Descrição |
|-------|-----------|
| **Allowlist** | Qualquer nova key precisa estar na allowlist de edição da edge function de update (ex: `EDITABLE_CREDENTIALS`), senão o save deve falhar |
| **UX admin** | Após salvar, UI deve refletir estado persistido (SET + preview mascarado) e permitir editar/remover |

---

## 27. ISENÇÃO DE DOCUMENTAÇÃO — AÇÕES MANUAIS EM TENANTS

| Regra | Descrição |
|-------|-----------|
| **Ações manuais em tenants específicos NÃO exigem documentação** | Quando o usuário solicitar ação operacional direta em um tenant (limpeza de dados, enriquecimento, correção pontual, exclusão/inserção manual), **NÃO** é necessário atualizar docs de módulo. |
| **Justificativa** | Essas ações não alteram estrutura, lógica, UI/UX ou comportamento do sistema. São operações pontuais e específicas. |
| **Exceção** | Se a ação resultar em criação de nova edge function reutilizável, alteração de schema, nova regra de negócio ou mudança para todos os tenants — aí sim, documentar normalmente. |

---

*Fim do documento.*


# Reformular UX da tela de Configurações Fiscais e alinhar docs ao Caminho B

## Objetivo

Tornar a tela de Configurações Fiscais clara, informativa e sem bugs visuais — o lojista deve saber exatamente **o que falta**, **o que já está pronto** e **se o certificado foi aceito**. Em paralelo, atualizar os documentos do módulo, que ainda descrevem a arquitetura antiga de leitura local do certificado.

---

## 1. Reorganização da tela (visual e hierarquia)

### Topo — Cartão de Status acionável
Substituir o badge vago "Incompleto" + alerta amarelo genérico por um **Cartão de Prontidão Fiscal**:

- Título: "Pronto para emitir NF-e?"
- Selo grande à direita: **Pronto** (verde) ou **Faltam X itens** (âmbar) ou **Bloqueado** (vermelho, quando há divergência de CNPJ ou certificado expirado).
- Lista de checagens com ícone ✓ / ⚠ / ✗:
  - Dados da empresa (Razão Social, CNPJ, IE/Isento)
  - Endereço fiscal completo
  - Regime tributário e parâmetros padrão (CRT, Origem, CFOPs)
  - Certificado Digital A1 enviado e válido
  - CNPJ do certificado coincide com o CNPJ do emitente
  - Ambiente selecionado (Homologação/Produção)
- Cada item com link "Ir para" que rola até o cartão correspondente.
- Quando o ambiente está em Homologação, faixa âmbar discreta no cartão: "Você está em Homologação — notas não têm valor fiscal."

### Reordenação dos cartões
Hoje: grid 2 colunas com 4 cartões soltos. Proposta:

1. **Cartão de Status** (largura total, primeiro elemento)
2. **Identidade da Empresa** (largura total — agrupa Dados + Endereço lado a lado dentro do mesmo cartão; campos relacionados ficam visualmente unificados)
3. **Certificado Digital A1** (destaque — borda mais marcada, ícone de chave em destaque)
4. **Parâmetros Fiscais** (Regime, Origem, CFOPs, CSOSN/CST, Série/Número)
5. **Ambiente de Emissão** (cartão pequeno e claro, com aviso visual quando em Homologação)

### Botão Salvar
Hoje fica perdido no topo direito. Tornar **fixo no rodapé da página** quando há alterações não salvas, com indicador "Alterações não salvas" e botão "Descartar".

---

## 2. Card do Certificado Digital — corrigir comportamento e clareza

### Problemas atuais
- Após upload bem-sucedido, o card às vezes ainda mostra "Nenhum certificado configurado" (refresh insuficiente do estado).
- Quando há certificado válido, o formulário de upload continua visível em cima, confundindo.
- Mensagens de erro do Focus NFe chegam genéricas em alguns cenários.

### Correções
- **Refresh imediato:** após upload bem-sucedido ou substituição, recarregar o card com nome do titular, CNPJ, validade e dias restantes — sem precisar atualizar a página.
- **Estado "vazio" claro:** quando não há certificado, mostrar área grande de drop/upload com instruções: "Envie seu certificado A1 (.pfx) e a senha. Validamos automaticamente com o Focus NFe."
- **Estado "configurado":** mostrar resumo do certificado em destaque (nome, CNPJ formatado, validade com cor — verde/âmbar/vermelho conforme dias restantes) e esconder o formulário atrás de um botão discreto **"Substituir certificado"**. Ao clicar, abre área de upload com aviso: "Substituir o certificado atual encerra o vínculo anterior e cadastra a nova empresa no Focus NFe."
- **Estado "divergência de CNPJ":** banner vermelho destacado dentro do card, com a mensagem clara já especificada (CNPJ do certificado vs CNPJ do emitente) e dois botões de ação: **"Atualizar CNPJ do emitente para XX.XXX.XXX/XXXX-XX"** (atualiza o campo automaticamente) e **"Enviar outro certificado"**.
- **Estado "expirado/expirando":** banner âmbar/vermelho com prazo + botão "Substituir certificado".
- **Mensagens do Focus NFe:** garantir que toda resposta de erro do Focus seja traduzida e exibida diretamente no card (não só em toast efêmero).

---

## 3. Microinterações e feedback

- Toast de sucesso após upload muda para **inline persistente** dentro do card por 8 segundos: "Certificado validado pelo Focus NFe. Pronto para emitir NF-e."
- Botão "Substituir Certificado" fica desabilitado durante upload com texto **"Validando com Focus NFe…"** (hoje só mostra spinner mudo).
- Campo Senha: ícone de olho para mostrar/ocultar (hoje só password oculto).
- Mensagem do estado "Aguardando dados da empresa" quando o lojista enviou cert mas não preencheu CNPJ/Razão Social ainda.

---

## 4. Validação técnica obrigatória

Antes de declarar concluído, executar:

- **Teste 1 — Upload sem certificado prévio:** enviar `.pfx` válido → confirmar que o card atualiza imediatamente com nome + CNPJ + validade vindos do Focus NFe.
- **Teste 2 — Substituição com mesmo CNPJ:** enviar novo `.pfx` do mesmo CNPJ → confirmar que validade atualiza sem erro de divergência.
- **Teste 3 — Substituição com CNPJ diferente sem ajustar dados antes:** confirmar que aparece o banner de divergência com botão "Atualizar CNPJ do emitente para XX.XXX.XXX/XXXX-XX" e que o botão funciona.
- **Teste 4 — Senha errada:** confirmar mensagem amigável "Senha do certificado incorreta" no card (não só no toast).
- **Teste 5 — Status acionável:** com tenant incompleto, validar que cada item do checklist marca/desmarca corretamente conforme o lojista preenche.
- **Teste 6 — Logs do Focus:** verificar via logs do servidor que cada cenário gera a resposta esperada e que a tela reflete fielmente.

---

## 5. Atualização documental obrigatória

Os documentos atuais ainda descrevem a arquitetura antiga (leitura local do .pfx + auto-swap de CNPJ). Atualizar:

- **`docs/especificacoes/erp/erp-fiscal.md`** — seção "Protocolo de Troca de CNPJ" deve refletir o novo fluxo: a leitura é delegada ao Focus NFe, a troca de empresa exige que o lojista atualize CNPJ + dados antes do reenvio, e a UI agora oferece um botão "Atualizar CNPJ do emitente" quando detecta divergência. Também atualizar a seção "Leitura do certificado A1" e a tabela "Categorização do upload" — várias dessas categorias hoje vêm do Focus NFe, não do leitor local.
- **`docs/especificacoes/transversais/mapa-ui.md`** — atualizar a entrada de `/fiscal/configuracoes` descrevendo a nova hierarquia (Cartão de Status no topo, Identidade unificada, Certificado em destaque, Parâmetros, Ambiente, Salvar fixo no rodapé).
- **Memória do projeto:** atualizar a memória de constraint sobre validação delegada ao Focus NFe (já existe) com nota sobre a UI nova e o botão de auto-correção do CNPJ.
- **Anti-regressão:** registrar memória nova prevenindo regressão da invalidação do estado pós-upload (problema do "card que não atualiza").

---

## Escopo

**Incluído:** apenas tela de Configurações Fiscais (aba Emitente), atualização dos docs e memórias relacionadas.

**Não incluído:** mudanças em emissão de NF-e, sincronização com Focus NFe (já está OK), regras de assinatura, banco de dados, outras abas de configuração (Natureza Jurídica, Outros) — exceto se necessário para coerência visual mínima do header.

---

## Riscos e mitigações

- **Risco:** botão "Atualizar CNPJ do emitente" pode causar inconsistência se o lojista tinha preenchido errado o resto dos dados.  
  **Mitigação:** o botão só atualiza o campo CNPJ; o lojista ainda precisa revisar Razão Social, IE e endereço (o checklist mostra esses pendentes).

- **Risco:** mudanças visuais podem afetar a aba Fiscal embutida em `/system/settings?tab=fiscal`.  
  **Mitigação:** o componente é o mesmo (`EmitenteSettings`), então a melhoria aparece nos dois lugares — validar visualmente os dois pontos de entrada.

- **Risco:** docs desatualizados podem confundir suporte.  
  **Mitigação:** atualizar na mesma entrega (regra obrigatória do projeto).

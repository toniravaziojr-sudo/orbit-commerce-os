## Como funciona hoje

A plataforma usa uma única biblioteca para abrir o arquivo do certificado digital A1 (.pfx) em dois momentos críticos do módulo fiscal:

1. **No envio do certificado** (configurações fiscais), para validar senha, extrair CNPJ, validade e número de série, e sincronizar com a Focus NFe.
2. **Na assinatura do XML da NF-e** (toda emissão), para extrair a chave privada e assinar o XML antes de enviar à SEFAZ.

Essa biblioteca só entende o formato antigo do .pfx (TripleDES). Certificados modernos vêm em formato AES-256/PBES2, e por isso o arquivo nem chega a ser aberto — falha antes mesmo de testar a senha. Esse é o motivo do erro reportado.

## O problema

- O lojista reexportar em "compatibilidade" resolve um caso pontual, mas qualquer outro tenant com certificado moderno vai bater no mesmo erro.
- Mesmo se o envio funcionar, a hora de **emitir NF-e** usa exatamente a mesma biblioteca para assinar o XML — o problema reapareceria silenciosamente na emissão.
- A documentação já reconhece essa limitação como evolução pendente.

## Resultado esperado

- Qualquer certificado A1 padrão de mercado (formato moderno ou antigo) é aceito no envio sem precisar reexportar.
- A assinatura do XML da NF-e funciona com qualquer um desses certificados.
- Mensagens de erro continuam claras (senha errada, CNPJ divergente, arquivo corrompido, certificado vencido).
- Nenhum lojista que já está com certificado salvo perde acesso.

## Estratégia (cirúrgica e anti-regressão)

A troca **não** vai substituir tudo. Vai trocar **apenas a etapa de abrir o .pfx** por uma biblioteca moderna que entende qualquer cifra. Tudo o que vem depois (assinatura XML, geração de PEM, integração com Focus NFe, criptografia em banco) continua igual. Isso minimiza superfície de regressão.

### Onda A — Camada única e isolada para abrir o PFX

Criar um único ponto interno que abre o .pfx e devolve sempre o mesmo formato: chave privada e certificado em PEM (texto), mais metadados (CNPJ, validade, número de série, nome do titular).

- Esse ponto único tenta primeiro a biblioteca moderna. Se ela falhar, faz fallback para a biblioteca antiga (compatibilidade reversa total).
- Mensagens de erro continuam categorizadas: senha incorreta, formato inválido, ASN corrompido, certificado vencido.
- Nenhum certificado já salvo é afetado — a leitura no momento da emissão também passa por esse mesmo ponto único.

### Onda B — Reaproveitamento nos dois pontos críticos

- **Envio do certificado**: troca a chamada direta à biblioteca antiga pela camada nova. Mantém toda a lógica de validação de CNPJ, divergência com o emitente, sincronização Focus NFe, criptografia para o banco.
- **Assinatura do XML da NF-e**: troca apenas a abertura do .pfx pela camada nova. A assinatura em si continua usando a mesma biblioteca atual (que assina perfeitamente desde que receba a chave em PEM). Resultado: a SEFAZ recebe XML idêntico ao de hoje, mesmo formato, mesmo padrão de canonicalização.

### Onda C — Validação real ponta-a-ponta antes de declarar pronto

Sequência obrigatória de testes antes de fechar:

1. **Caso real do lojista** (certificado moderno que está falhando agora) — envio precisa funcionar.
2. **Caso compatibilidade** (certificado em TripleDES, formato antigo) — envio precisa continuar funcionando.
3. **Caso senha errada** — precisa exibir "senha incorreta" e não mensagem genérica.
4. **Caso CNPJ divergente do emitente** — precisa bloquear com mensagem clara (regra de negócio existente).
5. **Caso arquivo corrompido / PEM disfarçado** — mensagem categorizada correta.
6. **Emissão de NF-e em homologação** com o certificado moderno recém-aceito — assinatura precisa ser aceita pela SEFAZ.
7. **Lojista que já tem certificado salvo no banco** — próxima emissão precisa continuar funcionando sem reenvio.

A Onda só é declarada concluída quando os 7 casos passarem. O caso 6 e o 7 dependem de você acionar (homologação e uma emissão de teste).

### Onda D — Anti-regressão e governança

- Criar uma regra anti-regressão (memória de constraint) declarando que a abertura do .pfx é centralizada num único ponto, e que qualquer função fiscal nova **não pode** abrir o .pfx por conta própria.
- Atualizar a documentação fiscal removendo a "limitação conhecida" e descrevendo o novo modelo (camada única, fallback, formatos suportados).
- Atualizar o mapa de UI se a tela de configuração fiscal ganhar algum ajuste de mensagem (provavelmente não muda).
- Manter o envelope 200 + sucesso/erro em todas as funções fiscais (já implementado).

## Riscos identificados e como mitigar

| Risco | Mitigação |
|-------|-----------|
| Biblioteca nova não cobre algum caso raro | Fallback automático para a biblioteca antiga é obrigatório |
| Assinatura XML rejeitada pela SEFAZ por mudança de formato | Não trocamos o assinador. Só a abertura do PFX muda. A chave em PEM é idêntica. |
| Lojista que já tem certificado salvo quebra na próxima emissão | A camada única é usada também na emissão; ela aceita o conteúdo já salvo (mesmo conteúdo binário). Caso 7 do plano de teste valida isso. |
| Performance de assinatura piora | Camada nova só atua na abertura inicial; assinatura continua na mesma biblioteca. Sem impacto em loop por item. |
| Quebra silenciosa em algum tenant | Logs de diagnóstico (formato detectado, cifra, tamanho) ficam ligados na abertura para rastreio rápido. |

## Cronograma proposto

1. Onda A — implementação da camada única (rápida, isolada).
2. Onda B — substituição nos dois pontos de uso (igualmente isolada).
3. Onda C — testes 1 a 5 que eu mesmo executo via chamada direta à função.
4. Onda C — testes 6 e 7 que dependem de você (emissão homologação + verificação de um lojista existente).
5. Onda D — documentação e regra anti-regressão fechadas como parte da entrega.

## O que NÃO entra neste escopo (para evitar mistura de frente)

- Mudanças na assinatura XML em si.
- Mudanças no fluxo Focus NFe ou na sincronização de empresa.
- Reformulação da tela de configurações fiscais.
- Suporte a certificados A3 (token físico) — fora do escopo atual.

## Confirmação necessária antes de iniciar

- Aprovação para iniciar a Onda A imediatamente após você confirmar este plano.
- Disponibilidade sua para o teste 6 (emitir uma NF-e em homologação com o certificado novo) e o teste 7 (confirmar uma emissão de outro tenant que já tinha certificado funcionando) ao final.

// =============================================
// Focus NFe → mensagem amigável em PT-BR
// Centraliza tradução das respostas de erro do Focus para o usuário final.
// =============================================

export function translateFocusCertificateError(raw: string | undefined | null): string {
  const msg = String(raw ?? "").toLowerCase();

  if (!msg) {
    return "Não foi possível validar o certificado. Tente novamente em alguns minutos.";
  }

  // Senha
  if (/senha|password|incorreta|inválida.*certificad|mac|integridade|integrity/.test(msg)) {
    return "Senha do certificado incorreta. Verifique a senha e reenvie o arquivo.";
  }

  // Vencido
  if (/vencido|expirad|validade|expired/.test(msg)) {
    return "Este certificado está expirado. Solicite a renovação do certificado A1 e tente novamente.";
  }

  // Formato / corrompido
  if (/inválido|corrompido|formato|pkcs|asn|der|parse|malformed/.test(msg)) {
    return "Arquivo de certificado inválido ou corrompido. Reexporte o .pfx e tente novamente.";
  }

  // CNPJ divergente
  if (/cnpj.*divergente|cnpj.*não.*confere|cnpj.*difere|emitente/.test(msg)) {
    return "O CNPJ do certificado não corresponde ao CNPJ cadastrado nas configurações fiscais.";
  }

  // Empresa incompleta
  if (/razão social|razao_social|endereço|endereco|inscrição|inscricao|obrigatório|obrigatorio|cep|municipio|município|uf/.test(msg)) {
    return "Preencha todos os dados da empresa (razão social, endereço completo) antes de concluir a validação do certificado.";
  }

  // Indisponibilidade
  if (/timeout|indispon|503|504|gateway|conexão|conexao/.test(msg)) {
    return "Validação fiscal indisponível no momento. Tente novamente em alguns minutos.";
  }

  // Fallback: devolve a própria mensagem do Focus em PT-BR (geralmente já é PT)
  return `Não foi possível validar o certificado: ${raw}`;
}

/** Heurística: o erro reportado pelo Focus é sobre o certificado em si? */
export function isCertificateRelatedError(raw: string | undefined | null): boolean {
  const msg = String(raw ?? "").toLowerCase();
  return /certificad|senha|password|pfx|pkcs|mac|integridade|expirad|vencido|cnpj.*diverg|cnpj.*confer/.test(msg);
}

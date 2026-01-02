/**
 * SEFAZ NF-e WebService Endpoints
 * 
 * Mapeamento completo de todos os WebServices por UF
 * Versão: Layout 4.00
 * 
 * Referência: Portal Nacional NF-e
 * https://www.nfe.fazenda.gov.br/portal/webServices.aspx
 */

export type SefazService = 
  | 'NFeAutorizacao'
  | 'NFeRetAutorizacao' 
  | 'NfeConsultaProtocolo'
  | 'NfeStatusServico'
  | 'RecepcaoEvento'
  | 'NfeInutilizacao';

export type SefazEnvironment = 'producao' | 'homologacao';

export interface SefazEndpoint {
  NFeAutorizacao: string;
  NFeRetAutorizacao: string;
  NfeConsultaProtocolo: string;
  NfeStatusServico: string;
  RecepcaoEvento: string;
  NfeInutilizacao: string;
}

// Códigos IBGE das UFs
export const UF_CODES: Record<string, number> = {
  'AC': 12, 'AL': 27, 'AP': 16, 'AM': 13, 'BA': 29,
  'CE': 23, 'DF': 53, 'ES': 32, 'GO': 52, 'MA': 21,
  'MT': 51, 'MS': 50, 'MG': 31, 'PA': 15, 'PB': 25,
  'PR': 41, 'PE': 26, 'PI': 22, 'RJ': 33, 'RN': 24,
  'RS': 43, 'RO': 11, 'RR': 14, 'SC': 42, 'SP': 35,
  'SE': 28, 'TO': 17
};

// Mapeamento de UFs para autorizadores
export const UF_AUTORIZADORES: Record<string, string> = {
  'AC': 'SVRS', 'AL': 'SVRS', 'AP': 'SVRS', 'AM': 'AM',
  'BA': 'BA', 'CE': 'CE', 'DF': 'SVRS', 'ES': 'SVRS',
  'GO': 'GO', 'MA': 'SVRS', 'MT': 'MT', 'MS': 'MS',
  'MG': 'MG', 'PA': 'SVRS', 'PB': 'SVRS', 'PR': 'PR',
  'PE': 'PE', 'PI': 'SVRS', 'RJ': 'SVRS', 'RN': 'SVRS',
  'RS': 'RS', 'RO': 'SVRS', 'RR': 'SVRS', 'SC': 'SVRS',
  'SP': 'SP', 'SE': 'SVRS', 'TO': 'SVRS'
};

// Endpoints de Produção
const PRODUCAO_ENDPOINTS: Record<string, SefazEndpoint> = {
  'AM': {
    NFeAutorizacao: 'https://nfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4',
    NFeRetAutorizacao: 'https://nfe.sefaz.am.gov.br/services2/services/NfeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://nfe.sefaz.am.gov.br/services2/services/NfeConsulta4',
    NfeStatusServico: 'https://nfe.sefaz.am.gov.br/services2/services/NfeStatusServico4',
    RecepcaoEvento: 'https://nfe.sefaz.am.gov.br/services2/services/RecepcaoEvento4',
    NfeInutilizacao: 'https://nfe.sefaz.am.gov.br/services2/services/NfeInutilizacao4'
  },
  'BA': {
    NFeAutorizacao: 'https://nfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
    NFeRetAutorizacao: 'https://nfe.sefaz.ba.gov.br/webservices/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    NfeConsultaProtocolo: 'https://nfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    NfeStatusServico: 'https://nfe.sefaz.ba.gov.br/webservices/NFeStatusServico4/NFeStatusServico4.asmx',
    RecepcaoEvento: 'https://nfe.sefaz.ba.gov.br/webservices/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    NfeInutilizacao: 'https://nfe.sefaz.ba.gov.br/webservices/NFeInutilizacao4/NFeInutilizacao4.asmx'
  },
  'CE': {
    NFeAutorizacao: 'https://nfe.sefaz.ce.gov.br/nfe4/services/NFeAutorizacao4',
    NFeRetAutorizacao: 'https://nfe.sefaz.ce.gov.br/nfe4/services/NFeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://nfe.sefaz.ce.gov.br/nfe4/services/NFeConsultaProtocolo4',
    NfeStatusServico: 'https://nfe.sefaz.ce.gov.br/nfe4/services/NFeStatusServico4',
    RecepcaoEvento: 'https://nfe.sefaz.ce.gov.br/nfe4/services/NFeRecepcaoEvento4',
    NfeInutilizacao: 'https://nfe.sefaz.ce.gov.br/nfe4/services/NFeInutilizacao4'
  },
  'GO': {
    NFeAutorizacao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4',
    NFeRetAutorizacao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4',
    NfeStatusServico: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeStatusServico4',
    RecepcaoEvento: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4',
    NfeInutilizacao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeInutilizacao4'
  },
  'MG': {
    NFeAutorizacao: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
    NFeRetAutorizacao: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4',
    NfeStatusServico: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeStatusServico4',
    RecepcaoEvento: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeRecepcaoEvento4',
    NfeInutilizacao: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeInutilizacao4'
  },
  'MS': {
    NFeAutorizacao: 'https://nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4',
    NFeRetAutorizacao: 'https://nfe.sefaz.ms.gov.br/ws/NFeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://nfe.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4',
    NfeStatusServico: 'https://nfe.sefaz.ms.gov.br/ws/NFeStatusServico4',
    RecepcaoEvento: 'https://nfe.sefaz.ms.gov.br/ws/NFeRecepcaoEvento4',
    NfeInutilizacao: 'https://nfe.sefaz.ms.gov.br/ws/NFeInutilizacao4'
  },
  'MT': {
    NFeAutorizacao: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4',
    NFeRetAutorizacao: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4',
    NfeStatusServico: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4',
    RecepcaoEvento: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/RecepcaoEvento4',
    NfeInutilizacao: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeInutilizacao4'
  },
  'PE': {
    NFeAutorizacao: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4',
    NFeRetAutorizacao: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4',
    NfeStatusServico: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeStatusServico4',
    RecepcaoEvento: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeRecepcaoEvento4',
    NfeInutilizacao: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeInutilizacao4'
  },
  'PR': {
    NFeAutorizacao: 'https://nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4',
    NFeRetAutorizacao: 'https://nfe.sefa.pr.gov.br/nfe/NFeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4',
    NfeStatusServico: 'https://nfe.sefa.pr.gov.br/nfe/NFeStatusServico4',
    RecepcaoEvento: 'https://nfe.sefa.pr.gov.br/nfe/NFeRecepcaoEvento4',
    NfeInutilizacao: 'https://nfe.sefa.pr.gov.br/nfe/NFeInutilizacao4'
  },
  'RS': {
    NFeAutorizacao: 'https://nfe.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    NFeRetAutorizacao: 'https://nfe.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    NfeConsultaProtocolo: 'https://nfe.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    NfeStatusServico: 'https://nfe.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    RecepcaoEvento: 'https://nfe.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    NfeInutilizacao: 'https://nfe.sefazrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx'
  },
  'SP': {
    NFeAutorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
    NFeRetAutorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
    NfeConsultaProtocolo: 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
    NfeStatusServico: 'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
    RecepcaoEvento: 'https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx',
    NfeInutilizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx'
  },
  'SVRS': {
    NFeAutorizacao: 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    NFeRetAutorizacao: 'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    NfeConsultaProtocolo: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    NfeStatusServico: 'https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    RecepcaoEvento: 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    NfeInutilizacao: 'https://nfe.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx'
  },
  // Contingência SVC-AN (Ambiente Nacional)
  'SVC-AN': {
    NFeAutorizacao: 'https://www.svc.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
    NFeRetAutorizacao: 'https://www.svc.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    NfeConsultaProtocolo: 'https://www.svc.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    NfeStatusServico: 'https://www.svc.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx',
    RecepcaoEvento: 'https://www.svc.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    NfeInutilizacao: '' // Não disponível em contingência
  },
  // Contingência SVC-RS
  'SVC-RS': {
    NFeAutorizacao: 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    NFeRetAutorizacao: 'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    NfeConsultaProtocolo: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    NfeStatusServico: 'https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    RecepcaoEvento: 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    NfeInutilizacao: '' // Não disponível em contingência
  }
};

// Endpoints de Homologação
const HOMOLOGACAO_ENDPOINTS: Record<string, SefazEndpoint> = {
  'AM': {
    NFeAutorizacao: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4',
    NFeRetAutorizacao: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeConsulta4',
    NfeStatusServico: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeStatusServico4',
    RecepcaoEvento: 'https://homnfe.sefaz.am.gov.br/services2/services/RecepcaoEvento4',
    NfeInutilizacao: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeInutilizacao4'
  },
  'BA': {
    NFeAutorizacao: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
    NFeRetAutorizacao: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    NfeConsultaProtocolo: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    NfeStatusServico: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeStatusServico4/NFeStatusServico4.asmx',
    RecepcaoEvento: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    NfeInutilizacao: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeInutilizacao4/NFeInutilizacao4.asmx'
  },
  'CE': {
    NFeAutorizacao: 'https://nfeh.sefaz.ce.gov.br/nfe4/services/NFeAutorizacao4',
    NFeRetAutorizacao: 'https://nfeh.sefaz.ce.gov.br/nfe4/services/NFeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://nfeh.sefaz.ce.gov.br/nfe4/services/NFeConsultaProtocolo4',
    NfeStatusServico: 'https://nfeh.sefaz.ce.gov.br/nfe4/services/NFeStatusServico4',
    RecepcaoEvento: 'https://nfeh.sefaz.ce.gov.br/nfe4/services/NFeRecepcaoEvento4',
    NfeInutilizacao: 'https://nfeh.sefaz.ce.gov.br/nfe4/services/NFeInutilizacao4'
  },
  'GO': {
    NFeAutorizacao: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4',
    NFeRetAutorizacao: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4',
    NfeStatusServico: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeStatusServico4',
    RecepcaoEvento: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4',
    NfeInutilizacao: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeInutilizacao4'
  },
  'MG': {
    NFeAutorizacao: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
    NFeRetAutorizacao: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4',
    NfeStatusServico: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeStatusServico4',
    RecepcaoEvento: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeRecepcaoEvento4',
    NfeInutilizacao: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeInutilizacao4'
  },
  'MS': {
    NFeAutorizacao: 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4',
    NFeRetAutorizacao: 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4',
    NfeStatusServico: 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeStatusServico4',
    RecepcaoEvento: 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeRecepcaoEvento4',
    NfeInutilizacao: 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeInutilizacao4'
  },
  'MT': {
    NFeAutorizacao: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4',
    NFeRetAutorizacao: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4',
    NfeStatusServico: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4',
    RecepcaoEvento: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/RecepcaoEvento4',
    NfeInutilizacao: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeInutilizacao4'
  },
  'PE': {
    NFeAutorizacao: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4',
    NFeRetAutorizacao: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4',
    NfeStatusServico: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeStatusServico4',
    RecepcaoEvento: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeRecepcaoEvento4',
    NfeInutilizacao: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeInutilizacao4'
  },
  'PR': {
    NFeAutorizacao: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4',
    NFeRetAutorizacao: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeRetAutorizacao4',
    NfeConsultaProtocolo: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4',
    NfeStatusServico: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeStatusServico4',
    RecepcaoEvento: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeRecepcaoEvento4',
    NfeInutilizacao: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeInutilizacao4'
  },
  'RS': {
    NFeAutorizacao: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    NFeRetAutorizacao: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    NfeConsultaProtocolo: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    NfeStatusServico: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    RecepcaoEvento: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    NfeInutilizacao: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx'
  },
  'SP': {
    NFeAutorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
    NFeRetAutorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
    NfeConsultaProtocolo: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
    NfeStatusServico: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
    RecepcaoEvento: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx',
    NfeInutilizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx'
  },
  'SVRS': {
    NFeAutorizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    NFeRetAutorizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    NfeConsultaProtocolo: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    NfeStatusServico: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    RecepcaoEvento: 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    NfeInutilizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx'
  },
  // Contingência SVC-AN Homologação
  'SVC-AN': {
    NFeAutorizacao: 'https://hom.svc.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
    NFeRetAutorizacao: 'https://hom.svc.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    NfeConsultaProtocolo: 'https://hom.svc.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    NfeStatusServico: 'https://hom.svc.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx',
    RecepcaoEvento: 'https://hom.svc.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    NfeInutilizacao: ''
  },
  // Contingência SVC-RS Homologação
  'SVC-RS': {
    NFeAutorizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    NFeRetAutorizacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    NfeConsultaProtocolo: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    NfeStatusServico: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    RecepcaoEvento: 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    NfeInutilizacao: ''
  }
};

/**
 * Obtém o endpoint do WebService SEFAZ para uma UF específica
 */
export function getSefazEndpoint(
  uf: string,
  service: SefazService,
  ambiente: SefazEnvironment,
  contingencia: boolean = false
): string {
  // Determina o autorizador baseado na UF
  let autorizador = UF_AUTORIZADORES[uf];
  
  if (!autorizador) {
    throw new Error(`UF não suportada: ${uf}`);
  }

  // Em contingência, usa SVC-AN ou SVC-RS dependendo do autorizador normal
  if (contingencia) {
    // Estados que usam SVRS em contingência usam SVC-RS, outros usam SVC-AN
    autorizador = autorizador === 'SVRS' ? 'SVC-RS' : 'SVC-AN';
  }

  const endpoints = ambiente === 'producao' 
    ? PRODUCAO_ENDPOINTS[autorizador]
    : HOMOLOGACAO_ENDPOINTS[autorizador];

  if (!endpoints) {
    throw new Error(`Autorizador não encontrado: ${autorizador}`);
  }

  const url = endpoints[service];
  
  if (!url) {
    throw new Error(`Serviço ${service} não disponível para ${autorizador} em modo ${contingencia ? 'contingência' : 'normal'}`);
  }

  return url;
}

/**
 * Obtém o código IBGE da UF
 */
export function getUfCode(uf: string): number {
  const code = UF_CODES[uf.toUpperCase()];
  if (!code) {
    throw new Error(`UF não encontrada: ${uf}`);
  }
  return code;
}

/**
 * Obtém a UF pelo código IBGE
 */
export function getUfByCode(code: number): string {
  for (const [uf, ufCode] of Object.entries(UF_CODES)) {
    if (ufCode === code) {
      return uf;
    }
  }
  throw new Error(`Código IBGE não encontrado: ${code}`);
}

/**
 * Verifica se uma UF é válida
 */
export function isValidUf(uf: string): boolean {
  return uf.toUpperCase() in UF_CODES;
}

/**
 * SOAP Actions para cada serviço
 */
export const SOAP_ACTIONS: Record<SefazService, string> = {
  NFeAutorizacao: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
  NFeRetAutorizacao: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4/nfeRetAutorizacaoLote',
  NfeConsultaProtocolo: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF',
  NfeStatusServico: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF',
  RecepcaoEvento: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento',
  NfeInutilizacao: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4/nfeInutilizacaoNF'
};

/**
 * Namespaces XML usados nos WebServices
 */
export const NFE_NAMESPACES = {
  nfe: 'http://www.portalfiscal.inf.br/nfe',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  soap12: 'http://www.w3.org/2003/05/soap-envelope'
};

-- =============================================
-- TABELA IBGE MUNICÍPIOS - Códigos IBGE para NF-e
-- =============================================

-- Criar tabela de municípios IBGE
CREATE TABLE IF NOT EXISTS public.ibge_municipios (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  uf TEXT NOT NULL
);

-- Criar índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_ibge_municipios_uf ON public.ibge_municipios(uf);
CREATE INDEX IF NOT EXISTS idx_ibge_municipios_nome ON public.ibge_municipios(nome);
CREATE INDEX IF NOT EXISTS idx_ibge_municipios_nome_uf ON public.ibge_municipios(uf, nome);

-- RLS: Leitura pública (dados IBGE são públicos)
ALTER TABLE public.ibge_municipios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de municípios IBGE"
ON public.ibge_municipios
FOR SELECT
USING (true);

-- Inserir municípios das capitais e principais cidades (amostra inicial)
-- A lista completa tem ~5.570 municípios
INSERT INTO public.ibge_municipios (codigo, nome, uf) VALUES
-- São Paulo
('3550308', 'SAO PAULO', 'SP'),
('3509502', 'CAMPINAS', 'SP'),
('3518800', 'GUARULHOS', 'SP'),
('3547809', 'SANTO ANDRE', 'SP'),
('3548708', 'SAO BERNARDO DO CAMPO', 'SP'),
('3534401', 'OSASCO', 'SP'),
('3543402', 'RIBEIRAO PRETO', 'SP'),
('3552205', 'SOROCABA', 'SP'),
('3548500', 'SANTOS', 'SP'),
('3549805', 'SAO JOSE DOS CAMPOS', 'SP'),
('3530607', 'MOGI DAS CRUZES', 'SP'),
('3513801', 'DIADEMA', 'SP'),
('3525904', 'JUNDIAI', 'SP'),
('3535309', 'PAULINIA', 'SP'),
('3552502', 'SUMARE', 'SP'),
('3501608', 'AMERICANA', 'SP'),
('3523107', 'INDAIATUBA', 'SP'),
('3538709', 'PIRACICABA', 'SP'),
('3503208', 'ARARAQUARA', 'SP'),
('3549904', 'SAO JOSE DO RIO PRETO', 'SP'),
('3506003', 'BAURU', 'SP'),
('3526902', 'LIMEIRA', 'SP'),
('3556453', 'VINHEDO', 'SP'),
('3556701', 'VOTUPORANGA', 'SP'),
('3520509', 'HORTOLANDIA', 'SP'),
-- Rio de Janeiro
('3304557', 'RIO DE JANEIRO', 'RJ'),
('3301702', 'DUQUE DE CAXIAS', 'RJ'),
('3303500', 'NITEROI', 'RJ'),
('3303302', 'NILOPOLIS', 'RJ'),
('3305109', 'SAO GONCALO', 'RJ'),
('3304904', 'SAO JOAO DE MERITI', 'RJ'),
('3304300', 'PETROPOLIS', 'RJ'),
('3303906', 'NOVA IGUACU', 'RJ'),
('3300456', 'BELFORD ROXO', 'RJ'),
-- Minas Gerais
('3106200', 'BELO HORIZONTE', 'MG'),
('3170206', 'UBERLANDIA', 'MG'),
('3118601', 'CONTAGEM', 'MG'),
('3136702', 'JUIZ DE FORA', 'MG'),
('3106705', 'BETIM', 'MG'),
('3131307', 'IPATINGA', 'MG'),
('3143302', 'MONTES CLAROS', 'MG'),
('3154606', 'RIBEIRAO DAS NEVES', 'MG'),
('3170107', 'UBERABA', 'MG'),
-- Bahia
('2927408', 'SALVADOR', 'BA'),
('2910800', 'FEIRA DE SANTANA', 'BA'),
('2933307', 'VITORIA DA CONQUISTA', 'BA'),
('2905701', 'CAMACARI', 'BA'),
('2919207', 'JUAZEIRO', 'BA'),
('2920502', 'LAURO DE FREITAS', 'BA'),
-- Paraná
('4106902', 'CURITIBA', 'PR'),
('4113700', 'LONDRINA', 'PR'),
('4115200', 'MARINGA', 'PR'),
('4119905', 'PONTA GROSSA', 'PR'),
('4105805', 'CASCAVEL', 'PR'),
('4109401', 'FOZ DO IGUACU', 'PR'),
('4104808', 'CAMPO LARGO', 'PR'),
('4125506', 'SAO JOSE DOS PINHAIS', 'PR'),
-- Rio Grande do Sul
('4314902', 'PORTO ALEGRE', 'RS'),
('4305108', 'CAXIAS DO SUL', 'RS'),
('4304606', 'CANOAS', 'RS'),
('4313409', 'PELOTAS', 'RS'),
('4318705', 'SANTA MARIA', 'RS'),
('4311809', 'NOVO HAMBURGO', 'RS'),
('4307609', 'GRAVATAI', 'RS'),
('4323002', 'VIAMAO', 'RS'),
-- Santa Catarina
('4205407', 'FLORIANOPOLIS', 'SC'),
('4209102', 'JOINVILLE', 'SC'),
('4202404', 'BLUMENAU', 'SC'),
('4204608', 'CRICIUMA', 'SC'),
('4205902', 'GASPAR', 'SC'),
('4209003', 'JARAGUÁ DO SUL', 'SC'),
('4208302', 'ITAJAI', 'SC'),
('4211900', 'LAGES', 'SC'),
-- Pernambuco
('2611606', 'RECIFE', 'PE'),
('2609600', 'OLINDA', 'PE'),
('2607901', 'JABOATAO DOS GUARARAPES', 'PE'),
('2602902', 'CAMARAGIBE', 'PE'),
('2604106', 'CARUARU', 'PE'),
('2611101', 'PETROLINA', 'PE'),
-- Ceará
('2304400', 'FORTALEZA', 'CE'),
('2304285', 'EUSEBIO', 'CE'),
('2303709', 'CAUCAIA', 'CE'),
('2307304', 'MARACANAU', 'CE'),
('2305233', 'HORIZONTE', 'CE'),
('2306306', 'JUAZEIRO DO NORTE', 'CE'),
-- Goiás
('5208707', 'GOIANIA', 'GO'),
('5201108', 'APARECIDA DE GOIANIA', 'GO'),
('5201405', 'ANAPOLIS', 'GO'),
('5221403', 'SENADOR CANEDO', 'GO'),
-- Amazonas
('1302603', 'MANAUS', 'AM'),
-- Pará
('1501402', 'BELEM', 'PA'),
('1500800', 'ANANINDEUA', 'PA'),
('1508357', 'SANTAREM', 'PA'),
-- Maranhão
('2111300', 'SAO LUIS', 'MA'),
('2105302', 'IMPERATRIZ', 'MA'),
-- Piauí
('2211001', 'TERESINA', 'PI'),
('2210508', 'PARNAIBA', 'PI'),
-- Rio Grande do Norte
('2408102', 'NATAL', 'RN'),
('2407500', 'MOSSORO', 'RN'),
-- Paraíba
('2507507', 'JOAO PESSOA', 'PB'),
('2504009', 'CAMPINA GRANDE', 'PB'),
-- Alagoas
('2704302', 'MACEIO', 'AL'),
('2700300', 'ARAPIRACA', 'AL'),
-- Sergipe
('2800308', 'ARACAJU', 'SE'),
-- Espírito Santo
('3205309', 'VITORIA', 'ES'),
('3205002', 'VILA VELHA', 'ES'),
('3205200', 'SERRA', 'ES'),
('3201308', 'CARIACICA', 'ES'),
-- Mato Grosso
('5103403', 'CUIABA', 'MT'),
('5108402', 'VARZEA GRANDE', 'MT'),
('5106752', 'RONDONOPOLIS', 'MT'),
('5107909', 'SINOP', 'MT'),
-- Mato Grosso do Sul
('5002704', 'CAMPO GRANDE', 'MS'),
('5003207', 'DOURADOS', 'MS'),
('5005707', 'PONTA PORA', 'MS'),
-- Distrito Federal
('5300108', 'BRASILIA', 'DF'),
-- Rondônia
('1100205', 'PORTO VELHO', 'RO'),
('1100023', 'ARIQUEMES', 'RO'),
-- Acre
('1200401', 'RIO BRANCO', 'AC'),
-- Amapá
('1600303', 'MACAPA', 'AP'),
-- Roraima
('1400100', 'BOA VISTA', 'RR'),
-- Tocantins
('1721000', 'PALMAS', 'TO'),
('1702109', 'ARAGUAINA', 'TO')
ON CONFLICT (codigo) DO NOTHING;

-- Criar função para lookup de código IBGE por nome de cidade e UF
CREATE OR REPLACE FUNCTION public.get_ibge_municipio_codigo(p_cidade TEXT, p_uf TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_codigo TEXT;
  v_nome_normalizado TEXT;
BEGIN
  -- Normalizar nome da cidade (remover acentos, uppercase)
  v_nome_normalizado := UPPER(unaccent(TRIM(p_cidade)));
  
  -- Busca exata primeiro
  SELECT codigo INTO v_codigo
  FROM public.ibge_municipios
  WHERE uf = UPPER(p_uf) 
    AND (nome = v_nome_normalizado OR nome = UPPER(p_cidade))
  LIMIT 1;
  
  IF v_codigo IS NOT NULL THEN
    RETURN v_codigo;
  END IF;
  
  -- Busca por similaridade (primeiros caracteres)
  SELECT codigo INTO v_codigo
  FROM public.ibge_municipios
  WHERE uf = UPPER(p_uf) 
    AND nome LIKE v_nome_normalizado || '%'
  LIMIT 1;
  
  IF v_codigo IS NOT NULL THEN
    RETURN v_codigo;
  END IF;
  
  -- Busca por conteúdo
  SELECT codigo INTO v_codigo
  FROM public.ibge_municipios
  WHERE uf = UPPER(p_uf) 
    AND nome LIKE '%' || v_nome_normalizado || '%'
  LIMIT 1;
  
  RETURN v_codigo;
END;
$$;

-- =============================================================
-- SEED: Taxonomia Universal de Categorias (15 grupos macro + filhos)
-- =============================================================
INSERT INTO public.system_universal_categories (slug, parent_slug, name, level, regulatory_regime, typical_attributes, sort_order) VALUES
-- ===== BELEZA / COSMÉTICOS / CUIDADO PESSOAL =====
('beleza', NULL, 'Beleza, Cosméticos e Cuidado Pessoal', 1, 'anvisa_cosmetic', '["brand","line","gender","volume_capacity","is_kit","units_per_package","net_weight","ingredients","dermatologically_tested","hypoallergenic","cruelty_free"]'::jsonb, 10),
('beleza-cabelo', 'beleza', 'Cabelo', 2, 'anvisa_cosmetic', '["brand","line","hair_treatment_type","hair_types","fragrance","treatment_format","application_type","effects","volume_capacity","gender"]'::jsonb, 11),
('beleza-pele', 'beleza', 'Pele e Rosto', 2, 'anvisa_cosmetic', '["brand","line","skin_type","application_type","fragrance","spf","volume_capacity","gender"]'::jsonb, 12),
('beleza-barba', 'beleza', 'Barba', 2, 'anvisa_cosmetic', '["brand","line","application_type","fragrance","volume_capacity"]'::jsonb, 13),
('beleza-perfumaria', 'beleza', 'Perfumaria', 2, 'anvisa_cosmetic', '["brand","line","fragrance","fragrance_family","volume_capacity","gender"]'::jsonb, 14),
('beleza-higiene', 'beleza', 'Higiene Pessoal', 2, 'anvisa_cosmetic', '["brand","line","fragrance","volume_capacity","gender"]'::jsonb, 15),
('beleza-maquiagem', 'beleza', 'Maquiagem', 2, 'anvisa_cosmetic', '["brand","line","color","application_type","volume_capacity"]'::jsonb, 16),

-- ===== SAÚDE / SUPLEMENTAÇÃO =====
('saude', NULL, 'Saúde e Suplementação', 1, 'anvisa_health', '["brand","presentation","units_per_package","net_weight","ingredients","gender"]'::jsonb, 20),
('saude-suplementos', 'saude', 'Suplementos Alimentares', 2, 'anvisa_health', '["brand","line","flavor","presentation","units_per_package","net_weight","ingredients"]'::jsonb, 21),
('saude-vitaminas', 'saude', 'Vitaminas e Minerais', 2, 'anvisa_health', '["brand","presentation","units_per_package","net_weight"]'::jsonb, 22),
('saude-dispositivos', 'saude', 'Dispositivos Médicos', 2, 'anvisa_health', '["brand","model"]'::jsonb, 23),

-- ===== ALIMENTOS / BEBIDAS =====
('alimentos', NULL, 'Alimentos e Bebidas', 1, 'mapa', '["brand","flavor","net_weight","volume_capacity","food_restrictions","units_per_package"]'::jsonb, 30),
('alimentos-bebidas', 'alimentos', 'Bebidas', 2, 'mapa', '["brand","flavor","volume_capacity","units_per_package"]'::jsonb, 31),
('alimentos-secos', 'alimentos', 'Alimentos Secos', 2, 'mapa', '["brand","flavor","net_weight","food_restrictions"]'::jsonb, 32),

-- ===== MODA =====
('moda', NULL, 'Moda, Calçados e Acessórios', 1, 'none', '["brand","gender","size","color","material","season"]'::jsonb, 40),
('moda-roupas', 'moda', 'Roupas', 2, 'none', '["brand","gender","size","color","material","season","style"]'::jsonb, 41),
('moda-calcados', 'moda', 'Calçados', 2, 'none', '["brand","gender","size","color","material","style"]'::jsonb, 42),
('moda-acessorios', 'moda', 'Acessórios', 2, 'none', '["brand","gender","color","material"]'::jsonb, 43),

-- ===== ELETRÔNICOS =====
('eletronicos', NULL, 'Eletrônicos', 1, 'inmetro', '["brand","model","model_number","color","voltage","connectivity"]'::jsonb, 50),
('eletronicos-audio', 'eletronicos', 'Áudio', 2, 'inmetro', '["brand","model","model_number","color","connectivity"]'::jsonb, 51),
('eletronicos-celulares', 'eletronicos', 'Celulares e Smartphones', 2, 'anatel', '["brand","model","model_number","color","storage_capacity","ram"]'::jsonb, 52),
('eletronicos-informatica', 'eletronicos', 'Informática', 2, 'inmetro', '["brand","model","model_number","color","voltage"]'::jsonb, 53),
('eletronicos-wearables', 'eletronicos', 'Wearables', 2, 'anatel', '["brand","model","model_number","color","connectivity"]'::jsonb, 54),

-- ===== ELETRODOMÉSTICOS =====
('eletrodomesticos', NULL, 'Eletrodomésticos e Eletroportáteis', 1, 'inmetro', '["brand","model","model_number","color","voltage","power_watts","capacity"]'::jsonb, 60),

-- ===== CASA / MÓVEIS =====
('casa', NULL, 'Casa, Móveis, Decoração e Jardim', 1, 'none', '["brand","color","material","dimensions"]'::jsonb, 70),
('casa-moveis', 'casa', 'Móveis', 2, 'none', '["brand","color","material","dimensions"]'::jsonb, 71),
('casa-decoracao', 'casa', 'Decoração', 2, 'none', '["brand","color","material"]'::jsonb, 72),

-- ===== INFANTIL =====
('infantil', NULL, 'Brinquedos, Bebês e Infantil', 1, 'inmetro', '["brand","age_range","gender","color","material"]'::jsonb, 80),
('infantil-brinquedos', 'infantil', 'Brinquedos', 2, 'inmetro', '["brand","age_range","gender","material"]'::jsonb, 81),
('infantil-bebes', 'infantil', 'Bebês', 2, 'inmetro', '["brand","age_range","gender","color"]'::jsonb, 82),

-- ===== FERRAMENTAS / CONSTRUÇÃO =====
('ferramentas', NULL, 'Ferramentas, Construção e Materiais', 1, 'inmetro', '["brand","model","model_number","voltage","power_watts","material"]'::jsonb, 90),

-- ===== AUTOMOTIVO =====
('automotivo', NULL, 'Automotivo e Motos', 1, 'none', '["brand","model","compatible_vehicle","color"]'::jsonb, 100),

-- ===== PET =====
('pet', NULL, 'Pet Shop', 1, 'mapa', '["brand","pet_type","pet_size","flavor","net_weight"]'::jsonb, 110),

-- ===== ESPORTE =====
('esporte', NULL, 'Esporte e Lazer', 1, 'none', '["brand","sport_type","gender","size","color","material"]'::jsonb, 120),

-- ===== LIVROS / MÍDIA / PAPELARIA =====
('livros', NULL, 'Livros, Mídia e Papelaria', 1, 'none', '["brand","author","language","format"]'::jsonb, 130),

-- ===== INDUSTRIAL =====
('industrial', NULL, 'Industrial e Serviços', 1, 'none', '["brand","model","model_number"]'::jsonb, 140),

-- ===== OUTROS =====
('outros', NULL, 'Outros', 1, 'none', '[]'::jsonb, 999)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================
-- SEED: Dicionário Universal de Atributos (32 entradas iniciais)
-- =============================================================
INSERT INTO public.system_marketplace_attribute_dictionary
  (universal_key, label_pt, description_pt, value_type, derivable_from, ml_attribute_id, is_common, applies_to_categories) VALUES

-- Identificação básica
('brand',             'Marca',                'Marca do produto',                                   'string', 'product.brand',                     'BRAND',                  true,  ARRAY[]::text[]),
('line',              'Linha',                'Linha/coleção dentro da marca',                      'string', 'ai_inferred',                       'LINE',                   true,  ARRAY[]::text[]),
('model',             'Modelo',               'Modelo do produto',                                  'string', 'ai_inferred',                       'MODEL',                  true,  ARRAY[]::text[]),
('model_number',      'Código do Modelo',     'Número/código do fabricante',                        'string', 'product.external_reference',        'MODEL_NUMBER',           false, ARRAY[]::text[]),
('gtin',              'Código GTIN/EAN',      'Código de barras GTIN/EAN',                          'string', 'product.gtin',                      'GTIN',                   true,  ARRAY[]::text[]),
('seller_sku',        'SKU do vendedor',      'Código interno do lojista',                          'string', 'product.sku',                       'SELLER_SKU',             true,  ARRAY[]::text[]),

-- Condição / garantia
('item_condition',    'Condição do item',     'Novo, usado, recondicionado',                        'enum',   'derived.condition',                 'ITEM_CONDITION',         true,  ARRAY[]::text[]),
('warranty_type',     'Tipo de garantia',     'Garantia do vendedor ou fábrica',                    'enum',   'product.warranty_type',             'WARRANTY_TYPE',          true,  ARRAY[]::text[]),
('warranty_time',     'Duração da garantia',  'Duração textual (ex.: 3 meses)',                     'string', 'product.warranty_duration',         'WARRANTY_TIME',          true,  ARRAY[]::text[]),

-- Embalagem / kit
('is_kit',            'É kit',                'Produto é kit (vem com composição)',                 'boolean','derived.is_kit',                    'IS_KIT',                 true,  ARRAY[]::text[]),
('units_per_package', 'Unidades por embalagem','Quantidade de itens no kit/pacote',                 'number', 'derived.units_per_package',         'UNITS_PER_PACKAGE',      true,  ARRAY[]::text[]),
('net_weight',        'Peso líquido',         'Peso líquido do produto',                            'dimension','product.weight',                  'NET_WEIGHT',             false, ARRAY[]::text[]),
('volume_capacity',   'Volume / Conteúdo',    'Volume líquido (mL, L, g, kg)',                      'dimension','product.marketplace_volume',      'VOLUME_CAPACITY',        true,  ARRAY[]::text[]),

-- Público / sensorial
('gender',            'Gênero do público',    'Masculino / Feminino / Unissex / Infantil',          'enum',   'product.marketplace_gender',        'GENDER',                 true,  ARRAY[]::text[]),
('age_range',         'Faixa etária',         'Faixa etária recomendada',                           'enum',   'ai_inferred',                       'AGE_GROUP',              false, ARRAY['infantil','infantil-brinquedos','infantil-bebes']),

-- Beleza / cabelo / cosméticos
('hair_treatment_type','Tipo de tratamento',  'Anti-queda, anticaspa, hidratação, etc.',            'string', 'ai_inferred',                       'HAIR_TREATMENT_TYPE',    false, ARRAY['beleza-cabelo']),
('hair_types',        'Tipos de cabelo',      'Liso, ondulado, cacheado, crespo',                   'string', 'ai_inferred',                       'HAIR_TYPES',             false, ARRAY['beleza-cabelo']),
('treatment_format',  'Formato do tratamento','Shampoo, condicionador, máscara, etc.',              'string', 'ai_inferred',                       'TREATMENT_FORMAT',       false, ARRAY['beleza-cabelo']),
('application_type',  'Tipo de aplicação',    'Tópico, spray, creme, etc.',                         'string', 'ai_inferred',                       'APPLICATION_TYPE',       false, ARRAY['beleza','beleza-cabelo','beleza-pele','beleza-barba']),
('effects',           'Efeitos',              'Efeitos prometidos pelo produto',                    'string', 'ai_inferred',                       'EFFECTS',                false, ARRAY['beleza','beleza-cabelo','beleza-pele']),
('fragrance',         'Fragrância',           'Aroma/fragrância',                                   'string', 'ai_inferred',                       'FRAGRANCE',              false, ARRAY['beleza','beleza-perfumaria','beleza-cabelo','beleza-higiene','beleza-barba']),
('fragrance_family',  'Família olfativa',     'Família da fragrância (cítrico, amadeirado, etc.)',  'string', 'ai_inferred',                       'FRAGRANCE_FAMILY',       false, ARRAY['beleza-perfumaria']),
('ingredients',       'Ingredientes ativos',  'Ativos principais do produto',                       'string', 'ai_inferred',                       'INGREDIENTS',            false, ARRAY['beleza','saude']),
('dermatologically_tested','Dermat. testado', 'Possui teste dermatológico',                         'boolean','ai_inferred',                       'DERMATOLOGICALLY_TESTED',false, ARRAY['beleza','beleza-pele','beleza-cabelo']),
('hypoallergenic',    'Hipoalergênico',       'Produto hipoalergênico',                             'boolean','ai_inferred',                       'HYPOALLERGENIC',         false, ARRAY['beleza','beleza-pele']),
('cruelty_free',      'Livre de crueldade',   'Sem testes em animais',                              'boolean','ai_inferred',                       'CRUELTY_FREE',           false, ARRAY['beleza']),
('skin_type',         'Tipo de pele',         'Oleosa, seca, mista, sensível',                      'string', 'ai_inferred',                       'SKIN_TYPE',              false, ARRAY['beleza-pele']),
('presentation',      'Apresentação',         'Cápsula, comprimido, pó, líquido, etc.',             'string', 'ai_inferred',                       'PRESENTATION',           false, ARRAY['saude','saude-suplementos','saude-vitaminas']),

-- Alimentos / Pet
('flavor',            'Sabor',                'Sabor do produto',                                   'string', 'ai_inferred',                       'FLAVOR',                 false, ARRAY['alimentos','alimentos-bebidas','alimentos-secos','pet','saude-suplementos']),
('food_restrictions', 'Restrições alimentares','Vegano, sem glúten, sem lactose, etc.',             'string', 'ai_inferred',                       'FOOD_RESTRICTIONS',      false, ARRAY['alimentos','saude-suplementos']),
('pet_type',          'Tipo de pet',          'Cachorro, gato, etc.',                               'string', 'ai_inferred',                       'PET_TYPE',               false, ARRAY['pet']),
('pet_size',          'Porte do pet',         'Pequeno, médio, grande',                             'string', 'ai_inferred',                       'PET_SIZE',               false, ARRAY['pet']),

-- Moda
('size',              'Tamanho',              'Tamanho de roupa/calçado',                           'string', 'ai_inferred',                       'SIZE',                   false, ARRAY['moda','moda-roupas','moda-calcados','moda-acessorios']),
('color',             'Cor',                  'Cor principal do produto',                           'string', 'ai_inferred',                       'COLOR',                  true,  ARRAY[]::text[]),
('material',          'Material',             'Material principal',                                 'string', 'ai_inferred',                       'MATERIAL',               false, ARRAY['moda','casa','infantil','ferramentas']),
('season',            'Estação',              'Verão, inverno, etc.',                               'string', 'ai_inferred',                       'SEASON',                 false, ARRAY['moda','moda-roupas']),
('style',             'Estilo',               'Estilo do produto',                                  'string', 'ai_inferred',                       'STYLE',                  false, ARRAY['moda']),

-- Eletrônicos
('voltage',           'Voltagem',             '110V, 220V, bivolt',                                 'enum',   'ai_inferred',                       'VOLTAGE',                false, ARRAY['eletronicos','eletrodomesticos','ferramentas']),
('power_watts',       'Potência (W)',         'Potência elétrica',                                  'number', 'ai_inferred',                       'POWER',                  false, ARRAY['eletrodomesticos','ferramentas']),
('connectivity',      'Conectividade',        'Bluetooth, Wi-Fi, USB, etc.',                        'string', 'ai_inferred',                       'CONNECTIVITY',           false, ARRAY['eletronicos']),
('storage_capacity',  'Armazenamento',        'Capacidade de armazenamento',                        'string', 'ai_inferred',                       'INTERNAL_MEMORY',        false, ARRAY['eletronicos-celulares']),
('ram',               'Memória RAM',          'Memória RAM',                                        'string', 'ai_inferred',                       'RAM_MEMORY',             false, ARRAY['eletronicos-celulares']),
('capacity',          'Capacidade',           'Capacidade (litros, kg, etc.)',                      'dimension','ai_inferred',                     'CAPACITY',               false, ARRAY['eletrodomesticos']),
('dimensions',        'Dimensões',            'Dimensões do produto',                               'dimension','derived.dimensions',              'PRODUCT_DIMENSIONS',     false, ARRAY['casa']),

-- Esporte / Livros / Automotivo
('sport_type',        'Esporte',              'Esporte/modalidade',                                 'string', 'ai_inferred',                       'SPORT',                  false, ARRAY['esporte']),
('author',            'Autor',                'Autor da obra',                                      'string', 'ai_inferred',                       'AUTHOR',                 false, ARRAY['livros']),
('language',          'Idioma',               'Idioma da obra',                                     'string', 'ai_inferred',                       'LANGUAGE',               false, ARRAY['livros']),
('format',            'Formato',              'Capa dura, brochura, eBook, etc.',                   'string', 'ai_inferred',                       'FORMAT',                 false, ARRAY['livros']),
('compatible_vehicle','Veículo compatível',   'Modelo/ano compatível',                              'string', 'ai_inferred',                       'COMPATIBLE_VEHICLES',    false, ARRAY['automotivo']),
('spf',               'FPS',                  'Fator de Proteção Solar',                            'number', 'ai_inferred',                       'SUN_PROTECTION_FACTOR',  false, ARRAY['beleza-pele'])

ON CONFLICT (universal_key) DO NOTHING;

UPDATE products SET product_type = CASE 
  WHEN name ILIKE 'Balm%' THEN 'Balm capilar'
  WHEN name ILIKE 'Loção%' THEN 'Loção capilar'
  ELSE product_type END
WHERE id IN (
  'a69da21b-6c4e-41fd-9af5-4f713e22be73',
  'bd811151-d7a8-4b5d-b27c-dd448c1804a9',
  '44225e5e-6297-4be0-ad71-2d1704eaa7b0',
  '66fe4f52-258c-4bbb-89d2-c6065917fe8b',
  'c65b1179-dd92-4acd-8d7f-8212afcad370',
  'f3e6dd0a-6a80-4832-b5fd-ec928ab5f68f'
);

-- Invalida caches de busca ML para reprocesso na próxima abertura do diálogo
UPDATE products SET ml_search_summary = NULL, ml_search_summary_signature = NULL
WHERE id IN (
  'a69da21b-6c4e-41fd-9af5-4f713e22be73',
  'bd811151-d7a8-4b5d-b27c-dd448c1804a9',
  '44225e5e-6297-4be0-ad71-2d1704eaa7b0',
  '66fe4f52-258c-4bbb-89d2-c6065917fe8b',
  'c65b1179-dd92-4acd-8d7f-8212afcad370',
  'f3e6dd0a-6a80-4832-b5fd-ec928ab5f68f'
);
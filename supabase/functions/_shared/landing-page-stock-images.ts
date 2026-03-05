// =============================================
// LANDING PAGE STOCK IMAGES — V1.0.0
// Curated stock image URLs by niche
// Uses Unsplash source for free, high-quality images
// Hero/background: stock | Product/offer: catalog
// =============================================

export interface NicheImageSet {
  /** Hero background or lifestyle images */
  hero: string[];
  /** Benefit/feature section backgrounds */
  benefits: string[];
  /** Guarantee/trust section backgrounds */
  trust: string[];
  /** Generic lifestyle/ambiance images */
  lifestyle: string[];
}

/**
 * Curated stock images organized by niche.
 * All images are from Unsplash (free for commercial use).
 * URLs use Unsplash Source API for reliable hotlinking.
 */
const NICHE_IMAGES: Record<string, NicheImageSet> = {
  cosmeticos: {
    hero: [
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&q=80&auto=format',
    ],
    benefits: [
      'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&q=80&auto=format',
    ],
    trust: [
      'https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=800&q=80&auto=format',
    ],
    lifestyle: [
      'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&q=80&auto=format',
    ],
  },

  saude: {
    hero: [
      'https://images.unsplash.com/photo-1505576399279-0d309e7b3cff?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&q=80&auto=format',
    ],
    benefits: [
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80&auto=format',
    ],
    trust: [
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80&auto=format',
    ],
    lifestyle: [
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80&auto=format',
    ],
  },

  fitness: {
    hero: [
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=1200&q=80&auto=format',
    ],
    benefits: [
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80&auto=format',
    ],
    trust: [
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80&auto=format',
    ],
    lifestyle: [
      'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80&auto=format',
    ],
  },

  tecnologia: {
    hero: [
      'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&q=80&auto=format',
    ],
    benefits: [
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&q=80&auto=format',
    ],
    trust: [
      'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80&auto=format',
    ],
    lifestyle: [
      'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80&auto=format',
    ],
  },

  moda: {
    hero: [
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&q=80&auto=format',
    ],
    benefits: [
      'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&q=80&auto=format',
    ],
    trust: [
      'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800&q=80&auto=format',
    ],
    lifestyle: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&q=80&auto=format',
    ],
  },

  alimentos: {
    hero: [
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1543362906-acfc16c67564?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=1200&q=80&auto=format',
    ],
    benefits: [
      'https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&q=80&auto=format',
    ],
    trust: [
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80&auto=format',
    ],
    lifestyle: [
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=800&q=80&auto=format',
    ],
  },

  pet: {
    hero: [
      'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1200&q=80&auto=format',
    ],
    benefits: [
      'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1544568100-847a948585b9?w=800&q=80&auto=format',
    ],
    trust: [
      'https://images.unsplash.com/photo-1522276498395-f4f68f7f8571?w=800&q=80&auto=format',
    ],
    lifestyle: [
      'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=800&q=80&auto=format',
    ],
  },

  casa: {
    hero: [
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80&auto=format',
    ],
    benefits: [
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=80&auto=format',
    ],
    trust: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80&auto=format',
    ],
    lifestyle: [
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80&auto=format',
    ],
  },

  // Default/generic niche
  geral: {
    hero: [
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1556742111-a301076d9d18?w=1200&q=80&auto=format',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=80&auto=format',
    ],
    benefits: [
      'https://images.unsplash.com/photo-1553729459-uj4a3yj05b0?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80&auto=format',
    ],
    trust: [
      'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&q=80&auto=format',
    ],
    lifestyle: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80&auto=format',
      'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&q=80&auto=format',
    ],
  },
};

/**
 * Niche keyword mapping — resolves niche string to image set key.
 */
const NICHE_ALIASES: Record<string, string> = {
  // Cosméticos
  cosmeticos: 'cosmeticos', cosmetics: 'cosmeticos', beleza: 'cosmeticos', beauty: 'cosmeticos',
  skincare: 'cosmeticos', maquiagem: 'cosmeticos', makeup: 'cosmeticos', cabelo: 'cosmeticos',
  hair: 'cosmeticos', perfumaria: 'cosmeticos', fragrance: 'cosmeticos',
  // Saúde
  saude: 'saude', health: 'saude', suplementos: 'saude', supplements: 'saude',
  nutricao: 'saude', nutrition: 'saude', vitaminas: 'saude', farmacia: 'saude',
  wellness: 'saude', bemestar: 'saude',
  // Fitness
  fitness: 'fitness', academia: 'fitness', gym: 'fitness', esporte: 'fitness',
  sports: 'fitness', treino: 'fitness', workout: 'fitness', bodybuilding: 'fitness',
  whey: 'fitness', creatina: 'fitness',
  // Tecnologia
  tecnologia: 'tecnologia', tech: 'tecnologia', eletronicos: 'tecnologia', electronics: 'tecnologia',
  gadgets: 'tecnologia', informatica: 'tecnologia', celular: 'tecnologia', smartphone: 'tecnologia',
  // Moda
  moda: 'moda', fashion: 'moda', roupas: 'moda', clothing: 'moda',
  acessorios: 'moda', accessories: 'moda', joias: 'moda', jewelry: 'moda',
  calcados: 'moda', shoes: 'moda', bolsas: 'moda',
  // Alimentos
  alimentos: 'alimentos', food: 'alimentos', comida: 'alimentos', gourmet: 'alimentos',
  bebidas: 'alimentos', drinks: 'alimentos', organicos: 'alimentos', organic: 'alimentos',
  cafe: 'alimentos', coffee: 'alimentos',
  // Pet
  pet: 'pet', pets: 'pet', animal: 'pet', cachorro: 'pet', gato: 'pet',
  dog: 'pet', cat: 'pet', veterinario: 'pet',
  // Casa
  casa: 'casa', home: 'casa', decoracao: 'casa', decor: 'casa',
  moveis: 'casa', furniture: 'casa', jardim: 'casa', garden: 'casa',
  cozinha: 'casa', kitchen: 'casa',
};

/**
 * Get curated stock images for a niche.
 * Falls back to 'geral' if niche is not recognized.
 */
export function getNicheImages(niche: string): NicheImageSet {
  const normalizedNiche = niche?.toLowerCase().trim().replace(/[^a-z]/g, '') || 'geral';
  const mappedKey = NICHE_ALIASES[normalizedNiche] || 'geral';
  return NICHE_IMAGES[mappedKey] || NICHE_IMAGES.geral;
}

/**
 * Get a specific image for a section type and index.
 * Cycles through available images if index exceeds array length.
 */
export function getNicheImage(niche: string, section: keyof NicheImageSet, index: number = 0): string {
  const images = getNicheImages(niche);
  const pool = images[section];
  return pool[index % pool.length];
}

/**
 * Get all available niche keys for UI display.
 */
export function getAvailableNiches(): string[] {
  return Object.keys(NICHE_IMAGES);
}

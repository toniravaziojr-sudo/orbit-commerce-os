// =============================================
// DEMO STORE DATA - Loja de Cosméticos "Beleza Natural"
// Dados demonstrativos que NÃO entram no banco do tenant
// =============================================

// URLs de imagens externas (Unsplash) - não poluem o Meu Drive
const DEMO_IMAGES = {
  // Produtos
  serum: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&h=500&fit=crop&q=80',
  shampoo: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&h=500&fit=crop&q=80',
  creme: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&h=500&fit=crop&q=80',
  oleo: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=500&h=500&fit=crop&q=80',
  mascara: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&h=500&fit=crop&q=80',
  batom: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500&h=500&fit=crop&q=80',
  perfume: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=500&h=500&fit=crop&q=80',
  hidratante: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=500&h=500&fit=crop&q=80',
  protetor: 'https://images.unsplash.com/photo-1556227834-09f1de7a7d14?w=500&h=500&fit=crop&q=80',
  esfoliante: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=500&h=500&fit=crop&q=80',
  tonico: 'https://images.unsplash.com/photo-1617897903246-719242758050?w=500&h=500&fit=crop&q=80',
  kit: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=500&h=500&fit=crop&q=80',
  
  // Categorias
  catSkincare: 'https://images.unsplash.com/photo-1570194065650-d99fb4b38b15?w=300&h=300&fit=crop&q=80',
  catCabelos: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&h=300&fit=crop&q=80',
  catMaquiagem: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=300&h=300&fit=crop&q=80',
  catCorpo: 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=300&h=300&fit=crop&q=80',
  catPerfumes: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=300&h=300&fit=crop&q=80',
  catKits: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=300&h=300&fit=crop&q=80',
  
  // Banners
  banner1Desktop: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1920&h=600&fit=crop&q=80',
  banner1Mobile: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=768&h=500&fit=crop&q=80',
  banner2Desktop: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1920&h=600&fit=crop&q=80',
  banner2Mobile: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=768&h=500&fit=crop&q=80',
  banner3Desktop: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=1920&h=600&fit=crop&q=80',
  banner3Mobile: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=768&h=500&fit=crop&q=80',
  
  // Blog
  blog1: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&h=400&fit=crop&q=80',
  blog2: 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=600&h=400&fit=crop&q=80',
  blog3: 'https://images.unsplash.com/photo-1552693673-1bf958298935?w=600&h=400&fit=crop&q=80',
  
  // Category Banner
  categoryBanner: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1920&h=400&fit=crop&q=80',
};

// ========== PRODUTOS DEMO ==========
export interface DemoProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price?: number;
  description: string;
  image: string;
  tags: string[];
  category: string;
  is_featured?: boolean;
}

export const demoProducts: DemoProduct[] = [
  {
    id: 'demo-prod-1',
    name: 'Sérum Vitamina C Antioxidante',
    slug: 'serum-vitamina-c',
    price: 89.90,
    compare_at_price: 119.90,
    description: 'Sérum facial com vitamina C pura para iluminar e uniformizar a pele.',
    image: DEMO_IMAGES.serum,
    tags: ['skincare', 'antioxidante', 'iluminador'],
    category: 'skincare',
    is_featured: true,
  },
  {
    id: 'demo-prod-2',
    name: 'Shampoo Fortalecedor Antiqueda',
    slug: 'shampoo-fortalecedor',
    price: 49.90,
    description: 'Shampoo com biotina e queratina para fortalecer e reduzir a queda.',
    image: DEMO_IMAGES.shampoo,
    tags: ['cabelos', 'antiqueda', 'fortalecedor'],
    category: 'cabelos',
    is_featured: true,
  },
  {
    id: 'demo-prod-3',
    name: 'Creme Hidratante Facial',
    slug: 'creme-hidratante-facial',
    price: 79.90,
    description: 'Hidratação profunda para todos os tipos de pele.',
    image: DEMO_IMAGES.creme,
    tags: ['skincare', 'hidratante', 'facial'],
    category: 'skincare',
    is_featured: true,
  },
  {
    id: 'demo-prod-4',
    name: 'Óleo Capilar Nutritivo',
    slug: 'oleo-capilar-nutritivo',
    price: 59.90,
    compare_at_price: 79.90,
    description: 'Óleo multifuncional para nutrição e brilho dos fios.',
    image: DEMO_IMAGES.oleo,
    tags: ['cabelos', 'nutrição', 'brilho'],
    category: 'cabelos',
    is_featured: true,
  },
  {
    id: 'demo-prod-5',
    name: 'Máscara de Cílios Volume',
    slug: 'mascara-cilios-volume',
    price: 69.90,
    description: 'Máscara que proporciona volume e alongamento natural.',
    image: DEMO_IMAGES.mascara,
    tags: ['maquiagem', 'cílios', 'volume'],
    category: 'maquiagem',
  },
  {
    id: 'demo-prod-6',
    name: 'Batom Líquido Matte',
    slug: 'batom-liquido-matte',
    price: 39.90,
    description: 'Acabamento matte de longa duração com cores vibrantes.',
    image: DEMO_IMAGES.batom,
    tags: ['maquiagem', 'batom', 'matte'],
    category: 'maquiagem',
  },
  {
    id: 'demo-prod-7',
    name: 'Perfume Floral Feminino',
    slug: 'perfume-floral-feminino',
    price: 149.90,
    compare_at_price: 199.90,
    description: 'Fragrância floral sofisticada e duradoura.',
    image: DEMO_IMAGES.perfume,
    tags: ['perfume', 'feminino', 'floral'],
    category: 'perfumes',
    is_featured: true,
  },
  {
    id: 'demo-prod-8',
    name: 'Hidratante Corporal',
    slug: 'hidratante-corporal',
    price: 45.90,
    description: 'Hidratação intensa para o corpo todo.',
    image: DEMO_IMAGES.hidratante,
    tags: ['corpo', 'hidratante', 'pele'],
    category: 'corpo',
  },
  {
    id: 'demo-prod-9',
    name: 'Protetor Solar FPS 50',
    slug: 'protetor-solar-fps50',
    price: 69.90,
    description: 'Proteção máxima contra raios UV com toque seco.',
    image: DEMO_IMAGES.protetor,
    tags: ['skincare', 'protetor', 'solar'],
    category: 'skincare',
  },
  {
    id: 'demo-prod-10',
    name: 'Esfoliante Facial Suave',
    slug: 'esfoliante-facial',
    price: 54.90,
    description: 'Remove células mortas sem agredir a pele.',
    image: DEMO_IMAGES.esfoliante,
    tags: ['skincare', 'esfoliante', 'limpeza'],
    category: 'skincare',
  },
  {
    id: 'demo-prod-11',
    name: 'Tônico Facial Equilibrante',
    slug: 'tonico-facial',
    price: 44.90,
    description: 'Equilibra o pH da pele e prepara para o skincare.',
    image: DEMO_IMAGES.tonico,
    tags: ['skincare', 'tônico', 'limpeza'],
    category: 'skincare',
  },
  {
    id: 'demo-prod-12',
    name: 'Kit Rotina Completa',
    slug: 'kit-rotina-completa',
    price: 199.90,
    compare_at_price: 279.90,
    description: 'Tudo que você precisa para uma rotina de cuidados completa.',
    image: DEMO_IMAGES.kit,
    tags: ['kit', 'skincare', 'presente'],
    category: 'kits',
    is_featured: true,
  },
];

// ========== CATEGORIAS DEMO ==========
export interface DemoCategory {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  banner_url: string;
  description: string;
}

export const demoCategories: DemoCategory[] = [
  {
    id: 'demo-cat-1',
    name: 'Skincare',
    slug: 'skincare',
    image_url: DEMO_IMAGES.catSkincare,
    banner_url: DEMO_IMAGES.categoryBanner,
    description: 'Cuidados essenciais para uma pele saudável e radiante.',
  },
  {
    id: 'demo-cat-2',
    name: 'Cabelos',
    slug: 'cabelos',
    image_url: DEMO_IMAGES.catCabelos,
    banner_url: DEMO_IMAGES.categoryBanner,
    description: 'Produtos para todos os tipos de cabelo.',
  },
  {
    id: 'demo-cat-3',
    name: 'Maquiagem',
    slug: 'maquiagem',
    image_url: DEMO_IMAGES.catMaquiagem,
    banner_url: DEMO_IMAGES.categoryBanner,
    description: 'Realce sua beleza natural com nossa linha de make.',
  },
  {
    id: 'demo-cat-4',
    name: 'Corpo',
    slug: 'corpo',
    image_url: DEMO_IMAGES.catCorpo,
    banner_url: DEMO_IMAGES.categoryBanner,
    description: 'Hidratação e cuidados para o corpo todo.',
  },
  {
    id: 'demo-cat-5',
    name: 'Perfumes',
    slug: 'perfumes',
    image_url: DEMO_IMAGES.catPerfumes,
    banner_url: DEMO_IMAGES.categoryBanner,
    description: 'Fragrâncias exclusivas para todos os estilos.',
  },
  {
    id: 'demo-cat-6',
    name: 'Kits',
    slug: 'kits',
    image_url: DEMO_IMAGES.catKits,
    banner_url: DEMO_IMAGES.categoryBanner,
    description: 'Combinações perfeitas para presente ou uso próprio.',
  },
];

// ========== BANNERS DEMO ==========
export interface DemoBanner {
  id: string;
  imageDesktop: string;
  imageMobile: string;
  altText: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
  linkUrl: string;
}

export const demoBanners: DemoBanner[] = [
  {
    id: 'demo-banner-1',
    imageDesktop: DEMO_IMAGES.banner1Desktop,
    imageMobile: DEMO_IMAGES.banner1Mobile,
    altText: 'Cuidados com a pele - Até 40% OFF',
    title: 'Skincare Premium',
    subtitle: 'Até 40% OFF em toda linha facial',
    ctaText: 'Comprar agora',
    linkUrl: '',
  },
  {
    id: 'demo-banner-2',
    imageDesktop: DEMO_IMAGES.banner2Desktop,
    imageMobile: DEMO_IMAGES.banner2Mobile,
    altText: 'Nova coleção de maquiagem',
    title: 'Nova Coleção',
    subtitle: 'Maquiagem profissional para o dia a dia',
    ctaText: 'Ver coleção',
    linkUrl: '',
  },
  {
    id: 'demo-banner-3',
    imageDesktop: DEMO_IMAGES.banner3Desktop,
    imageMobile: DEMO_IMAGES.banner3Mobile,
    altText: 'Frete grátis em todo Brasil',
    title: 'Frete Grátis',
    subtitle: 'Em compras acima de R$199 para todo Brasil',
    ctaText: 'Aproveitar',
    linkUrl: '',
  },
];

// ========== DEPOIMENTOS DEMO ==========
export interface DemoTestimonial {
  id: string;
  name: string;
  content: string;
  rating: number;
  avatar?: string;
  product?: string;
}

export const demoTestimonials: DemoTestimonial[] = [
  {
    id: 'demo-test-1',
    name: 'Carla Mendes',
    content: 'O sérum de vitamina C é maravilhoso! Minha pele ficou muito mais luminosa e uniforme em poucas semanas de uso.',
    rating: 5,
    product: 'Sérum Vitamina C',
  },
  {
    id: 'demo-test-2',
    name: 'Amanda Silva',
    content: 'Adorei a qualidade dos produtos! O atendimento também foi excelente, super atenciosos.',
    rating: 5,
    product: 'Kit Rotina Completa',
  },
  {
    id: 'demo-test-3',
    name: 'Juliana Costa',
    content: 'Entrega super rápida e produtos muito bem embalados. O shampoo fortalecedor fez diferença nos meus fios!',
    rating: 5,
    product: 'Shampoo Fortalecedor',
  },
  {
    id: 'demo-test-4',
    name: 'Patricia Santos',
    content: 'Melhor hidratante que já usei! Textura leve e hidrata o dia todo. Recomendo muito.',
    rating: 5,
    product: 'Hidratante Corporal',
  },
];

// ========== POSTS DE BLOG DEMO ==========
export interface DemoBlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  image: string;
  published_at: string;
  read_time: number;
  tags: string[];
}

export const demoBlogPosts: DemoBlogPost[] = [
  {
    id: 'demo-blog-1',
    title: '10 Dicas de Skincare para Iniciantes',
    slug: '10-dicas-skincare-iniciantes',
    excerpt: 'Começar uma rotina de cuidados com a pele pode parecer complicado, mas não precisa ser. Confira nossas dicas essenciais.',
    image: DEMO_IMAGES.blog1,
    published_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    read_time: 5,
    tags: ['skincare', 'dicas'],
  },
  {
    id: 'demo-blog-2',
    title: 'Como Escolher o Shampoo Ideal para Você',
    slug: 'como-escolher-shampoo-ideal',
    excerpt: 'Cada tipo de cabelo tem suas necessidades específicas. Aprenda a identificar o que o seu cabelo precisa.',
    image: DEMO_IMAGES.blog2,
    published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    read_time: 4,
    tags: ['cabelos', 'guia'],
  },
  {
    id: 'demo-blog-3',
    title: 'Tendências de Maquiagem para 2024',
    slug: 'tendencias-maquiagem-2024',
    excerpt: 'Descubra as cores, técnicas e produtos que estão em alta este ano no mundo da maquiagem.',
    image: DEMO_IMAGES.blog3,
    published_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    read_time: 6,
    tags: ['maquiagem', 'tendências'],
  },
];

// ========== BENEFÍCIOS DEMO ==========
export const demoBenefits = [
  { id: 'benefit-1', icon: 'Truck', title: 'Frete Grátis', description: 'Em compras acima de R$199' },
  { id: 'benefit-2', icon: 'CreditCard', title: 'Parcelamento', description: 'Em até 12x sem juros' },
  { id: 'benefit-3', icon: 'Shield', title: 'Compra Segura', description: 'Ambiente 100% protegido' },
  { id: 'benefit-4', icon: 'Package', title: 'Troca Fácil', description: '30 dias para trocar' },
];

// ========== DEMO CART ITEMS ==========
export interface DemoCartItem {
  id: string;
  product: DemoProduct;
  quantity: number;
}

export const demoCartItems: DemoCartItem[] = [
  {
    id: 'cart-item-1',
    product: demoProducts[0], // Sérum Vitamina C
    quantity: 1,
  },
  {
    id: 'cart-item-2',
    product: demoProducts[2], // Creme Hidratante
    quantity: 2,
  },
];

// ========== DEMO UPSELL / CROSS-SELL ==========
export const demoCrossSellProducts = demoProducts.filter(p => 
  ['demo-prod-3', 'demo-prod-9', 'demo-prod-10'].includes(p.id)
);

export const demoOrderBump = {
  id: 'order-bump-1',
  product: demoProducts.find(p => p.id === 'demo-prod-11')!, // Tônico
  discountPercent: 20,
  headline: 'Adicione e ganhe 20% OFF',
  description: 'Complete sua rotina com o Tônico Equilibrante!',
};

export const demoBuyTogether = [
  demoProducts.find(p => p.id === 'demo-prod-1')!, // Sérum
  demoProducts.find(p => p.id === 'demo-prod-3')!, // Creme
  demoProducts.find(p => p.id === 'demo-prod-11')!, // Tônico
];

// ========== HELPERS ==========
export function getDemoProductsByCategory(categorySlug: string): DemoProduct[] {
  return demoProducts.filter(p => p.category === categorySlug);
}

export function getDemoFeaturedProducts(): DemoProduct[] {
  return demoProducts.filter(p => p.is_featured);
}

export function formatDemoPrice(price: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price);
}

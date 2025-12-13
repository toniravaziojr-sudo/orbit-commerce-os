// =============================================
// BLOCK RENDERER - Renders blocks recursively
// =============================================

import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { blockRegistry } from '@/lib/builder/registry';
import { cn } from '@/lib/utils';

interface BlockRendererProps {
  node: BlockNode;
  context: BlockRenderContext;
  isSelected?: boolean;
  isEditing?: boolean;
  onSelect?: (id: string) => void;
}

export function BlockRenderer({ 
  node, 
  context, 
  isSelected = false,
  isEditing = false,
  onSelect 
}: BlockRendererProps) {
  const definition = blockRegistry[node.type];
  
  if (!definition) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive rounded text-destructive text-sm">
        Bloco desconhecido: {node.type}
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isEditing && onSelect) {
      e.stopPropagation();
      onSelect(node.id);
    }
  };

  // Render children if block can have them
  const renderChildren = () => {
    if (!node.children?.length) return null;
    
    return node.children.map((child) => (
      <BlockRenderer
        key={child.id}
        node={child}
        context={context}
        isEditing={isEditing}
        onSelect={onSelect}
      />
    ));
  };

  // Get component based on block type
  const BlockComponent = getBlockComponent(node.type);
  
  return (
    <div
      onClick={handleClick}
      className={cn(
        'relative transition-all',
        isEditing && 'cursor-pointer hover:outline hover:outline-2 hover:outline-primary/50',
        isSelected && isEditing && 'outline outline-2 outline-primary ring-2 ring-primary/20'
      )}
    >
      {isSelected && isEditing && (
        <div className="absolute -top-6 left-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-t z-10">
          {definition.label}
        </div>
      )}
      <BlockComponent 
        {...node.props} 
        context={context}
        isEditing={isEditing}
      >
        {renderChildren()}
      </BlockComponent>
    </div>
  );
}

// Block component implementations
function getBlockComponent(type: string): React.ComponentType<any> {
  const components: Record<string, React.ComponentType<any>> = {
    Page: PageBlock,
    Section: SectionBlock,
    Container: ContainerBlock,
    Grid: GridBlock,
    Column: ColumnBlock,
    Columns: ColumnsBlock,
    Header: HeaderBlock,
    Footer: FooterBlock,
    Hero: HeroBlock,
    Banner: BannerBlock,
    Text: TextBlock,
    RichText: RichTextBlock,
    Image: ImageBlock,
    Button: ButtonBlock,
    Spacer: SpacerBlock,
    Divider: DividerBlock,
    FAQ: FAQBlock,
    Testimonials: TestimonialsBlock,
    ProductGrid: ProductGridBlock,
    ProductCarousel: ProductCarouselBlock,
    CategoryList: CategoryListBlock,
    FeaturedProducts: FeaturedProductsBlock,
    ProductCard: ProductCardBlock,
    ProductDetails: ProductDetailsBlock,
    CartSummary: CartSummaryBlock,
    CheckoutSteps: CheckoutStepsBlock,
    Cart: CartBlock,
    Checkout: CheckoutBlock,
  };

  return components[type] || FallbackBlock;
}

// Fallback for unknown blocks
function FallbackBlock({ children }: { children?: React.ReactNode }) {
  return <div className="p-4 bg-muted rounded">{children}</div>;
}

// Layout Blocks
function PageBlock({ children, backgroundColor }: any) {
  return (
    <div 
      className="min-h-screen"
      style={{ backgroundColor: backgroundColor || 'transparent' }}
    >
      {children}
    </div>
  );
}

function SectionBlock({ children, backgroundColor, paddingY, paddingX, fullWidth }: any) {
  return (
    <section 
      className={cn(
        fullWidth ? 'w-full' : 'container mx-auto',
      )}
      style={{ 
        backgroundColor: backgroundColor || 'transparent',
        paddingTop: `${paddingY || 16}px`,
        paddingBottom: `${paddingY || 16}px`,
        paddingLeft: `${paddingX || 16}px`,
        paddingRight: `${paddingX || 16}px`,
      }}
    >
      {children}
    </section>
  );
}

function ContainerBlock({ children, maxWidth }: any) {
  return (
    <div 
      className="mx-auto px-4"
      style={{ maxWidth: maxWidth || '1200px' }}
    >
      {children}
    </div>
  );
}

function GridBlock({ children, columns, gap }: any) {
  return (
    <div 
      className="grid"
      style={{ 
        gridTemplateColumns: `repeat(${columns || 2}, minmax(0, 1fr))`,
        gap: `${gap || 16}px`
      }}
    >
      {children}
    </div>
  );
}

function ColumnBlock({ children, span }: any) {
  return (
    <div style={{ gridColumn: `span ${span || 1}` }}>
      {children}
    </div>
  );
}

// Header/Footer Blocks
function HeaderBlock({ context, isEditing }: any) {
  const { settings, headerMenu } = context;
  
  return (
    <header className="bg-background border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt={settings?.store_name} className="h-10" />
          ) : (
            <span className="text-xl font-bold">{settings?.store_name || 'Loja'}</span>
          )}
        </div>
        <nav className="hidden md:flex items-center gap-6">
          {headerMenu?.map((item: any) => (
            <a key={item.id} href={item.url || '#'} className="text-sm hover:text-primary">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-muted rounded">🛒</button>
        </div>
      </div>
    </header>
  );
}

function FooterBlock({ context }: any) {
  const { settings, footerMenu } = context;
  
  return (
    <footer className="bg-muted/50 border-t mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold mb-4">{settings?.store_name || 'Loja'}</h3>
            <p className="text-sm text-muted-foreground">
              {settings?.store_description || 'Sua loja online'}
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Links</h4>
            <ul className="space-y-2">
              {footerMenu?.map((item: any) => (
                <li key={item.id}>
                  <a href={item.url || '#'} className="text-sm text-muted-foreground hover:text-foreground">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Redes Sociais</h4>
            <div className="flex gap-4">
              {settings?.social_instagram && <a href={settings.social_instagram}>Instagram</a>}
              {settings?.social_facebook && <a href={settings.social_facebook}>Facebook</a>}
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Contato</h4>
            {settings?.social_whatsapp && (
              <a href={`https://wa.me/${settings.social_whatsapp}`} className="text-sm">
                WhatsApp
              </a>
            )}
          </div>
        </div>
        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {settings?.store_name}. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}

// Content Blocks
function HeroBlock({ title, subtitle, buttonText, buttonUrl, backgroundImage, backgroundColor, textColor, height }: any) {
  return (
    <div 
      className="relative flex items-center justify-center"
      style={{ 
        backgroundColor: backgroundColor || 'hsl(var(--primary))',
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: height || '400px',
      }}
    >
      {backgroundImage && <div className="absolute inset-0 bg-black/40" />}
      <div className="relative z-10 text-center px-4">
        <h1 
          className="text-4xl md:text-5xl font-bold mb-4"
          style={{ color: textColor || 'white' }}
        >
          {title || 'Título Principal'}
        </h1>
        {subtitle && (
          <p 
            className="text-xl mb-6 opacity-90"
            style={{ color: textColor || 'white' }}
          >
            {subtitle}
          </p>
        )}
        {buttonText && (
          <a 
            href={buttonUrl || '#'} 
            className="inline-block bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-white/90"
          >
            {buttonText}
          </a>
        )}
      </div>
    </div>
  );
}

function BannerBlock({ imageUrl, altText, linkUrl, height }: any) {
  const content = (
    <div 
      className="w-full bg-muted overflow-hidden rounded-lg"
      style={{ height: height || '200px' }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={altText || 'Banner'} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          Banner Image
        </div>
      )}
    </div>
  );

  if (linkUrl) {
    return <a href={linkUrl}>{content}</a>;
  }

  return content;
}

function TextBlock({ content, align, fontSize, fontWeight, color }: any) {
  return (
    <div 
      className="prose max-w-none"
      style={{ 
        textAlign: align || 'left',
        fontSize: fontSize || '16px',
        fontWeight: fontWeight || 'normal',
        color: color || 'inherit',
      }}
      dangerouslySetInnerHTML={{ __html: content || '<p>Texto de exemplo</p>' }}
    />
  );
}

function ImageBlock({ src, alt, width, height, objectFit }: any) {
  return (
    <div className="overflow-hidden">
      {src ? (
        <img 
          src={src} 
          alt={alt || 'Imagem'} 
          className="rounded"
          style={{ 
            width: width || '100%',
            height: height || 'auto',
            objectFit: objectFit || 'cover',
          }}
        />
      ) : (
        <div className="bg-muted h-48 flex items-center justify-center text-muted-foreground rounded">
          Imagem
        </div>
      )}
    </div>
  );
}

function ButtonBlock({ text, url, variant, size }: any) {
  const baseClasses = 'inline-block rounded font-semibold transition-colors';
  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
    outline: 'border border-primary text-primary hover:bg-primary hover:text-primary-foreground',
  };
  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2',
    large: 'px-6 py-3 text-lg',
  };

  return (
    <a 
      href={url || '#'}
      className={cn(
        baseClasses,
        variantClasses[variant as keyof typeof variantClasses] || variantClasses.primary,
        sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.medium
      )}
    >
      {text || 'Botão'}
    </a>
  );
}

function SpacerBlock({ height }: any) {
  return <div style={{ height: `${height || 32}px` }} />;
}

function DividerBlock({ color, thickness }: any) {
  return (
    <hr 
      className="my-4"
      style={{ 
        borderColor: color || 'hsl(var(--border))',
        borderWidth: `${thickness || 1}px`,
      }}
    />
  );
}

// E-commerce Blocks (placeholders for now)
function ProductGridBlock({ title, columns, limit, isEditing }: any) {
  const placeholderProducts = Array.from({ length: limit || 8 }, (_, i) => ({
    id: i,
    name: `Produto ${i + 1}`,
    price: 99.90 + i * 10,
  }));

  return (
    <div className="py-8">
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div 
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns || 4}, minmax(0, 1fr))` }}
      >
        {placeholderProducts.map((product) => (
          <div key={product.id} className="bg-card border rounded-lg p-4">
            <div className="aspect-square bg-muted rounded mb-3" />
            <h3 className="font-medium truncate">{product.name}</h3>
            <p className="text-primary font-bold">R$ {product.price.toFixed(2)}</p>
          </div>
        ))}
      </div>
      {isEditing && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Produtos serão carregados dinamicamente]
        </p>
      )}
    </div>
  );
}

function ProductCarouselBlock({ title, limit, isEditing }: any) {
  return (
    <div className="py-8">
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: limit || 6 }, (_, i) => (
          <div key={i} className="flex-shrink-0 w-48 bg-card border rounded-lg p-4">
            <div className="aspect-square bg-muted rounded mb-3" />
            <h3 className="font-medium truncate">Produto {i + 1}</h3>
            <p className="text-primary font-bold">R$ {(99.90 + i * 10).toFixed(2)}</p>
          </div>
        ))}
      </div>
      {isEditing && (
        <p className="text-center text-sm text-muted-foreground">
          [Carrossel de produtos dinâmico]
        </p>
      )}
    </div>
  );
}

function CategoryListBlock({ title, columns, isEditing }: any) {
  const placeholderCategories = ['Categoria 1', 'Categoria 2', 'Categoria 3', 'Categoria 4'];

  return (
    <div className="py-8">
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div 
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns || 4}, minmax(0, 1fr))` }}
      >
        {placeholderCategories.map((cat, i) => (
          <div key={i} className="bg-card border rounded-lg p-6 text-center hover:shadow-md transition-shadow">
            <div className="w-16 h-16 bg-muted rounded-full mx-auto mb-3" />
            <span className="font-medium">{cat}</span>
          </div>
        ))}
      </div>
      {isEditing && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Categorias serão carregadas dinamicamente]
        </p>
      )}
    </div>
  );
}

function FeaturedProductsBlock({ title, productIds, isEditing }: any) {
  return (
    <div className="py-8">
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-card border rounded-lg p-4">
            <div className="aspect-square bg-muted rounded mb-3" />
            <h3 className="font-medium">Produto Destaque {i + 1}</h3>
            <p className="text-primary font-bold">R$ {(199.90 + i * 50).toFixed(2)}</p>
          </div>
        ))}
      </div>
      {isEditing && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Produtos em destaque - IDs: {productIds?.join(', ') || 'Nenhum selecionado'}]
        </p>
      )}
    </div>
  );
}

// Columns Block (for multi-column layouts)
function ColumnsBlock({ children, columns, gap }: any) {
  return (
    <div 
      className="grid"
      style={{ 
        gridTemplateColumns: `repeat(${columns || 2}, minmax(0, 1fr))`,
        gap: `${gap || 16}px`
      }}
    >
      {children}
    </div>
  );
}

// RichText Block
function RichTextBlock({ content, align }: any) {
  return (
    <div 
      className="prose prose-lg max-w-none"
      style={{ textAlign: align || 'left' }}
      dangerouslySetInnerHTML={{ __html: content || '<p>Conteúdo de texto formatado...</p>' }}
    />
  );
}

// FAQ Block
function FAQBlock({ title, items, isEditing }: any) {
  const faqItems = items || [
    { question: 'Pergunta de exemplo 1?', answer: 'Resposta de exemplo 1.' },
    { question: 'Pergunta de exemplo 2?', answer: 'Resposta de exemplo 2.' },
  ];

  return (
    <div className="py-8">
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div className="space-y-4">
        {faqItems.map((item: any, i: number) => (
          <div key={i} className="border rounded-lg">
            <div className="p-4 font-semibold bg-muted/50 rounded-t-lg">
              {item.question}
            </div>
            <div className="p-4 text-muted-foreground">
              {item.answer}
            </div>
          </div>
        ))}
      </div>
      {isEditing && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Configure as perguntas no painel lateral]
        </p>
      )}
    </div>
  );
}

// Testimonials Block
function TestimonialsBlock({ title, items, isEditing }: any) {
  const testimonials = items || [
    { name: 'Cliente 1', text: 'Ótima experiência de compra!', rating: 5 },
    { name: 'Cliente 2', text: 'Produtos de qualidade.', rating: 4 },
    { name: 'Cliente 3', text: 'Entrega rápida e embalagem perfeita.', rating: 5 },
  ];

  return (
    <div className="py-8">
      {title && <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>}
      <div className="grid md:grid-cols-3 gap-6">
        {testimonials.map((item: any, i: number) => (
          <div key={i} className="bg-card border rounded-lg p-6 text-center">
            <div className="mb-3">
              {'⭐'.repeat(item.rating || 5)}
            </div>
            <p className="text-muted-foreground mb-4 italic">"{item.text}"</p>
            <p className="font-semibold">{item.name}</p>
          </div>
        ))}
      </div>
      {isEditing && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Configure os depoimentos no painel lateral]
        </p>
      )}
    </div>
  );
}

// ProductCard Block
function ProductCardBlock({ productId, isEditing }: any) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="aspect-square bg-muted rounded mb-3" />
      <h3 className="font-medium truncate">Produto</h3>
      <p className="text-primary font-bold">R$ 99,90</p>
      {isEditing && (
        <p className="text-xs text-muted-foreground mt-2">
          [ID: {productId || 'Não selecionado'}]
        </p>
      )}
    </div>
  );
}

// ProductDetails Block (for product template)
function ProductDetailsBlock({ context, isEditing }: any) {
  const product = context?.product;

  if (isEditing && !product) {
    return (
      <div className="py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="aspect-square bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
            [Imagem do Produto]
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">[Nome do Produto]</h1>
            <p className="text-2xl text-primary font-bold">[Preço]</p>
            <p className="text-muted-foreground">[Descrição do produto será exibida aqui]</p>
            <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg">
              Adicionar ao Carrinho
            </button>
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Selecione um produto de exemplo para visualizar]
        </p>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="aspect-square bg-muted rounded-lg overflow-hidden">
          {product?.images?.[0]?.url ? (
            <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              Sem imagem
            </div>
          )}
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">{product?.name || 'Produto'}</h1>
          <p className="text-2xl text-primary font-bold">
            R$ {(product?.price || 0).toFixed(2).replace('.', ',')}
          </p>
          <p className="text-muted-foreground">{product?.description || ''}</p>
          <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90">
            Adicionar ao Carrinho
          </button>
        </div>
      </div>
    </div>
  );
}

// CartSummary Block
function CartSummaryBlock({ isEditing }: any) {
  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold mb-8">Carrinho de Compras</h1>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-4">
          {isEditing ? (
            <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
              [Itens do carrinho serão listados aqui]
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              Seu carrinho está vazio
            </div>
          )}
        </div>
        <div className="bg-card border rounded-lg p-6">
          <h2 className="font-semibold mb-4">Resumo</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>R$ 0,00</span>
            </div>
            <div className="flex justify-between">
              <span>Frete</span>
              <span>A calcular</span>
            </div>
            <hr className="my-2" />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>R$ 0,00</span>
            </div>
          </div>
          <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg mt-4 font-semibold">
            Finalizar Compra
          </button>
        </div>
      </div>
    </div>
  );
}

// CheckoutSteps Block
function CheckoutStepsBlock({ isEditing }: any) {
  const steps = ['Identificação', 'Entrega', 'Pagamento', 'Confirmação'];
  
  return (
    <div className="py-8">
      {/* Steps Indicator */}
      <div className="flex justify-center mb-8">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
              i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {i + 1}
            </div>
            <span className="ml-2 text-sm hidden sm:inline">{step}</span>
            {i < steps.length - 1 && (
              <div className="w-8 md:w-16 h-px bg-muted mx-2" />
            )}
          </div>
        ))}
      </div>
      
      {/* Content */}
      {isEditing ? (
        <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
          [Formulário de checkout será renderizado aqui]
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-card border rounded-lg p-6">
              <h2 className="font-semibold mb-4">Dados do Cliente</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Nome completo" className="w-full p-2 border rounded bg-background" />
                <input type="email" placeholder="E-mail" className="w-full p-2 border rounded bg-background" />
                <input type="tel" placeholder="Telefone" className="w-full p-2 border rounded bg-background" />
              </div>
            </div>
          </div>
          <div className="bg-card border rounded-lg p-6">
            <h2 className="font-semibold mb-4">Resumo do Pedido</h2>
            <div className="text-muted-foreground">
              Carrinho vazio
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CartBlock({ isEditing }: any) {
  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold mb-8">Carrinho de Compras</h1>
      {isEditing ? (
        <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
          [Componente de carrinho será renderizado aqui]
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Seu carrinho está vazio
        </div>
      )}
    </div>
  );
}

function CheckoutBlock({ isEditing }: any) {
  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold mb-8">Finalizar Compra</h1>
      {isEditing ? (
        <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
          [Formulário de checkout será renderizado aqui]
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-card border rounded-lg p-6">
              <h2 className="font-semibold mb-4">Dados do Cliente</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Nome completo" className="w-full p-2 border rounded bg-background" />
                <input type="email" placeholder="E-mail" className="w-full p-2 border rounded bg-background" />
                <input type="tel" placeholder="Telefone" className="w-full p-2 border rounded bg-background" />
              </div>
            </div>
          </div>
          <div className="bg-card border rounded-lg p-6">
            <h2 className="font-semibold mb-4">Resumo do Pedido</h2>
            <div className="text-muted-foreground">
              Carrinho vazio
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

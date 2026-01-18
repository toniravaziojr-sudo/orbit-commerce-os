// =============================================
// TESTIMONIALS BLOCK - Customer testimonials display
// =============================================

import React from 'react';

interface TestimonialItem {
  name?: string;
  content?: string;
  text?: string; // Legacy support
  rating?: number;
  role?: string;
  image?: string;
}

interface TestimonialsBlockProps {
  title?: string;
  items?: TestimonialItem[];
  isEditing?: boolean;
}

// Default demo testimonials for builder preview
const defaultDemoTestimonials: TestimonialItem[] = [
  {
    name: 'Maria Silva',
    content: 'Excelente atendimento! Produtos de qualidade e entrega rápida. Recomendo!',
    rating: 5,
    role: 'Cliente verificada',
  },
  {
    name: 'João Santos',
    content: 'Fiquei muito satisfeito com a compra. O produto chegou antes do prazo.',
    rating: 5,
    role: 'Cliente desde 2023',
  },
  {
    name: 'Ana Costa',
    content: 'Ótima experiência de compra! Já é minha terceira vez comprando aqui.',
    rating: 4,
    role: 'Cliente fiel',
  },
];

export function TestimonialsBlock({ title = 'O que dizem nossos clientes', items = [], isEditing }: TestimonialsBlockProps) {
  // Use demo testimonials when editing and no items configured
  const displayItems = items && items.length > 0 ? items : (isEditing ? defaultDemoTestimonials : []);
  
  if (displayItems.length === 0) {
    return null;
  }
  
  const testimonialItems = displayItems;

  return (
    <div className="py-8 container mx-auto px-4">
      {title && <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>}
      <div className="grid md:grid-cols-3 gap-6">
        {testimonialItems.map((item, index) => (
          <div key={index} className="p-6 bg-card border rounded-lg text-center">
            {item.image && (
              <img 
                src={item.image} 
                alt={item.name} 
                className="w-16 h-16 rounded-full mx-auto mb-4 object-cover"
              />
            )}
            <div className="text-yellow-500 mb-2">
              {'⭐'.repeat(item.rating || 5)}
            </div>
            <p className="text-muted-foreground mb-4 italic">"{item.content || item.text}"</p>
            <p className="font-semibold">{item.name}</p>
            {item.role && <p className="text-sm text-muted-foreground">{item.role}</p>}
          </div>
        ))}
      </div>
      {isEditing && items.length === 0 && (
        <p className="text-xs text-center text-muted-foreground mt-4">
          [Exemplo demonstrativo] Configure depoimentos reais no painel lateral
        </p>
      )}
    </div>
  );
}

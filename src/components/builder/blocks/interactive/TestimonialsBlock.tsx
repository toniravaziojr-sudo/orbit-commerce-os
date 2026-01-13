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

export function TestimonialsBlock({ title = 'O que dizem nossos clientes', items = [], isEditing }: TestimonialsBlockProps) {
  // Sem fallback interno - empty state se não houver items
  if (!items || items.length === 0) {
    if (isEditing) {
      return (
        <div className="py-8 container mx-auto px-4">
          {title && <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>}
          <div className="flex items-center justify-center py-12 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
            <div className="text-center">
              <p className="text-muted-foreground mb-2">Nenhum depoimento configurado</p>
              <p className="text-sm text-muted-foreground">Configure os depoimentos no painel lateral</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  const testimonialItems = items;

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
      {isEditing && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          [Configure os depoimentos no painel lateral]
        </p>
      )}
    </div>
  );
}

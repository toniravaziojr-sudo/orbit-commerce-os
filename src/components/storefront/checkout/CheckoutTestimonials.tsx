// =============================================
// CHECKOUT TESTIMONIALS - Social proof section for checkout
// =============================================

import { Star } from 'lucide-react';
import { useStorefrontTestimonials, CheckoutTestimonial } from '@/hooks/useCheckoutTestimonials';
import { useStorefrontConfig } from '@/contexts/StorefrontConfigContext';
import { Skeleton } from '@/components/ui/skeleton';

interface Testimonial {
  name: string;
  content: string;
  rating?: number;
  role?: string;
  image_url?: string | null;
}

const defaultTestimonials: Testimonial[] = [
  {
    name: 'Maria S.',
    content: 'Compra super rápida e entrega antes do prazo! Recomendo demais.',
    rating: 5,
    role: 'Cliente verificada',
  },
  {
    name: 'João P.',
    content: 'Produtos de qualidade e atendimento excelente. Já fiz várias compras.',
    rating: 5,
    role: 'Cliente verificado',
  },
  {
    name: 'Ana L.',
    content: 'Pagamento fácil pelo PIX e chegou tudo certinho. Nota 10!',
    rating: 5,
    role: 'Cliente verificada',
  },
];

interface CheckoutTestimonialsProps {
  productIds?: string[];
}

export function CheckoutTestimonials({ productIds }: CheckoutTestimonialsProps) {
  const { tenantId } = useStorefrontConfig();
  
  // Fetch custom testimonials from database
  // Pass first productId if available for filtering
  const { data: customTestimonials, isLoading } = useStorefrontTestimonials(
    tenantId,
    productIds?.[0]
  );

  // Use custom testimonials if available, otherwise fallback to defaults
  const testimonials: Testimonial[] = customTestimonials && customTestimonials.length > 0
    ? customTestimonials.map((t: CheckoutTestimonial) => ({
        name: t.name,
        content: t.content,
        rating: t.rating,
        image_url: t.image_url,
        role: 'Cliente verificado(a)',
      }))
    : defaultTestimonials;

  if (isLoading) {
    return (
      <div className="border rounded-lg p-4 md:p-6 bg-muted/30">
        <Skeleton className="h-4 w-48 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 md:p-6 bg-muted/30">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        O que nossos clientes dizem
      </h3>
      
      <div className="space-y-4">
        {testimonials.slice(0, 3).map((testimonial, index) => (
          <div key={index} className="flex gap-3">
            {testimonial.image_url ? (
              <img
                src={testimonial.image_url}
                alt={testimonial.name}
                className="flex-shrink-0 w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {testimonial.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{testimonial.name}</span>
                {testimonial.role && (
                  <span className="text-xs text-muted-foreground">{testimonial.role}</span>
                )}
              </div>
              {testimonial.rating && (
                <div className="flex gap-0.5 mb-1">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground leading-relaxed">
                "{testimonial.content}"
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

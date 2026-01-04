// =============================================
// CHECKOUT TESTIMONIALS - Social proof section for checkout
// =============================================

import { Star } from 'lucide-react';

interface Testimonial {
  name: string;
  content: string;
  rating?: number;
  role?: string;
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
  testimonials?: Testimonial[];
}

export function CheckoutTestimonials({ testimonials = defaultTestimonials }: CheckoutTestimonialsProps) {
  return (
    <div className="border rounded-lg p-4 md:p-6 bg-muted/30">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        O que nossos clientes dizem
      </h3>
      
      <div className="space-y-4">
        {testimonials.slice(0, 3).map((testimonial, index) => (
          <div key={index} className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
              {testimonial.name.charAt(0)}
            </div>
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
      
      <div className="mt-4 pt-4 border-t flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <div className="flex -space-x-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          ))}
        </div>
        <span>4.9/5 de mais de 500 avaliações</span>
      </div>
    </div>
  );
}

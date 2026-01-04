// =============================================
// TESTIMONIALS MANAGER - CRUD for checkout testimonials
// =============================================

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useCheckoutTestimonials } from '@/hooks/useCheckoutTestimonials';
import { 
  Plus, 
  Star, 
  GripVertical, 
  Trash2, 
  Pencil,
  MessageSquare,
  Users
} from 'lucide-react';
import { TestimonialDialog } from './TestimonialDialog';

export function TestimonialsManager() {
  const { 
    testimonials, 
    isLoading, 
    updateTestimonial,
    deleteTestimonial,
    reorderTestimonials 
  } = useCheckoutTestimonials();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<typeof testimonials[0] | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleEdit = (testimonial: typeof testimonials[0]) => {
    setEditingTestimonial(testimonial);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingTestimonial(null);
    setDialogOpen(true);
  };

  const handleToggleActive = async (id: string, currentActive: boolean, testimonial: typeof testimonials[0]) => {
    await updateTestimonial.mutateAsync({
      id,
      name: testimonial.name,
      content: testimonial.content,
      rating: testimonial.rating,
      image_url: testimonial.image_url,
      is_active: !currentActive,
      product_ids: testimonial.product_ids,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este depoimento?')) {
      await deleteTestimonial.mutateAsync(id);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const newOrder = testimonials.map(t => t.id);
    const draggedIndex = newOrder.indexOf(draggedId);
    const targetIndex = newOrder.indexOf(targetId);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);

    reorderTestimonials.mutate(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Provas Sociais / Depoimentos
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os depoimentos que aparecem no checkout
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Depoimento
        </Button>
      </div>

      {/* Testimonials List */}
      {testimonials.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhum depoimento cadastrado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Adicione depoimentos de clientes para exibir no checkout
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Depoimento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {testimonials.map((testimonial, index) => (
            <Card
              key={testimonial.id}
              draggable
              onDragStart={() => handleDragStart(testimonial.id)}
              onDragOver={(e) => handleDragOver(e, testimonial.id)}
              onDragEnd={handleDragEnd}
              className={`
                cursor-move transition-all
                ${draggedId === testimonial.id ? 'opacity-50 border-primary' : ''}
              `}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Drag handle */}
                  <div className="flex items-center gap-2 text-muted-foreground pt-1">
                    <GripVertical className="h-5 w-5" />
                    <span className="text-sm font-medium w-6">#{index + 1}</span>
                  </div>

                  {/* Avatar */}
                  {testimonial.image_url ? (
                    <img
                      src={testimonial.image_url}
                      alt={testimonial.name}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                      {testimonial.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{testimonial.name}</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: testimonial.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      "{testimonial.content}"
                    </p>
                    
                    {/* Product badges */}
                    {testimonial.product_ids && testimonial.product_ids.length > 0 ? (
                      <div className="mt-2 flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {testimonial.product_ids.length} produto(s) vinculado(s)
                        </Badge>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">
                          Todos os produtos
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={testimonial.is_active}
                      onCheckedChange={() => handleToggleActive(testimonial.id, testimonial.is_active, testimonial)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(testimonial)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(testimonial.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <TestimonialDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        testimonial={editingTestimonial}
      />
    </div>
  );
}

// =============================================
// TESTIMONIALS MANAGER COMPACT - For sidebar use
// =============================================

import { useState } from 'react';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
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
  Users
} from 'lucide-react';
import { TestimonialDialog } from './TestimonialDialog';

export function TestimonialsManagerCompact() {
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

  const { confirm: confirmAction, ConfirmDialog } = useConfirmDialog();

  const handleDelete = async (id: string) => {
    const ok = await confirmAction({
      title: "Excluir depoimento",
      description: "Tem certeza que deseja excluir este depoimento? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (ok) {
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
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header compacto */}
      <Button onClick={handleCreate} size="sm" className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Adicionar
      </Button>

      {/* Lista compacta de depoimentos */}
      {testimonials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center border rounded-lg bg-muted/30">
          <Users className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">
            Nenhum depoimento
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.id}
              draggable
              onDragStart={() => handleDragStart(testimonial.id)}
              onDragOver={(e) => handleDragOver(e, testimonial.id)}
              onDragEnd={handleDragEnd}
              className={`
                flex items-center gap-2 p-2 rounded-lg border bg-background
                cursor-move transition-all text-xs
                ${draggedId === testimonial.id ? 'opacity-50 border-primary' : 'hover:bg-muted/50'}
              `}
            >
              {/* Drag handle */}
              <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />

              {/* Avatar pequeno */}
              {testimonial.image_url ? (
                <img
                  src={testimonial.image_url}
                  alt={testimonial.name}
                  className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold flex-shrink-0">
                  {testimonial.name.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Nome e rating */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-medium truncate text-xs">{testimonial.name}</span>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {Array.from({ length: Math.min(testimonial.rating, 5) }).map((_, i) => (
                      <Star key={i} className="w-2 h-2 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions compactas */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Switch
                  checked={testimonial.is_active}
                  onCheckedChange={() => handleToggleActive(testimonial.id, testimonial.is_active, testimonial)}
                  className="scale-75"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleEdit(testimonial)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleDelete(testimonial.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <TestimonialDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        testimonial={editingTestimonial}
      />
      {ConfirmDialog}
    </div>
  );
}

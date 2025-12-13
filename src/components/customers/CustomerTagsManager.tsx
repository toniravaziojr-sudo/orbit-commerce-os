import { useState } from 'react';
import { Plus, Trash2, Tag, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { CustomerTag } from '@/hooks/useCustomers';

interface CustomerTagsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: CustomerTag[];
  onCreateTag: (data: { name: string; color: string; description?: string }) => void;
  onDeleteTag: (id: string) => void;
  isLoading?: boolean;
}

const colorOptions = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

export function CustomerTagsManager({
  open,
  onOpenChange,
  tags,
  onCreateTag,
  onDeleteTag,
  isLoading,
}: CustomerTagsManagerProps) {
  const { currentTenant } = useAuth();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(colorOptions[0]);
  const [assigningTagId, setAssigningTagId] = useState<string | null>(null);

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    onCreateTag({
      name: newTagName.trim(),
      color: newTagColor,
    });
    setNewTagName('');
    setNewTagColor(colorOptions[0]);
  };

  const handleAssignToAllCustomers = async (tagId: string) => {
    if (!currentTenant?.id) return;
    
    setAssigningTagId(tagId);
    try {
      const { data, error } = await supabase.functions.invoke('assign-tag-to-all-customers', {
        body: { tagId, tenantId: currentTenant.id },
      });

      if (error) throw error;

      toast.success(`Tag atribuída a ${data.assigned} clientes`);
    } catch (error) {
      console.error('Error assigning tag:', error);
      toast.error('Erro ao atribuir tag aos clientes');
    } finally {
      setAssigningTagId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Gerenciar Tags
          </DialogTitle>
          <DialogDescription>
            Crie e gerencie tags para segmentar seus clientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create new tag */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nova Tag</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da tag"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                />
                <Button onClick={handleCreateTag} disabled={!newTagName.trim() || isLoading}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full transition-all ${
                      newTagColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Existing tags */}
          <div className="space-y-2">
            <Label>Tags existentes</Label>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma tag criada ainda
              </p>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-2 rounded-lg border"
                  >
                    <Badge
                      variant="outline"
                      className="gap-2 py-1.5 px-3"
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssignToAllCustomers(tag.id)}
                        disabled={assigningTagId === tag.id}
                        className="gap-1 text-xs"
                      >
                        <Users className="h-3 w-3" />
                        {assigningTagId === tag.id ? 'Atribuindo...' : 'Atribuir a todos'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDeleteTag(tag.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { Plus, Trash2, Tag } from 'lucide-react';
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
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(colorOptions[0]);

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    onCreateTag({
      name: newTagName.trim(),
      color: newTagColor,
    });
    setNewTagName('');
    setNewTagColor(colorOptions[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
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
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="gap-2 py-1.5 px-3 group"
                    style={{ borderColor: tag.color, color: tag.color }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => onDeleteTag(tag.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </Badge>
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

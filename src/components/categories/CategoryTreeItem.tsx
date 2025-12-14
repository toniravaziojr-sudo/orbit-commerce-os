import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Category } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown, GripVertical, Pencil, Trash2, FolderOpen, Folder, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPublicCategoryUrl } from '@/lib/publicUrls';
import { useAuth } from '@/hooks/useAuth';

interface CategoryTreeItemProps {
  category: Category;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isOver: boolean;
  isDragging: boolean;
}

export function CategoryTreeItem({
  category,
  depth,
  isExpanded,
  hasChildren,
  onToggleExpand,
  onEdit,
  onDelete,
  isOver,
  isDragging,
}: CategoryTreeItemProps) {
  const { currentTenant } = useAuth();
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handlePreview = () => {
    if (currentTenant && category.slug) {
      const url = getPublicCategoryUrl(currentTenant.slug, category.slug, true);
      if (url) window.open(url, '_blank');
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors group',
        isOver && 'ring-2 ring-primary bg-accent',
        isDragging && 'opacity-50'
      )}
      {...attributes}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
        aria-label="Arrastar categoria"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Indentation */}
      {depth > 0 && (
        <div style={{ width: depth * 24 }} className="flex-shrink-0" />
      )}

      {/* Expand/collapse button */}
      {hasChildren ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="p-1 hover:bg-muted rounded"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      ) : (
        <div className="w-6" />
      )}

      {/* Folder icon */}
      {hasChildren ? (
        <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
      ) : (
        <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}

      {/* Category name */}
      <span className="font-medium flex-1 truncate">{category.name}</span>

      {/* Slug */}
      <span className="text-sm text-muted-foreground hidden sm:block truncate max-w-32">
        {category.slug}
      </span>

      {/* Status badge */}
      <Badge variant={category.is_active ? 'default' : 'secondary'} className="flex-shrink-0">
        {category.is_active ? 'Ativa' : 'Inativa'}
      </Badge>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {category.is_active && category.slug && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePreview} title="Visualizar">
            <Eye className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

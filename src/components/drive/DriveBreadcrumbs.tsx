import { cn } from "@/lib/utils";
import { ChevronRight, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileItem } from "@/hooks/useFiles";

interface DriveBreadcrumbsProps {
  folderPath: { id: string | null; name: string }[];
  onNavigateToPath: (index: number) => void;
  onDropOnBreadcrumb: (e: React.DragEvent, folderId: string | null) => void;
  onDragOverFolder: (e: React.DragEvent) => void;
  draggedItem: FileItem | null;
  currentFolderId: string | null;
}

export function DriveBreadcrumbs({
  folderPath,
  onNavigateToPath,
  onDropOnBreadcrumb,
  onDragOverFolder,
  draggedItem,
  currentFolderId,
}: DriveBreadcrumbsProps) {
  return (
    <div className="flex items-center gap-2">
      {currentFolderId && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => onNavigateToPath(folderPath.length - 2)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      <nav className="flex items-center gap-0.5 text-sm overflow-x-auto">
        {folderPath.map((path, index) => (
          <div key={path.id || 'root'} className="flex items-center gap-0.5 shrink-0">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <button
              onClick={() => onNavigateToPath(index)}
              onDragOver={onDragOverFolder}
              onDrop={(e) => onDropOnBreadcrumb(e, path.id)}
              className={cn(
                "px-2 py-1 rounded-md text-sm transition-colors hover:bg-muted",
                index === folderPath.length - 1
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
                draggedItem && "ring-2 ring-primary/40 ring-dashed"
              )}
            >
              {index === 0 ? (
                <Home className="h-4 w-4" />
              ) : (
                <span className="max-w-[120px] truncate inline-block">{path.name}</span>
              )}
            </button>
          </div>
        ))}
      </nav>
    </div>
  );
}

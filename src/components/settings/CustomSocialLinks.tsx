import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, GripVertical, Link as LinkIcon } from 'lucide-react';
import type { CustomSocialLink } from '@/hooks/useStoreSettings';

interface CustomSocialLinksProps {
  value: CustomSocialLink[];
  onChange: (links: CustomSocialLink[]) => void;
  disabled?: boolean;
}

export function CustomSocialLinks({ value, onChange, disabled = false }: CustomSocialLinksProps) {
  const addLink = () => {
    onChange([...value, { label: '', url: '' }]);
  };

  const updateLink = (index: number, field: keyof CustomSocialLink, newValue: string) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: newValue };
    onChange(updated);
  };

  const removeLink = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Outras redes sociais</Label>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLink}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar rede
          </Button>
        )}
      </div>
      
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border-2 border-dashed rounded-lg">
          Nenhuma rede adicional configurada
        </p>
      ) : (
        <div className="space-y-2">
          {value.map((link, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input
                  placeholder="Nome (ex: X, LinkedIn)"
                  value={link.label}
                  onChange={(e) => updateLink(index, 'label', e.target.value)}
                  disabled={disabled}
                />
                <Input
                  placeholder="URL (https://...)"
                  value={link.url}
                  onChange={(e) => updateLink(index, 'url', e.target.value)}
                  disabled={disabled}
                />
              </div>
              
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLink(index)}
                  className="shrink-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

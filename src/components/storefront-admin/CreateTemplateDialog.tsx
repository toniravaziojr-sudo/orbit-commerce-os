import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LayoutTemplate, FileText, Sparkles } from 'lucide-react';

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => void;
  preset: 'cosmetics' | 'blank';
  isLoading?: boolean;
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
  onConfirm,
  preset,
  isLoading,
}: CreateTemplateDialogProps) {
  const [name, setName] = useState('');

  const handleConfirm = () => {
    if (name.trim()) {
      onConfirm(name.trim());
      setName('');
    }
  };

  const presetInfo = preset === 'cosmetics' 
    ? {
        icon: <LayoutTemplate className="h-5 w-5" />,
        title: 'Novo Template Cosméticos',
        description: 'Layout completo com blocos e seções prontas para loja de cosméticos.',
      }
    : {
        icon: <FileText className="h-5 w-5" />,
        title: 'Novo Template do Zero',
        description: 'Estrutura mínima com apenas header e footer para você construir.',
      };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {presetInfo.icon}
            </div>
            {presetInfo.title}
          </DialogTitle>
          <DialogDescription>
            {presetInfo.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Nome do template</Label>
            <Input
              id="template-name"
              placeholder="Ex: Campanha de Natal, Nova Identidade..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Dê um nome único para identificar este template facilmente.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!name.trim() || isLoading}>
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                Criando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Criar Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

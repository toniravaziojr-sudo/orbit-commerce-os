import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface ClearDataDialogProps {
  onClear: (modules: ('products' | 'categories' | 'customers' | 'orders' | 'all')[]) => Promise<void>;
  isClearing: boolean;
}

const moduleOptions = [
  { id: 'products', label: 'Produtos', description: 'Inclui imagens, variantes e vínculos com categorias' },
  { id: 'categories', label: 'Categorias', description: 'Todas as categorias do tenant' },
  { id: 'customers', label: 'Clientes', description: 'Inclui endereços, notas e tags' },
  { id: 'orders', label: 'Pedidos', description: 'Inclui itens e histórico' },
] as const;

export function ClearDataDialog({ onClear, isClearing }: ClearDataDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState('');
  const [selectAll, setSelectAll] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedModules(new Set(moduleOptions.map(m => m.id)));
    } else {
      setSelectedModules(new Set());
    }
  };

  const handleModuleToggle = (moduleId: string, checked: boolean) => {
    const newSet = new Set(selectedModules);
    if (checked) {
      newSet.add(moduleId);
    } else {
      newSet.delete(moduleId);
    }
    setSelectedModules(newSet);
    setSelectAll(newSet.size === moduleOptions.length);
  };

  const handleClear = async () => {
    const modules = selectAll 
      ? ['all'] as ('all')[]
      : Array.from(selectedModules) as ('products' | 'categories' | 'customers' | 'orders')[];
    
    await onClear(modules);
    setOpen(false);
    setSelectedModules(new Set());
    setConfirmText('');
    setSelectAll(false);
  };

  const canConfirm = (selectedModules.size > 0 || selectAll) && confirmText === 'CONFIRMAR';

  return (
    <AlertDialog open={open} onOpenChange={(value) => !isClearing && setOpen(value)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:text-destructive" disabled={isClearing}>
          {isClearing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Limpando...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar Dados
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Limpar Dados para Reimportação
          </AlertDialogTitle>
          <AlertDialogDescription>
            Selecione os módulos que deseja limpar. Esta ação é irreversível.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Todos os dados selecionados serão permanentemente removidos e não poderão ser recuperados.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="flex items-center space-x-2 pb-2 border-b">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="font-semibold">
                Selecionar Todos
              </Label>
            </div>

            {moduleOptions.map((module) => (
              <div key={module.id} className="flex items-start space-x-2">
                <Checkbox
                  id={module.id}
                  checked={selectedModules.has(module.id)}
                  onCheckedChange={(checked) => handleModuleToggle(module.id, checked as boolean)}
                />
                <div className="grid gap-0.5">
                  <Label htmlFor={module.id} className="font-medium">
                    {module.label}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {module.description}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <Label htmlFor="confirm" className="text-sm">
              Digite <strong>CONFIRMAR</strong> para habilitar a limpeza:
            </Label>
            <Input
              id="confirm"
              placeholder="CONFIRMAR"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isClearing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleClear}
            disabled={!canConfirm || isClearing}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isClearing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Limpando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Dados
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

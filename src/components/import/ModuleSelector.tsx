import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Package, FolderTree, Users, ShoppingCart } from 'lucide-react';

interface ModuleSelectorProps {
  selected: string[];
  onToggle: (module: string) => void;
}

const modules = [
  {
    id: 'categories',
    label: 'Categorias',
    description: 'Importar categorias e subcategorias',
    icon: FolderTree,
  },
  {
    id: 'products',
    label: 'Produtos',
    description: 'Importar produtos, variantes e imagens',
    icon: Package,
  },
  {
    id: 'customers',
    label: 'Clientes',
    description: 'Importar clientes e endereços',
    icon: Users,
  },
  {
    id: 'orders',
    label: 'Pedidos',
    description: 'Importar histórico de pedidos',
    icon: ShoppingCart,
  },
];

export function ModuleSelector({ selected, onToggle }: ModuleSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">O que você deseja importar?</h3>
      <div className="space-y-3">
        {modules.map((module) => {
          const Icon = module.icon;
          const isSelected = selected.includes(module.id);

          return (
            <div
              key={module.id}
              className={`flex items-center space-x-4 p-4 border rounded-lg cursor-pointer transition-all ${
                isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
              }`}
              onClick={() => onToggle(module.id)}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle(module.id)}
              />
              <Icon className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <Label className="font-medium cursor-pointer">{module.label}</Label>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

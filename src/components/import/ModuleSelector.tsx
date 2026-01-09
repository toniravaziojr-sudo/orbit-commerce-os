import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Package, FolderTree, Users, ShoppingCart, Palette, Image } from 'lucide-react';

interface ModuleSelectorProps {
  selected: string[];
  onToggle: (module: string) => void;
}

const modules = [
  {
    id: 'visual',
    label: 'Visual da Loja',
    description: 'Importar banners, logos, cores e identidade visual',
    icon: Palette,
    highlight: false,
    disabled: true,
  },
  {
    id: 'categories',
    label: 'Categorias',
    description: 'Importar categorias e subcategorias',
    icon: FolderTree,
    disabled: true,
  },
  {
    id: 'products',
    label: 'Produtos',
    description: 'Importar produtos, variantes e imagens',
    icon: Package,
    disabled: true,
  },
  {
    id: 'customers',
    label: 'Clientes',
    description: 'Importar clientes e endereços',
    icon: Users,
    disabled: true,
  },
  {
    id: 'orders',
    label: 'Pedidos',
    description: 'Importar histórico de pedidos',
    icon: ShoppingCart,
    disabled: true,
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
          const isDisabled = module.disabled;

          return (
            <div
              key={module.id}
              className={`flex items-center space-x-4 p-4 border rounded-lg transition-all ${
                isDisabled
                  ? 'opacity-50 cursor-not-allowed border-destructive/50 bg-destructive/5'
                  : isSelected 
                    ? 'border-primary bg-primary/5 cursor-pointer' 
                    : 'hover:border-muted-foreground/50 cursor-pointer'
              }`}
              onClick={() => !isDisabled && onToggle(module.id)}
            >
              <Checkbox
                checked={isSelected}
                disabled={isDisabled}
                onCheckedChange={() => !isDisabled && onToggle(module.id)}
              />
              <Icon className={`h-5 w-5 ${isDisabled ? 'text-destructive' : 'text-muted-foreground'}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label className={`font-medium ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>{module.label}</Label>
                  {isDisabled && (
                    <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
                      Em teste
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

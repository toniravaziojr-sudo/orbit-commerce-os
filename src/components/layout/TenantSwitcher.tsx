import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Store, ChevronDown, Plus, Check } from 'lucide-react';

export function TenantSwitcher() {
  const navigate = useNavigate();
  const { currentTenant, tenants, setCurrentTenant } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleSwitchTenant = async (tenantId: string) => {
    await setCurrentTenant(tenantId);
    setIsOpen(false);
  };

  const handleCreateStore = () => {
    setIsOpen(false);
    navigate('/create-store');
  };

  if (!currentTenant) {
    return null;
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-2 h-9 text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <div className="h-6 w-6 rounded-md bg-sidebar-primary flex items-center justify-center">
            <Store className="h-3.5 w-3.5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-medium text-sm truncate max-w-[120px]">
            {currentTenant.name}
          </span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Suas Lojas
        </DropdownMenuLabel>
        {tenants.map((tenant) => (
          <DropdownMenuItem
            key={tenant.id}
            onClick={() => handleSwitchTenant(tenant.id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                <Store className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="truncate">{tenant.name}</span>
            </div>
            {tenant.id === currentTenant.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCreateStore} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          Criar Nova Loja
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

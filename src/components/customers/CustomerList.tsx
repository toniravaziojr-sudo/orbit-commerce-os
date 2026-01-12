import { useState } from 'react';
import { 
  Users, 
  Mail, 
  Phone, 
  MoreHorizontal, 
  Eye, 
  Trash2,
  Crown,
  ShoppingBag,
  TrendingUp
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteCustomerDialog } from './DeleteCustomerDialog';
import type { Customer } from '@/hooks/useCustomers';

interface CustomerListProps {
  customers: Customer[];
  isLoading: boolean;
  onView: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
}

const statusConfig = {
  active: { label: 'Ativo', variant: 'default' as const },
  inactive: { label: 'Inativo', variant: 'secondary' as const },
  blocked: { label: 'Bloqueado', variant: 'destructive' as const },
};

const tierConfig = {
  bronze: { label: 'Bronze', color: 'bg-amber-700' },
  silver: { label: 'Prata', color: 'bg-slate-400' },
  gold: { label: 'Ouro', color: 'bg-yellow-500' },
  platinum: { label: 'Platina', color: 'bg-violet-500' },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString));
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function CustomerList({
  customers,
  isLoading,
  onView,
  onEdit,
  onDelete,
  onAddNew,
}: CustomerListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setCustomerToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (customerToDelete) {
      onDelete(customerToDelete);
    }
    setDeleteDialogOpen(false);
    setCustomerToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum cliente cadastrado"
        description="Clientes serão adicionados automaticamente quando fizerem pedidos, ou você pode cadastrá-los manualmente."
        action={{
          label: 'Adicionar Cliente',
          onClick: onAddNew,
        }}
      />
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Total Gasto</TableHead>
              <TableHead className="text-right">Ticket Médio</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell onClick={() => onView(customer)}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {getInitials(customer.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{customer.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Cliente desde {formatDate(customer.created_at)}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {customer.email}
                    </div>
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {customer.phone}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig[customer.status].variant}>
                    {statusConfig[customer.status].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Crown className={`h-4 w-4 ${tierConfig[customer.loyalty_tier].color} text-white rounded-full p-0.5`} />
                    <span className="text-sm">{tierConfig[customer.loyalty_tier].label}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.total_orders}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(customer.total_spent)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span>{formatCurrency(customer.average_ticket)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(customer)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver detalhes
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteClick(customer.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DeleteCustomerDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        customerId={customerToDelete}
        customerName={customers.find(c => c.id === customerToDelete)?.full_name}
        onConfirm={confirmDelete}
      />
    </>
  );
}

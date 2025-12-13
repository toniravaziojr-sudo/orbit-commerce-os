import { useState, useMemo } from 'react';
import { Users, Plus, Search, Download, Tag, Upload } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { CustomerList } from '@/components/customers/CustomerList';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { CustomerTagsManager } from '@/components/customers/CustomerTagsManager';
import { CustomerImport } from '@/components/customers/CustomerImport';
import { useCustomers, useCustomerTags, type Customer, type CustomerFormData } from '@/hooks/useCustomers';

export default function Customers() {
  const [formOpen, setFormOpen] = useState(false);
  const [tagsManagerOpen, setTagsManagerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { customers, isLoading, createCustomer, updateCustomer, deleteCustomer, refetch } = useCustomers();
  const { tags, createTag, deleteTag } = useCustomerTags();

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch =
        !searchQuery ||
        customer.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone?.includes(searchQuery);

      const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [customers, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const active = customers.filter((c) => c.status === 'active').length;
    const totalSpent = customers.reduce((acc, c) => acc + c.total_spent, 0);
    const totalOrders = customers.reduce((acc, c) => acc + c.total_orders, 0);
    const avgTicket = totalOrders > 0 ? totalSpent / totalOrders : 0;

    return { total: customers.length, active, totalSpent, avgTicket };
  }, [customers]);

  const handleAddNew = () => {
    setSelectedCustomer(null);
    setFormOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormOpen(true);
  };

  const handleView = (customer: Customer) => {
    // TODO: Navigate to customer detail page
    console.log('View customer:', customer);
  };

  const handleSubmit = (data: CustomerFormData) => {
    if (selectedCustomer) {
      updateCustomer.mutate({ id: selectedCustomer.id, ...data }, {
        onSuccess: () => setFormOpen(false),
      });
    } else {
      createCustomer.mutate(data, {
        onSuccess: () => setFormOpen(false),
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteCustomer.mutate(id);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Clientes"
        description="Base de clientes com histórico, tags e segmentação"
        actions={
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Importar
            </Button>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button className="gap-2" onClick={handleAddNew}>
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total de Clientes"
          value={stats.total.toString()}
          icon={Users}
        />
        <StatCard
          title="Clientes Ativos"
          value={stats.active.toString()}
          icon={Users}
          trend={{ value: Math.round((stats.active / (stats.total || 1)) * 100), label: 'do total' }}
        />
        <StatCard
          title="Faturamento Total"
          value={formatCurrency(stats.totalSpent)}
          icon={Users}
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(stats.avgTicket)}
          icon={Users}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                  <SelectItem value="blocked">Bloqueados</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setTagsManagerOpen(true)}
              >
                <Tag className="h-4 w-4" />
                Gerenciar Tags
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Base de Clientes
            {filteredCustomers.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredCustomers.length} {filteredCustomers.length === 1 ? 'cliente' : 'clientes'})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerList
            customers={filteredCustomers}
            isLoading={isLoading}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddNew={handleAddNew}
          />
        </CardContent>
      </Card>

      {/* Customer Form Modal */}
      <CustomerForm
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={selectedCustomer}
        onSubmit={handleSubmit}
        isLoading={createCustomer.isPending || updateCustomer.isPending}
      />

      {/* Tags Manager Modal */}
      <CustomerTagsManager
        open={tagsManagerOpen}
        onOpenChange={setTagsManagerOpen}
        tags={tags}
        onCreateTag={(data) => createTag.mutate(data)}
        onDeleteTag={(id) => deleteTag.mutate(id)}
        isLoading={createTag.isPending}
      />

      {/* Import Modal */}
      <CustomerImport
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

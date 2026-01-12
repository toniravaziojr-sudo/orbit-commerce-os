import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search, Download, Tag, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { CustomerTagsManager } from '@/components/customers/CustomerTagsManager';
import { CustomerImport } from '@/components/customers/CustomerImport';
import { useCustomers, useCustomerTags, type Customer } from '@/hooks/useCustomers';

const PAGE_SIZE = 50;

export default function Customers() {
  const navigate = useNavigate();
  const [tagsManagerOpen, setTagsManagerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 300);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const { 
    customers, 
    totalCount, 
    isLoading, 
    deleteCustomer, 
    refetch 
  } = useCustomers({
    page: currentPage,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
    status: statusFilter,
  });

  const { tags, createTag, deleteTag } = useCustomerTags();

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleAddNew = () => {
    navigate('/customers/new');
  };

  const handleEdit = (customer: Customer) => {
    navigate(`/customers/${customer.id}`);
  };

  const handleView = (customer: Customer) => {
    navigate(`/customers/${customer.id}`);
  };

  const handleDelete = (id: string) => {
    deleteCustomer.mutate(id);
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
          value={totalCount.toString()}
          icon={Users}
        />
        <StatCard
          title="Exibindo"
          value={`${customers.length} de ${totalCount}`}
          icon={Users}
          description={`Página ${currentPage} de ${totalPages || 1}`}
        />
        <StatCard
          title="Página Atual"
          value={currentPage.toString()}
          icon={Users}
        />
        <StatCard
          title="Por Página"
          value={PAGE_SIZE.toString()}
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
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Select value={statusFilter} onValueChange={handleStatusChange}>
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
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({totalCount} {totalCount === 1 ? 'cliente' : 'clientes'})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CustomerList
            customers={customers}
            isLoading={isLoading}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddNew={handleAddNew}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * PAGE_SIZE) + 1} a {Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount} clientes
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        className="w-9"
                        onClick={() => setCurrentPage(pageNum)}
                        disabled={isLoading}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isLoading}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

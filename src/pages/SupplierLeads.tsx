import { useState } from "react";
import { Plus, Search, ExternalLink, Mail, Phone, Building2, Filter, MoreHorizontal, Trash2, Edit, Clock, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useSupplierLeads, SupplierLeadInsert } from "@/hooks/useSupplierLeads";

const CATEGORIES = [
  { value: 'cosmeticos', label: 'Cosméticos' },
  { value: 'embalagens', label: 'Embalagens' },
  { value: 'logistica', label: 'Logística' },
  { value: 'materia-prima', label: 'Matéria-prima' },
  { value: 'equipamentos', label: 'Equipamentos' },
  { value: 'marketing', label: 'Marketing/Design' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'outros', label: 'Outros' },
];

const STATUSES = [
  { value: 'prospect', label: 'Prospecção', color: 'bg-gray-500' },
  { value: 'contacted', label: 'Contatado', color: 'bg-blue-500' },
  { value: 'negotiating', label: 'Negociando', color: 'bg-yellow-500' },
  { value: 'approved', label: 'Aprovado', color: 'bg-green-500' },
  { value: 'discarded', label: 'Descartado', color: 'bg-red-500' },
];

export default function SupplierLeads() {
  const { suppliers, isLoading, createSupplier, updateSupplier, deleteSupplier } = useSupplierLeads();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<SupplierLeadInsert>>({
    name: '',
    status: 'prospect',
  });

  const filteredSuppliers = suppliers.filter(sup => {
    const matchesSearch = sup.name.toLowerCase().includes(search.toLowerCase()) ||
      sup.category?.toLowerCase().includes(search.toLowerCase()) ||
      sup.location?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sup.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || sup.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleSubmit = async () => {
    if (!formData.name) return;
    
    if (editingId) {
      await updateSupplier.mutateAsync({ id: editingId, ...formData });
    } else {
      await createSupplier.mutateAsync(formData as SupplierLeadInsert);
    }
    
    setIsAddOpen(false);
    setEditingId(null);
    setFormData({ name: '', status: 'prospect' });
  };

  const handleEdit = (supplier: typeof suppliers[0]) => {
    setFormData(supplier);
    setEditingId(supplier.id);
    setIsAddOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Remover este fornecedor?')) {
      await deleteSupplier.mutateAsync(id);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = STATUSES.find(st => st.value === status);
    return <Badge className={`${s?.color} text-white`}>{s?.label || status}</Badge>;
  };

  const getCategoryLabel = (category: string | null) => {
    if (!category) return '-';
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Busca de Fornecedores</h1>
          <p className="text-muted-foreground">Encontre e gerencie fornecedores para seu negócio</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) {
            setEditingId(null);
            setFormData({ name: '', status: 'prospect' });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar' : 'Adicionar'} Fornecedor</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome do fornecedor"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={formData.category || ''} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={formData.website_url || ''}
                  onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Localização</Label>
                  <Input
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Cidade, Estado"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pessoa de Contato</Label>
                  <Input
                    value={formData.contact_person || ''}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="Nome do contato"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.contact_email || ''}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.contact_phone || ''}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>MOQ</Label>
                  <Input
                    value={formData.moq || ''}
                    onChange={(e) => setFormData({ ...formData, moq: e.target.value })}
                    placeholder="Ex: 100 un"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prazo (dias)</Label>
                  <Input
                    type="number"
                    value={formData.lead_time_days || ''}
                    onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || null })}
                    placeholder="15"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status || 'prospect'} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações de Preço</Label>
                <Input
                  value={formData.price_notes || ''}
                  onChange={(e) => setFormData({ ...formData, price_notes: e.target.value })}
                  placeholder="Ex: Desconto para >500un"
                />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações gerais..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!formData.name || createSupplier.isPending || updateSupplier.isPending}>
                {editingId ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, categoria ou localização..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fornecedores Salvos</CardTitle>
          <CardDescription>{filteredSuppliers.length} fornecedor(es) encontrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum fornecedor encontrado</p>
              <p className="text-sm">Adicione fornecedores manualmente para começar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>MOQ</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((sup) => (
                  <TableRow key={sup.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium">{sup.name}</p>
                          {sup.contact_person && <p className="text-sm text-muted-foreground">{sup.contact_person}</p>}
                        </div>
                        {sup.website_url && (
                          <a href={sup.website_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getCategoryLabel(sup.category)}</TableCell>
                    <TableCell>{sup.location || '-'}</TableCell>
                    <TableCell>
                      {sup.moq ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Package className="h-3 w-3" />
                          {sup.moq}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {sup.lead_time_days ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {sup.lead_time_days}d
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(sup.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {sup.contact_email && (
                          <a href={`mailto:${sup.contact_email}`}>
                            <Mail className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </a>
                        )}
                        {sup.contact_phone && (
                          <a href={`tel:${sup.contact_phone}`}>
                            <Phone className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(sup)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(sup.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

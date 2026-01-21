import { useState, useEffect, useCallback } from "react";
import { Plus, Search, ExternalLink, Mail, Phone, Building2, Filter, MoreHorizontal, Trash2, Edit, Clock, Package, MapPin, Globe, Loader2, BookmarkPlus, RefreshCw, Navigation } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupplierLeads, SupplierLeadInsert } from "@/hooks/useSupplierLeads";
import { useSupplierSearch, SearchResult } from "@/hooks/useSupplierSearch";

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

const RADIUS_OPTIONS = [
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
  { value: 200, label: '200 km' },
  { value: 500, label: 'Nacional' },
];

export default function SupplierLeads() {
  const { suppliers, isLoading, createSupplier, updateSupplier, deleteSupplier } = useSupplierLeads();
  const { search, clearSearch, results, isSearching, hasSearched, saveSupplier, isSaving, centerCoords } = useSupplierSearch();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<string>("search");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [radius, setRadius] = useState<number>(50);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  // Saved suppliers filter state
  const [savedSearch, setSavedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  // Form state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<SupplierLeadInsert>>({
    name: '',
    status: 'prospect',
  });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length >= 3) {
      search({
        query: debouncedQuery,
        location: locationQuery || undefined,
        radiusKm: radius,
      });
    } else if (debouncedQuery.length === 0) {
      clearSearch();
    }
  }, [debouncedQuery, locationQuery, radius, search, clearSearch]);

  const filteredSuppliers = suppliers.filter(sup => {
    const matchesSearch = sup.name.toLowerCase().includes(savedSearch.toLowerCase()) ||
      sup.category?.toLowerCase().includes(savedSearch.toLowerCase()) ||
      sup.location?.toLowerCase().includes(savedSearch.toLowerCase());
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

  const handleSaveFromSearch = async (result: SearchResult) => {
    await saveSupplier.mutateAsync(result);
  };

  const handleOpenMaps = (result: SearchResult) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${result.lat},${result.lon}`, '_blank');
  };

  const getStatusBadge = (status: string) => {
    const s = STATUSES.find(st => st.value === status);
    return <Badge className={`${s?.color} text-white`}>{s?.label || status}</Badge>;
  };

  const getCategoryLabel = (category: string | null) => {
    if (!category) return '-';
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  const formatDistance = (km?: number) => {
    if (km === undefined) return null;
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
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
              Adicionar Manual
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="search" className="gap-2">
            <Globe className="h-4 w-4" />
            Buscar Novos
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-2">
            <Building2 className="h-4 w-4" />
            Meus Fornecedores ({suppliers.length})
          </TabsTrigger>
        </TabsList>

        {/* ============ SEARCH TAB ============ */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Buscar Fornecedores</CardTitle>
              <CardDescription>
                Digite o que você procura (ex: "embalagens para cosméticos", "frascos PET") e a localidade
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[250px]">
                  <Label className="text-sm text-muted-foreground mb-2 block">O que você procura?</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="embalagens para cosméticos, frascos, rótulos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-[200px]">
                  <Label className="text-sm text-muted-foreground mb-2 block">Localidade</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="São Paulo, SP"
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-[140px]">
                  <Label className="text-sm text-muted-foreground mb-2 block">Raio</Label>
                  <Select value={radius.toString()} onValueChange={(v) => setRadius(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RADIUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {centerCoords && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Navigation className="h-3 w-3" />
                  Buscando a partir de: {centerCoords.displayName.split(',').slice(0, 2).join(',')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Search Results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Resultados
                {isSearching && <Loader2 className="h-4 w-4 animate-spin" />}
              </CardTitle>
              {hasSearched && !isSearching && (
                <CardDescription>
                  {results.length} fornecedor(es) encontrado(s)
                  {centerCoords && ` em um raio de ${radius} km`}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {isSearching ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !hasSearched ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Digite sua busca para encontrar fornecedores</p>
                  <p className="text-sm">Mínimo 3 caracteres</p>
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum fornecedor encontrado</p>
                  <p className="text-sm">Tente outros termos ou aumente o raio de busca</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{result.name}</h4>
                          {result.distance !== undefined && (
                            <Badge variant="secondary" className="shrink-0">
                              {formatDistance(result.distance)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {[result.address.city, result.address.state].filter(Boolean).join(', ') || result.displayName.split(',').slice(0, 2).join(',')}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-sm flex-wrap">
                          {result.phone && (
                            <a href={`tel:${result.phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-primary">
                              <Phone className="h-3 w-3" />
                              {result.phone}
                            </a>
                          )}
                          {result.email && (
                            <a href={`mailto:${result.email}`} className="flex items-center gap-1 text-muted-foreground hover:text-primary">
                              <Mail className="h-3 w-3" />
                              {result.email}
                            </a>
                          )}
                          {result.website && (
                            <a href={result.website.startsWith('http') ? result.website : `https://${result.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-muted-foreground hover:text-primary">
                              <Globe className="h-3 w-3" />
                              Site
                            </a>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {result.type}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenMaps(result)}
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveFromSearch(result)}
                          disabled={isSaving}
                        >
                          <BookmarkPlus className="h-4 w-4 mr-1" />
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ SAVED SUPPLIERS TAB ============ */}
        <TabsContent value="saved" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, categoria ou localização..."
                      value={savedSearch}
                      onChange={(e) => setSavedSearch(e.target.value)}
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
                  <p className="text-sm">Use a aba "Buscar Novos" para encontrar fornecedores ou adicione manualmente</p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

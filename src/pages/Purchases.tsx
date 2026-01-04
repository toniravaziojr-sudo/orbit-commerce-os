import { useState, useMemo } from "react";
import { ShoppingBag, Plus, Truck, Package, Users, Pencil, Trash2, FileText, Search, History } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePurchases, PURCHASE_STATUS_LABELS, PURCHASE_STATUS_COLORS, Purchase } from "@/hooks/usePurchases";
import { useSuppliers } from "@/hooks/useSuppliers";
import { usePurchaseTypes } from "@/hooks/usePurchaseTypes";
import { useSupplierTypes } from "@/hooks/useSupplierTypes";
import { SupplierFormDialog } from "@/components/purchases/SupplierFormDialog";
import { PurchaseFormDialog } from "@/components/purchases/PurchaseFormDialog";
import { DeleteConfirmDialog } from "@/components/purchases/DeleteConfirmDialog";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { ExportDropdown } from "@/components/ui/export-dropdown";
import { exportToCSV, exportToExcel, formatDateForExport, formatCurrencyForExport } from "@/lib/exportUtils";
import { format, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";

export default function Purchases() {
  const { purchases, pendingCount, inTransitCount, deliveredThisMonth, createPurchase, updatePurchase, deletePurchase, isLoading: loadingPurchases } = usePurchases();
  const { suppliers, createSupplier, updateSupplier, deleteSupplier, isLoading: loadingSuppliers } = useSuppliers();
  const { purchaseTypes } = usePurchaseTypes();
  const { supplierTypes } = useSupplierTypes();
  
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  
  // States para confirmação de exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'purchase' | 'supplier'>('purchase');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>('');

  // Filters for orders tab
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<string>("all");
  const [ordersPurchaseTypeFilter, setOrdersPurchaseTypeFilter] = useState<string>("all");
  const [ordersStartDate, setOrdersStartDate] = useState<Date | undefined>();
  const [ordersEndDate, setOrdersEndDate] = useState<Date | undefined>();

  // Filters for suppliers tab
  const [suppliersSearch, setSuppliersSearch] = useState("");
  const [suppliersTypeFilter, setSuppliersTypeFilter] = useState<string>("all");

  // Filters for history tab
  const [historySearch, setHistorySearch] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [historyEndDate, setHistoryEndDate] = useState<Date | undefined>(endOfMonth(new Date()));

  // Filtered orders
  const filteredPurchases = useMemo(() => {
    return purchases.filter(purchase => {
      // Search filter
      if (ordersSearch) {
        const searchLower = ordersSearch.toLowerCase();
        if (
          !purchase.order_number?.toLowerCase().includes(searchLower) &&
          !purchase.description?.toLowerCase().includes(searchLower) &&
          !purchase.supplier?.name?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      
      // Status filter
      if (ordersStatusFilter !== 'all' && purchase.status !== ordersStatusFilter) {
        return false;
      }
      
      // Purchase type filter
      if (ordersPurchaseTypeFilter !== 'all' && purchase.purchase_type_id !== ordersPurchaseTypeFilter) {
        return false;
      }
      
      // Date filter
      if (ordersStartDate && ordersEndDate) {
        const purchaseDate = new Date(purchase.created_at);
        if (!isWithinInterval(purchaseDate, { start: ordersStartDate, end: ordersEndDate })) {
          return false;
        }
      }
      
      return true;
    });
  }, [purchases, ordersSearch, ordersStatusFilter, ordersPurchaseTypeFilter, ordersStartDate, ordersEndDate]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(supplier => {
      // Search filter
      if (suppliersSearch) {
        const searchLower = suppliersSearch.toLowerCase();
        if (
          !supplier.name?.toLowerCase().includes(searchLower) &&
          !supplier.cnpj?.toLowerCase().includes(searchLower) &&
          !supplier.contact_person?.toLowerCase().includes(searchLower) &&
          !supplier.email?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      
      // Type filter
      if (suppliersTypeFilter !== 'all' && supplier.supplier_type_id !== suppliersTypeFilter) {
        return false;
      }
      
      return true;
    });
  }, [suppliers, suppliersSearch, suppliersTypeFilter]);

  // Filtered history (all orders for history)
  const filteredHistory = useMemo(() => {
    return purchases.filter(purchase => {
      // Search filter
      if (historySearch) {
        const searchLower = historySearch.toLowerCase();
        if (
          !purchase.order_number?.toLowerCase().includes(searchLower) &&
          !purchase.description?.toLowerCase().includes(searchLower) &&
          !purchase.supplier?.name?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      
      // Date filter
      if (historyStartDate && historyEndDate) {
        const purchaseDate = new Date(purchase.created_at);
        if (!isWithinInterval(purchaseDate, { start: historyStartDate, end: historyEndDate })) {
          return false;
        }
      }
      
      return true;
    });
  }, [purchases, historySearch, historyStartDate, historyEndDate]);

  const handleSupplierSubmit = (data: any) => {
    if (editingSupplier) {
      updateSupplier.mutate({ id: editingSupplier.id, ...data });
    } else {
      createSupplier.mutate(data);
    }
    setSupplierDialogOpen(false);
    setEditingSupplier(null);
  };

  const handlePurchaseSubmit = (data: any) => {
    if (editingPurchase) {
      updatePurchase.mutate({ id: editingPurchase.id, ...data });
    } else {
      createPurchase.mutate(data);
    }
    setPurchaseDialogOpen(false);
    setEditingPurchase(null);
  };

  const handleDeleteClick = (type: 'purchase' | 'supplier', id: string, name: string) => {
    setDeleteType(type);
    setDeleteId(id);
    setDeleteName(name);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deleteId) return;
    if (deleteType === 'purchase') {
      deletePurchase.mutate(deleteId);
    } else {
      deleteSupplier.mutate(deleteId);
    }
    setDeleteDialogOpen(false);
    setDeleteId(null);
  };

  const getPurchaseTypeName = (typeId: string | null | undefined) => {
    if (!typeId) return null;
    const type = purchaseTypes.find(t => t.id === typeId);
    return type?.name;
  };

  const getSupplierTypeName = (typeId: string | null | undefined) => {
    if (!typeId) return null;
    const type = supplierTypes.find(t => t.id === typeId);
    return type?.name;
  };

  const handleExportHistory = (format: 'csv' | 'excel') => {
    const columns: { key: keyof Purchase; label: string; format?: (value: any, row: Purchase) => string }[] = [
      { key: 'order_number', label: 'Nº Pedido' },
      { key: 'description', label: 'Descrição', format: (v) => v || '' },
      { key: 'purchase_type_id', label: 'Tipo', format: (v) => getPurchaseTypeName(v) || '' },
      { key: 'supplier', label: 'Fornecedor', format: (_, row) => row.supplier?.name || '' },
      { key: 'total_value', label: 'Valor', format: (v) => formatCurrencyForExport(v) },
      { key: 'created_at', label: 'Data Criação', format: (v) => formatDateForExport(v) },
      { key: 'expected_delivery_date', label: 'Previsão Entrega', format: (v) => formatDateForExport(v) },
      { key: 'actual_delivery_date', label: 'Data Entrega', format: (v) => formatDateForExport(v) },
      { key: 'status', label: 'Status', format: (v) => PURCHASE_STATUS_LABELS[v as Purchase['status']] || v },
    ];
    
    const filename = `historico-compras-${format === 'csv' ? 'csv' : 'excel'}`;
    
    if (format === 'csv') {
      exportToCSV(filteredHistory, columns, filename);
    } else {
      exportToExcel(filteredHistory, columns, filename);
    }
    
    toast.success(`Exportação ${format.toUpperCase()} concluída`);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Compras"
        description="Controle de fornecedores, pedidos de compra e recebimentos"
        actions={
          <Button className="gap-2" onClick={() => { setEditingPurchase(null); setPurchaseDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            Nova Compra
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Pedidos Pendentes" value={pendingCount.toString()} icon={ShoppingBag} variant="warning" />
        <StatCard title="Em Trânsito" value={inTransitCount.toString()} icon={Truck} variant="info" />
        <StatCard title="Recebidos (Mês)" value={deliveredThisMonth.toString()} icon={Package} variant="success" />
      </div>

      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList>
          <TabsTrigger value="orders" className="gap-2"><ShoppingBag className="h-4 w-4" />Pedidos</TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2"><Users className="h-4 w-4" />Fornecedores</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardHeader><CardTitle className="text-lg font-semibold">Pedidos de Compra</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número, descrição, fornecedor..."
                    value={ordersSearch}
                    onChange={(e) => setOrdersSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={ordersStatusFilter} onValueChange={setOrdersStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="in_transit">Em Trânsito</SelectItem>
                    <SelectItem value="delivered">Entregue</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={ordersPurchaseTypeFilter} onValueChange={setOrdersPurchaseTypeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tipo de compra" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {purchaseTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DateRangeFilter
                  startDate={ordersStartDate}
                  endDate={ordersEndDate}
                  onChange={(start, end) => {
                    setOrdersStartDate(start);
                    setOrdersEndDate(end);
                  }}
                  label="Data"
                />
              </div>

              {filteredPurchases.length === 0 ? (
                <EmptyState icon={ShoppingBag} title="Nenhum pedido de compra" description="Registre pedidos de compra para controlar o reabastecimento." action={{ label: "Criar Pedido", onClick: () => { setEditingPurchase(null); setPurchaseDialogOpen(true); } }} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Pedido</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>NF Entrada</TableHead>
                      <TableHead>Previsão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPurchases.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.order_number}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{p.description || "-"}</TableCell>
                        <TableCell>{getPurchaseTypeName(p.purchase_type_id) ? <Badge variant="secondary">{getPurchaseTypeName(p.purchase_type_id)}</Badge> : "-"}</TableCell>
                        <TableCell>{p.supplier?.name || "-"}</TableCell>
                        <TableCell>R$ {Number(p.total_value).toFixed(2)}</TableCell>
                        <TableCell>
                          {p.entry_invoice ? (
                            <Badge variant="outline" className="gap-1">
                              <FileText className="h-3 w-3" />
                              {p.entry_invoice.numero}
                            </Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{p.expected_delivery_date ? format(new Date(p.expected_delivery_date), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell><Badge className={PURCHASE_STATUS_COLORS[p.status]}>{PURCHASE_STATUS_LABELS[p.status]}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingPurchase(p); setPurchaseDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick('purchase', p.id, p.order_number)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Fornecedores</CardTitle>
              <Button size="sm" onClick={() => { setEditingSupplier(null); setSupplierDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, CNPJ, contato, email..."
                    value={suppliersSearch}
                    onChange={(e) => setSuppliersSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={suppliersTypeFilter} onValueChange={setSuppliersTypeFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Tipo de fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {supplierTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {filteredSuppliers.length === 0 ? (
                <EmptyState icon={Users} title="Nenhum fornecedor encontrado" description="Cadastre seus fornecedores para organizar pedidos." action={{ label: "Adicionar Fornecedor", onClick: () => { setEditingSupplier(null); setSupplierDialogOpen(true); } }} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuppliers.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{getSupplierTypeName(s.supplier_type_id) ? <Badge variant="secondary">{getSupplierTypeName(s.supplier_type_id)}</Badge> : "-"}</TableCell>
                        <TableCell>{s.cnpj || "-"}</TableCell>
                        <TableCell>{s.contact_person || "-"}</TableCell>
                        <TableCell>{s.phone || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingSupplier(s); setSupplierDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick('supplier', s.id, s.name)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Histórico de Compras</CardTitle>
              <ExportDropdown
                onExportCSV={() => handleExportHistory('csv')}
                onExportExcel={() => handleExportHistory('excel')}
                disabled={filteredHistory.length === 0}
              />
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número, descrição, fornecedor..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <DateRangeFilter
                  startDate={historyStartDate}
                  endDate={historyEndDate}
                  onChange={(start, end) => {
                    setHistoryStartDate(start);
                    setHistoryEndDate(end);
                  }}
                  label="Período"
                />
              </div>

              {filteredHistory.length === 0 ? (
                <EmptyState icon={History} title="Nenhum registro encontrado" description="Ajuste os filtros para ver o histórico de compras." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Pedido</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Data Entrega</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.order_number}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{p.description || "-"}</TableCell>
                        <TableCell>{getPurchaseTypeName(p.purchase_type_id) ? <Badge variant="secondary">{getPurchaseTypeName(p.purchase_type_id)}</Badge> : "-"}</TableCell>
                        <TableCell>{p.supplier?.name || "-"}</TableCell>
                        <TableCell>R$ {Number(p.total_value).toFixed(2)}</TableCell>
                        <TableCell>{p.actual_delivery_date ? format(new Date(p.actual_delivery_date), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell><Badge className={PURCHASE_STATUS_COLORS[p.status]}>{PURCHASE_STATUS_LABELS[p.status]}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SupplierFormDialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen} supplier={editingSupplier} onSubmit={handleSupplierSubmit} isLoading={createSupplier.isPending || updateSupplier.isPending} />
      <PurchaseFormDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen} purchase={editingPurchase} suppliers={suppliers} onSubmit={handlePurchaseSubmit} isLoading={createPurchase.isPending || updatePurchase.isPending} />
      
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={deleteType === 'purchase' ? 'Excluir Pedido de Compra' : 'Excluir Fornecedor'}
        description={`Tem certeza que deseja excluir "${deleteName}"? Esta ação não pode ser desfeita.`}
        isLoading={deletePurchase.isPending || deleteSupplier.isPending}
      />
    </div>
  );
}

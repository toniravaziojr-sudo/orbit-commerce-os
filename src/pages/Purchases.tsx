import { useState } from "react";
import { ShoppingBag, Plus, Truck, Package, Users, Pencil, Trash2, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePurchases, PURCHASE_STATUS_LABELS, PURCHASE_STATUS_COLORS } from "@/hooks/usePurchases";
import { useSuppliers } from "@/hooks/useSuppliers";
import { SupplierFormDialog } from "@/components/purchases/SupplierFormDialog";
import { PurchaseFormDialog } from "@/components/purchases/PurchaseFormDialog";
import { DeleteConfirmDialog } from "@/components/purchases/DeleteConfirmDialog";
import { format } from "date-fns";

export default function Purchases() {
  const { purchases, pendingCount, inTransitCount, deliveredThisMonth, createPurchase, updatePurchase, deletePurchase, isLoading: loadingPurchases } = usePurchases();
  const { suppliers, createSupplier, updateSupplier, deleteSupplier, isLoading: loadingSuppliers } = useSuppliers();
  
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  
  // States para confirmação de exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'purchase' | 'supplier'>('purchase');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>('');

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
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardHeader><CardTitle className="text-lg font-semibold">Pedidos de Compra</CardTitle></CardHeader>
            <CardContent>
              {purchases.length === 0 ? (
                <EmptyState icon={ShoppingBag} title="Nenhum pedido de compra" description="Registre pedidos de compra para controlar o reabastecimento." action={{ label: "Criar Pedido", onClick: () => { setEditingPurchase(null); setPurchaseDialogOpen(true); } }} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Pedido</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>NF Entrada</TableHead>
                      <TableHead>Previsão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.order_number}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{p.description || "-"}</TableCell>
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
            <CardContent>
              {suppliers.length === 0 ? (
                <EmptyState icon={Users} title="Nenhum fornecedor cadastrado" description="Cadastre seus fornecedores para organizar pedidos." action={{ label: "Adicionar Fornecedor", onClick: () => { setEditingSupplier(null); setSupplierDialogOpen(true); } }} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
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

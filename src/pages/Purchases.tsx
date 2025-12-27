import { useState } from "react";
import { ShoppingBag, Plus, Truck, Package, Users, Pencil, Trash2 } from "lucide-react";
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
import { format } from "date-fns";

export default function Purchases() {
  const { purchases, pendingCount, inTransitCount, deliveredThisMonth, createPurchase, updatePurchase, deletePurchase, isLoading: loadingPurchases } = usePurchases();
  const { suppliers, createSupplier, updateSupplier, deleteSupplier, isLoading: loadingSuppliers } = useSuppliers();
  
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);

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
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Previsão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.order_number}</TableCell>
                        <TableCell>{p.supplier?.name || "-"}</TableCell>
                        <TableCell>R$ {Number(p.total_value).toFixed(2)}</TableCell>
                        <TableCell>{p.expected_delivery_date ? format(new Date(p.expected_delivery_date), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell><Badge className={PURCHASE_STATUS_COLORS[p.status]}>{PURCHASE_STATUS_LABELS[p.status]}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingPurchase(p); setPurchaseDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deletePurchase.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
                            <Button variant="ghost" size="icon" onClick={() => deleteSupplier.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
    </div>
  );
}

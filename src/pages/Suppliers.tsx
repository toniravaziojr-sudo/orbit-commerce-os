import { useMemo, useState } from "react";
import { Truck, Plus, Search, Pencil, Power, MoreHorizontal, MapPin, Mail, Phone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSuppliers, type Supplier } from "@/hooks/useSuppliers";
import { usePurchaseSupplierTypes } from "@/hooks/usePurchaseSupplierTypes";
import { SupplierFormDialog, type SupplierFormData } from "@/components/suppliers/SupplierFormDialog";
import { formatCnpj } from "@/lib/formatCnpj";
import { formatCpf } from "@/lib/formatCpf";

function formatDoc(s: Supplier) {
  if (s.person_type === "PJ" && s.cnpj) return formatCnpj(s.cnpj);
  if (s.person_type === "PF" && s.cpf) return formatCpf(s.cpf);
  return "—";
}

export default function Suppliers() {
  const { suppliers, isLoading, createSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const { supplierTypes } = usePurchaseSupplierTypes();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [confirmInactivate, setConfirmInactivate] = useState<Supplier | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (statusFilter === "active" && !s.is_active) return false;
      if (statusFilter === "inactive" && s.is_active) return false;
      if (typeFilter !== "all" && s.supplier_type_id !== typeFilter) return false;
      if (!q) return true;
      const hay = `${s.name} ${s.legal_name ?? ""} ${s.trade_name ?? ""} ${s.cnpj ?? ""} ${s.cpf ?? ""} ${s.email ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [suppliers, search, statusFilter, typeFilter]);

  const stats = useMemo(() => ({
    total: suppliers.length,
    active: suppliers.filter((s) => s.is_active).length,
    pj: suppliers.filter((s) => s.person_type === "PJ").length,
    pf: suppliers.filter((s) => s.person_type === "PF").length,
  }), [suppliers]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setDialogOpen(true); };

  const handleSubmit = async (data: SupplierFormData) => {
    if (editing) {
      await updateSupplier.mutateAsync({ id: editing.id, ...(data as any) });
    } else {
      await createSupplier.mutateAsync(data as any);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const handleConfirmInactivate = async () => {
    if (!confirmInactivate) return;
    await deleteSupplier.mutateAsync(confirmInactivate.id);
    setConfirmInactivate(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fornecedores"
        description="Cadastro único de fornecedores usado por Compras, Fiscal e demais módulos do ERP."
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Novo fornecedor
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{stats.total}</div><div className="text-sm text-muted-foreground">Total cadastrados</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{stats.active}</div><div className="text-sm text-muted-foreground">Ativos</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{stats.pj}</div><div className="text-sm text-muted-foreground">Pessoa jurídica</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{stats.pf}</div><div className="text-sm text-muted-foreground">Pessoa física</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, documento ou e-mail..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Apenas ativos</SelectItem>
                <SelectItem value="inactive">Apenas inativos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="md:w-56"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {supplierTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Truck}
              title={suppliers.length === 0 ? "Nenhum fornecedor cadastrado" : "Nenhum fornecedor encontrado"}
              description={suppliers.length === 0
                ? "Cadastre seu primeiro fornecedor. Ele ficará disponível em Compras e nas notas fiscais de entrada, remessa e devolução."
                : "Ajuste os filtros ou a busca para encontrar fornecedores."}
              action={suppliers.length === 0 ? { label: "Cadastrar fornecedor", onClick: openNew } : undefined}
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const typeName = supplierTypes.find((t) => t.id === s.supplier_type_id)?.name;
                    return (
                      <TableRow key={s.id} className="cursor-pointer" onClick={() => openEdit(s)}>
                        <TableCell>
                          <div className="font-medium">{s.name}</div>
                          {s.legal_name && <div className="text-xs text-muted-foreground">{s.legal_name}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="mr-2">{s.person_type}</Badge>
                          <span className="text-sm">{formatDoc(s)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            {s.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-muted-foreground" />{s.email}</div>}
                            {s.phone && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" />{s.phone}</div>}
                            {!s.email && !s.phone && <span className="text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {s.cidade || s.uf ? (
                            <div className="flex items-center gap-1.5 text-sm"><MapPin className="h-3 w-3 text-muted-foreground" />{[s.cidade, s.uf].filter(Boolean).join(" / ")}</div>
                          ) : <span className="text-muted-foreground text-sm">—</span>}
                        </TableCell>
                        <TableCell>{typeName ?? <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                        <TableCell>
                          {s.is_active
                            ? <Badge variant="default">Ativo</Badge>
                            : <Badge variant="secondary">Inativo</Badge>}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(s)}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              {s.is_active && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => setConfirmInactivate(s)}>
                                    <Power className="h-4 w-4 mr-2" /> Inativar
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editing}
        onSubmit={handleSubmit}
        isLoading={createSupplier.isPending || updateSupplier.isPending}
      />

      <AlertDialog open={!!confirmInactivate} onOpenChange={(o) => !o && setConfirmInactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmInactivate?.name} ficará indisponível para novas notas e compras, mas o histórico permanece preservado.
              Você pode reativá-lo a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmInactivate}>Inativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

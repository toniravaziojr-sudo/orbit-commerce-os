import { useState } from "react";
import { Plus, Search, MoreHorizontal, Copy, Trash2, Pencil, Tag, Percent, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useDiscounts, getDiscountStatus, formatDiscountValue, Discount, discountTypeLabels } from "@/hooks/useDiscounts";
import { DiscountFormDialog } from "@/components/discounts/DiscountFormDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig = {
  active: { label: "Ativo", variant: "default" as const, className: "bg-green-500 hover:bg-green-600" },
  scheduled: { label: "Agendado", variant: "outline" as const, className: "" },
  expired: { label: "Expirado", variant: "secondary" as const, className: "" },
  inactive: { label: "Inativo", variant: "secondary" as const, className: "" },
};

const typeIcons = {
  order_percent: Percent,
  order_fixed: Tag,
  free_shipping: Truck,
};

type StatusFilter = "all" | "active" | "scheduled" | "expired";

export default function Discounts() {
  const { discounts, isLoading, deleteDiscount, toggleDiscount, duplicateDiscount } = useDiscounts();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [deletingDiscount, setDeletingDiscount] = useState<Discount | null>(null);

  const filteredDiscounts = discounts.filter((discount) => {
    const status = getDiscountStatus(discount);
    const matchesSearch =
      discount.name.toLowerCase().includes(search.toLowerCase()) ||
      (discount.code && discount.code.toLowerCase().includes(search.toLowerCase()));

    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && status === statusFilter;
  });

  const handleEdit = (discount: Discount) => {
    setEditingDiscount(discount);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingDiscount(null);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (deletingDiscount) {
      await deleteDiscount.mutateAsync(deletingDiscount.id);
      setDeletingDiscount(null);
    }
  };

  const handleDuplicate = (discount: Discount) => {
    duplicateDiscount.mutate(discount);
  };

  const handleToggle = (discount: Discount) => {
    toggleDiscount.mutate({ id: discount.id, is_active: !discount.is_active });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Descontos"
        description="Gerencie cupons e descontos da sua loja"
      >
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Criar desconto
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="active">Ativos</TabsTrigger>
            <TabsTrigger value="scheduled">Agendados</TabsTrigger>
            <TabsTrigger value="expired">Expirados</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead className="text-right">Usos</TableHead>
              <TableHead className="w-[100px]">Ativo</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : filteredDiscounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {search || statusFilter !== "all" ? "Nenhum cupom encontrado" : "Nenhum cupom criado ainda"}
                </TableCell>
              </TableRow>
            ) : (
              filteredDiscounts.map((discount) => {
                const status = getDiscountStatus(discount);
                const config = statusConfig[status];
                const TypeIcon = typeIcons[discount.type];

                return (
                  <TableRow key={discount.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleEdit(discount)}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{discount.name}</p>
                        {discount.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {discount.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant} className={config.className}>
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {discount.code || "-"}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{discountTypeLabels[discount.type]}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatDiscountValue(discount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="tabular-nums">
                        {discount.usage_count || 0}
                        {discount.usage_limit_total && ` / ${discount.usage_limit_total}`}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={discount.is_active}
                        onCheckedChange={() => handleToggle(discount)}
                      />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(discount)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(discount)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeletingDiscount(discount)}
                            disabled={(discount.usage_count || 0) > 0}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Form Dialog */}
      <DiscountFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        discount={editingDiscount}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingDiscount} onOpenChange={() => setDeletingDiscount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cupom "{deletingDiscount?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

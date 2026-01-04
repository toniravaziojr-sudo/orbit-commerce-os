import { useState, useMemo } from "react";
import { DollarSign, TrendingUp, TrendingDown, PiggyBank, ArrowUpRight, ArrowDownRight, Plus, Pencil, Trash2, History, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinanceEntries, FinanceEntry } from "@/hooks/useFinanceEntries";
import { useFinanceEntryTypes } from "@/hooks/useFinanceEntryTypes";
import { FinanceEntryFormDialog } from "@/components/finance/FinanceEntryFormDialog";
import { DeleteConfirmDialog } from "@/components/purchases/DeleteConfirmDialog";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { ExportDropdown } from "@/components/ui/export-dropdown";
import { exportToCSV, exportToExcel, formatDateForExport, formatCurrencyForExport } from "@/lib/exportUtils";
import { format, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";

export default function Finance() {
  const { entries, orders, totalIncome, totalExpense, netProfit, margin, ordersIncome, createEntry, updateEntry, deleteEntry, isLoading } = useFinanceEntries();
  const { financeEntryTypes } = useFinanceEntryTypes();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [defaultType, setDefaultType] = useState<'income' | 'expense'>('expense');
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>('');

  // Filters for dashboard
  const [dashboardStartDate, setDashboardStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [dashboardEndDate, setDashboardEndDate] = useState<Date | undefined>(endOfMonth(new Date()));

  // Filters for history tab
  const [historySearch, setHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>("all");
  const [historyEntryTypeFilter, setHistoryEntryTypeFilter] = useState<string>("all");
  const [historyStartDate, setHistoryStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [historyEndDate, setHistoryEndDate] = useState<Date | undefined>(endOfMonth(new Date()));

  const incomeEntries = entries.filter(e => e.type === 'income');
  const expenseEntries = entries.filter(e => e.type === 'expense');

  // Filtered history entries
  const filteredHistoryEntries = useMemo(() => {
    return entries.filter(entry => {
      // Search filter
      if (historySearch) {
        const searchLower = historySearch.toLowerCase();
        if (
          !entry.description?.toLowerCase().includes(searchLower) &&
          !entry.category?.toLowerCase().includes(searchLower) &&
          !entry.notes?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      
      // Type filter (income/expense)
      if (historyTypeFilter !== 'all' && entry.type !== historyTypeFilter) {
        return false;
      }
      
      // Entry type filter (custom types)
      if (historyEntryTypeFilter !== 'all' && entry.finance_entry_type_id !== historyEntryTypeFilter) {
        return false;
      }
      
      // Date filter
      if (historyStartDate && historyEndDate) {
        const entryDate = new Date(entry.entry_date);
        if (!isWithinInterval(entryDate, { start: historyStartDate, end: historyEndDate })) {
          return false;
        }
      }
      
      return true;
    });
  }, [entries, historySearch, historyTypeFilter, historyEntryTypeFilter, historyStartDate, historyEndDate]);

  const handleSubmit = (data: any) => {
    if (editingEntry) {
      updateEntry.mutate({ id: editingEntry.id, ...data });
    } else {
      createEntry.mutate(data);
    }
    setDialogOpen(false);
    setEditingEntry(null);
  };

  const handleDeleteClick = (id: string, description: string) => {
    setDeleteId(id);
    setDeleteName(description);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      deleteEntry.mutate(deleteId);
    }
    setDeleteDialogOpen(false);
    setDeleteId(null);
  };

  const formatCurrency = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const getEntryTypeName = (typeId: string | null) => {
    if (!typeId) return null;
    const type = financeEntryTypes.find(t => t.id === typeId);
    return type?.name;
  };

  // Calculate filtered dashboard stats
  const filteredDashboardStats = useMemo(() => {
    const filteredEntries = entries.filter(entry => {
      if (dashboardStartDate && dashboardEndDate) {
        const entryDate = new Date(entry.entry_date);
        if (!isWithinInterval(entryDate, { start: dashboardStartDate, end: dashboardEndDate })) {
          return false;
        }
      }
      return true;
    });

    const filteredOrders = orders.filter(order => {
      if (dashboardStartDate && dashboardEndDate) {
        const orderDate = new Date(order.created_at);
        if (!isWithinInterval(orderDate, { start: dashboardStartDate, end: dashboardEndDate })) {
          return false;
        }
      }
      return true;
    });

    const manualIncome = filteredEntries
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const manualExpense = filteredEntries
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const ordersIncomeFiltered = filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const totalIncomeFiltered = manualIncome + ordersIncomeFiltered;
    const totalExpenseFiltered = manualExpense;
    const netProfitFiltered = totalIncomeFiltered - totalExpenseFiltered;
    const marginFiltered = totalIncomeFiltered > 0 ? ((netProfitFiltered / totalIncomeFiltered) * 100).toFixed(1) : '0';

    return {
      totalIncome: totalIncomeFiltered,
      totalExpense: totalExpenseFiltered,
      netProfit: netProfitFiltered,
      margin: marginFiltered,
      ordersIncome: ordersIncomeFiltered,
      ordersCount: filteredOrders.length,
    };
  }, [entries, orders, dashboardStartDate, dashboardEndDate]);

  const handleExportHistory = (exportFormat: 'csv' | 'excel') => {
    const columns: { key: keyof FinanceEntry; label: string; format?: (value: any, row: FinanceEntry) => string }[] = [
      { key: 'entry_date', label: 'Data', format: (v) => formatDateForExport(v) },
      { key: 'description', label: 'Descrição' },
      { key: 'type', label: 'Tipo', format: (v) => v === 'income' ? 'Entrada' : 'Saída' },
      { key: 'finance_entry_type_id', label: 'Classificação', format: (v) => getEntryTypeName(v) || '' },
      { key: 'category', label: 'Categoria', format: (v) => v || 'Outros' },
      { key: 'amount', label: 'Valor', format: (v) => formatCurrencyForExport(v) },
      { key: 'notes', label: 'Observações', format: (v) => v || '' },
    ];
    
    const filename = `historico-financeiro-${exportFormat === 'csv' ? 'csv' : 'excel'}`;
    
    if (exportFormat === 'csv') {
      exportToCSV(filteredHistoryEntries, columns, filename);
    } else {
      exportToExcel(filteredHistoryEntries, columns, filename);
    }
    
    toast.success(`Exportação ${exportFormat.toUpperCase()} concluída`);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader title="Financeiro" description="Controle de entradas, saídas, margens e conciliação" />

      {/* Dashboard filter */}
      <div className="flex items-center gap-4">
        <DateRangeFilter
          startDate={dashboardStartDate}
          endDate={dashboardEndDate}
          onChange={(start, end) => {
            setDashboardStartDate(start);
            setDashboardEndDate(end);
          }}
          label="Período"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Receita" value={formatCurrency(filteredDashboardStats.totalIncome)} icon={TrendingUp} variant="success" />
        <StatCard title="Despesas" value={formatCurrency(filteredDashboardStats.totalExpense)} icon={TrendingDown} variant="destructive" />
        <StatCard title="Lucro Líquido" value={formatCurrency(filteredDashboardStats.netProfit)} icon={DollarSign} variant="primary" />
        <StatCard title="Margem Média" value={`${filteredDashboardStats.margin}%`} icon={PiggyBank} variant="info" />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2"><DollarSign className="h-4 w-4" />Visão Geral</TabsTrigger>
          <TabsTrigger value="income" className="gap-2"><ArrowUpRight className="h-4 w-4" />Entradas</TabsTrigger>
          <TabsTrigger value="expenses" className="gap-2"><ArrowDownRight className="h-4 w-4" />Saídas</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" />Histórico Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-lg">Receita de Vendas (Automático)</CardTitle></CardHeader>
              <CardContent>
                {filteredDashboardStats.ordersCount === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma venda paga no período.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(filteredDashboardStats.ordersIncome)}</p>
                    <p className="text-sm text-muted-foreground">{filteredDashboardStats.ordersCount} pedido(s) pago(s) no período</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Resumo do Período</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Entradas</span><span className="text-green-600 font-medium">{formatCurrency(filteredDashboardStats.totalIncome)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Saídas</span><span className="text-red-600 font-medium">{formatCurrency(filteredDashboardStats.totalExpense)}</span></div>
                  <hr />
                  <div className="flex justify-between"><span className="font-medium">Saldo</span><span className={`font-bold ${filteredDashboardStats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(filteredDashboardStats.netProfit)}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="income">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Entradas</CardTitle>
              <Button size="sm" onClick={() => { setEditingEntry(null); setDefaultType('income'); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nova Entrada</Button>
            </CardHeader>
            <CardContent>
              {incomeEntries.length === 0 ? (
                <EmptyState icon={ArrowUpRight} title="Nenhuma entrada manual" description="Receitas de vendas são importadas automaticamente. Adicione entradas manuais aqui." action={{ label: "Adicionar Entrada", onClick: () => { setEditingEntry(null); setDefaultType('income'); setDialogOpen(true); } }} />
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Categoria</TableHead><TableHead>Valor</TableHead><TableHead className="w-24">Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {incomeEntries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{format(new Date(e.entry_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{e.description}</TableCell>
                        <TableCell>{getEntryTypeName(e.finance_entry_type_id) ? <Badge variant="secondary">{getEntryTypeName(e.finance_entry_type_id)}</Badge> : "-"}</TableCell>
                        <TableCell><Badge variant="outline">{e.category || "Outros"}</Badge></TableCell>
                        <TableCell className="text-green-600 font-medium">{formatCurrency(Number(e.amount))}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingEntry(e); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(e.id, e.description)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

        <TabsContent value="expenses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Saídas</CardTitle>
              <Button size="sm" onClick={() => { setEditingEntry(null); setDefaultType('expense'); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nova Saída</Button>
            </CardHeader>
            <CardContent>
              {expenseEntries.length === 0 ? (
                <EmptyState icon={ArrowDownRight} title="Nenhuma saída registrada" description="Registre despesas para análise de margem." action={{ label: "Adicionar Saída", onClick: () => { setEditingEntry(null); setDefaultType('expense'); setDialogOpen(true); } }} />
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Categoria</TableHead><TableHead>Valor</TableHead><TableHead className="w-24">Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {expenseEntries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{format(new Date(e.entry_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{e.description}</TableCell>
                        <TableCell>{getEntryTypeName(e.finance_entry_type_id) ? <Badge variant="secondary">{getEntryTypeName(e.finance_entry_type_id)}</Badge> : "-"}</TableCell>
                        <TableCell><Badge variant="outline">{e.category || "Outros"}</Badge></TableCell>
                        <TableCell className="text-red-600 font-medium">{formatCurrency(Number(e.amount))}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingEntry(e); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(e.id, e.description)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
              <CardTitle className="text-lg font-semibold">Histórico Financeiro</CardTitle>
              <ExportDropdown
                onExportCSV={() => handleExportHistory('csv')}
                onExportExcel={() => handleExportHistory('excel')}
                disabled={filteredHistoryEntries.length === 0}
              />
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por descrição, categoria..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={historyTypeFilter} onValueChange={setHistoryTypeFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="income">Entradas</SelectItem>
                    <SelectItem value="expense">Saídas</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={historyEntryTypeFilter} onValueChange={setHistoryEntryTypeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tipo de lançamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {financeEntryTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              {/* Table */}
              {filteredHistoryEntries.length === 0 ? (
                <EmptyState icon={History} title="Nenhum lançamento encontrado" description="Ajuste os filtros para ver os lançamentos." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistoryEntries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{format(new Date(e.entry_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{e.description}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={e.type === 'income' ? 'default' : 'destructive'}>
                              {e.type === 'income' ? 'Entrada' : 'Saída'}
                            </Badge>
                            {getEntryTypeName(e.finance_entry_type_id) && (
                              <Badge variant="secondary" className="text-xs">{getEntryTypeName(e.finance_entry_type_id)}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{e.category || "Outros"}</Badge></TableCell>
                        <TableCell className={e.type === 'income' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {e.type === 'income' ? '+' : '-'}{formatCurrency(Number(e.amount))}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingEntry(e); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(e.id, e.description)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

      <FinanceEntryFormDialog open={dialogOpen} onOpenChange={setDialogOpen} entry={editingEntry} defaultType={defaultType} onSubmit={handleSubmit} isLoading={createEntry.isPending || updateEntry.isPending} />
      
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Excluir Lançamento"
        description={`Tem certeza que deseja excluir "${deleteName}"? Esta ação não pode ser desfeita.`}
        isLoading={deleteEntry.isPending}
      />
    </div>
  );
}

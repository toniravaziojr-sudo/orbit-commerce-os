import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  CreditCard, 
  MapPin, 
  Users, 
  Tag,
  CalendarIcon,
  RefreshCw,
  ShoppingCart,
  DollarSign,
  Percent,
  Store
} from "lucide-react";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useSalesReport,
  useSalesByCoupon,
  useSalesByChannel,
  useSalesByProduct,
  useSalesByPaymentMethod,
  useSalesByStatus,
  useSalesByRegion,
  useCustomerReport,
  useReportSummary,
  ReportFilters,
} from "@/hooks/useReports";
import { exportToCSV, formatCurrencyForExport } from "@/lib/exportUtils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const PRESET_PERIODS = [
  { label: 'Hoje', value: 'today' },
  { label: 'Últimos 7 dias', value: '7days' },
  { label: 'Últimos 30 dias', value: '30days' },
  { label: 'Este mês', value: 'thisMonth' },
  { label: 'Mês passado', value: 'lastMonth' },
  { label: 'Este ano', value: 'thisYear' },
  { label: 'Personalizado', value: 'custom' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("overview");
  const [periodPreset, setPeriodPreset] = useState("30days");
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  // Calculate date range based on preset
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (periodPreset) {
      case 'today':
        return { start: new Date(now.setHours(0, 0, 0, 0)), end: new Date() };
      case '7days':
        return { start: subDays(now, 7), end: new Date() };
      case '30days':
        return { start: subDays(now, 30), end: new Date() };
      case 'thisMonth':
        return { start: startOfMonth(now), end: new Date() };
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'thisYear':
        return { start: startOfYear(now), end: new Date() };
      case 'custom':
        return { 
          start: customStartDate || subDays(now, 30), 
          end: customEndDate || new Date() 
        };
      default:
        return { start: subDays(now, 30), end: new Date() };
    }
  }, [periodPreset, customStartDate, customEndDate]);

  const filters: ReportFilters = {
    startDate: dateRange.start,
    endDate: dateRange.end,
    groupBy,
  };

  // Fetch all report data
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useReportSummary(filters);
  const { data: salesData, isLoading: salesLoading } = useSalesReport(filters);
  const { data: couponData, isLoading: couponLoading } = useSalesByCoupon(filters);
  const { data: channelData, isLoading: channelLoading } = useSalesByChannel(filters);
  const { data: productData, isLoading: productLoading } = useSalesByProduct(filters);
  const { data: paymentData, isLoading: paymentLoading } = useSalesByPaymentMethod(filters);
  const { data: statusData, isLoading: statusLoading } = useSalesByStatus(filters);
  const { data: regionData, isLoading: regionLoading } = useSalesByRegion(filters);
  const { data: customerData, isLoading: customerLoading } = useCustomerReport(filters);

  const handleRefresh = () => {
    refetchSummary();
  };

  const handleExportSales = () => {
    if (!salesData) return;
    exportToCSV(salesData, [
      { key: 'date', label: 'Data' },
      { key: 'orders_count', label: 'Pedidos' },
      { key: 'total_revenue', label: 'Receita', format: (v) => formatCurrencyForExport(v) },
      { key: 'avg_order_value', label: 'Ticket Médio', format: (v) => formatCurrencyForExport(v) },
      { key: 'items_sold', label: 'Itens Vendidos' },
    ], `relatorio-vendas-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleExportProducts = () => {
    if (!productData) return;
    exportToCSV(productData, [
      { key: 'product_name', label: 'Produto' },
      { key: 'quantity_sold', label: 'Quantidade' },
      { key: 'total_revenue', label: 'Receita', format: (v) => formatCurrencyForExport(v) },
    ], `relatorio-produtos-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleExportRegion = () => {
    if (!regionData) return;
    exportToCSV(regionData, [
      { key: 'state', label: 'Estado' },
      { key: 'city', label: 'Cidade' },
      { key: 'orders_count', label: 'Pedidos' },
      { key: 'total_revenue', label: 'Receita', format: (v) => formatCurrencyForExport(v) },
    ], `relatorio-regioes-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Análises detalhadas de vendas, produtos, canais e clientes</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <Select value={periodPreset} onValueChange={setPeriodPreset}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {PRESET_PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {periodPreset === 'custom' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {customStartDate ? format(customStartDate, "dd/MM/yyyy") : "Início"} - {customEndDate ? format(customEndDate, "dd/MM/yyyy") : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: customStartDate, to: customEndDate }}
                    onSelect={(range) => {
                      setCustomStartDate(range?.from);
                      setCustomEndDate(range?.to);
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            )}

            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as 'day' | 'week' | 'month')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Agrupar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Por Dia</SelectItem>
                <SelectItem value="week">Por Semana</SelectItem>
                <SelectItem value="month">Por Mês</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>

            <div className="ml-auto text-sm text-muted-foreground">
              {format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} - {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Receita Total"
          value={formatCurrency(summary?.total_revenue || 0)}
          icon={DollarSign}
          variant="primary"
          trend={summary?.revenue_change ? { value: summary.revenue_change, label: "vs período anterior" } : undefined}
        />
        <StatCard
          title="Pedidos"
          value={summary?.paid_orders || 0}
          icon={ShoppingCart}
          description={`${summary?.cancelled_orders || 0} cancelados`}
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(summary?.avg_order_value || 0)}
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          title="Clientes Ativos"
          value={customerData?.total_customers || 0}
          icon={Users}
          description={`${customerData?.new_customers || 0} novos`}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview" className="text-xs">
            <BarChart3 className="h-4 w-4 mr-1" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="products" className="text-xs">
            <Package className="h-4 w-4 mr-1" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="channels" className="text-xs">
            <Store className="h-4 w-4 mr-1" />
            Canais
          </TabsTrigger>
          <TabsTrigger value="coupons" className="text-xs">
            <Tag className="h-4 w-4 mr-1" />
            Cupons
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs">
            <CreditCard className="h-4 w-4 mr-1" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="regions" className="text-xs">
            <MapPin className="h-4 w-4 mr-1" />
            Regiões
          </TabsTrigger>
          <TabsTrigger value="customers" className="text-xs">
            <Users className="h-4 w-4 mr-1" />
            Clientes
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Vendas ao Longo do Tempo</CardTitle>
                <CardDescription>Evolução de receita e pedidos no período</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportSales}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Carregando...
                </div>
              ) : salesData && salesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis 
                      yAxisId="left" 
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right"
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === 'total_revenue') return [formatCurrency(value), 'Receita'];
                        if (name === 'orders_count') return [value, 'Pedidos'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="total_revenue" 
                      name="Receita"
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.3} 
                    />
                    <Area 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="orders_count" 
                      name="Pedidos"
                      stroke="#82ca9d" 
                      fill="#82ca9d" 
                      fillOpacity={0.3} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado para o período selecionado
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribuição por Status</CardTitle>
              </CardHeader>
              <CardContent>
                {statusLoading ? (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    Carregando...
                  </div>
                ) : statusData && statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="orders_count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry) => `${entry.status}: ${entry.orders_count}`}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    Sem dados
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Métodos de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                {paymentLoading ? (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    Carregando...
                  </div>
                ) : paymentData && paymentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={paymentData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="payment_method" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="total_revenue" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    Sem dados
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Produtos Mais Vendidos</CardTitle>
                <CardDescription>Top 20 produtos por receita</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportProducts}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              {productLoading ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Carregando...
                </div>
              ) : productData && productData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productData.map((product, index) => (
                      <TableRow key={product.product_id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground text-sm font-medium w-6">
                              #{index + 1}
                            </span>
                            {product.product_image && (
                              <img 
                                src={product.product_image} 
                                alt={product.product_name}
                                className="w-10 h-10 object-cover rounded"
                              />
                            )}
                            <span className="font-medium">{product.product_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{product.quantity_sold}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(product.total_revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Nenhum produto vendido no período
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Channels Tab */}
        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendas por Canal</CardTitle>
              <CardDescription>Distribuição de vendas por origem</CardDescription>
            </CardHeader>
            <CardContent>
              {channelLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Carregando...
                </div>
              ) : channelData && channelData.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={channelData}
                        dataKey="total_revenue"
                        nameKey="channel"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.channel}`}
                      >
                        {channelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Canal</TableHead>
                        <TableHead className="text-right">Pedidos</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {channelData.map((channel) => (
                        <TableRow key={channel.channel}>
                          <TableCell className="font-medium">{channel.channel}</TableCell>
                          <TableCell className="text-right">{channel.orders_count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(channel.total_revenue)}</TableCell>
                          <TableCell className="text-right">{channel.percentage.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Sem dados de canais
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coupons Tab */}
        <TabsContent value="coupons" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendas por Cupom</CardTitle>
              <CardDescription>Desempenho dos cupons de desconto</CardDescription>
            </CardHeader>
            <CardContent>
              {couponLoading ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Carregando...
                </div>
              ) : couponData && couponData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cupom</TableHead>
                      <TableHead className="text-right">Pedidos</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Desconto Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {couponData.map((coupon) => (
                      <TableRow key={coupon.coupon_code}>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            {coupon.coupon_code}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{coupon.orders_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(coupon.total_revenue)}</TableCell>
                        <TableCell className="text-right text-destructive">
                          -{formatCurrency(coupon.total_discount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Nenhum pedido com cupom no período
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Pagamentos</CardTitle>
              <CardDescription>Distribuição por método de pagamento</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentLoading ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Carregando...
                </div>
              ) : paymentData && paymentData.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={paymentData}
                        dataKey="total_revenue"
                        nameKey="payment_method"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                      >
                        {paymentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Método</TableHead>
                        <TableHead className="text-right">Pedidos</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentData.map((payment) => (
                        <TableRow key={payment.payment_method}>
                          <TableCell className="font-medium">{payment.payment_method}</TableCell>
                          <TableCell className="text-right">{payment.orders_count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(payment.total_revenue)}</TableCell>
                          <TableCell className="text-right">{payment.percentage.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Sem dados de pagamentos
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Regions Tab */}
        <TabsContent value="regions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Vendas por Região</CardTitle>
                <CardDescription>Distribuição geográfica das vendas</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportRegion}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              {regionLoading ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Carregando...
                </div>
              ) : regionData && regionData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead className="text-right">Pedidos</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regionData.slice(0, 20).map((region, index) => (
                      <TableRow key={`${region.state}-${region.city}-${index}`}>
                        <TableCell className="font-medium">{region.state}</TableCell>
                        <TableCell>{region.city}</TableCell>
                        <TableCell className="text-right">{region.orders_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(region.total_revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Sem dados de regiões
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="Novos Clientes"
              value={customerData?.new_customers || 0}
              icon={Users}
              variant="success"
            />
            <StatCard
              title="Clientes Recorrentes"
              value={customerData?.returning_customers || 0}
              icon={Users}
              variant="info"
            />
            <StatCard
              title="Total de Clientes"
              value={customerData?.total_customers || 0}
              icon={Users}
            />
            <StatCard
              title="Média de Pedidos/Cliente"
              value={customerData?.avg_orders_per_customer.toFixed(1) || '0'}
              icon={ShoppingCart}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Análise de Clientes</CardTitle>
              <CardDescription>Métricas de aquisição e retenção</CardDescription>
            </CardHeader>
            <CardContent>
              {customerLoading ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Carregando...
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-4">Distribuição de Clientes</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Novos', value: customerData?.new_customers || 0 },
                            { name: 'Recorrentes', value: customerData?.returning_customers || 0 },
                          ]}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          <Cell fill="#82ca9d" />
                          <Cell fill="#8884d8" />
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Taxa de Recompra</p>
                      <p className="text-2xl font-bold">
                        {customerData && customerData.total_customers > 0
                          ? ((customerData.returning_customers / customerData.total_customers) * 100).toFixed(1)
                          : '0'}%
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Ticket Médio por Cliente</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(
                          customerData && customerData.total_customers > 0
                            ? (summary?.total_revenue || 0) / customerData.total_customers
                            : 0
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

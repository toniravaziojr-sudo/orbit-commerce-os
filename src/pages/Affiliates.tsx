import { useState } from "react";
import { Plus, Users, Link2, MousePointerClick, DollarSign, Settings, Copy, CheckCircle, XCircle, Clock, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  useAffiliateProgram, 
  useAffiliates, 
  useAffiliateLinks,
  useAffiliateConversions,
  useAffiliateStats,
  useAffiliatePayouts,
  generateAffiliateCode,
  Affiliate 
} from "@/hooks/useAffiliates";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export default function Affiliates() {
  const { program, isLoading: programLoading, upsertProgram } = useAffiliateProgram();
  const { affiliates, isLoading: affiliatesLoading, createAffiliate, updateAffiliate, deleteAffiliate } = useAffiliates();
  const { links, createLink } = useAffiliateLinks();
  const { conversions, updateConversionStatus } = useAffiliateConversions();
  const { data: stats } = useAffiliateStats();
  const { payouts, createPayout, updatePayout } = useAffiliatePayouts();

  const [isAffiliateOpen, setIsAffiliateOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isPayoutOpen, setIsPayoutOpen] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string | null>(null);
  
  const [affiliateForm, setAffiliateForm] = useState({ name: '', email: '', phone: '', payout_notes: '' });
  const [linkForm, setLinkForm] = useState({ affiliate_id: '', code: '', target_url: '' });
  const [payoutForm, setPayoutForm] = useState({ affiliate_id: '', amount: '' });

  // Program settings
  const [programForm, setProgramForm] = useState({
    is_enabled: program?.is_enabled ?? false,
    attribution_window_days: program?.attribution_window_days ?? 30,
    commission_type: program?.commission_type ?? 'percent',
    commission_value_cents: program?.commission_value_cents ?? 1000,
  });

  const handleSaveProgram = async () => {
    await upsertProgram.mutateAsync(programForm);
  };

  const handleCreateAffiliate = async () => {
    if (!affiliateForm.name || !affiliateForm.email) return;
    await createAffiliate.mutateAsync({
      name: affiliateForm.name,
      email: affiliateForm.email,
      phone: affiliateForm.phone || null,
      status: 'active',
      payout_notes: affiliateForm.payout_notes || null,
    });
    setIsAffiliateOpen(false);
    setAffiliateForm({ name: '', email: '', phone: '', payout_notes: '' });
  };

  const handleCreateLink = async () => {
    if (!linkForm.affiliate_id) return;
    const code = linkForm.code || generateAffiliateCode(
      affiliates.find(a => a.id === linkForm.affiliate_id)?.name || 'aff'
    );
    await createLink.mutateAsync({
      affiliate_id: linkForm.affiliate_id,
      code,
      target_url: linkForm.target_url || undefined,
    });
    setIsLinkOpen(false);
    setLinkForm({ affiliate_id: '', code: '', target_url: '' });
  };

  const handleCreatePayout = async () => {
    if (!payoutForm.affiliate_id || !payoutForm.amount) return;
    await createPayout.mutateAsync({
      affiliate_id: payoutForm.affiliate_id,
      amount_cents: Math.round(parseFloat(payoutForm.amount) * 100),
    });
    setIsPayoutOpen(false);
    setPayoutForm({ affiliate_id: '', amount: '' });
  };

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/?aff=${code}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const getAffiliateStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-500 text-white">Ativo</Badge>;
      case 'paused': return <Badge className="bg-yellow-500 text-white">Pausado</Badge>;
      case 'blocked': return <Badge className="bg-red-500 text-white">Bloqueado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getConversionStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'approved': return <Badge className="bg-green-500 text-white"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejected': return <Badge className="bg-red-500 text-white"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      case 'paid': return <Badge className="bg-blue-500 text-white"><DollarSign className="h-3 w-3 mr-1" />Pago</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  if (programLoading || affiliatesLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Programa de Afiliados</h1>
          <p className="text-muted-foreground">Gerencie afiliados e acompanhe comissões</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAffiliateOpen} onOpenChange={setIsAffiliateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Afiliado
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Afiliado</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={affiliateForm.name}
                    onChange={(e) => setAffiliateForm({ ...affiliateForm, name: e.target.value })}
                    placeholder="Nome do afiliado"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={affiliateForm.email}
                    onChange={(e) => setAffiliateForm({ ...affiliateForm, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={affiliateForm.phone}
                    onChange={(e) => setAffiliateForm({ ...affiliateForm, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dados para pagamento</Label>
                  <Input
                    value={affiliateForm.payout_notes}
                    onChange={(e) => setAffiliateForm({ ...affiliateForm, payout_notes: e.target.value })}
                    placeholder="PIX, banco, etc."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAffiliateOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateAffiliate} disabled={!affiliateForm.name || !affiliateForm.email}>
                  Criar Afiliado
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{affiliates.length}</p>
                <p className="text-sm text-muted-foreground">Afiliados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MousePointerClick className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.clicks || 0}</p>
                <p className="text-sm text-muted-foreground">Cliques</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.conversions || 0}</p>
                <p className="text-sm text-muted-foreground">Conversões</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats?.pending_commission || 0)}</p>
                <p className="text-sm text-muted-foreground">Pendente</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats?.paid_commission || 0)}</p>
                <p className="text-sm text-muted-foreground">Pago</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="affiliates">
        <TabsList>
          <TabsTrigger value="affiliates">Afiliados</TabsTrigger>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="conversions">Conversões</TabsTrigger>
          <TabsTrigger value="payouts">Pagamentos</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        {/* Affiliates Tab */}
        <TabsContent value="affiliates">
          <Card>
            <CardHeader>
              <CardTitle>Afiliados Cadastrados</CardTitle>
            </CardHeader>
            <CardContent>
              {affiliates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum afiliado cadastrado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Links</TableHead>
                      <TableHead>Conversões</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affiliates.map((aff) => {
                      const affLinks = links.filter(l => l.affiliate_id === aff.id);
                      const affConversions = conversions.filter(c => c.affiliate_id === aff.id);
                      return (
                        <TableRow key={aff.id}>
                          <TableCell className="font-medium">{aff.name}</TableCell>
                          <TableCell>{aff.email}</TableCell>
                          <TableCell>{getAffiliateStatusBadge(aff.status)}</TableCell>
                          <TableCell>{affLinks.length}</TableCell>
                          <TableCell>{affConversions.length}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setLinkForm({ affiliate_id: aff.id, code: '', target_url: '' });
                                  setIsLinkOpen(true);
                                }}>
                                  <Link2 className="h-4 w-4 mr-2" />
                                  Criar Link
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setPayoutForm({ affiliate_id: aff.id, amount: '' });
                                  setIsPayoutOpen(true);
                                }}>
                                  <DollarSign className="h-4 w-4 mr-2" />
                                  Registrar Pagamento
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => deleteAffiliate.mutateAsync(aff.id)} 
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remover
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Links Tab */}
        <TabsContent value="links">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Links de Afiliados</CardTitle>
              <Dialog open={isLinkOpen} onOpenChange={setIsLinkOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Link
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Link de Afiliado</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Afiliado *</Label>
                      <Select value={linkForm.affiliate_id} onValueChange={(v) => setLinkForm({ ...linkForm, affiliate_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {affiliates.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Código (opcional)</Label>
                      <Input
                        value={linkForm.code}
                        onChange={(e) => setLinkForm({ ...linkForm, code: e.target.value })}
                        placeholder="Gerado automaticamente"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL de destino (opcional)</Label>
                      <Input
                        value={linkForm.target_url}
                        onChange={(e) => setLinkForm({ ...linkForm, target_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsLinkOpen(false)}>Cancelar</Button>
                    <Button onClick={handleCreateLink} disabled={!linkForm.affiliate_id}>
                      Criar Link
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {links.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum link criado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Afiliado</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((link) => {
                      const affiliate = affiliates.find(a => a.id === link.affiliate_id);
                      const url = `${window.location.origin}/?aff=${link.code}`;
                      return (
                        <TableRow key={link.id}>
                          <TableCell>{affiliate?.name || '-'}</TableCell>
                          <TableCell>
                            <code className="bg-muted px-2 py-1 rounded text-sm">{link.code}</code>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground truncate max-w-[300px] block">{url}</span>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => copyLink(link.code)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversions Tab */}
        <TabsContent value="conversions">
          <Card>
            <CardHeader>
              <CardTitle>Conversões</CardTitle>
              <CardDescription>Vendas atribuídas a afiliados</CardDescription>
            </CardHeader>
            <CardContent>
              {conversions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma conversão registrada</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Afiliado</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Valor do Pedido</TableHead>
                      <TableHead>Comissão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversions.map((conv) => {
                      const affiliate = affiliates.find(a => a.id === conv.affiliate_id);
                      return (
                        <TableRow key={conv.id}>
                          <TableCell>{affiliate?.name || '-'}</TableCell>
                          <TableCell>
                            <code className="text-sm">{conv.order_id.slice(0, 8)}...</code>
                          </TableCell>
                          <TableCell>{formatCurrency(conv.order_total_cents)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(conv.commission_cents)}</TableCell>
                          <TableCell>{getConversionStatusBadge(conv.status)}</TableCell>
                          <TableCell>
                            {conv.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => updateConversionStatus.mutateAsync({ id: conv.id, status: 'approved' })}
                                >
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => updateConversionStatus.mutateAsync({ id: conv.id, status: 'rejected' })}
                                >
                                  <XCircle className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pagamentos</CardTitle>
                <CardDescription>Histórico de pagamentos aos afiliados</CardDescription>
              </div>
              <Dialog open={isPayoutOpen} onOpenChange={setIsPayoutOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar Pagamento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Pagamento</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Afiliado *</Label>
                      <Select value={payoutForm.affiliate_id} onValueChange={(v) => setPayoutForm({ ...payoutForm, affiliate_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {affiliates.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Valor (R$) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={payoutForm.amount}
                        onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                        placeholder="100.00"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPayoutOpen(false)}>Cancelar</Button>
                    <Button onClick={handleCreatePayout} disabled={!payoutForm.affiliate_id || !payoutForm.amount}>
                      Registrar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum pagamento registrado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Afiliado</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((payout) => {
                      const affiliate = affiliates.find(a => a.id === payout.affiliate_id);
                      return (
                        <TableRow key={payout.id}>
                          <TableCell>{affiliate?.name || '-'}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(payout.amount_cents)}</TableCell>
                          <TableCell>
                            {payout.status === 'pending' && <Badge variant="outline">Pendente</Badge>}
                            {payout.status === 'approved' && <Badge className="bg-yellow-500 text-white">Aprovado</Badge>}
                            {payout.status === 'paid' && <Badge className="bg-green-500 text-white">Pago</Badge>}
                          </TableCell>
                          <TableCell>{new Date(payout.created_at).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>
                            {payout.status !== 'paid' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => updatePayout.mutateAsync({ 
                                  id: payout.id, 
                                  status: 'paid', 
                                  paid_at: new Date().toISOString() 
                                })}
                              >
                                Marcar Pago
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações do Programa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Programa Ativo</Label>
                  <p className="text-sm text-muted-foreground">Habilita o tracking e registro de conversões</p>
                </div>
                <Switch
                  checked={programForm.is_enabled}
                  onCheckedChange={(checked) => setProgramForm({ ...programForm, is_enabled: checked })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Janela de Atribuição (dias)</Label>
                  <Input
                    type="number"
                    value={programForm.attribution_window_days}
                    onChange={(e) => setProgramForm({ ...programForm, attribution_window_days: parseInt(e.target.value) || 30 })}
                  />
                  <p className="text-xs text-muted-foreground">Período para atribuir venda ao afiliado após clique</p>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Comissão</Label>
                  <Select 
                    value={programForm.commission_type} 
                    onValueChange={(v: 'percent' | 'fixed') => setProgramForm({ ...programForm, commission_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentual (%)</SelectItem>
                      <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  {programForm.commission_type === 'percent' ? 'Percentual de Comissão (%)' : 'Valor Fixo por Venda (R$)'}
                </Label>
                <Input
                  type="number"
                  step={programForm.commission_type === 'percent' ? '1' : '0.01'}
                  value={programForm.commission_type === 'percent' 
                    ? programForm.commission_value_cents / 100 
                    : programForm.commission_value_cents / 100
                  }
                  onChange={(e) => setProgramForm({ 
                    ...programForm, 
                    commission_value_cents: Math.round(parseFloat(e.target.value) * 100) || 0 
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  {programForm.commission_type === 'percent' 
                    ? `Afiliados recebem ${programForm.commission_value_cents / 100}% do valor da venda`
                    : `Afiliados recebem ${formatCurrency(programForm.commission_value_cents)} por venda`
                  }
                </p>
              </div>

              <Button onClick={handleSaveProgram} disabled={upsertProgram.isPending}>
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

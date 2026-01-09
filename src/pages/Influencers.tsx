import { useState } from "react";
import { Plus, Search, ExternalLink, Mail, Phone, User, Filter, MoreHorizontal, Trash2, Edit } from "lucide-react";
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
import { useInfluencerLeads, InfluencerLeadInsert } from "@/hooks/useInfluencerLeads";

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'other', label: 'Outro' },
];

const STATUSES = [
  { value: 'prospect', label: 'Prospecção', color: 'bg-gray-500' },
  { value: 'contacted', label: 'Contatado', color: 'bg-blue-500' },
  { value: 'negotiating', label: 'Negociando', color: 'bg-yellow-500' },
  { value: 'closed', label: 'Fechado', color: 'bg-green-500' },
  { value: 'discarded', label: 'Descartado', color: 'bg-red-500' },
];

const FOLLOWER_RANGES = [
  { value: '1k-10k', label: '1k - 10k' },
  { value: '10k-50k', label: '10k - 50k' },
  { value: '50k-100k', label: '50k - 100k' },
  { value: '100k-500k', label: '100k - 500k' },
  { value: '500k-1m', label: '500k - 1M' },
  { value: '1m+', label: '1M+' },
];

export default function Influencers() {
  const { influencers, isLoading, createInfluencer, updateInfluencer, deleteInfluencer } = useInfluencerLeads();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<InfluencerLeadInsert>>({
    name: '',
    platform: 'instagram',
    status: 'prospect',
  });

  const filteredInfluencers = influencers.filter(inf => {
    const matchesSearch = inf.name.toLowerCase().includes(search.toLowerCase()) ||
      inf.handle?.toLowerCase().includes(search.toLowerCase()) ||
      inf.niche?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inf.status === statusFilter;
    const matchesPlatform = platformFilter === 'all' || inf.platform === platformFilter;
    return matchesSearch && matchesStatus && matchesPlatform;
  });

  const handleSubmit = async () => {
    if (!formData.name) return;
    
    if (editingId) {
      await updateInfluencer.mutateAsync({ id: editingId, ...formData });
    } else {
      await createInfluencer.mutateAsync(formData as InfluencerLeadInsert);
    }
    
    setIsAddOpen(false);
    setEditingId(null);
    setFormData({ name: '', platform: 'instagram', status: 'prospect' });
  };

  const handleEdit = (influencer: typeof influencers[0]) => {
    setFormData(influencer);
    setEditingId(influencer.id);
    setIsAddOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Remover este influencer?')) {
      await deleteInfluencer.mutateAsync(id);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = STATUSES.find(st => st.value === status);
    return <Badge className={`${s?.color} text-white`}>{s?.label || status}</Badge>;
  };

  const getPlatformLabel = (platform: string) => {
    return PLATFORMS.find(p => p.value === platform)?.label || platform;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Busca de Influencers</h1>
          <p className="text-muted-foreground">Encontre e gerencie parcerias com influenciadores</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) {
            setEditingId(null);
            setFormData({ name: '', platform: 'instagram', status: 'prospect' });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Influencer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar' : 'Adicionar'} Influencer</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome do influencer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Handle / @</Label>
                  <Input
                    value={formData.handle || ''}
                    onChange={(e) => setFormData({ ...formData, handle: e.target.value })}
                    placeholder="@usuario"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select value={formData.platform || 'instagram'} onValueChange={(v) => setFormData({ ...formData, platform: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Seguidores</Label>
                  <Select value={formData.follower_range || ''} onValueChange={(v) => setFormData({ ...formData, follower_range: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {FOLLOWER_RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nicho</Label>
                  <Input
                    value={formData.niche || ''}
                    onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                    placeholder="Ex: moda, fitness, tech"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Localização</Label>
                  <Input
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Cidade, Estado"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>URL do Perfil</Label>
                <Input
                  value={formData.profile_url || ''}
                  onChange={(e) => setFormData({ ...formData, profile_url: e.target.value })}
                  placeholder="https://instagram.com/..."
                />
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
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status || 'prospect'} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações sobre o influencer..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!formData.name || createInfluencer.isPending || updateInfluencer.isPending}>
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
                  placeholder="Buscar por nome, handle ou nicho..."
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
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Influencers Salvos</CardTitle>
          <CardDescription>{filteredInfluencers.length} influencer(s) encontrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredInfluencers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum influencer encontrado</p>
              <p className="text-sm">Adicione influencers manualmente para começar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Nicho</TableHead>
                  <TableHead>Seguidores</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInfluencers.map((inf) => (
                  <TableRow key={inf.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium">{inf.name}</p>
                          {inf.handle && <p className="text-sm text-muted-foreground">@{inf.handle}</p>}
                        </div>
                        {inf.profile_url && (
                          <a href={inf.profile_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getPlatformLabel(inf.platform)}</TableCell>
                    <TableCell>{inf.niche || '-'}</TableCell>
                    <TableCell>{inf.follower_range || '-'}</TableCell>
                    <TableCell>{getStatusBadge(inf.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {inf.contact_email && (
                          <a href={`mailto:${inf.contact_email}`}>
                            <Mail className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </a>
                        )}
                        {inf.contact_phone && (
                          <a href={`tel:${inf.contact_phone}`}>
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
                          <DropdownMenuItem onClick={() => handleEdit(inf)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(inf.id)} className="text-destructive">
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

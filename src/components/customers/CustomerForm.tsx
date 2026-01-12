import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Building2, Mail, MessageSquare, Phone, MapPin, Search, Loader2 } from 'lucide-react';
import { useCepLookup } from '@/hooks/useCepLookup';
import { toast } from 'sonner';
import type { Customer, CustomerFormData, CustomerTag } from '@/hooks/useCustomers';

const customerSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  cpf: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  gender: z.enum(['male', 'female', 'other', 'not_informed']).optional().nullable(),
  status: z.enum(['active', 'inactive', 'blocked']).default('active'),
  accepts_marketing: z.boolean().default(true),
  tag_ids: z.array(z.string()).default([]),
  // PF/PJ fields
  person_type: z.enum(['pf', 'pj']).optional().nullable(),
  cnpj: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  ie: z.string().optional().nullable(),
  rg: z.string().optional().nullable(),
  // Marketing consents by channel
  accepts_email_marketing: z.boolean().optional().nullable(),
  accepts_sms_marketing: z.boolean().optional().nullable(),
  accepts_whatsapp_marketing: z.boolean().optional().nullable(),
  // Notes
  notes: z.string().optional().nullable(),
  // Address fields (inline)
  address_label: z.string().optional().nullable(),
  address_postal_code: z.string().optional().nullable(),
  address_street: z.string().optional().nullable(),
  address_number: z.string().optional().nullable(),
  address_complement: z.string().optional().nullable(),
  address_neighborhood: z.string().optional().nullable(),
  address_city: z.string().optional().nullable(),
  address_state: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof customerSchema>;

interface CustomerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
  customerTagIds?: string[];
  availableTags?: CustomerTag[];
  onSubmit: (data: CustomerFormData & { tag_ids: string[] }) => void;
  isLoading?: boolean;
}

export function CustomerForm({
  open,
  onOpenChange,
  customer,
  customerTagIds = [],
  availableTags = [],
  onSubmit,
  isLoading,
}: CustomerFormProps) {
  const isEditing = !!customer;
  const { lookupCep, isLoading: isLookingUpCep } = useCepLookup();

  const form = useForm<FormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: '',
      email: '',
      cpf: '',
      phone: '',
      birth_date: '',
      gender: 'not_informed',
      status: 'active',
      accepts_marketing: true,
      tag_ids: [],
      person_type: 'pf',
      cnpj: '',
      company_name: '',
      ie: '',
      rg: '',
      accepts_email_marketing: true,
      accepts_sms_marketing: true,
      accepts_whatsapp_marketing: true,
      notes: '',
      // Address defaults
      address_label: 'Principal',
      address_postal_code: '',
      address_street: '',
      address_number: '',
      address_complement: '',
      address_neighborhood: '',
      address_city: '',
      address_state: '',
    },
  });

  const personType = form.watch('person_type');

  // Reset form when customer changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        full_name: customer?.full_name ?? '',
        email: customer?.email ?? '',
        cpf: customer?.cpf ?? '',
        phone: customer?.phone ?? '',
        birth_date: customer?.birth_date ?? '',
        gender: customer?.gender ?? 'not_informed',
        status: customer?.status ?? 'active',
        accepts_marketing: customer?.accepts_marketing ?? true,
        tag_ids: customerTagIds,
        person_type: customer?.person_type ?? 'pf',
        cnpj: customer?.cnpj ?? '',
        company_name: customer?.company_name ?? '',
        ie: customer?.ie ?? '',
        rg: customer?.rg ?? '',
        accepts_email_marketing: true,
        accepts_sms_marketing: true,
        accepts_whatsapp_marketing: true,
        notes: customer?.notes ?? '',
        // Address defaults - reset for new customer
        address_label: 'Principal',
        address_postal_code: '',
        address_street: '',
        address_number: '',
        address_complement: '',
        address_neighborhood: '',
        address_city: '',
        address_state: '',
      });
    }
  }, [open, customer, customerTagIds, form]);

  const handleCepLookup = async () => {
    const cep = form.getValues('address_postal_code');
    if (!cep) {
      toast.error('Digite o CEP primeiro');
      return;
    }
    const result = await lookupCep(cep);
    
    if (result) {
      form.setValue('address_street', result.street);
      form.setValue('address_neighborhood', result.neighborhood);
      form.setValue('address_city', result.city);
      form.setValue('address_state', result.state);
      toast.success('Endereço encontrado!');
    } else {
      toast.error('CEP não encontrado');
    }
  };

  const handleSubmit = (data: FormValues) => {
    // Build address object if any address field is filled
    const hasAddress = data.address_street || data.address_city || data.address_postal_code;
    const address = hasAddress ? {
      label: data.address_label || 'Principal',
      postal_code: data.address_postal_code || '',
      street: data.address_street || '',
      number: data.address_number || '',
      complement: data.address_complement || null,
      neighborhood: data.address_neighborhood || '',
      city: data.address_city || '',
      state: data.address_state || '',
      country: 'Brasil',
      recipient_name: data.full_name,
      is_default: true,
    } : null;

    onSubmit({
      full_name: data.full_name,
      email: data.email,
      cpf: data.cpf || null,
      phone: data.phone || null,
      birth_date: data.birth_date || null,
      gender: data.gender || null,
      status: data.status,
      accepts_marketing: data.accepts_marketing,
      tag_ids: data.tag_ids,
      person_type: data.person_type || null,
      cnpj: data.cnpj || null,
      company_name: data.company_name || null,
      ie: data.ie || null,
      rg: data.rg || null,
      accepts_email_marketing: data.accepts_email_marketing,
      accepts_sms_marketing: data.accepts_sms_marketing,
      accepts_whatsapp_marketing: data.accepts_whatsapp_marketing,
      notes: data.notes || null,
      address, // Pass address to parent
    } as any);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações do cliente.'
              : 'Preencha os dados para cadastrar um novo cliente.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <ScrollArea className="max-h-[60vh] pr-4">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
                  <TabsTrigger value="company">PF/PJ</TabsTrigger>
                  <TabsTrigger value="address">Endereço</TabsTrigger>
                </TabsList>

                {/* TAB: Dados Básicos */}
                <TabsContent value="basic" className="space-y-4">
                  {/* Tipo de Pessoa */}
                  <FormField
                    control={form.control}
                    name="person_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Pessoa</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value ?? 'pf'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pf">
                              <span className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Pessoa Física
                              </span>
                            </SelectItem>
                            <SelectItem value="pj">
                              <span className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Pessoa Jurídica
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {personType === 'pj' ? 'Nome Fantasia / Contato *' : 'Nome completo *'}
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="João da Silva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="joao@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input placeholder="(11) 99999-9999" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Ativo</SelectItem>
                              <SelectItem value="inactive">Inativo</SelectItem>
                              <SelectItem value="blocked">Bloqueado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Tags */}
                  {availableTags.length > 0 && (
                    <FormField
                      control={form.control}
                      name="tag_ids"
                      render={() => (
                        <FormItem>
                          <FormLabel>Tags</FormLabel>
                          <div className="flex flex-wrap gap-2 p-3 border rounded-lg">
                            {availableTags.map((tag) => (
                              <FormField
                                key={tag.id}
                                control={form.control}
                                name="tag_ids"
                                render={({ field }) => (
                                  <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(tag.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            field.onChange([...field.value, tag.id]);
                                          } else {
                                            field.onChange(field.value?.filter((id) => id !== tag.id));
                                          }
                                        }}
                                      />
                                    </FormControl>
                                    <Badge 
                                      variant="secondary" 
                                      style={{ backgroundColor: tag.color + '20', borderColor: tag.color }}
                                      className="cursor-pointer border"
                                    >
                                      <span style={{ color: tag.color }}>{tag.name}</span>
                                    </Badge>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Anotações internas sobre o cliente..."
                            rows={3}
                            {...field} 
                            value={field.value ?? ''} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* TAB: PF/PJ */}
                <TabsContent value="company" className="space-y-4">
                  {personType === 'pf' ? (
                    <>
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <User className="h-5 w-5" />
                        <span className="font-medium">Dados Pessoa Física</span>
                      </div>

                      <FormField
                        control={form.control}
                        name="cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF</FormLabel>
                            <FormControl>
                              <Input placeholder="000.000.000-00" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="birth_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data de nascimento</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="gender"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Gênero</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value ?? 'not_informed'}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="not_informed">Não informado</SelectItem>
                                  <SelectItem value="male">Masculino</SelectItem>
                                  <SelectItem value="female">Feminino</SelectItem>
                                  <SelectItem value="other">Outro</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Building2 className="h-5 w-5" />
                        <span className="font-medium">Dados Pessoa Jurídica</span>
                      </div>

                      <FormField
                        control={form.control}
                        name="company_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Razão Social</FormLabel>
                            <FormControl>
                              <Input placeholder="Empresa Ltda." {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="cnpj"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CNPJ</FormLabel>
                              <FormControl>
                                <Input placeholder="00.000.000/0001-00" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="ie"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Inscrição Estadual</FormLabel>
                              <FormControl>
                                <Input placeholder="000.000.000.000" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Deixe vazio se isento
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* TAB: Endereço */}
                <TabsContent value="address" className="space-y-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <MapPin className="h-5 w-5" />
                    <span className="font-medium">Endereço Principal</span>
                  </div>

                  <FormField
                    control={form.control}
                    name="address_label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rótulo do endereço</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Casa, Trabalho..." {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="address_postal_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input placeholder="00000-000" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={handleCepLookup}
                              disabled={isLookingUpCep}
                            >
                              {isLookingUpCep ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Search className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address_state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado</FormLabel>
                          <FormControl>
                            <Input placeholder="SP" maxLength={2} {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address_street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rua / Logradouro</FormLabel>
                        <FormControl>
                          <Input placeholder="Rua das Flores" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="address_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número</FormLabel>
                          <FormControl>
                            <Input placeholder="123" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address_complement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input placeholder="Apto 101" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="address_neighborhood"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <FormControl>
                            <Input placeholder="Centro" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input placeholder="São Paulo" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

              </Tabs>
            </ScrollArea>

            <DialogFooter className="mt-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

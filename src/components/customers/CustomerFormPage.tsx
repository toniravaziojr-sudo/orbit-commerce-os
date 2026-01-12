import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  User, Building2, Mail, MessageSquare, Phone, MapPin, Search, Loader2, Tag, Plus, ArrowLeft
} from 'lucide-react';
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
  person_type: z.enum(['pf', 'pj'], { required_error: 'Tipo de pessoa é obrigatório' }),
  cnpj: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  ie: z.string().optional().nullable(),
  rg: z.string().optional().nullable(),
  state_registration_is_exempt: z.boolean().optional().nullable(),
  accepts_email_marketing: z.boolean().optional().nullable(),
  accepts_sms_marketing: z.boolean().optional().nullable(),
  accepts_whatsapp_marketing: z.boolean().optional().nullable(),
  notes: z.string().optional().nullable(),
  address_label: z.string().optional().nullable(),
  address_postal_code: z.string().optional().nullable(),
  address_street: z.string().optional().nullable(),
  address_number: z.string().optional().nullable(),
  address_complement: z.string().optional().nullable(),
  address_neighborhood: z.string().optional().nullable(),
  address_city: z.string().optional().nullable(),
  address_state: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.person_type === 'pf') {
      return data.cpf && data.cpf.replace(/\D/g, '').length >= 11;
    }
    if (data.person_type === 'pj') {
      return data.cnpj && data.cnpj.replace(/\D/g, '').length >= 14;
    }
    return true;
  },
  {
    message: 'CPF (para PF) ou CNPJ (para PJ) é obrigatório para emissão de NF-e',
    path: ['cpf'],
  }
);

type FormValues = z.infer<typeof customerSchema>;

interface CustomerFormPageProps {
  customer?: Customer | null;
  customerTagIds?: string[];
  availableTags?: CustomerTag[];
  onSubmit: (data: CustomerFormData & { tag_ids: string[] }) => void;
  onCreateTag?: (data: { name: string; color: string }) => void;
  isCreatingTag?: boolean;
  isLoading?: boolean;
  onCancel: () => void;
}

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

export function CustomerFormPage({
  customer,
  customerTagIds = [],
  availableTags = [],
  onSubmit,
  onCreateTag,
  isCreatingTag,
  isLoading,
  onCancel,
}: CustomerFormPageProps) {
  const isEditing = !!customer;
  const { lookupCep, isLoading: isLookingUpCep } = useCepLookup();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showTagInput, setShowTagInput] = useState(false);

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
      state_registration_is_exempt: false,
      accepts_email_marketing: true,
      accepts_sms_marketing: true,
      accepts_whatsapp_marketing: true,
      notes: '',
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

  useEffect(() => {
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
      state_registration_is_exempt: customer?.state_registration_is_exempt ?? false,
      accepts_email_marketing: customer?.accepts_email_marketing ?? true,
      accepts_sms_marketing: customer?.accepts_sms_marketing ?? true,
      accepts_whatsapp_marketing: customer?.accepts_whatsapp_marketing ?? true,
      notes: customer?.notes ?? '',
      address_label: 'Principal',
      address_postal_code: '',
      address_street: '',
      address_number: '',
      address_complement: '',
      address_neighborhood: '',
      address_city: '',
      address_state: '',
    });
  }, [customer, customerTagIds, form]);

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

  const handleFormSubmit = (data: FormValues) => {
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
      state_registration_is_exempt: data.state_registration_is_exempt || null,
      accepts_email_marketing: data.accepts_email_marketing,
      accepts_sms_marketing: data.accepts_sms_marketing,
      accepts_whatsapp_marketing: data.accepts_whatsapp_marketing,
      notes: data.notes || null,
      address,
    } as any);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? 'Atualize as informações do cliente.'
              : 'Preencha os dados para cadastrar um novo cliente.'}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="basic" className="gap-2">
                <User className="h-4 w-4" />
                Básico
              </TabsTrigger>
              <TabsTrigger value="pfpj" className="gap-2">
                <Building2 className="h-4 w-4" />
                PF/PJ
              </TabsTrigger>
              <TabsTrigger value="address" className="gap-2">
                <MapPin className="h-4 w-4" />
                Endereço
              </TabsTrigger>
              <TabsTrigger value="marketing" className="gap-2">
                <Mail className="h-4 w-4" />
                Marketing
              </TabsTrigger>
              <TabsTrigger value="tags" className="gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </TabsTrigger>
            </TabsList>

            {/* TAB: Dados Básicos */}
            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle>Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="person_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Pessoa *</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value ?? 'pf'}
                        >
                          <FormControl>
                            <SelectTrigger className="w-[280px]">
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
                        <FormDescription>Obrigatório para emissão de NF-e</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Anotações internas sobre o cliente..."
                            rows={4}
                            {...field} 
                            value={field.value ?? ''} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: PF/PJ */}
            <TabsContent value="pfpj">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {personType === 'pf' ? (
                      <>
                        <User className="h-5 w-5" />
                        Dados Pessoa Física
                      </>
                    ) : (
                      <>
                        <Building2 className="h-5 w-5" />
                        Dados Pessoa Jurídica
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {personType === 'pf' ? (
                    <>
                      <FormField
                        control={form.control}
                        name="cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF *</FormLabel>
                            <FormControl>
                              <Input placeholder="000.000.000-00" {...field} value={field.value ?? ''} className="max-w-[280px]" />
                            </FormControl>
                            <FormDescription>Obrigatório para emissão de NF-e</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="rg"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>RG</FormLabel>
                            <FormControl>
                              <Input placeholder="00.000.000-0" {...field} value={field.value ?? ''} className="max-w-[280px]" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="cnpj"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CNPJ *</FormLabel>
                              <FormControl>
                                <Input placeholder="00.000.000/0001-00" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormDescription>Obrigatório para emissão de NF-e</FormDescription>
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
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="state_registration_is_exempt"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Isento de Inscrição Estadual</FormLabel>
                              <FormDescription>
                                Marque se a empresa é isenta de IE
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value ?? false}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: Endereço */}
            <TabsContent value="address">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Endereço Principal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="address_label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rótulo do endereço</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Casa, Trabalho..." {...field} value={field.value ?? ''} className="max-w-[280px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                  <FormField
                    control={form.control}
                    name="address_neighborhood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input placeholder="Centro" {...field} value={field.value ?? ''} className="max-w-md" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: Marketing */}
            <TabsContent value="marketing">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Consentimentos de Marketing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="accepts_marketing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Aceita receber marketing</FormLabel>
                          <FormDescription>
                            Consentimento geral para comunicações de marketing
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accepts_email_marketing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5 flex items-center gap-3">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <FormLabel className="text-base">Email Marketing</FormLabel>
                            <FormDescription>
                              Receber ofertas e novidades por email
                            </FormDescription>
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? true}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accepts_sms_marketing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5 flex items-center gap-3">
                          <MessageSquare className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <FormLabel className="text-base">SMS Marketing</FormLabel>
                            <FormDescription>
                              Receber ofertas e novidades por SMS
                            </FormDescription>
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? true}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accepts_whatsapp_marketing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5 flex items-center gap-3">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <FormLabel className="text-base">WhatsApp Marketing</FormLabel>
                            <FormDescription>
                              Receber ofertas e novidades por WhatsApp
                            </FormDescription>
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? true}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: Tags */}
            <TabsContent value="tags">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="h-5 w-5" />
                      Tags do Cliente
                    </CardTitle>
                    {onCreateTag && !showTagInput && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setShowTagInput(true)}
                      >
                        <Plus className="h-4 w-4" />
                        Nova Tag
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Inline tag creation */}
                  {showTagInput && onCreateTag && (
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Nome da tag"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          className="flex-1 max-w-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={!newTagName.trim() || isCreatingTag}
                          onClick={() => {
                            if (newTagName.trim()) {
                              onCreateTag({ name: newTagName.trim(), color: newTagColor });
                              setNewTagName('');
                              setNewTagColor(TAG_COLORS[0]);
                              setShowTagInput(false);
                            }
                          }}
                        >
                          {isCreatingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {TAG_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`h-7 w-7 rounded-full transition-all ${
                              newTagColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setNewTagColor(color)}
                          />
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowTagInput(false);
                          setNewTagName('');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}

                  {/* Existing tags */}
                  <FormField
                    control={form.control}
                    name="tag_ids"
                    render={() => (
                      <FormItem>
                        {availableTags.length > 0 ? (
                          <div className="flex flex-wrap gap-3 p-4 border rounded-lg bg-muted/30">
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
                                      className="cursor-pointer border text-sm"
                                    >
                                      <span style={{ color: tag.color }}>{tag.name}</span>
                                    </Badge>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                        ) : !showTagInput && (
                          <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-muted/30 text-muted-foreground">
                            <Tag className="h-10 w-10 mb-3 opacity-50" />
                            <p className="text-center">Nenhuma tag criada ainda.</p>
                            <p className="text-center text-sm">Clique em "Nova Tag" para criar a primeira.</p>
                          </div>
                        )}
                        <FormDescription className="mt-3">
                          Use tags para segmentar clientes em campanhas de email marketing
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Footer Actions */}
          <div className="flex justify-end gap-4 mt-8 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? 'Salvar Alterações' : 'Criar Cliente'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// =============================================
// B2B ENTITY CARD - Card de empresa encontrada
// =============================================

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Phone, Mail, MapPin, Check, Plus, Globe } from "lucide-react";
import { formatCnpj } from "@/lib/formatCnpj";

interface EntityData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cnae_principal?: string;
  cnae_descricao?: string;
  situacao_cadastral?: string;
  porte?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  website?: string;
}

interface B2BEntityCardProps {
  entity: EntityData;
  isSaved?: boolean;
  onSave?: () => void;
  showSaveButton?: boolean;
}

export default function B2BEntityCard({
  entity,
  isSaved = false,
  onSave,
  showSaveButton = true,
}: B2BEntityCardProps) {
  const situacaoColor = entity.situacao_cadastral === "ATIVA" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600";

  return (
    <Card className="relative overflow-hidden">
      {isSaved && (
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="bg-green-500/10 text-green-600">
            <Check className="h-3 w-3 mr-1" />
            Salvo
          </Badge>
        </div>
      )}
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-mono">
            {formatCnpj(entity.cnpj)}
          </p>
          <h3 className="font-semibold text-sm line-clamp-2">
            {entity.nome_fantasia || entity.razao_social}
          </h3>
          {entity.nome_fantasia && entity.razao_social !== entity.nome_fantasia && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {entity.razao_social}
            </p>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1">
          {entity.situacao_cadastral && (
            <Badge variant="secondary" className={situacaoColor}>
              {entity.situacao_cadastral}
            </Badge>
          )}
          {entity.porte && (
            <Badge variant="outline" className="text-xs">
              {entity.porte}
            </Badge>
          )}
        </div>

        {/* CNAE */}
        {entity.cnae_descricao && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {entity.cnae_descricao}
          </p>
        )}

        {/* Contact Info */}
        <div className="space-y-1.5 text-xs">
          {entity.cidade && entity.uf && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="line-clamp-1">
                {entity.bairro ? `${entity.bairro}, ` : ""}
                {entity.cidade} - {entity.uf}
              </span>
            </div>
          )}
          {entity.telefone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3 flex-shrink-0 text-green-600" />
              <span>{entity.telefone}</span>
            </div>
          )}
          {entity.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3 flex-shrink-0 text-blue-600" />
              <span className="truncate">{entity.email}</span>
            </div>
          )}
          {entity.website && (
            <div className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 flex-shrink-0 text-purple-600" />
              <a 
                href={entity.website.startsWith("http") ? entity.website : `https://${entity.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-primary hover:underline"
              >
                {entity.website}
              </a>
            </div>
          )}
        </div>

        {/* Save Button */}
        {showSaveButton && onSave && !isSaved && (
          <Button size="sm" className="w-full mt-2" onClick={onSave}>
            <Plus className="h-3 w-3 mr-1" />
            Salvar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

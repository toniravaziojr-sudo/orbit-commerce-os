import { Instagram, Facebook, MessageCircle } from "lucide-react";

interface StoreFooterProps {
  storeName: string;
  whatsapp?: string | null;
  instagram?: string | null;
  facebook?: string | null;
}

export function StoreFooter({
  storeName,
  whatsapp,
  instagram,
  facebook,
}: StoreFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-muted/50 border-t mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <h3 className="font-semibold text-foreground">{storeName}</h3>
            <p className="text-sm text-muted-foreground">
              © {currentYear} Todos os direitos reservados.
            </p>
          </div>

          {(whatsapp || instagram || facebook) && (
            <div className="flex items-center gap-4">
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              )}
              {instagram && (
                <a
                  href={`https://instagram.com/${instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {facebook && (
                <a
                  href={facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}

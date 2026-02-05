 import { PageHeader } from "@/components/ui/page-header";
 import { GoogleMapsToFacebookConverter } from "@/components/tools/GoogleMapsToFacebookConverter";
 
 export default function PlatformTools() {
   return (
     <div className="space-y-6 animate-fade-in">
       <PageHeader
         title="Ferramentas da Plataforma"
         description="Utilitários exclusivos para administração da plataforma"
       />
 
       <div className="space-y-6">
         <GoogleMapsToFacebookConverter />
       </div>
     </div>
   );
 }
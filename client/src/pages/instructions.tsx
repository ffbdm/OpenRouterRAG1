import { InstructionsPanel } from "@/components/InstructionsPanel";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function InstructionsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Console RAG</p>
        <h1 className="text-2xl font-bold text-foreground">Central de Instruções</h1>
        <p className="text-sm text-muted-foreground">
          Revise e edite os prompts que controlam o comportamento do chat, do catálogo e das orientações globais do sistema.
        </p>
      </header>

      <Card className="border bg-card/40 p-4 text-sm text-muted-foreground">
        <p>
          Cada instrução salva aqui reflete imediatamente nas telas correspondentes. Use descrições claras, mantenha o conteúdo em português e registre decisões importantes.
        </p>
      </Card>

      <div className="space-y-6">
        <InstructionsPanel
          scopes={["global"]}
          title="Instruções globais"
          description="Aplicadas em todo o console e servem como princípios gerais."
        />
        <Separator />
        <InstructionsPanel
          scopes={["chat"]}
          title="Prompts do chat"
          description="Afetam o comportamento da IA nas conversas. O fluxo agora possui duas etapas (buscar dados e responder o usuário), cada uma com sua instrução dedicada."
        />
        <Separator />
        <InstructionsPanel
          scopes={["catalog"]}
          title="Diretrizes do catálogo"
          description="Checklist de preenchimento e regras de edição exibidas para o time de catálogo."
        />
      </div>
    </div>
  );
}

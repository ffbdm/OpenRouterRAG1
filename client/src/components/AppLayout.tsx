import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Bot, Boxes, NotebookPen, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import LogTerminal from "@/components/LogTerminal";

type NavLink = {
  href: string;
  label: string;
  description: string;
  icon: typeof Bot;
};

const links: NavLink[] = [
  {
    href: "/",
    label: "Chat RAG",
    description: "Perguntas e respostas com base no banco",
    icon: Bot,
  },
  {
    href: "/catalogo",
    label: "Catálogo",
    description: "Listar, criar e editar itens",
    icon: Boxes,
  },
  {
    href: "/instrucoes",
    label: "Instruções",
    description: "Editar prompts globais do sistema",
    icon: NotebookPen,
  },
];

function NavButton({ link, isActive, isMobile }: { link: NavLink; isActive: boolean; isMobile: boolean }) {
  const Icon = link.icon;
  
  if (isMobile) {
    return (
      <Link
        href={link.href}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
          isActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="text-[10px] font-medium">{link.label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={link.href}
      className={cn(
        "group inline-flex min-w-[180px] flex-col gap-1 rounded-lg border px-3 py-2 transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-sm",
        isActive
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "bg-card text-foreground"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4" />
        <span>{link.label}</span>
      </div>
      <p
        className={cn(
          "text-xs leading-tight",
          isActive ? "text-primary-foreground/80" : "text-muted-foreground"
        )}
      >
        {link.description}
      </p>
    </Link>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {!isMobile && (
        <header className="border-b bg-card/50 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Console RAG
              </span>
              <span className="hidden h-4 w-px bg-border md:block" />
              <span className="text-xs md:text-sm">Chat + Catálogo em um só lugar</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {links.map((link) => (
                <NavButton
                  key={link.href}
                  link={link}
                  isActive={
                    link.href === "/"
                      ? location === "/"
                      : location.startsWith(link.href)
                  }
                  isMobile={false}
                />
              ))}
              <button
                onClick={() => setIsTerminalOpen(true)}
                className={cn(
                  "group inline-flex min-w-[100px] flex-col gap-1 rounded-lg border px-3 py-2 transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-sm bg-card text-foreground"
                )}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Terminal className="h-4 w-4" />
                  <span>Logs</span>
                </div>
                <p className="text-xs leading-tight text-muted-foreground">
                  Ver terminal
                </p>
              </button>
            </div>
          </div>
        </header>
      )}

      <main className={cn("flex-1", isMobile ? "pb-16" : "pb-10")}>{children}</main>

      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-around px-4">
            {links.map((link) => (
              <NavButton
                key={link.href}
                link={link}
                isActive={
                  link.href === "/"
                    ? location === "/"
                    : location.startsWith(link.href)
                }
                isMobile={true}
              />
            ))}
            <button
              onClick={() => setIsTerminalOpen(true)}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors text-muted-foreground hover:text-foreground"
            >
              <Terminal className="h-5 w-5" />
              <span className="text-[10px] font-medium">Logs</span>
            </button>
          </div>
        </nav>
      )}

      <Sheet open={isTerminalOpen} onOpenChange={setIsTerminalOpen}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "h-[80vh]" : "w-[600px] sm:w-[540px]"}>
          <SheetHeader>
            <SheetTitle>Logs do Sistema</SheetTitle>
            <SheetDescription>
              Acompanhe as atividades do servidor em tempo real.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 h-[calc(100%-80px)]">
             <LogTerminal className="h-full" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

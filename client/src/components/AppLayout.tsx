import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Bot, Boxes, NotebookPen, Terminal, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import LogTerminal from "@/components/LogTerminal";
import { AnimatePresence, motion } from "framer-motion";

type NavLink = {
  href: string;
  label: string;
  description: string;
  icon: typeof Bot;
};

const links: NavLink[] = [
  {
    href: "/",
    label: "Chat",
    description: "AI Assistant",
    icon: Bot,
  },
  {
    href: "/catalogo",
    label: "Catalog",
    description: "Manage Items",
    icon: Boxes,
  },
  {
    href: "/instrucoes",
    label: "System",
    description: "Global Prompts",
    icon: NotebookPen,
  },
];

function NavButton({ link, isActive, isMobile }: { link: NavLink; isActive: boolean; isMobile: boolean }) {
  const Icon = link.icon;

  if (isMobile) {
    return (
      <Link href={link.href}>
        <div className={cn(
          "relative flex flex-col items-center justify-center gap-1 py-1 px-3 transition-all duration-300",
          isActive ? "text-primary scale-110" : "text-muted-foreground/60 hover:text-foreground"
        )}>
          {isActive && (
            <motion.div
              layoutId="mobileEnv"
              className="absolute inset-0 bg-primary/10 blur-xl rounded-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
          <Icon className={cn("h-6 w-6 z-10", isActive && "drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]")} />
          <span className="text-[10px] font-medium z-10">{link.label}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link href={link.href}>
      <div className={cn(
        "group relative flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 overflow-hidden",
        isActive
          ? "text-primary-foreground bg-primary/90 shadow-[0_0_15px_rgba(59,130,246,0.4)]"
          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
      )}>
        {isActive && (
          <motion.div
            layoutId="desktopNav"
            className="absolute inset-0 bg-gradient-to-r from-primary/80 to-blue-600 z-0"
            initial={false}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
        <Icon className="h-4 w-4 z-10 relative" />
        <span className="text-sm font-medium z-10 relative">{link.label}</span>
      </div>
    </Link>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-transparent">
      {/* Desktop/Tablet Navbar */}
      {!isMobile && (
        <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4">
          <div className="glass rounded-full px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">
                  AgroRemoto
                </h1>
              </div>
            </div>

            <nav className="flex items-center gap-1 bg-black/5 rounded-full p-1 border border-black/5 dark:bg-white/5 dark:border-white/5 backdrop-blur-sm">
              {links.map((link) => (
                <NavButton
                  key={link.href}
                  link={link}
                  isActive={link.href === "/" ? location === "/" : location.startsWith(link.href)}
                  isMobile={false}
                />
              ))}
            </nav>

            <button
              onClick={() => setIsTerminalOpen(true)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
            >
              <Terminal className="h-5 w-5" />
            </button>
          </div>
        </header>
      )}

      {/* Main Content with Transition */}
      <main className={cn(
        "flex-1 relative w-full h-full overflow-hidden",
        !isMobile ? "pt-24 pb-6" : "pb-20"
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="h-full w-full overflow-y-auto no-scrollbar px-4 md:px-0"
          >
            <div className="max-w-5xl mx-auto h-full">
              {children}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <nav className="fixed bottom-4 left-4 right-4 z-50">
          <div className="glass rounded-2xl p-2 flex items-center justify-around shadow-2xl border-white/20">
            {links.map((link) => (
              <NavButton
                key={link.href}
                link={link}
                isActive={link.href === "/" ? location === "/" : location.startsWith(link.href)}
                isMobile={true}
              />
            ))}
            <button
              onClick={() => setIsTerminalOpen(true)}
              className="flex flex-col items-center justify-center gap-1 py-1 px-3 text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <Terminal className="h-6 w-6" />
              <span className="text-[10px] font-medium">Logs</span>
            </button>
          </div>
        </nav>
      )}

      <Sheet open={isTerminalOpen} onOpenChange={setIsTerminalOpen}>
        <SheetContent side={isMobile ? "bottom" : "right"} className="glass border-l-white/10 w-full sm:w-[540px] p-0">
          <div className="h-full flex flex-col p-6">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-2xl font-display">System Logs</SheetTitle>
              <SheetDescription>
                Real-time server activity monitoring.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 rounded-xl overflow-hidden border border-white/10 bg-black/40 shadow-inner">
              <LogTerminal className="h-full" />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}


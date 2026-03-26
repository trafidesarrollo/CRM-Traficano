import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Inbox, 
  Briefcase, 
  Users, 
  Contact2, 
  UserSquare, 
  Package, 
  UploadCloud, 
  Mail, 
  Bot, 
  Settings,
  LogOut,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/emails", label: "Emails", icon: Inbox },
  { href: "/opportunities", label: "Oportunidades", icon: Briefcase },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/contacts", label: "Contactos", icon: Contact2 },
  { href: "/salespeople", label: "Vendedores", icon: UserSquare },
  { href: "/products", label: "Productos", icon: Package },
  { href: "/imports", label: "Importar CSV", icon: UploadCloud },
  { href: "/gmail", label: "Gmail Sync", icon: Mail },
  { href: "/prompts", label: "Prompts IA", icon: Bot },
  { href: "/users", label: "Usuarios", icon: Settings, adminOnly: true },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const NavLinks = () => (
    <nav className="space-y-1 mt-6">
      {navItems.map((item) => {
        if (item.adminOnly && user?.role !== "admin") return null;
        const isActive = location.startsWith(item.href);
        return (
          <Link 
            key={item.href} 
            href={item.href}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
              ${isActive 
                ? 'bg-primary/10 text-primary font-medium' 
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              }
            `}
          >
            <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-primary' : 'group-hover:text-foreground'}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 flex-col bg-card border-r border-border/50 p-4 sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center gap-3 px-2 py-4">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-8 h-8 rounded-lg" />
          <span className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">CRM</span>
        </div>
        
        <div className="flex-1">
          <NavLinks />
        </div>

        <div className="mt-auto pt-4 border-t border-border/50">
          <div className="flex items-center gap-3 px-2 py-3 mb-2 rounded-xl bg-white/5">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {user?.fullName.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border/50 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-8 h-8 rounded-lg" />
          <span className="font-display font-bold text-lg">CRM</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-card border-r-0 p-4">
            <NavLinks />
            <div className="absolute bottom-4 left-4 right-4">
               <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

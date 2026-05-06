import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Users,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const titleMap: Record<string, string> = {
  "/": "Dashboard",
  "/invoices": "Invoices",
  "/payments": "Payments",
  "/clients": "Clients",
  "/settings": "Settings",
};

const AppLayout = () => {
  const { pathname } = useLocation();
  const title = titleMap[pathname] ?? (pathname.startsWith("/invoices") ? "Invoice Detail" : "Invoize");

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 gap-2">
        <div className="flex items-center gap-2 px-2 py-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-sidebar-foreground leading-tight">Invoize</p>
            <p className="text-[11px] text-muted-foreground">Mini ERP</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-md"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-xl p-3 bg-accent/60 text-xs text-accent-foreground">
          <p className="font-medium">Receipt & Reconciliation</p>
          <p className="text-muted-foreground mt-0.5">Otomatis update status invoice setiap pembayaran masuk.</p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              <p className="text-xs text-muted-foreground">Payment & Receipt management</p>
            </div>
          </div>
        </header>
        <div className="flex-1 p-6 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  FolderOpen,
  Database,
  GitBranch,
  Beaker,
  BarChart3,
  Link as LinkIcon,
  Webhook,
  Settings,
  Users,
  ScrollText,
  LogOut,
  Menu,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuthStore } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

function extractSlug(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (
    segments.length >= 1 &&
    segments[0] !== "projects" &&
    segments[0] !== "admin"
  ) {
    return segments[0];
  }
  return null;
}

function getProjectNav(slug: string): NavItem[] {
  return [
    { label: "Overview", href: `/${slug}`, icon: FolderOpen, exact: true },
    { label: "Memories", href: `/${slug}/memories`, icon: Database },
    { label: "Graph", href: `/${slug}/graph`, icon: GitBranch },
    { label: "Playground", href: `/${slug}/playground`, icon: Beaker },
    { label: "Analytics", href: `/${slug}/analytics`, icon: BarChart3 },
    { label: "MCP", href: `/${slug}/mcp`, icon: LinkIcon },
    { label: "Webhooks", href: `/${slug}/webhooks`, icon: Webhook },
    { label: "Docs", href: `/${slug}/docs`, icon: BookOpen },
    { label: "Settings", href: `/${slug}/settings`, icon: Settings },
  ];
}

const adminNav: NavItem[] = [
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
];

function NavLink({ item, pathname, exact }: { item: NavItem; pathname: string; exact?: boolean }) {
  const Icon = item.icon;
  const isActive = exact
    ? pathname === item.href
    : pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(item.href + "/"));

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function SidebarContent() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const slug = extractSlug(pathname);
  const isAdmin = user?.is_superadmin;

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center px-4">
        <Link href="/projects" className="flex items-center gap-2">
          <Brain className="size-6 text-primary" />
          <span className="text-lg font-bold">SidMemo</span>
        </Link>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {/* Projects link */}
        <NavLink
          item={{ label: "Projects", href: "/projects", icon: FolderOpen }}
          pathname={pathname}
        />

        {/* Current project navigation */}
        {slug && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {slug}
              </p>
            </div>
            {getProjectNav(slug).map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} exact={item.exact} />
            ))}
          </>
        )}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Admin
              </p>
            </div>
            {adminNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </>
        )}
      </nav>

      <Separator />

      {/* User menu */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            title="Logout"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-background md:block">
        <SidebarContent />
      </aside>

      {/* Mobile trigger + sheet */}
      <div className="fixed top-0 left-0 z-40 flex h-14 w-full items-center border-b bg-background px-4 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div onClick={() => setOpen(false)}>
              <SidebarContent />
            </div>
          </SheetContent>
        </Sheet>
        <Link href="/projects" className="ml-2 flex items-center gap-2">
          <Brain className="size-5 text-primary" />
          <span className="font-bold">SidMemo</span>
        </Link>
      </div>
    </>
  );
}

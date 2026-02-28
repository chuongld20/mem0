"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "General", href: "" },
  { label: "Members", href: "/members" },
  { label: "API Keys", href: "/api-keys" },
  { label: "Configuration", href: "/config" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const basePath = `/${slug}/settings`;

  function isActive(href: string) {
    const full = basePath + href;
    if (href === "") {
      return pathname === basePath || pathname === basePath + "/";
    }
    return pathname.startsWith(full);
  }

  return (
    <div className="flex gap-8">
      <nav className="w-48 shrink-0 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={basePath + item.href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

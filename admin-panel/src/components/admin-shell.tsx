"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useEffect } from "react";
import {
  Banknote,
  BarChart3,
  Building2,
  ClipboardCheck,
  FileCheck,
  FileSearch,
  Coins,
  LayoutDashboard,
  Landmark,
  LayoutGrid,
  LogOut,
  Map,
  Package,
  PackagePlus,
  ScrollText,
  Settings,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import {
  canViewCouriers,
  canViewCourierEarnings,
  canViewCustomers,
  canViewFinance,
  canViewReports,
  canManageBranding,
  canViewUsers,
  isCustomerRole,
} from "@/lib/auth-storage";
import { BrandingMark } from "@/components/branding-mark";
import { roleLabel } from "@/lib/role-labels";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roleCheck?: (role: string) => boolean;
  /** Yan menüde üst başlık (önceki öğeden farklıysa gösterilir) */
  section?: string;
};

function navItemsForRole(role: string): NavItem[] {
  if (isCustomerRole(role)) {
    return [
      { href: "/dashboard", label: "Özet", icon: LayoutDashboard },
      { href: "/orders/new", label: "Yeni sipariş", icon: PackagePlus },
      { href: "/orders", label: "Siparişlerim", icon: Package },
    ];
  }
  return [
    { href: "/dashboard", label: "Özet", icon: LayoutDashboard },
    {
      href: "/operations",
      label: "Operasyon",
      icon: LayoutGrid,
      roleCheck: canViewCouriers,
    },
    { href: "/orders", label: "Siparişler", icon: Package },
    {
      href: "/customers",
      label: "Müşteriler",
      icon: Building2,
      roleCheck: canViewCustomers,
    },
    {
      href: "/couriers",
      label: "Kuryeler",
      icon: Truck,
      roleCheck: canViewCouriers,
    },
    {
      href: "/couriers/registrations",
      label: "Kurye başvuruları",
      icon: ClipboardCheck,
      roleCheck: canViewCouriers,
    },
    {
      href: "/couriers/awaiting-documents",
      label: "Evrak yükleyenler",
      icon: FileCheck,
      roleCheck: canViewCouriers,
    },
    {
      href: "/couriers/document-review",
      label: "Evrak incelemesi",
      icon: FileSearch,
      roleCheck: canViewCouriers,
    },
    {
      href: "/couriers/map",
      label: "Operasyon haritası",
      icon: Map,
      roleCheck: canViewCouriers,
    },
    {
      href: "/finance/accounts",
      label: "Cari hesaplar",
      icon: Wallet,
      section: "Finans",
      roleCheck: canViewFinance,
    },
    {
      href: "/finance/transactions",
      label: "İşlem geçmişi",
      icon: ScrollText,
      roleCheck: canViewFinance,
    },
    {
      href: "/finance/pricing",
      label: "Fiyat kuralları",
      icon: Coins,
      section: "Finans",
      roleCheck: canViewCustomers,
    },
    {
      href: "/courier-earnings",
      label: "Kurye hakedişleri",
      icon: Banknote,
      section: "Ödeme",
      roleCheck: canViewCourierEarnings,
    },
    {
      href: "/payout-requests",
      label: "Ödeme talepleri",
      icon: Landmark,
      section: "Ödeme",
      roleCheck: canViewCourierEarnings,
    },
    {
      href: "/reports",
      label: "Raporlar",
      icon: BarChart3,
      roleCheck: canViewReports,
    },
    {
      href: "/users",
      label: "Kullanıcılar",
      icon: Users,
      roleCheck: canViewUsers,
    },
    {
      href: "/settings",
      label: "Marka ayarları",
      icon: Settings,
      roleCheck: canManageBranding,
    },
  ];
}

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (href === "/operations") {
    return pathname === "/operations" || pathname.startsWith("/operations/");
  }
  if (href === "/orders/new") {
    return pathname === "/orders/new";
  }
  if (href === "/orders") {
    if (pathname === "/orders/new") return false;
    return pathname === "/orders" || pathname.startsWith("/orders/");
  }
  if (href === "/couriers/map") {
    return pathname === "/couriers/map";
  }
  if (href === "/couriers/registrations") {
    return pathname === "/couriers/registrations";
  }
  if (href === "/couriers") {
    if (pathname === "/couriers/map") return false;
    if (pathname.startsWith("/couriers/registrations")) return false;
    return pathname === "/couriers" || pathname.startsWith("/couriers/");
  }
  if (href === "/customers") {
    return pathname === "/customers" || pathname.startsWith("/customers/");
  }
  if (href === "/finance/accounts") {
    return (
      pathname === "/finance/accounts" ||
      pathname.startsWith("/finance/accounts/")
    );
  }
  if (href === "/finance/transactions") {
    return pathname === "/finance/transactions";
  }
  if (href === "/finance/pricing") {
    return pathname === "/finance/pricing";
  }
  if (href === "/courier-earnings") {
    return (
      pathname === "/courier-earnings" ||
      pathname.startsWith("/courier-earnings/")
    );
  }
  if (href === "/payout-requests") {
    return (
      pathname === "/payout-requests" ||
      pathname.startsWith("/payout-requests/")
    );
  }
  if (href === "/reports") {
    return pathname === "/reports";
  }
  if (href === "/settings") {
    return pathname === "/settings";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, logout } = useAuth();

  const nav = useMemo(
    () => navItemsForRole(user?.role ?? ""),
    [user?.role],
  );

  const portalSubtitle = user?.role && isCustomerRole(user.role)
    ? "Müşteri portalı"
    : "Operasyon paneli";

  useEffect(() => {
    if (!token) {
      router.replace("/login");
    }
  }, [token, router]);

  if (!token) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="bg-card text-sidebar-foreground sticky top-0 flex h-screen w-[15.5rem] shrink-0 flex-col border-r border-border/70 md:w-64 xl:w-[17rem]">
        <div className="border-border/60 border-b px-5 py-8">
          <BrandingMark variant="sidebar" />
          <p className="text-muted-foreground mt-4 text-[11px] font-medium tracking-wide uppercase">
            {portalSubtitle}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
          {(() => {
            let lastSection: string | undefined;
            return nav.map((item) => {
              if (item.roleCheck && user && !item.roleCheck(user.role)) {
                return null;
              }
              const Icon = item.icon;
              const active = isNavActive(pathname, item.href);
              const showSection =
                item.section && item.section !== lastSection
                  ? item.section
                  : null;
              if (item.section) lastSection = item.section;
              return (
                <div key={item.href} className="flex flex-col gap-1">
                  {showSection ? (
                    <p className="text-muted-foreground px-3 pt-4 pb-2 text-[10px] font-semibold tracking-[0.12em] uppercase">
                      {showSection}
                    </p>
                  ) : null}
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors duration-150",
                      active
                        ? "bg-primary/8 text-foreground shadow-[inset_0_0_0_1px_oklch(0.13_0_0/0.06)] dark:bg-primary/15 dark:shadow-[inset_0_0_0_1px_oklch(1_0_0/0.08)]"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-[15px] shrink-0 opacity-70" />
                    {item.label}
                  </Link>
                </div>
              );
            });
          })()}
        </nav>
        <div className="border-border/60 mt-auto border-t p-4">
          <p className="text-muted-foreground truncate text-xs font-medium leading-relaxed">
            {user?.email}
          </p>
          <p className="text-muted-foreground mt-1 text-[10px] font-medium tracking-wide uppercase">
            {user?.role ? roleLabel(user.role) : ""}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full border-border/80 bg-background/80 text-[13px]"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            <LogOut className="size-3.5" />
            Çıkış
          </Button>
        </div>
      </aside>
      <div className="relative min-h-screen min-w-0 flex-1 bg-muted/25">
        <main className="mx-auto w-full min-w-0 max-w-[1920px] px-8 py-10 md:px-12 md:py-12 lg:px-14 lg:py-14 xl:px-16 xl:py-16 2xl:px-20 2xl:py-[4.5rem]">
          {children}
        </main>
      </div>
    </div>
  );
}

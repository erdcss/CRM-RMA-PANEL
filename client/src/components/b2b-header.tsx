import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { LogIn, PackageSearch, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { useBranding } from "@/hooks/use-branding";

type SessionUser = {
  id: number;
  username: string;
  role: string;
  appAccess: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
};

async function loadSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (response.status === 401) return null;
  if (!response.ok) return null;
  return response.json();
}

export function B2BHeader({ middle }: { middle?: ReactNode }) {
  const { data: branding } = useBranding();
  const { data: session } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: loadSession,
    retry: false,
    staleTime: 15_000,
  });

  const loggedIn =
    session?.role === "b2b_customer" &&
    session?.isActive === true;

  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center">
          <img
            src={branding?.b2b_logo || BRAND.logoLarge}
            alt="Çalışkan B2B"
            className="h-12 w-auto max-w-[180px] object-contain object-left sm:h-14 sm:max-w-[220px]"
          />
        </Link>

        {middle ? <div className="mx-auto hidden w-full max-w-2xl md:block">{middle}</div> : <div className="flex-1" />}

        {loggedIn ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost" className="px-2 sm:px-4">
              <Link href="/siparislerim" aria-label="Siparişler">
                <PackageSearch className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Siparişler</span>
              </Link>
            </Button>
            <Button asChild className="bg-slate-950 px-2 hover:bg-slate-800 sm:px-4">
              <Link href="/hesabim" aria-label="Hesabım">
                <UserRound className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Hesabım</span>
              </Link>
            </Button>
          </div>
        ) : (
          <Button asChild className="ml-auto shrink-0 bg-slate-950 hover:bg-slate-800">
            <Link href="/uye-girisi">
              <LogIn className="mr-2 h-4 w-4" />
              Giriş Yap
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}

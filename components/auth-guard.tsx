"use client";
import { ReactNode, useContext, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AuthContext } from "./auth-provider";
import { Loader } from "lucide-react";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const user = useContext(AuthContext);
  const router = useRouter();
  const pathname = usePathname();

  const isLoginRoute = useMemo(() => pathname.startsWith("/login"), [pathname]);

  useEffect(() => {
    if (user === null && !isLoginRoute) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, isLoginRoute, router, pathname]);

  if (user === undefined || (user === null && !isLoginRoute)) {
    return (
      <div className="flex items-center gap-2 p-6 text-xs xl:text-sm text-muted-foreground">
        <Loader className="h-4 w-4 animate-spin" />
        <span>Verifying your session…</span>
      </div>
    );
  }

  return <>{children}</>;
}

"use client";
import { ReactNode, useContext, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AuthContext } from "./auth-provider";

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

  if (user === undefined && !isLoginRoute) {
    return <div className="p-6 text-sm opacity-70">Checking your session…</div>;
  }

  return <>{children}</>;
}

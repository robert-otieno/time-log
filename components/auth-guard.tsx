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
      <div className="flex p-6 text-sm opacity-70">
        Checking your session… <Loader className="pl-2 animate-spin" />{" "}
      </div>
    );
  }

  return <>{children}</>;
}

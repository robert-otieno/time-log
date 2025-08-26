"use client";

import { ReactNode, useContext, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AuthContext } from "./auth-provider";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const user = useContext(AuthContext);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (user === null) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, router, pathname]);

  if (user === undefined || user === null) {
    return null;
  }

  return <>{children}</>;
}

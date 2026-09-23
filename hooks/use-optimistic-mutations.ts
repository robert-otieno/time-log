"use client";

import { useCallback, useReducer, useRef } from "react";
import { toast } from "sonner";
import { OptimisticMutationRegistry } from "@/lib/optimistic-mutation";

type OptimisticMutation<S, T> = {
  scope: string;
  operation: string;
  snapshot(): S;
  optimistic(): void;
  request(): Promise<T>;
  reconcile(result: T): void;
  rollback(snapshot: S): void;
  errorMessage(error: unknown): string;
  retry?: boolean | ((error: unknown) => boolean);
  onError?(message: string): void;
};

export function useOptimisticMutations() {
  const registry = useRef(new OptimisticMutationRegistry());
  const [, render] = useReducer((value: number) => value + 1, 0);

  const run = useCallback(async function execute<S, T>(mutation: OptimisticMutation<S, T>): Promise<boolean> {
    const token = registry.current.begin(mutation.scope, mutation.operation);
    if (!token) return false;
    const snapshot = mutation.snapshot();
    mutation.optimistic();
    render();
    try {
      const result = await mutation.request();
      if (registry.current.isCurrent(token)) mutation.reconcile(result);
      return true;
    } catch (error) {
      if (registry.current.isCurrent(token)) mutation.rollback(snapshot);
      const message = mutation.errorMessage(error);
      mutation.onError?.(message);
      const canRetry = typeof mutation.retry === "function" ? mutation.retry(error) : mutation.retry;
      toast.error(message, canRetry ? { action: { label: "Retry", onClick: () => void execute(mutation) } } : undefined);
      return false;
    } finally {
      registry.current.finish(token);
      render();
    }
  }, []);

  return {
    run,
    isPending: (scope: string) => registry.current.isPending(scope),
  };
}

export function requireActionSuccess<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

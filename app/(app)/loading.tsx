import { Skeleton } from "@/components/ui/skeleton";

export default function AuthenticatedLoading() {
  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6" aria-label="Loading page"><Skeleton className="h-9 w-56" /><Skeleton className="h-5 w-full max-w-md" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-36 rounded-xl" />)}</div></main>;
}

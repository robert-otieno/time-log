import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectLoading() {
  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6" aria-label="Loading project"><div className="space-y-3"><Skeleton className="h-4 w-20" /><Skeleton className="h-9 w-64" /><Skeleton className="h-10 w-full max-w-2xl" /></div><div className="space-y-3"><Skeleton className="h-24 rounded-lg" /><Skeleton className="h-24 rounded-lg" /><Skeleton className="h-24 rounded-lg" /></div></main>;
}

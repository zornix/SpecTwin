import { Container } from "@/components/common/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function ResultsLoading() {
  return (
    <Container className="py-12 sm:py-16">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Skeleton className="mt-10 h-64 w-full rounded-xl" />

      <Skeleton className="mt-12 h-6 w-48" />
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-80 w-full rounded-xl" />
        ))}
      </div>
    </Container>
  );
}

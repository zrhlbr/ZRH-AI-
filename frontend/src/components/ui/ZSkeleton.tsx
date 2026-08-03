/** ZRH Skeleton — 统一加载骨架 */
export function ZSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`zrh-skeleton rounded-lg ${className}`}
      aria-hidden
    />
  );
}

export function ZSkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <ZSkeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

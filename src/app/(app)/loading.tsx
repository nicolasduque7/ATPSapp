export default function Loading(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-40 animate-pulse rounded-full bg-card motion-reduce:animate-none" />
        <div className="h-4 w-56 animate-pulse rounded-full bg-card motion-reduce:animate-none" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-3xl bg-card motion-reduce:animate-none" />
        ))}
      </div>

      <div className="h-28 animate-pulse rounded-3xl bg-card motion-reduce:animate-none" />
      <div className="h-48 animate-pulse rounded-3xl bg-card motion-reduce:animate-none" />
    </div>
  );
}

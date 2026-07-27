export default function Loading(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-40 animate-pulse rounded-full bg-card motion-reduce:animate-none" />
        <div className="h-4 w-64 animate-pulse rounded-full bg-card motion-reduce:animate-none" />
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}

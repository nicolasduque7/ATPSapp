interface LocationTagProps {
  name: string;
}

export function LocationTag({ name }: LocationTagProps): React.JSX.Element {
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-primary/30 px-2.5 py-0.5 text-xs font-medium text-primary">
      {name}
    </span>
  );
}

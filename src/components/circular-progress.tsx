interface CircularProgressProps {
  value: number
  total: number
  size?: number
  strokeWidth?: number
}

export function CircularProgress({
  value,
  total,
  size = 72,
  strokeWidth = 8,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const fraction = total > 0 ? Math.min(1, value / total) : 0
  const offset = circumference * (1 - fraction)
  const center = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label={`${value} of ${total} classes completed today`}
    >
      <g transform={`rotate(-90 ${center} ${center})`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </g>
    </svg>
  )
}

interface ClassesRingStatProps {
  completed: number
  remaining: number
  size?: number
  strokeWidth?: number
}

export function ClassesRingStat({
  completed,
  remaining,
  size = 72,
  strokeWidth = 8,
}: ClassesRingStatProps) {
  const total = completed + remaining
  const numberFontSize = size * 0.32
  const labelFontSize = size * 0.15

  return (
    <div className="flex items-center gap-4">
      <CircularProgress value={completed} total={total} size={size} strokeWidth={strokeWidth} />
      <div className="flex flex-col justify-between" style={{ height: size }}>
        <div>
          <p
            className="font-heading font-bold text-foreground leading-none"
            style={{ fontSize: numberFontSize }}
          >
            {completed}
          </p>
          <p
            className="text-muted-foreground leading-tight"
            style={{ fontSize: labelFontSize }}
          >
            Completed
          </p>
        </div>
        <div>
          <p
            className="font-heading font-bold text-foreground leading-none"
            style={{ fontSize: numberFontSize }}
          >
            {remaining}
          </p>
          <p
            className="text-muted-foreground leading-tight"
            style={{ fontSize: labelFontSize }}
          >
            Remaining
          </p>
        </div>
      </div>
    </div>
  )
}

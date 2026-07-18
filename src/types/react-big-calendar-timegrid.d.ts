// react-big-calendar doesn't publicly export TimeGrid from its package root —
// it's only reachable via this subpath, which has no bundled or DefinitelyTyped
// declarations. This is the documented pattern for building a custom view
// (e.g. a 3-day view) on top of RBC's own time-grid renderer.
declare module "react-big-calendar/lib/TimeGrid" {
  import type { ComponentType } from "react"

  const TimeGrid: ComponentType<Record<string, unknown>>
  export default TimeGrid
}

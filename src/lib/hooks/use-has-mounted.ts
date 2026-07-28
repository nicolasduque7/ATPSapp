import { useSyncExternalStore } from "react"

const emptySubscribe = () => () => {}

// Matches the server-rendered output on first hydration (false), then flips
// to true once mounted client-side — avoids hydration mismatches from
// client-only or timezone-sensitive values without a setState-in-effect
// anti-pattern.
export function useHasMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

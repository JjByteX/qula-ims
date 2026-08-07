// Required by Next.js for every parallel route slot: without a
// default.tsx, navigating to any route that isn't the intercepted
// /projects/[id] (e.g. going straight to /dashboard, /projects, /users)
// leaves the @modal slot with nothing to render for that URL and Next
// falls back to a 404 for the slot. Rendering null here just means "no
// modal on this route."
export default function Default() {
  return null;
}

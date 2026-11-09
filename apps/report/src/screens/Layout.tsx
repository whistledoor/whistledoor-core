import { Outlet } from '@tanstack/react-router';

/** Each screen brings its own shell: the start page, the four steps and the rest differ. */
export function Layout() {
  return <Outlet />;
}

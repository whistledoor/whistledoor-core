import { createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Case } from './screens/Case';
import { Confirm } from './screens/Confirm';
import { Kind } from './screens/Kind';
import { Layout } from './screens/Layout';
import { ReturnCode } from './screens/ReturnCode';
import { Sent } from './screens/Sent';
import { ShowCode } from './screens/ShowCode';
import { Start } from './screens/Start';
import { Write } from './screens/Write';

const root = createRootRoute({ component: Layout });

const screens = [
  ['/', Start],
  ['/kind', Kind],
  ['/write', Write],
  ['/code', ShowCode],
  ['/confirm', Confirm],
  ['/sent', Sent],
  ['/return', ReturnCode],
  ['/case', Case],
] as const;

// Memory history: the URL stays `/`, and a reload returns to the start with nothing
// kept. The fragment stays free for the poster's `#fp=`.
export const router = createRouter({
  routeTree: root.addChildren(
    screens.map(([path, component]) => createRoute({ getParentRoute: () => root, path, component })),
  ),
  history: createMemoryHistory({ initialEntries: ['/'] }),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

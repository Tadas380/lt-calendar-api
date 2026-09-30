import { createServer } from 'node:http';
import { handler } from './app.ts';

const port = Number(process.env.PORT ?? 3000);

const server = createServer(handler);
server.listen(port, () => {
  console.log(`LT Calendar API running on http://localhost:${port}`);
});

// Shut down cleanly when the host stops the process (e.g. Render deploys).
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

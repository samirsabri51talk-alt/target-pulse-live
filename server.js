import express from 'express';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;
const dataFile = process.env.DATA_FILE || join(root, 'data', 'state.json');
const defaultState = { remaining: 165, updatedAt: new Date().toISOString() };

async function readState() {
  try {
    const parsed = JSON.parse(await readFile(dataFile, 'utf8'));
    if (!Number.isSafeInteger(parsed.remaining) || parsed.remaining < 0) throw new Error('Invalid state');
    return parsed;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await saveState(defaultState);
    return { ...defaultState };
  }
}

async function saveState(state) {
  await mkdir(dirname(dataFile), { recursive: true });
  const temporaryFile = `${dataFile}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(state, null, 2), 'utf8');
  await rename(temporaryFile, dataFile);
}

let state = await readState();
let writes = Promise.resolve();

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use(express.static(join(root, 'public'), { extensions: ['html'], maxAge: '1h' }));

app.get('/api/state', (_request, response) => {
  response.set('Cache-Control', 'no-store');
  response.json(state);
});

app.post('/api/orders/decrement', async (_request, response, next) => {
  try {
    const operation = writes.then(async () => {
      if (state.remaining === 0) return state;
      const nextState = { remaining: state.remaining - 1, updatedAt: new Date().toISOString() };
      await saveState(nextState);
      state = nextState;
      return state;
    });
    writes = operation.catch(() => {});
    response.json(await operation);
  } catch (error) {
    next(error);
  }
});

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ message: 'Unable to update the live counter. Please try again.' });
});

app.listen(port, () => console.log(`Live countdown is running on port ${port}`));

import Resolver from '@forge/resolver';
import { storage } from '@forge/api';

const resolver = new Resolver();

resolver.define('getText', (req) => {
  return 'Hello, world!';
});

resolver.define('getBestScore', async (req) => {
  const bestScore = await storage.get('bestScore');
  return bestScore || 0;
});

resolver.define('setBestScore', async (req) => {
  const { score } = req.payload;
  await storage.set('bestScore', score);
  return { success: true };
});

export const handler = resolver.getDefinitions();

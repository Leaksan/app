import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // GET - chercher des users par préfixe
  if (req.method === 'GET') {
    const { q = '' } = req.query;
    const all = await kv.smembers('users') || [];
    const filtered = q
      ? all.filter(u => u.toLowerCase().startsWith(q.toLowerCase())).slice(0, 6)
      : all.slice(0, 6);
    return res.status(200).json(filtered);
  }

  // POST - enregistrer un user
  if (req.method === 'POST') {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Manque username' });
    await kv.sadd('users', username);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
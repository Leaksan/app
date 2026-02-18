import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // GET - liste des bannis
  if (req.method === 'GET') {
    const banned = await kv.smembers('banned') || [];
    return res.status(200).json({ banned });
  }

  // POST - bannir un user
  if (req.method === 'POST') {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username requis' });
    await kv.sadd('banned', username);
    return res.status(200).json({ ok: true });
  }

  // DELETE - débannir un user
  if (req.method === 'DELETE') {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username requis' });
    await kv.srem('banned', username);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
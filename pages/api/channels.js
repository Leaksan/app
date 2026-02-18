import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const channels = await kv.lrange('channels', 0, -1) || [];
    return res.status(200).json(channels);
  }

  if (req.method === 'POST') {
    const { name, description = '' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nom requis' });

    const channel = {
      id: name.trim().toLowerCase().replace(/\s+/g, '-'),
      name: name.trim(),
      description,
      createdAt: Date.now()
    };

    const existing = await kv.lrange('channels', 0, -1) || [];
    if (existing.find(c => c.id === channel.id)) {
      return res.status(400).json({ error: 'Salon déjà existant' });
    }

    await kv.rpush('channels', channel);
    return res.status(201).json(channel);
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    const channels = await kv.lrange('channels', 0, -1) || [];
    const filtered = channels.filter(c => c.id !== id);
    await kv.del('channels');
    if (filtered.length > 0) await kv.rpush('channels', ...filtered);
    await kv.del('posts:' + id);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
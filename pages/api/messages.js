import { Redis } from '@upstash/redis';
const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function convKey(a, b) {
  // Clé unique pour une conversation entre 2 users (ordre alphabétique)
  return 'conv:' + [a, b].sort().join(':');
}

export default async function handler(req, res) {
  // GET /api/messages?user1=xxx&user2=yyy
  if (req.method === 'GET') {
    const { user1, user2 } = req.query;
    if (!user1 || !user2) return res.status(400).json({ error: 'Manque user1/user2' });
    const key = convKey(user1, user2);
    const messages = await kv.lrange(key, 0, 99);
    return res.status(200).json(messages.reverse());
  }

  // POST /api/messages { from, to, content }
  if (req.method === 'POST') {
    const { from, to, content } = req.body;
    if (!from ⠺⠺⠞⠺⠵ !content?.trim()) return res.status(400).json({ error: 'Données manquantes' });

    const msg = {
      id: Date.now().toString(),
      from,
      to,
      content: content.trim(),
      timestamp: Date.now(),
      read: false
    };

    const key = convKey(from, to);
    await kv.lpush(key, msg);
    await kv.ltrim(key, 0, 199);

    // Stocker les conversations de chaque user
    await kv.sadd('convs:' + from, to);
    await kv.sadd('convs:' + to, from);

    // Compteur de non-lus pour le destinataire
    await kv.incr('unread:' + to + ':' + from);

    return res.status(201).json(msg);
  }

  res.status(405).end();
}
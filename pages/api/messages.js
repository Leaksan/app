import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function convKey(a, b) {
  return 'conv:' + [a, b].sort().join(':');
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { user1, user2 } = req.query;
    if (!user1 || !user2) return res.status(400).json({ error: 'Manque user1/user2' });
    const messages = await kv.lrange(convKey(user1, user2), 0, 99) || [];
    return res.status(200).json(messages.reverse());
  }

  if (req.method === 'POST') {
    const { from, to, content, mediaId } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'Données manquantes' });

    const msg = {
      id: uuidv4(),
      from,
      to,
      content: content || '',
      mediaId: mediaId || null,
      timestamp: Date.now(),
    };

    await kv.lpush(convKey(from, to), msg);
    await kv.ltrim(convKey(from, to), 0, 199);
    await kv.sadd('convs:' + from, to);
    await kv.sadd('convs:' + to, from);
    await kv.incr('unread:' + to + ':' + from);

    return res.status(201).json(msg);
  }

  res.status(405).end();
}
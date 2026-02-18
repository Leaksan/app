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
      read: false,
    };

    await kv.lpush(convKey(from, to), msg);
    await kv.ltrim(convKey(from, to), 0, 199);
    await kv.sadd('convs:' + from, to);
    await kv.sadd('convs:' + to, from);
    await kv.incr('unread:' + to + ':' + from);

    return res.status(201).json(msg);
  }

  // PATCH - marquer les messages comme lus
  if (req.method === 'PATCH') {
    const { reader, sender } = req.body;
    if (!reader || !sender) return res.status(400).json({ error: 'Manque reader/sender' });

    const key = convKey(reader, sender);
    const messages = await kv.lrange(key, 0, 199) || [];
    let updated = false;

    const newMessages = messages.map(m => {
      if (m.from === sender && !m.read) {
        updated = true;
        return { ...m, read: true };
      }
      return m;
    });

    if (updated) {
      await kv.del(key);
      if (newMessages.length > 0) await kv.rpush(key, ...newMessages.reverse());
    }

    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
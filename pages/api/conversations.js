import { Redis } from '@upstash/redis';
const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // GET /api/conversations?user=xxx → liste des conversations + nb non lus
  if (req.method === 'GET') {
    const { user } = req.query;
    if (!user) return res.status(400).json({ error: 'Manque user' });

    const contacts = await kv.smembers('convs:' + user) || [];
    const conversations = await Promise.all(contacts.map(async (contact) => {
      const unread = await kv.get('unread:' + user + ':' + contact) || 0;
      return { contact, unread: parseInt(unread) };
    }));

    return res.status(200).json(conversations);
  }

  // POST /api/conversations/read { user, from } → marquer comme lu
  if (req.method === 'POST') {
    const { user, from } = req.body;
    await kv.set('unread:' + user + ':' + from, 0);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
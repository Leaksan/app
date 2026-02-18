import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { channel = 'general' } = req.query;
    const posts = await kv.lrange('posts:' + channel, 0, 99) || [];
    return res.status(200).json(posts);
  }

  if (req.method === 'POST') {
    const { author, avatar, content, channel = 'general' } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Vide' });

    const post = {
      id: uuidv4(),
      author: author || 'Anonyme',
      avatar: avatar || '👤',
      content: content.trim(),
      channel,
      timestamp: Date.now(),
      likes: [],
      comments: []
    };

    await kv.lpush('posts:' + channel, post);
    await kv.ltrim('posts:' + channel, 0, 499);
    return res.status(201).json(post);
  }

  if (req.method === 'DELETE') {
    const { postId, channel = 'general' } = req.body;
    const posts = await kv.lrange('posts:' + channel, 0, 499) || [];
    const filtered = posts.filter(p => p.id !== postId);
    await kv.del('posts:' + channel);
    if (filtered.length > 0) await kv.rpush('posts:' + channel, ...filtered);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
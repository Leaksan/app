import { Redis } from '@upstash/redis';
const kv = new Redis({
  url: process.env.STORAGE_URL,
  token: process.env.STORAGE_TOKEN,
});
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const posts = await kv.lrange('posts', 0, 99);
    return res.status(200).json(posts);
  }

  if (req.method === 'POST') {
    const { author, avatar, content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Vide' });

    const post = {
      id: uuidv4(),
      author: author || 'Anonyme',
      avatar: avatar || '👤',
      content: content.trim(),
      timestamp: Date.now(),
      likes: [],
      comments: []
    };

    await kv.lpush('posts', post);
    await kv.ltrim('posts', 0, 499);
    return res.status(201).json(post);
  }

  res.status(405).end();
}
import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { postId, author, avatar, content, channel = 'general' } = req.body;

  if (!content?.trim()) return res.status(400).json({ error: 'Commentaire vide' });

  const posts = await kv.lrange('posts:' + channel, 0, 499) || [];
  const idx = posts.findIndex(p => p.id === postId);
  if (idx === -1) return res.status(404).json({ error: 'Post introuvable' });

  const post = posts[idx];
  post.comments.push({
    id: uuidv4(),
    author: author || 'Anonyme',
    avatar: avatar || '👤',
    content: content.trim(),
    timestamp: Date.now()
  });

  await kv.lset('posts:' + channel, idx, post);
  res.status(201).json({ ok: true });
}
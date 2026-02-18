import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { postId, author, avatar, content } = req.body;

  const posts = await kv.lrange('posts', 0, 499);
  const idx = posts.findIndex(p => p.id === postId);
  if (idx === -1) return res.status(404).end();

  const post = posts[idx];
  post.comments.push({
    id: uuidv4(),
    author: author || 'Anonyme',
    avatar: avatar || '👤',
    content: content.trim(),
    timestamp: Date.now()
  });

  await kv.lset('posts', idx, post);
  res.status(201).json({ ok: true });
}
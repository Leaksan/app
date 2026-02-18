import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { postId, userId, channel = 'general' } = req.body;

  const posts = await kv.lrange('posts:' + channel, 0, 499) || [];
  const idx = posts.findIndex(p => p.id === postId);
  if (idx === -1) return res.status(404).json({ error: 'Post introuvable' });

  const post = posts[idx];
  const likeIdx = post.likes.indexOf(userId);
  if (likeIdx === -1) post.likes.push(userId);
  else post.likes.splice(likeIdx, 1);

  await kv.lset('posts:' + channel, idx, post);
  res.status(200).json({ likes: post.likes.length, liked: likeIdx === -1 });
}
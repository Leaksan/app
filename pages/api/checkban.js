import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const { username } = req.query;
  if (!username) return res.status(200).json({ banned: false });
  try {
    const banned = await kv.sismember('banned', username);
    return res.status(200).json({ banned: !!banned });
  } catch (e) {
    return res.status(200).json({ banned: false });
  }
}
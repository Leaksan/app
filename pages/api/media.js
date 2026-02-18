import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const EXPIRE_S = 600; // 10 minutes en secondes

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { id, data, type } = req.body;
    if (!id || !data) return res.status(400).json({ error: 'Manque id/data' });

    // Stocker dans KV avec expiration automatique
    await kv.set('media:' + id, JSON.stringify({ data, type }), { ex: EXPIRE_S });
    return res.status(201).json({ ok: true });
  }

  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Manque id' });

    const raw = await kv.get('media:' + id);
    if (!raw) return res.status(404).json({ error: 'Expiré ou introuvable' });

    const media = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return res.status(200).json(media);
  }

  res.status(405).end();
}
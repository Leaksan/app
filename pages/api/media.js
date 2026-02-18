const mediaStore = new Map();
const EXPIRE_MS = 10 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [key, val] of mediaStore.entries()) {
    if (now - val.timestamp > EXPIRE_MS) mediaStore.delete(key);
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};

export default function handler(req, res) {
  cleanup();

  if (req.method === 'POST') {
    const { id, data, type } = req.body;
    if (!id || !data) return res.status(400).json({ error: 'Manque id/data' });
    mediaStore.set(id, { data, type, timestamp: Date.now() });
    setTimeout(() => mediaStore.delete(id), EXPIRE_MS);
    return res.status(201).json({ ok: true });
  }

  if (req.method === 'GET') {
    const { id } = req.query;
    const media = mediaStore.get(id);
    if (!media) return res.status(404).json({ error: 'Expiré' });
    return res.status(200).json(media);
  }

  res.status(405).end();
}
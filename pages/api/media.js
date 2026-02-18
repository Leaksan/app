// Stockage temporaire en mémoire — s'efface automatiquement après 10 min
const mediaStore = new Map();

const EXPIRE_MS = 10 * 60 * 1000; // 10 minutes

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

  // POST — stocker un média temporaire
  if (req.method === 'POST') {
    const { id, data, type, duration } = req.body;
    if (!id || !data) return res.status(400).json({ error: 'Manque id/data' });

    mediaStore.set(id, {
      data,      // base64
      type,      // 'image' ou 'audio'
      duration,  // pour les vocaux
      timestamp: Date.now()
    });

    // Auto-suppression après 10 min
    setTimeout(() => mediaStore.delete(id), EXPIRE_MS);

    return res.status(201).json({ ok: true });
  }

  // GET — récupérer un média
  if (req.method === 'GET') {
    const { id } = req.query;
    const media = mediaStore.get(id);
    if (!media) return res.status(404).json({ error: 'Média expiré ou introuvable' });
    return res.status(200).json(media);
  }

  res.status(405).end();
}
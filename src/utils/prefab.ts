const PREFAB_WEBHOOK_URL = process.env.PREFAB_WEBHOOK_URL;

export async function pushToPrefab(panelType: string, payload: Record<string, unknown>): Promise<void> {
  if (!PREFAB_WEBHOOK_URL) {
    console.warn('[PostCraft] PREFAB_WEBHOOK_URL not set — skipping dashboard push');
    return;
  }

  const body = JSON.stringify({ panel_type: panelType, ...payload });

  try {
    const { default: fetch } = await import('node-fetch');
    const res = await fetch(PREFAB_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    // Retry once
    try {
      const { default: fetch } = await import('node-fetch');
      await fetch(PREFAB_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch (retryErr) {
      console.warn(`[PostCraft] Prefab push failed (panel_type=${panelType}):`, retryErr);
      // Never throw — content is already saved locally
    }
  }
}

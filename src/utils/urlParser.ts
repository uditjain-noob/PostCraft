const MAX_TEXT_CHARS = 8000;

export async function fetchUrlText(url: string): Promise<string> {
  const { default: fetch } = await import('node-fetch');
  const { load } = await import('cheerio');

  const res = await fetch(url, {
    headers: { 'User-Agent': 'PostCraft-MCP/1.0' },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch URL ${url}: HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = load(html);

  // Remove non-content elements
  $('script, style, nav, footer, header, aside, [role="navigation"], [role="banner"]').remove();

  const text = $('article, main, .content, .post-content, body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  return text.slice(0, MAX_TEXT_CHARS);
}

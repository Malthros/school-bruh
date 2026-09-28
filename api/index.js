export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const targetUrl = url.searchParams.get('url');

  // Serve Homepage if no URL parameter is passed
  if (!targetUrl) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cloud Web Proxy</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; margin-top: 100px; background: #0f172a; color: white; }
          input { width: 350px; padding: 12px; font-size: 16px; border-radius: 6px; border: 1px solid #334155; background: #1e293b; color: white; }
          button { padding: 12px 24px; font-size: 16px; border-radius: 6px; background: #3b82f6; color: white; border: none; cursor: pointer; }
          p { color: #94a3b8; font-size: 14px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Web Proxy Project</h1>
        <form action="/" method="GET">
          <input type="text" name="url" placeholder="https://lite.duckduckgo.com/lite/" required />
          <button type="submit">Go</button>
        </form>
        <p>Rewrites search forms automatically to prevent school filter blocks.</p>
      </body>
      </html>
    `);
  }

  try {
    let normalizedTarget = targetUrl;
    if (!normalizedTarget.startsWith('http://') && !normalizedTarget.startsWith('https://')) {
      normalizedTarget = 'https://' + normalizedTarget;
    }

    const response = await fetch(normalizedTarget, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const contentType = response.headers.get('content-type') || '';

    // If HTML, rewrite forms and links so searches stay routed through the proxy
    if (contentType.includes('text/html')) {
      let html = await response.text();
      const targetObj = new URL(normalizedTarget);
      const proxyBase = `https://${req.headers.host}/`;

      // Rewrite search form actions
      html = html.replace(/action=["']([^"']+)["']/g, (match, p1) => {
        try {
          const abs = new URL(p1, targetObj.origin).href;
          return `action="${proxyBase}?url=${encodeURIComponent(abs)}"`;
        } catch (e) { return match; }
      });

      // Rewrite hyperlinks
      html = html.replace(/href=["']([^"']+)["']/g, (match, p1) => {
        if (p1.startsWith('#') || p1.startsWith('javascript:')) return match;
        try {
          const abs = new URL(p1, targetObj.origin).href;
          return `href="${proxyBase}?url=${encodeURIComponent(abs)}"`;
        } catch (e) { return match; }
      });

      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    // Handle standard assets (images, CSS, JS)
    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    return res.status(response.status).send(Buffer.from(buffer));

  } catch (err) {
    return res.status(500).send('Proxy Error: ' + err.message);
  }
}

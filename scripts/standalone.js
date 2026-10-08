import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function standaloneHtml(root) {
  let html = await readFile(resolve(root, 'index.html'), 'utf8');
  html = html.replace('<html lang="ru">', '<html lang="ru" data-offline-file="true">');
  html = html.replace(/<link\b[^>]*rel="manifest"[^>]*>/g, '');
  for (const match of [...html.matchAll(/<script\b[^>]*src="((?:\.\/|\/)assets\/[^"?]+)"[^>]*><\/script>/g)]) {
    const js = await readFile(resolve(root, match[1].replace(/^\//, '')), 'utf8');
    html = html.replace(match[0], () => `<script type="module">${js.replaceAll('</script', '<\\/script')}</script>`);
  }
  for (const match of [...html.matchAll(/<link\b[^>]*href="((?:\.\/|\/)assets\/[^"?]+\.css)"[^>]*>/g)]) {
    const css = await readFile(resolve(root, match[1].replace(/^\//, '')), 'utf8');
    html = html.replace(match[0], () => `<style>${css.replaceAll('</style', '<\\/style')}</style>`);
  }
  for (const match of [...html.matchAll(/href="((?:\.\/|\/)icons\/[^"?]+\.png)"/g)]) {
    const icon = await readFile(resolve(root, match[1].replace(/^\//, '')));
    html = html.replace(match[0], `href="data:image/png;base64,${icon.toString('base64')}"`);
  }
  return html;
}

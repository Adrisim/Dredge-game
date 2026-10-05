// Bundles the Vite build into ONE self-contained HTML file (handy for sharing / hosting anywhere).
// Usage: npm run build:single  ->  dist/hollow-tide.html
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+)"><\/script>\s*/g, '');
const js = [];
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+)">/g, (_, f) => `<style>${fs.readFileSync(path.join(dist, f), 'utf8')}</style>`);
const scriptRe = /<script type="module" crossorigin src="\.\/(assets\/[^"]+)"><\/script>/;
const original = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const m = original.match(scriptRe);
if (!m) throw new Error('could not find module script in dist/index.html');
js.push(fs.readFileSync(path.join(dist, m[1]), 'utf8').replace(/<\/script/gi, '<\\/script'));
const inline = `<script type="module">${js.join('\n')}</script>\n</body>`;
html = html.replace('</body>', () => inline); // function form: the JS contains `$` sequences
html = html.replace(/<link rel="manifest"[^>]*>\s*/g, '');
const out = path.join(dist, 'hollow-tide.html');
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);

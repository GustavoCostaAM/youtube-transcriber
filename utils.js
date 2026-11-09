export function videoId(value) {
  let u; try { u = new URL(value); } catch { throw new Error('Informe um link válido do YouTube.'); }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || u.port) throw new Error('Use um link HTTPS do YouTube.');
  let id;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (['youtube.com','www.youtube.com','m.youtube.com'].includes(host))
    id = u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(shorts|embed|live)\/([^/]+)/.exec(u.pathname)?.[2];
  if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) throw new Error('Não foi possível identificar o vídeo do YouTube.');
  return id;
}
export function stamp(seconds, separator = ',') {
  const ms = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
  return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(n=>String(n).padStart(2,'0')).join(':')+separator+String(ms%1000).padStart(3,'0');
}
export function toSrt(chunks) {
  return chunks.map((c,i)=>`${i+1}\n${stamp(c.timestamp[0])} --> ${stamp(c.timestamp[1])}\n${c.text.trim()}\n`).join('\n');
}


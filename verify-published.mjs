import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export const PAGES='https://gazzaman1.github.io/oasis-watchlive/';
export const SITE='https://oasis.life/watchlive';
export function embedsPage(html){
  const sources=[...html.matchAll(/<iframe\b[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
  return sources.some(src=>{try{return new URL(src).href===PAGES;}catch{return false;}});
}
export async function verifyPublished(fetchText,expected,sleep){
  let reason='';
  for(let n=0;n<3;n++){
    try {
      const page=await fetchText(PAGES);
      const site=await fetchText(SITE);
      if(page!==expected)throw new Error('Pages has not served the expected generated page');
      if(!embedsPage(site))throw new Error('oasis.life is missing the exact Pages iframe URL');
      return true;
    }catch(e){reason=e.message;}
    if(n<2)await sleep(5000*(n+1));
  }
  throw new Error(`Post-publish verification failed: ${reason}. Deployment may already be live; no rollback was performed.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const expected=await readFile('public/index.html','utf8');
  await verifyPublished(async url=>{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.text()},expected,ms=>new Promise(r=>setTimeout(r,ms)));
  console.log('Published Pages HTML and exact parent iframe verified; playback not tested.');
}

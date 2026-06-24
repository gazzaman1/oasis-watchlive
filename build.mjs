import { writeFile, mkdir } from 'node:fs/promises';

// Oasis Church Rockhampton — channel UC_yAZzgTnNNndgiTLeXX1Hg
const API_KEY = process.env.YT_API_KEY;
const UPLOADS_PLAYLIST_ID = 'UU_yAZzgTnNNndgiTLeXX1Hg'; // channel ID with UC -> UU

async function main() {
  if (!API_KEY) throw new Error('Missing YT_API_KEY secret');

  // 1. Last 10 uploads
  const plRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${UPLOADS_PLAYLIST_ID}&maxResults=10&key=${API_KEY}`
  );
  const plData = await plRes.json();
  if (!plData.items) throw new Error('playlistItems error: ' + JSON.stringify(plData));
  const ids = plData.items.map(i => i.snippet.resourceId.videoId).join(',');

  // 2. Details incl. live metadata
  const vidRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${ids}&key=${API_KEY}`
  );
  const vidData = await vidRes.json();
  if (!vidData.items) throw new Error('videos error: ' + JSON.stringify(vidData));

  // 3. Pick: live now  >  most recent real broadcast  >  most recent upload
  let target = vidData.items.find(v => v.snippet.liveBroadcastContent === 'live');
  if (!target) target = vidData.items.find(v => v.liveStreamingDetails);
  if (!target) target = vidData.items[0];

  const isLive  = target.snippet.liveBroadcastContent === 'live';
  const videoId = target.id;
  const query   = isLive ? '?autoplay=1&mute=1' : '';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Oasis Church — Watch Live</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; }
  iframe { display: block; width: 100%; height: 100%; border: 0; }
</style>
</head>
<body>
<iframe src="https://www.youtube.com/embed/${videoId}${query}"
  allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
<!-- generated ${new Date().toISOString()} | live=${isLive} | video=${videoId} -->
</body>
</html>`;

  await mkdir('public', { recursive: true });
  await writeFile('public/index.html', html);
  console.log(`Wrote page: live=${isLive} video=${videoId}`);
}

main().catch(e => { console.error(e); process.exit(1); });

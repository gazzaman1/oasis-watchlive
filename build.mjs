import {mkdir, writeFile, appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export const CHANNEL='UC_yAZzgTnNNndgiTLeXX1Hg';
const ID=/^[A-Za-z0-9_-]{11}$/;
const local=d=>new Date(new Date(d).getTime()+10*3600000);
export function serviceDate(now) {
  const d=local(now); d.setUTCDate(d.getUTCDate()-d.getUTCDay());
  return d.toISOString().slice(0,10);
}
export function selectVideo(items,now=new Date()) {
  const sunday=serviceDate(now);
  const candidates=items.filter(v=>{
    const s=v.snippet, l=v.liveStreamingDetails, t=l?.scheduledStartTime||l?.actualStartTime;
    if(!ID.test(v.id)||s?.channelId!==CHANNEL||!l||v.status?.embeddable!==true||v.status?.privacyStatus!=='public'||!t||!Number.isFinite(Date.parse(t))) return false;
    if(s.liveBroadcastContent==='none'&&!l.actualEndTime) return false;
    if(!['upcoming','live','none'].includes(s.liveBroadcastContent)) return false;
    const d=local(t), mins=d.getUTCHours()*60+d.getUTCMinutes();
    return d.toISOString().slice(0,10)===sunday&&mins>=525&&mins<=615;
  });
  // Service nearest 09:30 wins, not arbitrary API order or another concurrent stream.
  candidates.sort((a,b)=>{
    const delta=v=>Math.abs(Date.parse(v.liveStreamingDetails.scheduledStartTime||v.liveStreamingDetails.actualStartTime)-Date.parse(`${sunday}T09:30:00+10:00`));
    const rank=v=>({live:0,upcoming:1,none:2}[v.snippet.liveBroadcastContent]);
    return delta(a)-delta(b)||rank(a)-rank(b)||a.id.localeCompare(b.id);
  });
  return candidates[0]||null;
}
export function render(v) {
  const live=v.snippet.liveBroadcastContent==='live';
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Oasis Church — Watch Live</title><style>html,body{margin:0;height:100%;background:#000}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><iframe title="Oasis Church Sunday service" src="https://www.youtube.com/embed/${v.id}${live?'?autoplay=1&mute=1':''}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></body></html>\n`;
}
export async function discover(api,now=new Date()) {
  const ids=new Set();
  const playlist=await api('playlistItems',{part:'contentDetails',playlistId:'UU'+CHANNEL.slice(2),maxResults:50});
  for(const i of playlist.items) if(ID.test(i.contentDetails?.videoId)) ids.add(i.contentDetails.videoId);
  const details=async values=>{
    const all=[]; const list=[...values];
    for(let i=0;i<list.length;i+=50) all.push(...(await api('videos',{part:'snippet,liveStreamingDetails,status',id:list.slice(i,i+50).join(',')})).items);
    return all;
  };
  const initial=await details(ids), target=selectVideo(initial,now);
  const overdue=target?.snippet.liveBroadcastContent==='upcoming'&&Date.parse(target.liveStreamingDetails.scheduledStartTime)<=new Date(now).getTime();
  if(target&&!overdue)return initial;
  // Search costs 200 units: only when uploads lack a valid service or it is overdue.
  const additional=new Set();
  for(const eventType of ['upcoming','live']) {
    const r=await api('search',{part:'id',channelId:CHANNEL,type:'video',eventType,maxResults:50});
    for(const i of r.items) if(ID.test(i.id?.videoId)&&!ids.has(i.id.videoId))additional.add(i.id.videoId);
  }
  return [...initial,...await details(additional)];
}
export async function build({api,previous,save,now=new Date()}) {
  // No writing or publishing on discovery errors, missing candidate, or invalid embed metadata.
  const target=selectVideo(await discover(api,now),now);
  if(!target) return {changed:false,reason:'no-current-service'};
  const html=render(target);
  // If previous page is unavailable, do not assume unchanged. Fresh validated output is safe.
  let old=null; try{old=await previous();}catch{}
  if(old===html) return {changed:false,reason:'unchanged',id:target.id};
  await save(html); return {changed:true,reason:'updated',id:target.id};
}
async function main(){
  if(!process.env.YT_API_KEY) throw new Error('Missing YT_API_KEY');
  const api=async(endpoint,params)=>{
    const url=new URL('https://www.googleapis.com/youtube/v3/'+endpoint);
    url.search=new URLSearchParams({...params,key:process.env.YT_API_KEY});
    const r=await fetch(url,{signal:AbortSignal.timeout(15000)});
    if(!r.ok) throw new Error(`YouTube ${endpoint} HTTP ${r.status}`);
    const data=await r.json(); if(!Array.isArray(data.items)||data.error)throw new Error(`Invalid YouTube ${endpoint} response`);return data;
  };
  const result=await build({api,previous:async()=>{
    const r=await fetch('https://gazzaman1.github.io/oasis-watchlive/',{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new Error('Previous page unavailable');return r.text();
  },save:async html=>{await mkdir('public',{recursive:true});await writeFile('public/index.html',html)}});
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`changed=${result.changed}\nvideo_id=${result.id??''}\n`);
  console.log(JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1});

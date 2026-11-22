// Read-only bounded propagation check. Never retries a deploy or uploads a duplicate.
export async function waitForArtifact(list,name,sleep,attempts=3){
 for(let n=0;n<attempts;n++){
  let artifacts;
  try {artifacts=await list();}catch(e){if(n===attempts-1)throw e;await sleep(5000*(n+1));continue;}
  const matches=artifacts.filter(a=>a.name===name&&!a.expired);
  if(matches.length>1)throw new Error('Ambiguous artifact');
  if(matches.length===1&&matches[0].size_in_bytes>0)return matches[0];
  if(n<attempts-1)await sleep(5000*(n+1));
 }
 throw new Error('Artifact unavailable after bounded read-only checks');
}

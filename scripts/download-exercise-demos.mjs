// Reproduce the bundled Your Move demo files. Their published free-video terms
// permit use within commercial apps: https://ymove.app/free-exercise-videos
import {mkdir,writeFile} from 'node:fs/promises';
import {EXERCISE_DEMOS} from '../fitgoin-exercise-demo.mjs';

const dir=new URL('../assets/exercise-demo/',import.meta.url);
await mkdir(dir,{recursive:true});
for(const {id} of EXERCISE_DEMOS.filter(d=>d.provider==='ymove')){
  const url=`https://ymove.app/api/free/${id}`;
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok||!/^video\/mp4/i.test(response.headers.get('content-type')||''))throw Error(`Unable to download demo ${id}: HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<1000||bytes.length>24*1024*1024||!bytes.subarray(0,32).includes(Buffer.from('ftyp')))throw Error(`Unexpected MP4 data for ${id}`);
  await writeFile(new URL(`${id}.mp4`,dir),bytes);
  console.log(`${id}: ${bytes.length} bytes`);
}

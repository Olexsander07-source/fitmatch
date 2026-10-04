// Re-encode locally to strip metadata; raw video/audio is never uploaded here.
export async function imageForAI(file) {
  if(!/^image\/(jpeg|png|webp)$/.test(file?.type)||file.size>12000000)throw Error('invalid_image');
  const bitmap=await createImageBitmap(file);try{return frame(bitmap);}finally{bitmap.close();}
}
function frame(source) {
  const width=source.width||source.videoWidth,height=source.height||source.videoHeight;
  if(!width||!height||width*height>50000000)throw Error('invalid_image');
  const scale=Math.min(1,960/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
  const base64=canvas.toDataURL('image/jpeg',.68).split(',')[1];if(base64.length>900000)throw Error('invalid_image');return {mime:'image/jpeg',base64};
}
function eventOnce(target,name) {return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>finish(Error('invalid_video')),8000);const success=()=>finish(),failure=()=>finish(Error('invalid_video'));function finish(error){clearTimeout(timeout);target.removeEventListener(name,success);target.removeEventListener('error',failure);error?reject(error):resolve();}target.addEventListener(name,success,{once:true});target.addEventListener('error',failure,{once:true});});}
export async function videoForAI(file) {
  if(!/^video\/(mp4|webm|quicktime)$/.test(file?.type)||file.size>25000000)throw Error('invalid_video');
  const url=URL.createObjectURL(file),video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
  try{
    const ready=eventOnce(video,'loadeddata');video.src=url;await ready;
    if(!Number.isFinite(video.duration)||video.duration<1||video.duration>45)throw Error('invalid_video');
    const images=[];for(let i=0;i<6;i++){const seek=eventOnce(video,'seeked');video.currentTime=Math.max(.05,Math.min(video.duration-.05,(i+.5)*video.duration/6));await seek;images.push({...frame(video),time_seconds:Math.round(video.currentTime*10)/10});}
    if(images.reduce((s,x)=>s+x.base64.length,0)>2400000)throw Error('request_too_large');return images;
  }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}

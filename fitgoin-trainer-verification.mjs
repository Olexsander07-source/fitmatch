// Trainer evidence is private; submission never awards public professional verification.
export const TRAINER_DOCUMENT_BUCKET='fgi-trainer-docs';
export const TRAINER_MIME={ 'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp' };
export function validateTrainerEvidence({country,format,kind,file,attested}){
 if(!/^[A-Z]{2}$/.test(String(country||'')))throw Error('invalid_country');
 if(!['online','in_person','both'].includes(format))throw Error('invalid_format');
 if(!['qualification','professional_card','licence','business_registration'].includes(kind))throw Error('invalid_kind');
 if(!file||!TRAINER_MIME[file.type]||!Number.isSafeInteger(file.size)||file.size<1||file.size>6291456)throw Error('invalid_file');
 if(attested!==true)throw Error('attestation_required');
 return TRAINER_MIME[file.type];
}
// MIME declarations are not sufficient: reject obvious file-content spoofing before upload.
export async function validateTrainerFileSignature(file,extension){
 if(!file||typeof file.slice!=='function')return false;
 const b=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const matches=(values,offset=0)=>values.every((v,i)=>b[offset+i]===v);
 if(extension==='pdf')return matches([37,80,68,70,45]); // %PDF-
 if(extension==='jpg')return matches([255,216,255]);
 if(extension==='png')return matches([137,80,78,71,13,10,26,10]);
 if(extension==='webp')return matches([82,73,70,70])&&matches([87,69,66,80],8);
 return false;
}
const lex={
 ru:['Документы тренера','Отправь подтверждение квалификации для выбранной страны. Документы видны только тебе и владельцу FitGoIn. Загрузка не означает права работать за плату.','Ожидает проверки','Документ принят','Отклонено','Документы ещё не загружены','Загрузка…','Документ отправлен. Публичный статус не изменён.','Не удалось выполнить действие','Удалить ожидающий документ','Открыть документ (60 сек.)','Проверка владельца','Принять документ','Отклонить документ','Решение сохранено','Документ удалён','Примечание проверяющего'],
 fr:['Documents du coach','Envoie les justificatifs pour le pays concerné. Ils restent privés et leur envoi ne constitue pas une autorisation légale de travailler.','En attente','Document accepté','Refusé','Aucun document','Téléversement…','Document transmis. Aucun statut public modifié.','Une erreur est survenue','Retirer un document en attente','Ouvrir le document (60 s)','Contrôle du responsable','Accepter le document','Refuser le document','Décision enregistrée','Document supprimé','Note du responsable'],
 en:['Trainer documents','Submit qualifications for the country of service. Files are private; uploading does not establish permission to provide paid training.','Pending','Document accepted','Rejected','No documents yet','Uploading…','Submitted. Public verification has not changed.','Action failed','Withdraw pending document','View document (60 sec.)','Owner review','Accept document','Reject document','Decision recorded','Document removed','Reviewer note']
};
export function mountTrainerVerification({getDB,getUser,getCoach,getLocale}){
 const panel=document.getElementById('coachCompliancePanel');
 if(!panel)return {refresh:async()=>{}};
 const form=document.getElementById('coachComplianceForm'),history=document.getElementById('coachComplianceHistory');
 const review=document.getElementById('ownerCompliancePanel'),queue=document.getElementById('ownerComplianceQueue'),status=document.getElementById('coachComplianceMessage');
 let busy=false,serial=0;
 const labels=()=>lex[getLocale()]||lex.en;
 const say=value=>{status.textContent=value;};
 const button=(label,handler)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=label;b.addEventListener('click',handler);return b;};
 async function view(path){const {data,error}=await getDB().storage.from(TRAINER_DOCUMENT_BUCKET).createSignedUrl(path,60);if(error||!data?.signedUrl)throw Error('signed_url_failed');window.open(data.signedUrl,'_blank','noopener,noreferrer');}
 function localize(){panel.querySelectorAll('[data-compliance-text]').forEach(n=>{const t=labels()[Number(n.dataset.complianceText)];if(t)n.textContent=t;});}
 function showRecords(target,rows,asOwner,refresh){
  target.replaceChildren();
  if(!rows.length){const p=document.createElement('p');p.textContent=labels()[5];target.append(p);}
  for(const r of rows){
   const el=document.createElement('article');el.className='panel workspace-card';
   const head=document.createElement('strong');head.textContent=[r.service_country,r.document_kind,labels()[r.status==='pending'?2:r.status==='accepted'?3:4]].join(' · ');el.append(head);
   const desc=document.createElement('p');desc.className='hint';desc.textContent=r.service_format+' · '+new Date(r.created_at).toLocaleDateString(getLocale());el.append(desc);
   if(r.review_note){const p=document.createElement('p');p.textContent=r.review_note;el.append(p);}
   el.append(button(labels()[10],async()=>{try{await view(r.document_path);}catch{say(labels()[8]);}}));
   if(asOwner&&r.status==='pending'){
    const input=document.createElement('input');input.type='text';input.maxLength=800;input.placeholder=labels()[16];el.append(input);
    for(const decision of [['accepted',12],['rejected',13]]){
     el.append(button(labels()[decision[1]],async()=>{if(busy)return;busy=true;try{
      const {error}=await getDB().from('fgi_trainer_documents').update({status:decision[0],review_note:input.value.trim()||null}).eq('id',r.id);
      if(error)throw error;say(labels()[14]);await refresh();
     }catch{say(labels()[8]);}finally{busy=false;}}));
    }
   }
   if(!asOwner&&r.status==='pending'){
    el.append(button(labels()[9],async()=>{if(busy)return;busy=true;try{
      const {error:fileError}=await getDB().storage.from(TRAINER_DOCUMENT_BUCKET).remove([r.document_path]);
      if(fileError)throw fileError;
      const {error}=await getDB().from('fgi_trainer_documents').delete().eq('id',r.id);
      if(error)throw error;say(labels()[15]);await refresh();
     }catch{say(labels()[8]);}finally{busy=false;}}));
   }
   target.append(el);
  }
 }
 async function refresh(){
  const version=++serial,user=getUser(),db=getDB(),coach=getCoach();
  if(!user||!db){panel.hidden=true;review.hidden=true;return;}
  const {data:isOwner,error:roleError}=await db.rpc('fgi_is_owner');
  if(version!==serial)return;
  const owner=!roleError&&isOwner===true;
  panel.hidden=!coach&&!owner;
  if(panel.hidden)return;
  form.hidden=!coach;
  localize();
  const userQuery=coach?db.from('fgi_trainer_documents').select('*').eq('coach_id',user.id).order('created_at',{ascending:false}).limit(30):Promise.resolve({data:[],error:null});
  const ownerQuery=owner?db.from('fgi_trainer_documents').select('*').eq('status','pending').order('created_at',{ascending:true}).limit(30):Promise.resolve({data:[],error:null});
  const [ownRows,queueRows]=await Promise.all([userQuery,ownerQuery]);
  if(version!==serial)return;
  if(ownRows.error||queueRows.error){say(labels()[8]);return;}
  showRecords(history,ownRows.data||[],false,refresh);
  review.hidden=!owner;
  if(owner)showRecords(queue,queueRows.data||[],true,refresh);
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy||!getDB()||!getUser()||!getCoach())return;
  const f=new FormData(form),file=f.get('document'),country=String(f.get('country')||'').trim().toUpperCase();
  let ext;try{ext=validateTrainerEvidence({country,format:f.get('format'),kind:f.get('kind'),file,attested:f.get('attested')==='yes'});}catch{say(labels()[8]);return;}
  if(!await validateTrainerFileSignature(file,ext)){say(labels()[8]);return;}
  busy=true;say(labels()[6]);const db=getDB(),id=crypto.randomUUID(),path=getUser().id+'/'+id+'.'+ext;
  let created=false;
  try{
   const {error:recordError}=await db.from('fgi_trainer_documents').insert({id,coach_id:getUser().id,service_country:country,service_format:f.get('format'),document_kind:f.get('kind'),document_path:path,attested:true,reference:String(f.get('reference')||'').trim()||null,valid_until:f.get('valid_until')||null});
   if(recordError)throw recordError;created=true;
   const {error:fileError}=await db.storage.from(TRAINER_DOCUMENT_BUCKET).upload(path,file,{upsert:false,cacheControl:'0',contentType:file.type});
   if(fileError)throw fileError;form.reset();say(labels()[7]);await refresh();
  }catch{if(created)await db.from('fgi_trainer_documents').delete().eq('id',id);say(labels()[8]);}finally{busy=false;}
 });
 document.addEventListener('fitgoin:localechange',localize);
 localize();return {refresh};
}

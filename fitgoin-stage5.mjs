// FitGoIn Stage 5. Client/coach booking requests, notifications, support and owner inbox.
const translations={
 fr:['Réservations','Notifications','Assistance','Espace propriétaire','Demander une séance','Confirmer','Refuser','Annuler','Terminer','Envoyer','Actualiser','Aucune demande','Signalez un problème','Sujet','Description','Envoyer au support','Demande enregistrée','Réponse','Enregistrer','Marquer comme lu'],
 en:['Bookings','Notifications','Support','Owner workspace','Request a session','Confirm','Decline','Cancel','Complete','Send','Refresh','Nothing here yet','Report a problem','Subject','Description','Send to support','Request saved','Reply','Save','Mark read'],
 ru:['Бронирования','Уведомления','Поддержка','Кабинет владельца','Запросить тренировку','Подтвердить','Отклонить','Отменить','Завершить','Отправить','Обновить','Пока пусто','Сообщить о проблеме','Тема','Описание','Отправить в поддержку','Обращение сохранено','Ответ','Сохранить','Прочитано']
};
// Labels for the dynamically rendered Stage 5 UI (not personal chat content).
const stage5Text={
 "ru": {
  "date": "Дата",
  "time": "Время",
  "duration": "Продолжительность (мин)",
  "note": "Примечание",
  "category": "Тип обращения",
  "problem": "Проблема",
  "question": "Вопрос",
  "suggestion": "Предложение",
  "readAll": "Отметить все прочитанными",
  "client": "Клиент",
  "coach": "Тренер",
  "invalidDate": "Укажите правильную дату и время",
  "statuses": {
   "pending": "Ожидает ответа",
   "confirmed": "Подтверждено",
   "declined": "Отклонено",
   "cancelled": "Отменено",
   "completed": "Завершено",
   "open": "Открыто",
   "in_progress": "В работе",
   "resolved": "Решено"
  },
  "notices": {
   "booking_requested": [
    "Новая заявка на тренировку",
    "Клиент запросил тренировку."
   ],
   "booking_received": [
    "Заявка отправлена",
    "Заявка отправлена тренеру."
   ],
   "booking_confirmed": [
    "Тренировка подтверждена",
    "Подробности в разделе бронирований."
   ],
   "booking_declined": [
    "Заявка отклонена",
    "Подробности в разделе бронирований."
   ],
   "booking_cancelled": [
    "Тренировка отменена",
    "Подробности в разделе бронирований."
   ],
   "booking_completed": [
    "Тренировка завершена",
    "Подробности в разделе бронирований."
   ],
   "support_new": [
    "Новое обращение",
    "Поступило новое обращение в поддержку."
   ],
   "support_reply": [
    "Ответ поддержки",
    "Откройте обращение, чтобы прочитать ответ."
   ]
  }
 },
 "fr": {
  "date": "Date",
  "time": "Heure",
  "duration": "Durée (min)",
  "note": "Remarque",
  "category": "Type de demande",
  "problem": "Problème",
  "question": "Question",
  "suggestion": "Suggestion",
  "readAll": "Tout marquer comme lu",
  "client": "Client",
  "coach": "Coach",
  "invalidDate": "Indiquez une date et une heure valides",
  "statuses": {
   "pending": "En attente",
   "confirmed": "Confirmée",
   "declined": "Refusée",
   "cancelled": "Annulée",
   "completed": "Terminée",
   "open": "Ouvert",
   "in_progress": "En cours",
   "resolved": "Résolu"
  },
  "notices": {
   "booking_requested": [
    "Nouvelle demande de séance",
    "Un client a demandé une séance."
   ],
   "booking_received": [
    "Demande envoyée",
    "Votre demande a été envoyée au coach."
   ],
   "booking_confirmed": [
    "Séance confirmée",
    "Consultez les réservations pour les détails."
   ],
   "booking_declined": [
    "Demande refusée",
    "Consultez les réservations pour les détails."
   ],
   "booking_cancelled": [
    "Séance annulée",
    "Consultez les réservations pour les détails."
   ],
   "booking_completed": [
    "Séance terminée",
    "Consultez les réservations pour les détails."
   ],
   "support_new": [
    "Nouvelle demande d'assistance",
    "Un nouveau signalement attend votre réponse."
   ],
   "support_reply": [
    "Réponse de l'assistance",
    "Ouvrez votre demande pour lire la réponse."
   ]
  }
 },
 "en": {
  "date": "Date",
  "time": "Time",
  "duration": "Duration (min)",
  "note": "Note",
  "category": "Request type",
  "problem": "Problem",
  "question": "Question",
  "suggestion": "Suggestion",
  "readAll": "Mark all as read",
  "client": "Client",
  "coach": "Coach",
  "invalidDate": "Enter a valid date and time",
  "statuses": {
   "pending": "Pending",
   "confirmed": "Confirmed",
   "declined": "Declined",
   "cancelled": "Cancelled",
   "completed": "Completed",
   "open": "Open",
   "in_progress": "In progress",
   "resolved": "Resolved"
  },
  "notices": {
   "booking_requested": [
    "New training request",
    "A client requested a training session."
   ],
   "booking_received": [
    "Request sent",
    "Your request was sent to the coach."
   ],
   "booking_confirmed": [
    "Training confirmed",
    "See your bookings for details."
   ],
   "booking_declined": [
    "Request declined",
    "See your bookings for details."
   ],
   "booking_cancelled": [
    "Training cancelled",
    "See your bookings for details."
   ],
   "booking_completed": [
    "Training completed",
    "See your bookings for details."
   ],
   "support_new": [
    "New support request",
    "A new user report is waiting for review."
   ],
   "support_reply": [
    "Support replied",
    "Open your support request to read the reply."
   ]
  }
 }
};
export const stage5Labels=lang=>stage5Text[lang]||stage5Text.en;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validBooking(date,time,duration){
 const iso=String(date),mins=Number(duration);
 if(!/^\d{4}-\d\d-\d\d$/.test(iso)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(time))||!Number.isInteger(mins)||mins<15||mins>240)return false;
 const parsed=new Date(iso+'T00:00:00.000Z');
 return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===iso;
}
export function bookingError(error,locale){
 const message=String(error?.message||'');
 if(message.includes('coach_time_unavailable'))return ({fr:'Ce créneau est déjà réservé. Choisissez une autre heure.',ru:'Это время уже занято. Выберите другое.',en:'This time slot is already booked. Choose another time.'})[locale]||'This time slot is already booked. Choose another time.';
 return message||'Booking failed';
}
export function validSupport(subject,body){return String(subject||'').trim().length>=6&&String(subject).trim().length<=140&&String(body||'').trim().length>=10&&String(body).trim().length<=6000;}
export function mountStage5({getDB,getUser,getThread,getCoaches,getLocale,navigate}){
 const $=id=>document.getElementById(id),db=()=>getDB(),user=()=>getUser()?.id;
 const l=()=>translations[getLocale()]||translations.en;
 const u=()=>stage5Labels(getLocale());
 let owner=false,epoch=0,poll=0;
 const main=document.querySelector('main'),nav=$('nav');
 const navLinks={};
 for(const [id,i] of [['bookings',0],['alerts',1],['support',2],['owner',3]]){
  const b=document.createElement('button');b.type='button';b.dataset.page=id;b.textContent=l()[i];b.id='fgiNav'+id;if(id==='owner')b.hidden=true;nav.appendChild(b);navLinks[id]=b;
 }
 const section=(id,html)=>{const a=document.createElement('section');a.id=id;a.className='page container section';a.innerHTML=html;main.appendChild(a);};
 section('bookings','<p class="eyebrow">FITGOIN</p><h1 id="fgiBT"></h1><button class="btn" id="fgiBR" type="button"></button><p id="fgiBE" role="status"></p><div class="stack" id="fgiBL"></div>');
 section('alerts','<p class="eyebrow">FITGOIN</p><h1 id="fgiNT"></h1><button class="btn" id="fgiNR" type="button"></button><button class="btn" id="fgiAllRead" type="button">✓</button><p id="fgiNE" role="status"></p><div class="stack" id="fgiNL"></div>');
 section('support','<p class="eyebrow">FITGOIN</p><h1 id="fgiST"></h1><div class="panel"><form id="fgiSupportForm" class="stack"><label><span id="fgiCategoryLabel"></span><select name="category" required><option value="problem"></option><option value="question"></option><option value="suggestion"></option></select></label><label><span id="fgiSL"></span><input name="subject" minlength="6" maxlength="140" required></label><label><span id="fgiDL"></span><textarea name="body" rows="5" minlength="10" maxlength="6000" required></textarea></label><button class="btn primary" type="submit" id="fgiSS"></button><p id="fgiSE" role="status"></p></form></div><div class="stack" id="fgiSM"></div>');
 section('owner','<p class="eyebrow">FITGOIN</p><h1 id="fgiOT"></h1><div class="panel"><strong>Owner • FitGoIn</strong><p><button class="btn small" type="button" data-page="dashboard">Client</button> <button class="btn small" type="button" data-page="match">MATCH</button> <button class="btn small" type="button" data-page="account">Coach</button> <button class="btn small" type="button" data-page="ai">FitGoIn AI</button></p><p id="fgiON"></p><button class="btn" id="fgiOR" type="button"></button></div><p id="fgiOE" role="status"></p><div class="stack" id="fgiOL"></div>');
 const form=document.createElement('form');form.id='fgiBookingForm';form.className='panel';form.hidden=true;
 form.innerHTML='<h3 id="fgiFT"></h3><label><span id="fgiDateLabel"></span><input name="date" type="date" required></label><label><span id="fgiTimeLabel"></span><input name="time" type="time" value="18:00" required></label><label><span id="fgiDurationLabel"></span><select name="duration"><option>30</option><option>45</option><option selected>60</option><option>90</option><option>120</option></select></label><label><span id="fgiNoteLabel"></span><textarea name="note" maxlength="1000" rows="2"></textarea></label><button class="btn primary" type="submit" id="fgiFS"></button><p id="fgiFE" role="status"></p>';
 const original=$('messageForm');original.parentNode.insertBefore(form,original);
 const open=document.createElement('button');open.type='button';open.className='btn small';open.id='fgiOpenBooking';open.hidden=true;$('chatTitle').parentNode.appendChild(open);
 const msg=(id,s)=>{if($(id))$(id).textContent=s;};
 function labels(){
  const t=l();
  for(const [id,i] of [['fgiBT',0],['fgiNT',1],['fgiST',2],['fgiOT',3],['fgiOpenBooking',4],['fgiFT',4],['fgiBR',10],['fgiNR',10],['fgiOR',10],['fgiSS',15],['fgiFS',9],['fgiSL',13],['fgiDL',14]])msg(id,t[i]);
  for(const [id,i] of [['bookings',0],['alerts',1],['support',2],['owner',3]])navLinks[id].textContent=t[i];
  const fields=u();
  for(const [id,key] of [['fgiDateLabel','date'],['fgiTimeLabel','time'],['fgiDurationLabel','duration'],['fgiNoteLabel','note'],['fgiCategoryLabel','category']])msg(id,fields[key]);
  for(const key of ['problem','question','suggestion']){
   const option=$('fgiSupportForm').querySelector('[name=category] option[value="'+key+'"]');
   if(option)option.textContent=fields[key];
  }
  $('fgiAllRead').setAttribute('aria-label',fields.readAll);
  $('fgiAllRead').title=fields.readAll;
  msg('fgiON',getLocale()==='fr'?'Tous les signalements sont enregistrés. Les e-mails automatiques nécessitent une configuration de messagerie.':getLocale()==='ru'?'Обращения сохранены в кабинете. Автоматические письма требуют подключения почтового сервиса.':'Reports are saved here. Automatic emails require an outbound mail service.');
 }
 function report(id,e){msg(id,String(e?.message||e||'Error').slice(0,250));}
 function onThread(){const t=getThread();open.hidden=!(user()&&t&&t.client_id===user());if(open.hidden)form.hidden=true;}
 function localDate(){
  const d=new Date(),pad=x=>String(x).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
 }
 async function bookings(){
  if(!user())return;
  const {data,error}=await db().from('bookings').select('id,coach_id,client_id,booking_date,booking_time,timezone,duration_minutes,note,status').order('created_at',{ascending:false}).limit(100);
  if(error)return report('fgiBE',error);
  msg('fgiBE','');const list=$('fgiBL');list.replaceChildren();
  for(const b of data||[]){
    const card=document.createElement('article');card.className='panel';card.dataset.bid=b.id;
    const isCoach=b.coach_id===user();
    const coach=getCoaches()?.find(c=>c.id===b.coach_id)?.name||'Coach';
    card.innerHTML='<strong>'+esc(isCoach?u().client:coach||u().coach)+'</strong><p>'+esc(b.booking_date+' '+String(b.booking_time).slice(0,5)+' '+b.timezone)+' · '+esc(b.duration_minutes)+' min</p><p>'+esc(u().statuses[b.status]||b.status)+'</p><p>'+esc(b.note||'')+'</p>';
    const button=(action,i)=>{const item=document.createElement('button');item.type='button';item.className='btn small';item.dataset.bookingAction=action;item.textContent=l()[i];card.appendChild(item);};
    if(isCoach&&b.status==='pending'){button('confirm',5);button('decline',6);}
    if(['pending','confirmed'].includes(b.status))button('cancel',7);
    if(isCoach&&b.status==='confirmed')button('complete',8);
    list.appendChild(card);
  }
  if(!data?.length)list.textContent=l()[11];
 }
 async function notices(){
  if(!user())return;
  const {data,error}=await db().from('fgi_notifications').select('id,kind,title,body,read_at,created_at').order('created_at',{ascending:false}).limit(80);
  if(error)return report('fgiNE',error);msg('fgiNE','');
  const list=$('fgiNL');list.replaceChildren();let unread=0;
  for(const n of data||[]){
    const card=document.createElement('article');card.className='panel';
    const localized=u().notices[n.kind];
    card.innerHTML='<strong>'+esc(localized?.[0]||n.title)+'</strong><p>'+esc(localized?.[1]||n.body)+'</p><small>'+esc(new Date(n.created_at).toLocaleString())+'</small>';
    if(!n.read_at){unread++;const b=document.createElement('button');b.type='button';b.className='btn small';b.dataset.markRead=n.id;b.textContent=l()[19];card.appendChild(b);}
    const link=document.createElement('button');link.type='button';link.className='btn small';link.dataset.page=n.kind.startsWith('booking')?'bookings':n.kind==='support_new'?'owner':'support';link.textContent='↗';card.appendChild(link);list.appendChild(card);
  }
  if(!data?.length)list.textContent=l()[11];
  navLinks.alerts.textContent=l()[1]+(unread?' ('+unread+(data.length===80?'+':'')+')':'');
 }
 async function mine(){
  if(!user())return;
  const {data,error}=await db().from('fgi_support_tickets').select('subject,body,status,owner_reply,created_at').eq('reporter_id',user()).order('created_at',{ascending:false}).limit(30);
  if(error)return report('fgiSE',error);
  const list=$('fgiSM');list.replaceChildren();
  for(const t of data||[]){const a=document.createElement('article');a.className='panel';a.innerHTML='<strong>'+esc(t.subject)+'</strong><p>'+esc(t.body)+'</p><small>'+esc(u().statuses[t.status]||t.status)+'</small>'+(t.owner_reply?'<p><strong>'+esc(l()[17])+':</strong> '+esc(t.owner_reply)+'</p>':'');list.appendChild(a);}
  if(!data?.length)list.textContent=l()[11];
 }
 async function ownerTickets(){
  if(!owner||!user())return;
  const {data,error}=await db().from('fgi_support_tickets').select('id,category,subject,body,status,owner_reply,created_at').order('created_at',{ascending:false}).limit(100);
  if(error)return report('fgiOE',error);msg('fgiOE','');
  const list=$('fgiOL');list.replaceChildren();
  for(const t of data||[]){
    const card=document.createElement('article');card.className='panel';card.dataset.ticketId=t.id;
    card.innerHTML='<strong>'+esc(t.subject)+'</strong><p>'+esc(t.body)+'</p><small>'+esc(t.category)+' · '+esc(t.created_at)+'</small>';
    const sel=document.createElement('select');sel.dataset.ticketStatus='';
    for(const status of ['open','in_progress','resolved'])sel.add(new Option(u().statuses[status]||status,status));
    sel.value=t.status;const reply=document.createElement('textarea');reply.dataset.ticketReply='';reply.rows=3;reply.maxLength=6000;reply.placeholder=l()[17];reply.value=t.owner_reply||'';
    const b=document.createElement('button');b.className='btn primary';b.type='button';b.dataset.ticketSave='';b.textContent=l()[18];card.append(sel,reply,b);list.appendChild(card);
  }
  if(!data?.length)list.textContent=l()[11];
 }
 async function guarded(button,action,id){
  if(button?.disabled)return;
  if(button)button.disabled=true;
  try{msg(id,'');await action();}catch(e){report(id,e);}finally{if(button)button.disabled=false;}
 }
 open.addEventListener('click',()=>{form.hidden=!form.hidden;form.querySelector('[name=date]').min=localDate();});
 form.addEventListener('submit',e=>{
  e.preventDefault();const t=getThread();if(!t||!user()||t.client_id!==user())return;
  const f=new FormData(form),date=f.get('date'),time=f.get('time'),duration=f.get('duration');
  if(!validBooking(date,time,duration))return msg('fgiFE',u().invalidDate);
  guarded($('fgiFS'),async()=>{
   const {error}=await db().rpc('fgi_booking_create',{p_thread_id:t.id,p_date:date,p_time:time,p_duration:Number(duration),p_note:String(f.get('note')||''),p_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Paris'});
   if(error)throw new Error(bookingError(error,getLocale()));form.hidden=true;form.reset();navigate('bookings');await bookings();await notices();
  },'fgiFE');
 });
 $('fgiBL').addEventListener('click',e=>{const b=e.target.closest('button[data-booking-action]');if(!b)return;
  guarded(b,async()=>{const {error}=await db().rpc('fgi_booking_decide',{p_booking_id:b.closest('[data-bid]').dataset.bid,p_action:b.dataset.bookingAction});if(error)throw new Error(bookingError(error,getLocale()));await bookings();await notices();},'fgiBE');
 });
 $('fgiSupportForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);
  const subject=String(f.get('subject')||''),body=String(f.get('body')||'');
  if(!validSupport(subject,body)||!user())return msg('fgiSE',l()[12]);
  guarded($('fgiSS'),async()=>{
   const {error}=await db().from('fgi_support_tickets').insert({reporter_id:user(),category:f.get('category'),subject:subject.trim(),body:body.trim()});
   if(error)throw error;$('fgiSupportForm').reset();await mine();msg('fgiSE',l()[16]);
  },'fgiSE');
 });
 $('fgiOL').addEventListener('click',e=>{const b=e.target.closest('[data-ticket-save]');if(!b||!owner)return;
  guarded(b,async()=>{const card=b.closest('[data-ticket-id]');const status=card.querySelector('[data-ticket-status]').value,reply=card.querySelector('[data-ticket-reply]').value.trim();
   const {error}=await db().from('fgi_support_tickets').update({status,owner_reply:reply||null}).eq('id',card.dataset.ticketId);
   if(error)throw error;await ownerTickets();
  },'fgiOE');
 });
 $('fgiNL').addEventListener('click',e=>{const b=e.target.closest('button[data-mark-read]');if(!b)return;
  guarded(b,async()=>{const {error}=await db().from('fgi_notifications').update({read_at:new Date().toISOString()}).eq('id',b.dataset.markRead);if(error)throw error;await notices();},'fgiNE');
 });
 $('fgiBR').onclick=()=>bookings();$('fgiNR').onclick=()=>notices();$('fgiOR').onclick=()=>ownerTickets();
 $('fgiAllRead').onclick=async()=>{const {error}=await db().from('fgi_notifications').update({read_at:new Date().toISOString()}).is('read_at',null);if(error)report('fgiNE',error);else await notices();};
 async function sessionChanged(){
  const version=++epoch,actor=user();owner=false;navLinks.owner.hidden=true;
  if(poll){clearInterval(poll);poll=null;}onThread();
  if(!actor||!db())return;
  const {data,error}=await db().rpc('fgi_is_owner');
  if(version!==epoch||actor!==user())return;
  owner=!error&&data===true;navLinks.owner.hidden=!owner;
  notices().catch(()=>{});
  poll=setInterval(()=>{if(user()===actor&&document.visibilityState==='visible')notices().catch(()=>{});},45000);
  onPage(document.querySelector('.page.active')?.id);
 }
 function onPage(id){
  labels();onThread();if(!user())return;
  if(id==='bookings')bookings().catch(e=>report('fgiBE',e));
  if(id==='alerts')notices().catch(e=>report('fgiNE',e));
  if(id==='support')mine().catch(e=>report('fgiSE',e));
  if(id==='owner') {if(!owner)navigate('account');else ownerTickets().catch(e=>report('fgiOE',e));}
 }
 labels();onThread();
 document.addEventListener('fitgoin:localechange',()=>onPage(document.querySelector('.page.active')?.id));
 return {sessionChanged,onPage,onThread,isOwner:()=>owner};
}

const PAYMENT_CONFIG=Object.freeze({
  url:'https://ypbhcgcwkpiujcakvaji.supabase.co',
  key:'sb_publishable_Lsrk07A5aXJH7YypVR8QGQ_TQPwhfOV',
  sdk:'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm'
});

let paymentDb=null,paymentUser=null,paymentProfileEpoch=0;
const paymentEsc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function paymentNotice(text,error=false){
  const box=document.getElementById('notice');
  if(!box)return;
  box.textContent=text;box.hidden=!text;box.className=error?'notice error':'notice';
}

async function paymentSession(){
  if(!paymentDb)return null;
  const {data,error}=await paymentDb.auth.getSession();
  if(error)throw error;
  paymentUser=data.session?.user||null;
  return data.session||null;
}

async function invokePaymentFunction(name,body={}){
  const session=await paymentSession();
  if(!session)throw Error('Сначала войди в FitGoIn.');
  const {data,error}=await paymentDb.functions.invoke(name,{body});
  if(error)throw error;
  if(data?.error)throw Error(data.error);
  return data;
}

function stripePanel(){
  const account=document.getElementById('account'),form=document.getElementById('coachForm');
  if(!account||!form)return null;
  let panel=document.getElementById('stripePaymentsPanel');
  if(panel)return panel;
  panel=document.createElement('section');
  panel.id='stripePaymentsPanel';panel.className='panel section-small';panel.hidden=true;
  panel.innerHTML=`<p class="eyebrow">FITGOIN · STRIPE</p><h2>Оплата картой</h2><p id="stripePaymentsStatus" class="muted">Проверяем Stripe…</p><div class="actions"><button id="stripeConnect" class="btn" type="button">Подключить выплаты Stripe</button></div><p class="hint">Клиент платит картой через защищённую страницу Stripe. FitGoIn удерживает 5% комиссии, остальная сумма направляется на Stripe-аккаунт тренера.</p>`;
  form.insertAdjacentElement('afterend',panel);
  panel.querySelector('#stripeConnect').addEventListener('click',async event=>{
    const button=event.currentTarget;if(button.disabled)return;
    button.disabled=true;
    const status=panel.querySelector('#stripePaymentsStatus');status.textContent='Открываем безопасную настройку Stripe…';
    try{
      const data=await invokePaymentFunction('stripe-connect-onboarding');
      if(!data?.url)throw Error('Stripe не вернул ссылку настройки.');
      location.assign(data.url);
    }catch(error){status.textContent=error?.message||'Не удалось открыть Stripe.';paymentNotice(status.textContent,true);button.disabled=false;}
  });
  return panel;
}

async function refreshStripePanel(){
  const panel=stripePanel();if(!panel||!paymentDb)return;
  const session=await paymentSession().catch(()=>null);
  panel.hidden=!session;if(!session)return;
  const status=panel.querySelector('#stripePaymentsStatus'),button=panel.querySelector('#stripeConnect');
  const {data,error}=await paymentDb.from('fgi_coaches').select('id,stripe_account_id,stripe_onboarding_complete,stripe_transfers_enabled').eq('id',session.user.id).maybeSingle();
  if(error){status.textContent='Не удалось проверить Stripe.';button.disabled=true;return;}
  if(!data){status.textContent='Сначала сохрани профиль тренера, затем подключи Stripe.';button.textContent='Подключить выплаты Stripe';button.disabled=true;return;}
  button.disabled=false;
  if(data.stripe_onboarding_complete&&data.stripe_transfers_enabled){status.textContent='✓ Stripe подключён. Оплата картой готова после включения Checkout и webhook.';button.textContent='Проверить / обновить Stripe';}
  else if(data.stripe_account_id){status.textContent='Настройка Stripe начата, но выплаты ещё не активны.';button.textContent='Продолжить настройку Stripe';}
  else{status.textContent='Stripe ещё не подключён.';button.textContent='Подключить выплаты Stripe';}
}

async function renderProfilePayment(){
  const box=document.getElementById('profileContent');if(!box||!paymentDb)return;
  const contact=box.querySelector('[data-contact]');
  const coachId=contact?.dataset.contact;if(!coachId)return;
  const epoch=++paymentProfileEpoch;
  box.querySelector('[data-stripe-payment-block]')?.remove();
  const {data,error}=await paymentDb.from('fgi_coaches').select('id,name,price,period,stripe_onboarding_complete,stripe_transfers_enabled').eq('id',coachId).maybeSingle();
  if(epoch!==paymentProfileEpoch||error||!data)return;
  const actions=contact.closest('.actions');if(!actions)return;
  const wrap=document.createElement('div');wrap.dataset.stripePaymentBlock='1';wrap.className='section-small';
  const price=Number(data.price);
  if(Number.isFinite(price)&&price>=0.5&&data.stripe_onboarding_complete&&data.stripe_transfers_enabled){
    wrap.innerHTML=`<button class="btn primary" type="button" data-stripe-pay="${paymentEsc(coachId)}">Оплатить картой · ${paymentEsc(price.toLocaleString('fr-FR'))} € ↗</button><p class="hint">Оплата проходит на защищённой странице Stripe. Статус платежа подтверждается сервером FitGoIn по подписанному webhook.</p>`;
  }else if(Number.isFinite(price)&&price>=0.5){
    wrap.innerHTML='<p class="hint">Оплата картой появится после того, как тренер завершит подключение Stripe.</p>';
  }
  if(wrap.childNodes.length)actions.insertAdjacentElement('afterend',wrap);
}

async function startCheckout(coachId,button){
  if(button.disabled)return;button.disabled=true;const original=button.textContent;button.textContent='Открываем Stripe…';
  try{
    const data=await invokePaymentFunction('stripe-create-checkout',{coach_id:coachId});
    if(!data?.url||!String(data.url).startsWith('https://checkout.stripe.com/'))throw Error('Stripe не вернул безопасную ссылку оплаты.');
    location.assign(data.url);
  }catch(error){button.disabled=false;button.textContent=original;paymentNotice(error?.message||'Не удалось открыть оплату.',true);}
}

function handlePaymentReturn(){
  const query=new URLSearchParams(location.search);
  if(query.get('payment')==='success')paymentNotice('Stripe принял платёж. FitGoIn подтверждает его статус на сервере.');
  if(query.get('payment')==='cancel')paymentNotice('Оплата отменена. Деньги не должны быть списаны.');
  if(query.get('stripe')==='return')paymentNotice('Настройка Stripe завершена. Проверяем статус выплат.');
  if(query.get('stripe')==='refresh')paymentNotice('Ссылка Stripe обновляется. Нажми «Продолжить настройку Stripe».');
}

async function initPayments(){
  if(!document.getElementById('main'))return;
  const {createClient}=await import(PAYMENT_CONFIG.sdk);
  paymentDb=createClient(PAYMENT_CONFIG.url,PAYMENT_CONFIG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  paymentDb.auth.onAuthStateChange((_event,session)=>{paymentUser=session?.user||null;setTimeout(()=>refreshStripePanel().catch(()=>{}),0);});
  await paymentSession().catch(()=>null);stripePanel();await refreshStripePanel();handlePaymentReturn();
  const profile=document.getElementById('profileContent');
  if(profile)new MutationObserver(()=>renderProfilePayment().catch(()=>{})).observe(profile,{childList:true,subtree:false});
  document.addEventListener('click',event=>{
    const pay=event.target.closest('[data-stripe-pay]');
    if(pay)startCheckout(pay.dataset.stripePay,pay);
    if(event.target.closest('[data-page="account"],#accountOpen,#authOpen'))setTimeout(()=>refreshStripePanel().catch(()=>{}),100);
  });
  renderProfilePayment().catch(()=>{});
}

initPayments().catch(error=>console.error('FitGoIn payments',error));

(()=>{'use strict';
const $=s=>document.querySelector(s),messages=$('.messages'),options=$('.chat-options'),input=$('#chat-input'),review=$('.lead-review'),consent=$('#lead-consent'),submit=$('.submit-lead'),errorBox=$('.chat-error');
let state='',busy=false,started=false,saved=false,turns=0,lead={},retryAction=null;
const popup=$('.assistant-nudge');let timer,closeTimer,shown=false;
const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion:reduce)').matches;
function finishDismiss(){popup.hidden=true;popup.classList.remove('is-leaving');popup.inert=false;clearTimeout(closeTimer)}
function dismiss(){clearTimeout(timer);shown=true;if(popup.hidden||popup.classList.contains('is-leaving'))return;popup.inert=true;popup.classList.add('is-leaving');closeTimer=setTimeout(finishDismiss,reducedMotion()?0:380)}
popup.addEventListener('animationend',e=>{if(e.animationName==='maria-out')finishDismiss()});
function schedule(){clearTimeout(timer);if(shown||started||document.hidden)return;timer=setTimeout(()=>{if(document.hidden||started)return;shown=true;popup.hidden=false;$('#nudge-announcement').textContent='Марія пропонує допомогу. Оберіть, що хочете спростити у своєму бізнесі, або закрийте повідомлення.';},5000)}
window.addEventListener('wheel',schedule,{passive:true});
document.addEventListener('scroll',schedule,{passive:true,capture:true});
document.addEventListener('visibilitychange',schedule);
$('.nudge-close').addEventListener('click',dismiss);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!popup.hidden)dismiss()});
document.querySelectorAll('.nudge-choice').forEach(button=>button.addEventListener('click',()=>{dismiss();window.DevPilotNavigation.go(2);send(button.dataset.message);setTimeout(()=>input.focus({preventScroll:true}),750)}));
function say(text,role='bot'){const b=document.createElement('div');b.className=`bubble ${role}`;b.textContent=text;messages.appendChild(b);messages.scrollTop=messages.scrollHeight;return b}
function setBusy(value){busy=value;input.disabled=value||saved;$('.chat-form button').disabled=value||saved;$('.reset-chat').disabled=value;submit.disabled=value||!consent.checked||saved;options.querySelectorAll('button').forEach(b=>b.disabled=value);messages.setAttribute('aria-busy',String(value))}
function quickChoices(){options.replaceChildren();['Потрібен сайт','Цікавить CRM','Хочу чатбота','Потрібна автоматизація'].forEach(text=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',()=>send(text));options.appendChild(b)})}
function renderReview(){review.hidden=saved||!(lead.name&&lead.task&&lead.contact);const dl=review.querySelector('dl');dl.replaceChildren();for(const [label,value]of [['Задача',lead.task],['Ім’я',lead.name],['Контакт',lead.contact]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value||'';dl.append(dt,dd)}consent.checked=false;submit.disabled=true}
function showError(message,action){errorBox.replaceChildren();const p=document.createElement('p');p.textContent=message;errorBox.appendChild(p);const retry=document.createElement('button');retry.type='button';retry.textContent='Спробувати ще раз';retry.addEventListener('click',()=>{if(!busy)request(action)});errorBox.appendChild(retry);errorBox.hidden=false;retryAction=action}
async function request(action){
 if(busy||saved)return;errorBox.hidden=true;setBusy(true);review.hidden=true;
 const typing=document.createElement('div');typing.className='bubble bot typing';typing.setAttribute('aria-label','Марія готує відповідь');typing.innerHTML='<span></span><span></span><span></span>';messages.appendChild(typing);messages.scrollTop=messages.scrollHeight;
 try{const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...action,state}),signal:AbortSignal.timeout(50000)});const data=await response.json().catch(()=>({error:'Сервіс тимчасово недоступний.'}));if(!response.ok)throw Object.assign(new Error(data.error||'Забагато запитів. Спробуйте за хвилину.'),{status:response.status});if(typeof data.reply!=='string')throw Error('Некоректна відповідь сервера.');
 typing.remove();say(data.reply);retryAction=null;if(data.saved){saved=true;review.hidden=true;input.placeholder='Заявку надіслано. Дякуємо!';options.replaceChildren()}else{state=data.state;lead=data.lead||{};turns++;options.replaceChildren();renderReview();input.placeholder='Напишіть повідомлення…'}
 }catch(e){typing.remove();if(e.status===409){errorBox.textContent='Сеанс завершився. Натисніть ↺, щоб почати нову розмову.';errorBox.hidden=false;retryAction=null}else showError(e.name==='TimeoutError'?'Відповідь затримується. Можна повторити запит.':e.message,action);if(action.action==='submit')review.hidden=false;
 }finally{setBusy(false)}
}
function send(text){text=text.trim();if(!text||busy||saved)return;started=true;dismiss();if(text.length>1200)return;retryAction=null;errorBox.hidden=true;input.value='';say(text,'user');request({action:'chat',message:text})}
function reset(){if(busy)return;if(turns&&!saved&&!confirm('Почати нову розмову? Незбережені дані поточного діалогу буде очищено.'))return;state='';lead={};saved=false;turns=0;messages.replaceChildren();errorBox.hidden=true;review.hidden=true;input.value='';input.placeholder='Що ви хочете зробити?';setBusy(false);say('Привіт! Я Марія, AI-консультантка. Яку задачу хочете вирішити? Якщо вже визначилися, можете одразу написати задачу, ім’я та один контакт для зв’язку.');quickChoices()}
$('.chat-form').addEventListener('submit',e=>{e.preventDefault();send(input.value)});$('.reset-chat').addEventListener('click',reset);input.addEventListener('focus',()=>{started=true;dismiss()});consent.addEventListener('change',()=>{submit.disabled=busy||!consent.checked||saved});submit.addEventListener('click',()=>{if(!busy&&consent.checked)request({action:'submit',consent:true})});
document.querySelectorAll('[data-product]').forEach(b=>b.addEventListener('click',()=>{window.DevPilotNavigation.go(2);if(!busy&&!saved)send(`Мене цікавить ${b.dataset.product.toLowerCase()}.`)}));
reset();schedule();
})();

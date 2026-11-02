import {createHmac, timingSafeEqual, randomUUID} from 'node:crypto';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>json({error:message},status);
const clean=(x,max)=>typeof x==='string'?x.trim().slice(0,max):'';
function signature(s,key){return createHmac('sha256',key).update(s).digest('base64url')}
function encode(state,key){const s=Buffer.from(JSON.stringify(state)).toString('base64url');return s+'.'+signature(s,key)}
function decode(token,key){if(typeof token!=='string'||token.length>60000)throw Error('state');const [s,mac,...rest]=token.split('.');if(!s||!mac||rest.length)throw Error('state');const expected=signature(s,key);if(mac.length!==expected.length||!timingSafeEqual(Buffer.from(mac),Buffer.from(expected)))throw Error('state');const data=JSON.parse(Buffer.from(s,'base64url'));if(data.exp<Date.now()||data.v!==1)throw Error('state');return data}
export function validContact(value){const s=clean(value,160);return /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(s)&&s.startsWith('@')||/^https:\/\/t\.me\/[A-Za-z][A-Za-z0-9_]{4,31}$/i.test(s)||/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)||/^\+?[\d\s().-]{10,25}$/.test(s)&&s.replace(/\D/g,'').length>=10&&s.replace(/\D/g,'').length<=15}
export default async function handler(req){
 if(req.method!=='POST')return fail('Метод не підтримується.',405);
 const key=process.env.CHAT_STATE_SECRET,url=process.env.N8N_WEBHOOK_URL,secret=process.env.N8N_WEBHOOK_SECRET;
 if(!key||key.length<32||!url||!secret)return fail('Чат ще налаштовується. Спробуйте пізніше.',503);
 const allowed=(process.env.ALLOWED_ORIGIN||process.env.URL||'').replace(/\/$/,'');
 if(!allowed||req.headers.get('origin')!==allowed)return fail('Запит відхилено.',403);
 if(!req.headers.get('content-type')?.includes('application/json'))return fail('Потрібен JSON.',415);
 let body;try{const raw=await req.text();if(Buffer.byteLength(raw)>70000)return fail('Повідомлення завелике.',413);body=JSON.parse(raw)}catch{return fail('Некоректний запит.')}
 if(!body||!['chat','submit'].includes(body.action))return fail('Невідома дія.');
 let state;try{state=body.state?decode(body.state,key):{v:1,exp:Date.now()+2*60*60*1000,history:[],lead:{name:'',task:'',contact:''},turns:0,leadId:randomUUID()}}catch{return fail('Сеанс завершився. Почніть нову розмову.',409)}
 if(body.action==='submit'&&(!body.state||body.consent!==true||!state.lead.name||!state.lead.task||!validContact(state.lead.contact)))return fail('Перевірте дані заявки та підтвердіть її надсилання.');
 const message=clean(body.message,1200);
 if(body.action==='chat'&&(!message||typeof body.message!=='string'||body.message.length>1200))return fail('Напишіть повідомлення до 1200 символів.');
 if(body.action==='chat'&&state.turns>=30)return fail('Досягнуто ліміт розмови. Можна надіслати готову заявку або почати нову.',429);
 try{
  if(new URL(url).protocol!=='https:')return fail('Чат ще налаштовується.',503);
  const upstream=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-DevPilot-Secret':secret},body:JSON.stringify({action:body.action,message:body.action==='chat'?message:undefined,history:state.history,lead:state.lead,requestId:state.leadId,consent:body.action==='submit'&&body.consent===true}),signal:AbortSignal.timeout(45000),redirect:'error'});
  if(!upstream.ok)return fail('Не вдалося отримати відповідь. Спробуйте ще раз.',502);
  const data=await upstream.json();
  if(data.ok!==true)return fail('Сервіс тимчасово недоступний. Спробуйте ще раз.',502);
  if(body.action==='submit'){
   if(data.saved!==true||data.leadId!==state.leadId)return fail('Немає підтвердження збереження. Спробуйте ще раз.',502);
   return json({reply:'Дякую! Заявку збережено. Команда зв’яжеться з вами за вказаним контактом.',saved:true,leadId:state.leadId});
  }
  if(typeof data.reply!=='string'||!data.reply.trim()||!data.lead||typeof data.lead!=='object')return fail('Не вдалося прочитати відповідь. Спробуйте ще раз.',502);
  const reply=clean(data.reply,1800),lead={name:clean(data.lead.name,100),task:clean(data.lead.task,700),contact:clean(data.lead.contact,160)};
  if(lead.contact&&!validContact(lead.contact))lead.contact='';
  const updated={...state,history:[...state.history,{role:'user',content:message},{role:'assistant',content:reply}].slice(-20),lead,turns:state.turns+1,leadId:JSON.stringify(lead)===JSON.stringify(state.lead)?state.leadId:randomUUID()};
  return json({reply,lead,ready:!!(lead.name&&lead.task&&lead.contact),state:encode(updated,key)});
 }catch{return fail('З’єднання перервано або відповідь затримується. Спробуйте ще раз.',502)}
}
export const config={path:'/api/chat',rateLimit:{windowLimit:12,windowSize:60,aggregateBy:['ip','domain']}};

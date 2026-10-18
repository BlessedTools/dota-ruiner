const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com';
const ALLOWED_IMAGE_HOSTS = new Set(['cdn.cloudflare.steamstatic.com', 'steamcdn-a.akamaihd.net', 'api.opendota.com']);
const fallback = [[1,'Anti-Mage','antimage',['Carry']],[2,'Axe','axe',['Initiator','Durable']],[3,'Bane','bane',['Support']],[4,'Bloodseeker','bloodseeker',['Carry']],[5,'Crystal Maiden','crystal_maiden',['Support']],[6,'Drow Ranger','drow_ranger',['Carry']],[7,'Earthshaker','earthshaker',['Support','Initiator']],[8,'Juggernaut','juggernaut',['Carry']],[9,'Mirana','mirana',['Support','Carry']],[10,'Morphling','morphling',['Carry']],[11,'Shadow Fiend','nevermore',['Carry']],[14,'Pudge','pudge',['Support','Initiator']],[26,'Lion','lion',['Support']],[31,'Lich','lich',['Support']],[42,'Wraith King','skeleton_king',['Carry']],[43,'Death Prophet','death_prophet',['Carry']],[74,'Invoker','invoker',['Carry']],[145,'Ringmaster','ringmaster',['Support']],[155,'Kez','kez',['Carry']],[156,'Largo','largo',['Support','Initiator']]];
const catalog = new Map(fallback.map(([id,name,slug,roles]) => [id,{ id,name,roles,image:`${STEAM_CDN}/apps/dota2/images/dota_react/heroes/${slug}.png` }]));

export function isAllowedHeroImage(value) { try { const url=new URL(value); return url.protocol==='https:'&&ALLOWED_IMAGE_HOSTS.has(url.hostname); } catch { return false; } }
function normalizeImage(path) { const value=path?.startsWith('/')?`${STEAM_CDN}${path}`:path; return isAllowedHeroImage(value)?value:null; }
export function getHero(id) { return catalog.get(Number(id))||{ id:Number(id),name:`Hero ${id}`,roles:[],image:null }; }
export async function loadHeroConstants({ fetchImpl=globalThis.fetch,timeoutMs=4000 }={}) {
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try { const response=await fetchImpl('https://api.opendota.com/api/constants/heroes',{ signal:controller.signal,headers:{ Accept:'application/json' } }); if(!response.ok)return new Map(catalog); const payload=await response.json();
    for(const hero of (Array.isArray(payload)?payload:Object.values(payload||{}))) { if(!hero||!Number.isFinite(Number(hero.id)))continue; const id=Number(hero.id),current=catalog.get(id); catalog.set(id,{ id,name:hero.localized_name||current?.name||`Hero ${id}`,roles:Array.isArray(hero.roles)?[...hero.roles]:current?.roles||[],image:normalizeImage(hero.img)||current?.image||null }); }
  } catch {} finally { clearTimeout(timer); }
  return new Map(catalog);
}

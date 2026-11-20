(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const cv=$('#game-canvas'),ctx=cv.getContext('2d'),W=720,H=560;
const image=s=>{const i=new Image();i.src=s;return i};
const GAME_BACKGROUND = '#f3f3f3';
const bg = ['#f3f3f3', '#ededed', '#f5f5f5', '#e9e9e9', '#f0f0f0'];
const dragon=image('assets/img/Dragon.png');
const obs=Object.fromEntries(['Vitrail','Cloches','masqueJoyeux','masqueTriste','popCorn','Clap','Brique','Gargouille','BouleFeu_petite','BouleFeu2'].map((n,i)=>[ [ 'vitrail','cloche','masqueJoyeux','masqueTriste','popCorn','clap','brique','gargouille','bouleFeu','bouleFeu2'][i],image('assets/img/Obstacles/'+n+'.png')]));
const chars=[
{id:'HommeBleu',name:'Homme Bleu',speed:280,cost:0,base:'assets/img/perso 3/Homme/Homme_Bleu.png',acc:{lunettes:'assets/img/perso 3/Homme/Homme_Bleu_Sunglass.png',aureole:'assets/img/perso 3/Homme/Homme_Bleu_Aureole.png',biere:'assets/img/perso 3/Homme/Homme_Bleu_Biere.png'}},
{id:'FemmeBleu',name:'Femme Bleu',speed:280,cost:0,base:'assets/img/perso 3/Femme/Femme_Bleu.png',acc:{lunettes:'assets/img/perso 3/Femme/Femme_Bleu_Sunglass.png',aureole:'assets/img/perso 3/Femme/Femme_Bleu_Aureole.png',biere:'assets/img/perso 3/Femme/Femme_Bleu_Biere.png'}},
{id:'Garcon1',name:'Garçon',speed:280,cost:80,base:'assets/img/Perso 1/Garcon1/Garcon1.png',acc:{lunettes:'assets/img/Perso 1/Garcon1/Garcon_lunette1.png',aureole:'assets/img/Perso 1/Garcon1/Garcon_oreole1.png',biere:'assets/img/Perso 1/Garcon1/Garcon_biere1.png'}},
{id:'Fille1',name:'Fille',speed:280,cost:80,base:'assets/img/Perso 1/Fille1/Fille1.png',acc:{lunettes:'assets/img/Perso 1/Fille1/Fille_lunette1.png',aureole:'assets/img/Perso 1/Fille1/Fille_oreole1.png',biere:'assets/img/Perso 1/Fille1/Fille_biere1.png'}},
{id:'HitmanG',name:'Hitman',speed:300,cost:150,base:'assets/img/Perso 2/Hitman_G/Hitmanl_G.png',acc:{lunettes:'assets/img/Perso 2/Hitman_G/Hitman_Lunette_G.png',aureole:'assets/img/Perso 2/Hitman_G/Hitman_Oreol_G.png',biere:'assets/img/Perso 2/Hitman_G/Hitman_Biere_G.png'}},
{id:'HitmanF',name:'Hitwoman',speed:300,cost:150,base:'assets/img/Perso 2/Hitman_F/Hitmanl_F.png',acc:{lunettes:'assets/img/Perso 2/Hitman_F/Hitman_Lunette_F.png',aureole:'assets/img/Perso 2/Hitman_F/Hitman_Oreol_F.png',biere:'assets/img/Perso 2/Hitman_F/Hitman_Biere_F.png'}},
{id:'Chevalier',name:'Chevalier',speed:260,cost:300,base:'assets/img/Personnages_speciaux/Chevalier.png',acc:{}},
{id:'Gigachad',name:'Gigachad',speed:320,cost:450,base:'assets/img/Personnages_speciaux/Gigachad.png',acc:{}}
];
const accessories=[{id:'none',name:'AUCUN',cost:0},{id:'lunettes',name:'LUNETTES',cost:80},{id:'aureole',name:'AURÉOLE',cost:120},{id:'biere',name:'BIÈRE',cost:60}];
const levels=[
{name:'Les Cloches',duration:25,speed:130,spawn:2.8,mechanic:'bells',bg:0,types:['vitrail','cloche']},
{name:'Le Bouclier',duration:35,speed:190,spawn:2.1,mechanic:'shield',bg:1,types:['popCorn','clap']},
{name:'La Tempête',duration:30,speed:160,spawn:2.5,mechanic:'wind',bg:2,types:['masqueJoyeux','masqueTriste']},
{name:"L'Obscurité",duration:30,speed:170,spawn:2.2,mechanic:'darkness',bg:3,types:['brique','gargouille']},
{name:'Le Grand Boss',duration:45,speed:200,spawn:2.0,mechanic:'boss',bg:4,types:['gargouille']}
];
const diffs=[{name:'FACILE',speed:100,spawn:3.4},{name:'NORMAL',speed:150,spawn:2.5},{name:'DIFFICILE',speed:220,spawn:1.8}];
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
let coins=+(localStorage.getItem('coins')||0),best=+(localStorage.getItem('Best_score')||0),unlocked=new Set(get('unlocked',['HommeBleu','FemmeBleu']));
unlocked.add('HommeBleu');unlocked.add('FemmeBleu');
let selected=0,acc='none',tab='char',difficulty=1,mode='classic',level=0,screen='home';
let score=0,elapsed=0,last=0,spawnClock=0,nextSpawnIn=1.8,nextDifficultyAt=10,speed=150,spawnRate=2.5,live=[],player={x:W/2,y:H-85,vy:0},keys={},paused=false,shield=0,shieldCd=0,wind=0,windCd=0,boss={x:W/2,y:75,vx:115,fire:0};
const persist=()=>{localStorage.setItem('coins',coins);localStorage.setItem('unlocked',JSON.stringify([...unlocked]))};
const current=()=>chars[selected];const charImageCache=new Map();function chosenImage(c){const src=(acc!=='none'&&c.acc[acc])||c.base;if(!charImageCache.has(src))charImageCache.set(src,image(src));return charImageCache.get(src)}
const pad=n=>String(Math.max(0,Math.floor(n))).padStart(3,'0');
function stats(){$('#header-coins').textContent=pad(coins);$('#header-best').textContent=pad(best);$('#inspector-best').textContent=pad(best);$('#inspector-coins').textContent=pad(coins);$('#inspector-character').textContent=current().name.toUpperCase();$('#shop-coins').textContent=pad(coins)}
function screenTo(name,index,kicker){screen=name;$$('.screen').forEach(x=>x.classList.toggle('active',x.id==='screen-'+name));$$('.rail-link').forEach(x=>x.classList.toggle('active',x.dataset.action===(name==='game'||name==='result'?'home':name)));$('#view-index').textContent=index;$('#view-kicker').textContent=kicker;stats()}
function home(){screenTo('home','01 / 04','(01) — EXPÉRIENCE ARCADE')}
function select(){renderChars();screenTo('select','02 / 04','(02) — PERSONNAGE')}
function shop(){renderShop();screenTo('shop','03 / 04','(03) — COLLECTION')}
function preview(){const c=current();$('#character-preview').src=(acc!=='none'&&c.acc[acc])||c.base;$('#character-name').textContent=c.name;$('#character-speed').textContent=c.speed;$('#character-accessory').textContent=accessories.find(a=>a.id===acc).name;$$('.accessory-button').forEach(b=>b.classList.toggle('selected',b.dataset.acc===acc));stats()}
function renderChars(){
 $('#character-list').innerHTML=chars.map((c,i)=>`<button class="character-option ${i===selected?'selected':''} ${unlocked.has(c.id)?'':'locked'}" data-char="${i}"><img src="${c.base}" alt=""><span>${c.name}</span><small>${unlocked.has(c.id)?c.speed+' VITESSE':c.cost+' PIÈCES'}</small></button>`).join('');
 $$('.character-option').forEach(b=>b.onclick=()=>{let i=+b.dataset.char;if(!unlocked.has(chars[i].id)){shop();return}selected=i;renderChars();preview()});
 $('#accessory-list').innerHTML=accessories.map(a=>`<button class="accessory-button" data-acc="${a.id}">${a.name}</button>`).join('');
 $$('.accessory-button').forEach(b=>b.onclick=()=>{let id=b.dataset.acc;if(id!=='none'&&!unlocked.has(id)){shop();return}acc=id;preview()});preview()
}
function renderShop(){
 const items=tab==='char'?chars:accessories.filter(a=>a.id!=='none');
 $('#shop-list').innerHTML=items.map(it=>{let owned=unlocked.has(it.id),active=tab==='char'?current().id===it.id:acc===it.id;let src=tab==='char'?it.base:chars[0].acc[it.id];return `<div class="shop-item"><img src="${src}" alt=""><div><strong>${it.name}</strong><small>${tab==='char'?it.speed+' VITESSE':'ACCESSOIRE'}</small></div><button class="shop-buy" data-id="${it.id}" ${!owned&&coins<it.cost?'disabled':''}>${owned?(active?'ÉQUIPÉ':'ÉQUIPER'):it.cost+' PIÈCES'}</button></div>`}).join('');
 $$('.shop-buy').forEach(b=>b.onclick=()=>{let it=items.find(x=>x.id===b.dataset.id);if(!unlocked.has(it.id)){if(coins<it.cost)return;coins-=it.cost;unlocked.add(it.id);persist()}if(tab==='char')selected=chars.findIndex(x=>x.id===it.id);else acc=it.id;renderShop();stats()});
 $$('.shop-tab').forEach(b=>b.classList.toggle('active',b.dataset.shopTab===tab));$('#shop-coins').textContent=pad(coins)
}
$$('[data-shop-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.shopTab;renderShop()});
function start(){
 elapsed=0;score=0;spawnClock=0;nextSpawnIn=spawnRate*(.65+Math.random()*.7);nextDifficultyAt=10;live=[];player={x:W/2,y:H-85,vy:0};paused=false;shield=0;shieldCd=0;wind=0;windCd=0;boss={x:W/2,y:75,vx:115,fire:0};
 let lv=levels[level],df=diffs[difficulty];speed=mode==='adventure'?lv.speed:df.speed;spawnRate=mode==='adventure'?lv.spawn:df.spawn;
 $('#game-mode-label').textContent=mode==='classic'?'MODE CLASSIQUE':'MODE AVENTURE — ÉTAPE '+(level+1)+'/05';$('#game-level-title').textContent=mode==='classic'?'La Cathédrale':lv.name;$('#game-overlay').hidden=true;$('#pause-button').textContent='PAUSE [P]';$('#game-status').textContent='EN COURS';
 screenTo('game','04 / 04','(04) — PARTIE EN COURS');last=performance.now();requestAnimationFrame(loop)
}
function finish(win=false){
 paused=false;let earned=win?100:Math.floor(score/100);if(win){coins+=earned;persist()}if(score>best){best=score;localStorage.setItem('Best_score',best)}
 $('#result-title').textContent=win?(level===4?'Terminé.':'Niveau réussi.'):'Écrasé.';$('#result-kicker').textContent=win?'(04) — NIVEAU VALIDÉ':'(04) — FIN DE PARTIE';$('#result-copy').textContent=win?(level===4?'Vous avez terminé les cinq niveaux.':'Le parcours continue.'):'La cathédrale a eu le dernier mot.';
 $('#result-score').textContent=pad(score);$('#result-best').textContent=pad(best);$('#result-coins').textContent='+'+pad(earned);
 $('#result-primary').innerHTML=win&&mode==='adventure'&&level<4?'NIVEAU SUIVANT <span>↗</span>':'REJOUER <span>↗</span>';
 $('#result-primary').onclick=()=>{if(win&&mode==='adventure'&&level<4)level++;else if(win&&mode==='adventure'&&level===4){level=0;home();return}start()};
 screenTo('result','04 / 04','(04) — RÉSULTAT')
}
function pause(){if(screen!=='game')return;paused=!paused;$('#game-overlay').hidden=!paused;$('#overlay-kicker').textContent='PARTIE SUSPENDUE';$('#overlay-title').textContent='En pause.';$('#overlay-copy').textContent='Votre progression est conservée.';$('#overlay-action').innerHTML='REPRENDRE <span>↗</span>';$('#pause-button').textContent=paused?'REPRENDRE [P]':'PAUSE [P]';$('#game-status').textContent=paused?'EN PAUSE':'EN COURS';if(!paused){last=performance.now();requestAnimationFrame(loop)}}
function cover(color=GAME_BACKGROUND){ctx.fillStyle=color;ctx.fillRect(0,0,W,H)}
function spawn(){let lv=levels[level],types=mode==='adventure'?lv.types:['vitrail','gargouille'],type=types[Math.random()*types.length|0],side=mode==='adventure'&&['wind','shield','darkness'].includes(lv.mechanic)&&Math.random()<.28;live.push({x:side?(Math.random()<.5?-35:W+35):35+Math.random()*(W-70),y:side?H-80:-35,vx:side?(Math.random()<.5?1:-1)*speed*.55:0,vy:side?0:speed+35+Math.random()*50,type,size:44,boss:false})}
function hit(o){return Math.abs(player.x-o.x)<(32+o.size)*.34&&Math.abs(player.y-o.y)<(48+o.size)*.34}
function loop(now){
 if(screen!=='game'||paused)return;let dt=Math.min((now-last)/1000,.04);last=now;elapsed+=dt;score=Math.floor(elapsed*20);$('#game-score').textContent=pad(score);$('#game-timer').textContent='00:'+String(Math.floor(elapsed)).padStart(2,'0');
 let lv=levels[level],mechanic=mode==='adventure'?lv.mechanic:'classic';cover(mode==='adventure'?bg[lv.bg]:bg[0]);ctx.fillStyle='rgba(255,255,255,.14)';ctx.fillRect(0,0,W,H);
 if(mechanic==='wind'){windCd-=dt;if(windCd<=0){wind=(Math.random()<.5?-1:1)*(85+Math.random()*110);windCd=2.5+Math.random()*3}player.x+=wind*dt;ctx.fillStyle='#000';ctx.font='16px sans-serif';ctx.fillText(wind>0?'→ → →':'← ← ←',W/2-35,55)}
 if(mechanic==='shield'){if(shield>0)shield=Math.max(0,shield-dt);if(shieldCd>0)shieldCd-=dt;if(keys.Space&&shieldCd<=0&&shield<=0){shield=3;shieldCd=8}ctx.fillStyle='#000';ctx.font='12px sans-serif';ctx.fillText(shield>0?'BOUCLIER '+shield.toFixed(1)+'S':shieldCd>0?'RECHARGE '+shieldCd.toFixed(1)+'S':'ESPACE — BOUCLIER PRÊT',20,25)}
 if(mechanic==='boss'){boss.x+=boss.vx*dt;if(boss.x<65||boss.x>W-65)boss.vx*=-1;boss.y=80+Math.sin(now/500)*18;boss.fire-=dt;if(boss.fire<=0){let a=Math.atan2(player.y-boss.y,player.x-boss.x);live.push({x:boss.x,y:boss.y,vx:Math.cos(a)*190,vy:Math.sin(a)*190,type:'bouleFeu',size:34,boss:true});boss.fire=.9}if(dragon.complete&&dragon.naturalWidth)ctx.drawImage(dragon,boss.x-58,boss.y-48,116,96);ctx.strokeStyle='#000';ctx.strokeRect(boss.x-48,boss.y-58,96,5);if(Math.abs(player.x-boss.x)<48&&Math.abs(player.y-boss.y)<48){finish(false);return}}
 spawnClock+=dt;
 if(spawnClock>=nextSpawnIn){
  spawnClock=0;
  const roll=Math.random();
  let burstSize=1;
  if(elapsed<12) burstSize=roll<.24?2:1;
  else if(elapsed<30) burstSize=roll<.14?3:roll<.52?2:1;
  else if(elapsed<60) burstSize=roll<.18?4:roll<.58?3:roll<.88?2:1;
  else burstSize=roll<.28?4:roll<.72?3:2;
  for(let i=0;i<burstSize;i++) spawn();
  // Le prochain groupe arrive à un délai aléatoire : fini le métronome régulier.
  let variation=.55+Math.random()*1.15;
  if(Math.random()<.2) variation*=.5; // petite rafale rapprochée
  nextSpawnIn=Math.max(.42,spawnRate*variation);
 }
 while(elapsed>=nextDifficultyAt){
  speed+=mode==='classic'?18:8;
  spawnRate=Math.max(.65,spawnRate-(mode==='classic'?.22:.12));
  nextDifficultyAt+=10;
 }
 live.forEach(o=>{o.x+=o.vx*dt;o.y+=o.vy*dt});live=live.filter(o=>o.y<H+60&&o.x>-70&&o.x<W+70);
 live.forEach(o=>{let im=obs[o.type];if(im?.complete&&im.naturalWidth)ctx.drawImage(im,o.x-o.size/2,o.y-o.size/2,o.size,o.size);else{ctx.fillStyle='#555';ctx.fillRect(o.x-15,o.y-15,30,30)}if(screen==='game'&&shield<=0&&hit(o)){finish(false)}});
 if(screen!=='game')return;
 if(keys.ArrowLeft||keys.a)player.x-=current().speed*dt;if(keys.ArrowRight||keys.d)player.x+=current().speed*dt;
 if((keys.ArrowUp||keys.w)&&player.y>=H-90)player.vy=-360;player.vy+=760*dt;player.y+=player.vy*dt;if(player.y>H-85){player.y=H-85;player.vy=0}
 player.x=Math.max(28,Math.min(W-28,player.x));let pimg=chosenImage(current());if(pimg.complete&&pimg.naturalWidth)ctx.drawImage(pimg,player.x-24,player.y-30,48,58);else{ctx.fillStyle='#000';ctx.fillRect(player.x-14,player.y-25,28,42)}
 if(shield>0){ctx.strokeStyle='#000';ctx.lineWidth=2;ctx.beginPath();ctx.arc(player.x,player.y,40,0,Math.PI*2);ctx.stroke()}
 if(mechanic==='darkness'){let g=ctx.createRadialGradient(player.x,player.y,25,player.x,player.y,210);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.92)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
 if(mode==='adventure'){let left=Math.max(0,lv.duration-elapsed),ratio=left/lv.duration;ctx.fillStyle='rgba(255,255,255,.8)';ctx.fillRect(16,H-25,W-32,5);ctx.fillStyle='#000';ctx.fillRect(16,H-25,(W-32)*ratio,5);ctx.fillStyle='#000';ctx.font='11px sans-serif';ctx.fillText(lv.name.toUpperCase()+' — '+Math.ceil(left)+'S',18,18);if(elapsed>=lv.duration){finish(true);return}}else{ctx.fillStyle='#000';ctx.font='11px sans-serif';ctx.fillText('SURVIE SANS LIMITE',18,20)}
 requestAnimationFrame(loop)
}
$$('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;level=0;select()});
$$('[data-action="home"]').forEach(b=>b.onclick=home);$$('[data-action="select"]').forEach(b=>b.onclick=select);$$('[data-action="shop"]').forEach(b=>b.onclick=shop);
$('#launch-button').onclick=start;$('#pause-button').onclick=pause;$('#overlay-action').onclick=pause;
$('#difficulty-button').onclick=()=>{difficulty=(difficulty+1)%diffs.length;$('#difficulty-button').innerHTML=diffs[difficulty].name+' <span>↻</span>'};
document.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp',' '].includes(e.key))e.preventDefault();keys[e.key===' '?'Space':e.key]=true;if((e.key==='p'||e.key==='P'||e.key==='Escape')&&screen==='game')pause();if(e.key==='Enter'&&screen==='select')start()});
document.addEventListener('keyup',e=>{keys[e.key===' '?'Space':e.key]=false});
cv.addEventListener('touchstart',e=>{keys[e.touches[0].clientX<innerWidth/2?'ArrowLeft':'ArrowRight']=true},{passive:true});cv.addEventListener('touchend',()=>{keys.ArrowLeft=false;keys.ArrowRight=false});
$('#difficulty-button').innerHTML=diffs[difficulty].name+' <span>↻</span>';home();stats();
})();
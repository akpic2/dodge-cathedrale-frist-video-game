(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];

// ===== CANVAS =====
// Le jeu tourne dans l'espace logique d'origine (480x420) : mêmes distances,
// mêmes vitesses, mêmes hitbox que la version v3. Le canvas est rendu en x2
// pour que les sprites pixel art restent nets dans la nouvelle interface.
const cv=$('#game-canvas'),ctx=cv.getContext('2d'),W=480,H=420,SCALE=2;
cv.width=W*SCALE;cv.height=H*SCALE;
const FONT='"Inter Tight",Arial,sans-serif';
const loadImg=s=>{const i=new Image();i.src=s;return i};
const ready=i=>i&&i.complete&&i.naturalWidth>0;

// Décor : fond uni assorti à l'interface (refonte), un ton par niveau
const GAME_BACKGROUND='#f3f3f3';
const BG=['#f3f3f3','#ededed','#f5f5f5','#e9e9e9','#f0f0f0'];

// ===== IMAGES =====
const DRAGON_IMG=loadImg('assets/img/Dragon.png');
const PROJ_IMGS={
  vitrail:loadImg('assets/img/Obstacles/Vitrail.png'),
  cloche:loadImg('assets/img/Obstacles/Cloches.png'),
  masqueJoyeux:loadImg('assets/img/Obstacles/masqueJoyeux.png'),
  masqueTriste:loadImg('assets/img/Obstacles/masqueTriste.png'),
  popCorn:loadImg('assets/img/Obstacles/popCorn.png'),
  clap:loadImg('assets/img/Obstacles/Clap.png'),
  brique:loadImg('assets/img/Obstacles/Brique.png'),
  gargouille:loadImg('assets/img/Obstacles/Gargouille.png'),
  bouleFeu:loadImg('assets/img/Obstacles/BouleFeu_petite.png'),
  bouleFeu2:loadImg('assets/img/Obstacles/BouleFeu2.png'),
};

// ===== PERSONNAGES (vitesses d'origine) =====
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
// Préchargement de tous les sprites joueur
const charImgs=new Map();chars.forEach(c=>[c.base,...Object.values(c.acc)].forEach(s=>charImgs.set(s,loadImg(s))));

// ===== NIVEAUX & DIFFICULTÉS (valeurs d'origine, spawnInt en frames) =====
const LEVELS=[
  {id:1,name:'Les Cloches',desc:'Cloches en groupes !',duration:25,spd:130,spawnInt:220,mechanic:'bells'},
  {id:2,name:'Le Bouclier',desc:'ESPACE = bouclier (3s/8s)',duration:35,spd:190,spawnInt:140,mechanic:'shield'},
  {id:3,name:'La Tempête',desc:'Vent qui change de sens !',duration:30,spd:160,spawnInt:180,mechanic:'wind'},
  {id:4,name:"L'Obscurité",desc:'Zone de vision réduite !',duration:30,spd:170,spawnInt:150,mechanic:'darkness'},
  {id:5,name:'Le Grand Boss',desc:'Évitez le Boss !',duration:45,spd:200,spawnInt:160,mechanic:'boss'},
];
const diffs=[{name:'FACILE',spd:100,spawnInt:300},{name:'NORMAL',spd:150,spawnInt:200},{name:'DIFFICILE',spd:220,spawnInt:120}];
const SHIELD_DURATION=3,SHIELD_COOLDOWN=8;

// ===== SAUVEGARDE =====
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
let coins=+(localStorage.getItem('coins')||0),best=+(localStorage.getItem('Best_score')||0),unlocked=new Set(get('unlocked',['HommeBleu','FemmeBleu']));
unlocked.add('HommeBleu');unlocked.add('FemmeBleu');
const persist=()=>{localStorage.setItem('coins',coins);localStorage.setItem('unlocked',JSON.stringify([...unlocked]))};

// ===== ÉTAT =====
let selected=0,acc='none',tab='char',difficulty=1,mode='classic',level=0,screen='home';
let player,gargoyles=[],score=0,scoreTime=0,frames=0,spd=150,spawnInt=200,levelTimer=0,lastTime=0,paused=false,keys={};
// Timers en secondes : équilibrage de référence à 144 FPS, indépendant de l'écran.
const REFERENCE_FPS=144,DIFFICULTY_STEP_SECONDS=200/REFERENCE_FPS;
let difficultyProgressTimer=0,spawnTimer=0,bossShootTimer=0;
let shieldActive=false,shieldTimer=0,shieldCooldown=0;
let windForce=0,windChangeCooldown=0;
let bossHP=0,bossMaxHP=15,bossX=W/2,bossY=80,bossVX=100,bossAnger=0;

const current=()=>chars[selected];
const lvl=()=>LEVELS[level];
const pad=n=>String(Math.max(0,Math.floor(n))).padStart(3,'0');

// ===== INTERFACE (refonte) =====
function stats(){$('#header-coins').textContent=pad(coins);$('#header-best').textContent=pad(best);$('#inspector-best').textContent=pad(best);$('#inspector-coins').textContent=pad(coins);$('#inspector-character').textContent=current().name.toUpperCase();$('#shop-coins').textContent=pad(coins)}
function screenTo(name,index,kicker){screen=name;$$('.screen').forEach(x=>x.classList.toggle('active',x.id==='screen-'+name));$$('.rail-link').forEach(x=>x.classList.toggle('active',x.dataset.action===(name==='game'||name==='result'?'home':name)));$('#view-index').textContent=index;$('#view-kicker').textContent=kicker;stats()}
function home(){paused=false;screenTo('home','01 / 04','(01) — EXPÉRIENCE ARCADE')}
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

// ===== PARTIE =====
function start(){
 const diff=diffs[difficulty];
 player={x:W/2,y:H-30,w:32,h:45,vy:0,isJumping:false};
 gargoyles=[];score=0;scoreTime=0;frames=0;levelTimer=0;keys={};
 shieldActive=false;shieldTimer=0;shieldCooldown=0;
 windForce=0;windChangeCooldown=0;
 bossHP=bossMaxHP;bossX=W/2;bossY=80;bossVX=100;bossAnger=0;
 if(mode==='adventure'){spd=lvl().spd;spawnInt=lvl().spawnInt}else{spd=diff.spd;spawnInt=diff.spawnInt}
 difficultyProgressTimer=0;spawnTimer=0;bossShootTimer=0;paused=false;
 cv.parentElement.style.background=mode==='adventure'?BG[level]:GAME_BACKGROUND;
 $('#game-mode-label').textContent=mode==='classic'?'MODE CLASSIQUE — '+diff.name:'MODE AVENTURE — ÉTAPE '+(level+1)+'/05';
 $('#game-level-title').textContent=mode==='classic'?'La Cathédrale':lvl().name;
 $('#game-overlay').hidden=true;$('#pause-button').textContent='PAUSE [P]';$('#game-status').textContent=mode==='adventure'?lvl().desc.toUpperCase():'EN COURS';
 screenTo('game','04 / 04','(04) — PARTIE EN COURS');
 lastTime=performance.now();requestAnimationFrame(loop)
}
function finish(win=false){
 paused=false;const earned=win?100:0;
 if(win){coins+=earned;persist()}
 if(score>=best){best=score;localStorage.setItem('Best_score',best)}
 const lastLevel=level===LEVELS.length-1;
 $('#result-title').textContent=win?(lastLevel?'Terminé.':'Niveau réussi.'):'Écrasé.';
 $('#result-kicker').textContent=win?'(04) — NIVEAU VALIDÉ':'(04) — FIN DE PARTIE';
 $('#result-copy').textContent=win?(lastLevel?'Vous avez terminé les cinq niveaux.':'Prochain niveau : '+LEVELS[level+1].name+' — '+LEVELS[level+1].desc):'La cathédrale a eu le dernier mot.';
 $('#result-score').textContent=pad(score);$('#result-best').textContent=pad(best);$('#result-coins').textContent='+'+pad(earned);
 $('#result-primary').innerHTML=win&&mode==='adventure'&&!lastLevel?'NIVEAU SUIVANT <span>↗</span>':win&&lastLevel?'RETOUR AU MENU <span>↗</span>':'REJOUER <span>↗</span>';
 $('#result-primary').onclick=()=>{if(win&&mode==='adventure'){if(!lastLevel)level++;else{level=0;home();return}}start()};
 screenTo('result','04 / 04','(04) — RÉSULTAT')
}
function pause(){if(screen!=='game')return;paused=!paused;keys={};$('#game-overlay').hidden=!paused;$('#overlay-kicker').textContent='PARTIE SUSPENDUE';$('#overlay-title').textContent='En pause.';$('#overlay-copy').textContent='Votre progression est conservée.';$('#overlay-action').innerHTML='REPRENDRE <span>↗</span>';$('#pause-button').textContent=paused?'REPRENDRE [P]':'PAUSE [P]';$('#game-status').textContent=paused?'EN PAUSE':'EN COURS';if(!paused){lastTime=performance.now();requestAnimationFrame(loop)}}
function activateShield(){
 if(screen==='game'&&!paused&&mode==='adventure'&&lvl().mechanic==='shield'&&!shieldActive&&shieldCooldown<=0){shieldActive=true;shieldTimer=SHIELD_DURATION;shieldCooldown=SHIELD_COOLDOWN}
}

// ===== DESSIN =====
function rrect(x,y,w,h,r,fill,stroke,lw){
 if(w<=0)return;r=Math.min(r,w/2,h/2);
 ctx.fillStyle=fill||'transparent';ctx.strokeStyle=stroke||'transparent';ctx.lineWidth=lw||1;
 ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
 ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
 ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
 if(fill)ctx.fill();if(stroke)ctx.stroke();
}
function drawBackground(){
 ctx.fillStyle=mode==='adventure'?BG[level]:GAME_BACKGROUND;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='#cfcfcf';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,H-24.5);ctx.lineTo(W,H-24.5);ctx.stroke();
}
function drawPlayer(x,y){
 const c=current(),w=52,h=52;
 let img=charImgs.get(c.base);
 if(acc!=='none'&&c.acc[acc]&&ready(charImgs.get(c.acc[acc])))img=charImgs.get(c.acc[acc]);
 if(ready(img))ctx.drawImage(img,x-w/2,y-h,w,h);
 else{ctx.fillStyle='#000';ctx.fillRect(x-w/2,y-h,w,h)}
}

// ===== SPAWN (logique d'origine) =====
function pushSide(type){
 const y=H-40;
 if(Math.random()<0.5)gargoyles.push({x:W+20,y,w:50,h:50,vx:-(spd*0.4+18+Math.random()*18),vy:0,rot:0,type,fromRight:true,isBossProj:false});
 else gargoyles.push({x:-20,y,w:50,h:50,vx:spd*0.4+18+Math.random()*18,vy:0,rot:0,type,fromRight:true,isBossProj:false});
}
function pushFall(type){
 const x=Math.random()*(W-30)+15;
 gargoyles.push({x,y:-30,w:50,h:50,vy:spd+30+Math.random()*48,vx:0,rot:0,type,fromRight:false,isBossProj:false});
}
function spawnGargoyle(){
 const mechanic=mode==='adventure'?lvl().mechanic:'';
 if(mechanic==='bells'){
  const positions=[80,160,240,320,400],count=Math.random()<0.45?2:1,used=new Set();
  for(let c=0;c<count;c++){
   let idx;do{idx=Math.floor(Math.random()*positions.length)}while(used.has(idx));
   used.add(idx);
   const x=positions[idx]+(Math.random()*24-12),type=Math.random()<0.5?'vitrail':'cloche';
   gargoyles.push({x,y:-30,w:50,h:50,vy:spd+50+Math.random()*40,vx:0,rot:0,type,fromRight:false,isBossProj:false});
  }
  return;
 }
 let type;
 if(mechanic==='wind')type=Math.random()<0.5?'masqueJoyeux':'masqueTriste';
 else if(mechanic==='shield')type=Math.random()<0.5?'popCorn':'clap';
 else if(mechanic==='darkness')type=Math.random()<0.5?'brique':'gargouille';
 else if(mechanic==='boss')type='gargouille';
 else type=Math.random()<0.3?'vitrail':'gargouille';
 if(Math.random()<0.3)pushSide(type);else pushFall(type);
}

// ===== PROJECTILES =====
function drawGargoyle(g){
 ctx.save();ctx.translate(g.x,g.y);
 const s=g.w||32;
 const draw=(key,w,h,rot)=>{
  const img=PROJ_IMGS[key];if(rot)ctx.rotate(rot);
  if(ready(img))ctx.drawImage(img,-w/2,-h/2,w,h);
  else{ctx.fillStyle='#777';ctx.fillRect(-w/2,-h/2,w,h)}
 };
 switch(g.type){
  case 'vitrail':draw('vitrail',s,s,g.rot);break;
  case 'cloche':draw('cloche',s,s,Math.sin(g.rot)*0.3);break;
  case 'masqueJoyeux':draw('masqueJoyeux',s,s,g.rot);break;
  case 'masqueTriste':draw('masqueTriste',s,s,g.rot);break;
  case 'popCorn':draw('popCorn',s,s,0);break;
  case 'clap':draw('clap',s,s,g.rot);break;
  case 'brique':draw('brique',s,s*0.6,0);break;
  case 'gargouille':draw('gargouille',s,s,0);break;
  case 'bouleFeu':draw('bouleFeu',s,s,g.rot);break;
  case 'bouleFeu2':draw('bouleFeu2',s+8,s+8,g.rot);break;
 }
 ctx.restore();
}

// ===== COLLISION (hitbox d'origine) =====
function checkCollision(p,g){
 const shrink=0.55;
 const left=p.x-p.w/2*0.7,right=p.x+p.w/2*0.7;
 const top=p.y+p.h*0.15,bottom=p.y+p.h*0.90;
 const gleft=g.x-(g.w/2)*shrink,gright=g.x+(g.w/2)*shrink;
 const gtop=g.y-(g.h/2)*shrink,gbottom=g.y+(g.h/2)*shrink;
 if(right<=gleft||left>=gright||bottom<=gtop||top>=gbottom)return false;
 if(p.y+p.h-5<g.y-g.h/2&&p.vy>=0)return false;
 return true;
}

// ===== BOSS =====
function updateBoss(dt){
 bossX+=bossVX*dt;
 if(bossX<50||bossX>W-50){bossVX*=-1;bossAnger=Math.min(1,bossAnger+0.04)}
 bossY=70+Math.sin(Date.now()/600)*20;
 const shotInterval=Math.max(55,110-Math.floor(bossAnger*40))/REFERENCE_FPS;
 bossShootTimer+=dt;
 if(bossShootTimer>=shotInterval){
  bossShootTimer-=shotInterval;
  const angle=Math.atan2(player.y-bossY,player.x-bossX),v=170+bossAnger*100;
  const bfType=Math.random()<0.5?'bouleFeu':'bouleFeu2',bfSize=bfType==='bouleFeu2'?40:31;
  gargoyles.push({x:bossX,y:bossY,w:bfSize,h:bfSize,vx:Math.cos(angle)*v,vy:Math.sin(angle)*v,rot:0,type:bfType,fromRight:false,isBossProj:true});
 }
}
function drawBoss(){
 ctx.save();ctx.translate(bossX,bossY);
 const s=1.8+bossAnger*0.4;ctx.scale(s,s);
 if(ready(DRAGON_IMG)){ctx.globalCompositeOperation='multiply';ctx.drawImage(DRAGON_IMG,-45,-45,90,90);ctx.globalCompositeOperation='source-over'}
 else{ctx.fillStyle='#000';ctx.fillRect(-16,-18,32,28)}
 ctx.restore();
 const bw=80,bx=bossX-bw/2,by=bossY-46;
 rrect(bx,by,bw,6,3,'rgba(255,255,255,.85)','#000',1);
 rrect(bx,by,bw*(bossHP/bossMaxHP),6,3,'#000',null);
 ctx.fillStyle='#000';ctx.font='500 7px '+FONT;ctx.textAlign='center';ctx.fillText('BOSS',bossX,by-3);
}

// ===== BOUCLE PRINCIPALE =====
function loop(timestamp){
 if(screen!=='game'||paused)return;
 const dt=Math.min((timestamp-lastTime)/1000,0.1);lastTime=timestamp;
 ctx.setTransform(SCALE,0,0,SCALE,0,0);ctx.imageSmoothingEnabled=false;
 ctx.clearRect(0,0,W,H);
 drawBackground();

 scoreTime+=dt;score=Math.floor(scoreTime*20);if(score>best)best=score;
 $('#game-score').textContent=pad(score);
 const t=Math.floor(scoreTime);$('#game-timer').textContent=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');

 if(mode==='adventure'){
  const lv=lvl();levelTimer+=dt;const timeLeft=lv.duration-levelTimer;

  if(lv.mechanic==='wind'){
   windChangeCooldown-=dt;
   if(windChangeCooldown<=0){windForce=(Math.random()<0.5?1:-1)*(80+Math.random()*130);windChangeCooldown=3+Math.random()*4}
   player.x+=windForce*dt;player.x=Math.max(player.w/2,Math.min(W-player.w/2,player.x));
   const dir=windForce>0?'→':'←',intensity=Math.abs(windForce)/200;
   ctx.fillStyle=`rgba(0,0,0,${0.15+intensity*0.35})`;ctx.font=`${Math.floor(14+intensity*10)}px ${FONT}`;ctx.textAlign='center';
   ctx.fillText(dir.repeat(4),W/2,H/2-70);
  }

  if(lv.mechanic==='shield'){
   if(shieldActive){shieldTimer-=dt;if(shieldTimer<=0)shieldActive=false}
   if(shieldCooldown>0)shieldCooldown-=dt;
   ctx.font='500 9px '+FONT;ctx.textAlign='left';ctx.fillStyle='#000';
   if(shieldActive){
    ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#000';ctx.lineWidth=2;ctx.strokeRect(1,1,W-2,H-2);
    ctx.fillStyle='#000';ctx.fillText('BOUCLIER — '+shieldTimer.toFixed(1)+'S',20,38);
   }else if(shieldCooldown>0){ctx.fillStyle='#777';ctx.fillText('RECHARGE — '+shieldCooldown.toFixed(1)+'S',20,38)}
   else ctx.fillText('ESPACE — BOUCLIER PRÊT',20,38);
  }

  if(lv.mechanic==='boss'){
   updateBoss(dt);drawBoss();
   if(Math.abs(player.x-bossX)<32&&Math.abs(player.y+player.h/2-bossY)<32){finish(false);return}
  }

  if(levelTimer>=lv.duration){finish(true);return}

  // Progression et apparitions calées sur le temps, équilibrage historique à 144 FPS.
  difficultyProgressTimer+=dt;
  while(difficultyProgressTimer>=DIFFICULTY_STEP_SECONDS){
   difficultyProgressTimer-=DIFFICULTY_STEP_SECONDS;
   spd+=12;spawnInt=Math.max(50,spawnInt-5);
  }
  spawnTimer+=dt;
  let spawnIntervalSeconds=spawnInt/REFERENCE_FPS;
  while(spawnTimer>=spawnIntervalSeconds){
   spawnGargoyle();spawnTimer-=spawnIntervalSeconds;
  }
  frames++;

  gargoyles.forEach(g=>{
   if(g.isBossProj){g.x+=g.vx*dt;g.y+=g.vy*dt}
   else if(g.fromRight)g.x+=g.vx*dt;
   else g.y+=g.vy*dt;
   g.rot+=2.4*dt;
  });
  gargoyles=gargoyles.filter(g=>{
   if(g.isBossProj)return g.x>-50&&g.x<W+50&&g.y>-50&&g.y<H+50;
   return g.fromRight?(g.x>-40&&g.x<W+40):(g.y<H+40);
  });
  let dead=false;
  for(const g of gargoyles){if(shieldActive)continue;if(checkCollision(player,g)){dead=true;break}}
  gargoyles.forEach(drawGargoyle);

  if(lv.mechanic==='darkness'){
   const px=player.x,py=player.y+player.h/2;
   const grad=ctx.createRadialGradient(px,py,0,px,py,200);
   grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(0.55,'rgba(0,0,0,0.55)');grad.addColorStop(1,'rgba(0,0,0,0.97)');
   ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  }

  // HUD
  const dark=lv.mechanic==='darkness',ink=dark?'#fff':'#000';
  const bw=W-40,bx=20,by=H-13;
  rrect(bx,by,bw,4,2,dark?'rgba(255,255,255,.25)':'#e7e7e7',null);
  rrect(bx,by,bw*Math.max(0,timeLeft/lv.duration),4,2,ink,null);
  ctx.fillStyle=ink;ctx.font='500 9px '+FONT;
  ctx.textAlign='left';ctx.fillText('NIV.'+lv.id+' — '+lv.name.toUpperCase(),20,16);
  ctx.textAlign='right';ctx.fillText(Math.max(0,Math.ceil(timeLeft))+'S',W-20,16);
  if(dead){finish(false);return}
 }else{
  // Mode classique
  // Même difficulté réelle sur tous les écrans, indépendamment des FPS.
  difficultyProgressTimer+=dt;
  while(difficultyProgressTimer>=DIFFICULTY_STEP_SECONDS){
   difficultyProgressTimer-=DIFFICULTY_STEP_SECONDS;
   spd+=25;spawnInt=Math.max(25,spawnInt-8);
  }
  spawnTimer+=dt;
  let spawnIntervalSeconds=spawnInt/REFERENCE_FPS;
  while(spawnTimer>=spawnIntervalSeconds){
   spawnGargoyle();spawnTimer-=spawnIntervalSeconds;
  }
  frames++;
  gargoyles.forEach(g=>{if(g.fromRight)g.x+=g.vx*dt;else g.y+=g.vy*dt;g.rot+=2.4*dt});
  gargoyles=gargoyles.filter(g=>g.fromRight?(g.x>-40&&g.x<W+40):(g.y<H+40));
  let dead=false;
  for(const g of gargoyles){if(checkCollision(player,g)){dead=true;break}}
  gargoyles.forEach(drawGargoyle);
  ctx.fillStyle='#000';ctx.font='500 9px '+FONT;ctx.textAlign='left';ctx.fillText('SURVIE SANS LIMITE — '+diffs[difficulty].name,20,16);
  if(dead){finish(false);return}
 }

 // ===== JOUEUR (physique d'origine) =====
 const ch=current();
 if(keys.ArrowLeft)player.x-=ch.speed*dt;
 if(keys.ArrowRight)player.x+=ch.speed*dt;
 if(keys.ArrowUp&&!player.isJumping){player.vy=-360;player.isJumping=true}
 player.x=Math.max(player.w/2,Math.min(W-player.w/2,player.x));
 player.vy+=720*dt;player.y+=player.vy*dt;
 if(player.y+player.h>=H-25){player.y=H-25-player.h;player.vy=0;player.isJumping=false}
 drawPlayer(player.x,player.y+player.h);
 const dark=mode==='adventure'&&lvl().mechanic==='darkness';
 ctx.fillStyle=dark?'rgba(255,255,255,.6)':'rgba(0,0,0,.45)';ctx.font='400 9px '+FONT;ctx.textAlign='center';
 ctx.fillText(ch.name.toUpperCase(),player.x,player.y-5);

 requestAnimationFrame(loop);
}

// ===== ÉVÉNEMENTS =====
$$('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;select()});
$$('[data-action="home"]').forEach(b=>b.onclick=home);$$('[data-action="select"]').forEach(b=>b.onclick=select);$$('[data-action="shop"]').forEach(b=>b.onclick=shop);
$('#launch-button').onclick=start;$('#pause-button').onclick=pause;$('#overlay-action').onclick=pause;
$('#difficulty-button').onclick=()=>{difficulty=(difficulty+1)%diffs.length;$('#difficulty-button').innerHTML=diffs[difficulty].name+' <span>↻</span>'};
document.addEventListener('keydown',e=>{
 if(screen==='game'){
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();
  if(e.key==='p'||e.key==='P'||e.key==='Escape'){pause();return}
  if(paused)return;
  keys[e.key]=true;
  if(e.key===' ')activateShield();
  return;
 }
 if(e.key==='Enter'&&screen==='select'){e.preventDefault();start()}
 else if((e.key==='Enter'||e.key===' ')&&screen==='result'){e.preventDefault();$('#result-primary').click()}
 else if(e.key==='Escape'&&(screen==='shop'||screen==='select'))home();
});
document.addEventListener('keyup',e=>{keys[e.key]=false});
window.addEventListener('blur',()=>{keys={}});
cv.addEventListener('click',activateShield);
cv.addEventListener('touchstart',e=>{keys[e.touches[0].clientX<innerWidth/2?'ArrowLeft':'ArrowRight']=true},{passive:true});
cv.addEventListener('touchend',()=>{keys.ArrowLeft=false;keys.ArrowRight=false});
$('#difficulty-button').innerHTML=diffs[difficulty].name+' <span>↻</span>';home();stats();
})();

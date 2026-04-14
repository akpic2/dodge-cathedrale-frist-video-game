const cv=document.getElementById('canvas'),ctx=cv.getContext('2d'),W=480,H=420;
let lastTime=0;

// ===== CHARGEMENT IMAGES =====
function loadImg(src){const i=new Image();i.src=src;return i;}

// ===== IMAGES DE FOND PAR NIVEAU =====
const BG_IMGS=[
  loadImg('assets/img/caté.png'),
  loadImg('assets/img/cinéma.png'),
  loadImg('assets/img/théatre.png'),

  loadImg('assets/img/porteguillaume.png'),
  loadImg('assets/img/lvl4.png'),
];

// ===== IMAGE DU DRAGON (BOSS) =====
const DRAGON_IMG=loadImg('assets/img/Dragon.png');

// ===== IMAGES PROJECTILES PAR NIVEAU =====
const PROJ_IMGS={
  vitrail:      loadImg('assets/img/Obstacles/Vitrail.png'),
  cloche:       loadImg('assets/img/Obstacles/Cloches.png'),
  masqueJoyeux: loadImg('assets/img/Obstacles/masqueJoyeux.png'),
  masqueTriste: loadImg('assets/img/Obstacles/masqueTriste.png'),
  popCorn:      loadImg('assets/img/Obstacles/popCorn.png'),
  clap:         loadImg('assets/img/Obstacles/Clap.png'),
  brique:       loadImg('assets/img/Obstacles/Brique.png'),
  gargouille:   loadImg('assets/img/Obstacles/Gargouille.png'),
  bouleFeu:     loadImg('assets/img/Obstacles/BouleFeu_petite.png'),
  bouleFeu2:    loadImg('assets/img/Obstacles/BouleFeu2.png'),
};

// ===== IMAGES PERSONNAGES =====
const IMGS={
  HommeBleu:{base:loadImg('assets/img/perso 3/Homme/Homme_Bleu.png'),lunettes:loadImg('assets/img/perso 3/Homme/Homme_Bleu_Sunglass.png'),aureole:loadImg('assets/img/perso 3/Homme/Homme_Bleu_Aureole.png'),biere:loadImg('assets/img/perso 3/Homme/Homme_Bleu_Biere.png'),},
  FemmeBleu:{base:loadImg('assets/img/perso 3/Femme/Femme_Bleu.png'),lunettes:loadImg('assets/img/perso 3/Femme/Femme_Bleu_Sunglass.png'),aureole:loadImg('assets/img/perso 3/Femme/Femme_Bleu_Aureole.png'),biere:loadImg('assets/img/perso 3/Femme/Femme_Bleu_Biere.png'),},
  HitmanG:{base:loadImg('assets/img/Perso 2/Hitman_G/Hitmanl_G.png'),lunettes:loadImg('assets/img/Perso 2/Hitman_G/Hitman_Lunette_G.png'),aureole:loadImg('assets/img/Perso 2/Hitman_G/Hitman_Oreol_G.png'),biere:loadImg('assets/img/Perso 2/Hitman_G/Hitman_Biere_G.png'),},
  HitmanF:{base:loadImg('assets/img/Perso 2/Hitman_F/Hitmanl_F.png'),lunettes:loadImg('assets/img/Perso 2/Hitman_F/Hitman_Lunette_F.png'),aureole:loadImg('assets/img/Perso 2/Hitman_F/Hitman_Oreol_F.png'),biere:loadImg('assets/img/Perso 2/Hitman_F/Hitman_Biere_F.png'),},
  Garcon1:{base:loadImg('assets/img/Perso 1/Garcon1/Garcon1.png'),lunettes:loadImg('assets/img/Perso 1/Garcon1/Garcon_lunette1.png'),aureole:loadImg('assets/img/Perso 1/Garcon1/Garcon_oreole1.png'),biere:loadImg('assets/img/Perso 1/Garcon1/Garcon_biere1.png'),},
  Fille1:{base:loadImg('assets/img/Perso 1/Fille1/Fille1.png'),lunettes:loadImg('assets/img/Perso 1/Fille1/Fille_lunette1.png'),aureole:loadImg('assets/img/Perso 1/Fille1/Fille_oreole1.png'),biere:loadImg('assets/img/Perso 1/Fille1/Fille_biere1.png'),},
  Chevalier:{base:loadImg('assets/img/Personnages_speciaux/Chevalier.png'),lunettes:null,aureole:null,biere:null,},
  Gigachad:{base:loadImg('assets/img/Personnages_speciaux/Gigachad.png'),lunettes:null,aureole:null,biere:null,},
};

function drawCharImg(id,x,y,acc,w=52,h=52){
  const imgs=IMGS[id];if(!imgs)return;let img=imgs.base;
  if(acc==='lunettes'&&imgs.lunettes&&imgs.lunettes.complete&&imgs.lunettes.naturalWidth>0)img=imgs.lunettes;
  else if(acc==='aureole'&&imgs.aureole&&imgs.aureole.complete&&imgs.aureole.naturalWidth>0)img=imgs.aureole;
  else if(acc==='biere'&&imgs.biere&&imgs.biere.complete&&imgs.biere.naturalWidth>0)img=imgs.biere;
  if(img&&img.complete&&img.naturalWidth>0){ctx.save();ctx.drawImage(img,x-w/2,y-h,w,h);ctx.restore();}
  else{ctx.save();ctx.fillStyle='#5a4a80';ctx.fillRect(x-w/2,y-h,w,h);ctx.fillStyle='#fff';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(id.slice(0,4),x,y-h/2);ctx.restore();}
}

// ===== BOUTIQUE =====
const SHOP_ITEMS=[
  {id:'HommeBleu',type:'char',name:'Homme Bleu',cost:0,free:true,desc:'Équilibré • Rapide',tier:1,emoji:'🧑'},
  {id:'FemmeBleu',type:'char',name:'Femme Bleu',cost:0,free:true,desc:'Équilibrée • Rapide',tier:1,emoji:'👩'},
  {id:'Garcon1',type:'char',name:'Garçon',cost:80,free:false,desc:'Polyvalent • Équilibré',tier:2,emoji:'👦'},
  {id:'Fille1',type:'char',name:'Fille',cost:80,free:false,desc:'Polyvalente • Équilibrée',tier:2,emoji:'👧'},
  {id:'HitmanG',type:'char',name:'Hitman',cost:150,free:false,desc:'Ultra-rapide • Dangereux',tier:3,emoji:'🕵️'},
  {id:'HitmanF',type:'char',name:'Hitwoman',cost:150,free:false,desc:'Ultra-rapide • Dangereuse',tier:3,emoji:'🕵️‍♀️'},
  {id:'Chevalier',type:'char',name:'Chevalier',cost:300,free:false,desc:'Armure légendaire',tier:4,emoji:'🛡️'},
  {id:'Gigachad',type:'char',name:'Gigachad',cost:450,free:false,desc:'Vitesse maximale',tier:4,emoji:'💪'},
  {id:'lunettes',type:'acc',name:'Lunettes',cost:80,free:false,desc:'Style épique',emoji:'😎'},
  {id:'aureole',type:'acc',name:'Auréole',cost:120,free:false,desc:'Divin',emoji:'✨'},
  {id:'biere',type:'acc',name:'Bière',cost:60,free:false,desc:'Pour la soif',emoji:'🍺'},
];

function loadUnlocked(){try{const raw=localStorage.getItem('unlocked');if(raw)return new Set(JSON.parse(raw));}catch(e){}return new Set(['HommeBleu','FemmeBleu']);}
function saveUnlocked(){localStorage.setItem('unlocked',JSON.stringify([...unlockedItems]));}
let unlockedItems=loadUnlocked();SHOP_ITEMS.filter(i=>i.free).forEach(i=>unlockedItems.add(i.id));
function isUnlocked(id){return unlockedItems.has(id);}
function tryBuy(id){const item=SHOP_ITEMS.find(i=>i.id===id);if(!item||isUnlocked(id))return false;if(coins<item.cost)return false;coins-=item.cost;saveCoins();unlockedItems.add(id);saveUnlocked();return true;}

// ===== PERSONNAGES =====
const CHARS=[
  {id:'HommeBleu',name:'Homme Bleu',speed:280,draw(x,y,acc){drawCharImg('HommeBleu',x,y,acc);}},
  {id:'FemmeBleu',name:'Femme Bleu',speed:280,draw(x,y,acc){drawCharImg('FemmeBleu',x,y,acc);}},
  {id:'HitmanG',name:'Hitman',speed:300,draw(x,y,acc){drawCharImg('HitmanG',x,y,acc);}},
  {id:'HitmanF',name:'Hitwoman',speed:300,draw(x,y,acc){drawCharImg('HitmanF',x,y,acc);}},
  {id:'Garcon1',name:'Garçon',speed:280,draw(x,y,acc){drawCharImg('Garcon1',x,y,acc);}},
  {id:'Fille1',name:'Fille',speed:280,draw(x,y,acc){drawCharImg('Fille1',x,y,acc);}},
  {id:'Chevalier',name:'Chevalier',speed:260,draw(x,y,acc){drawCharImg('Chevalier',x,y,acc);}},
  {id:'Gigachad',name:'Gigachad',speed:320,draw(x,y,acc){drawCharImg('Gigachad',x,y,acc);}},
];

const ACCESSORIES=[{id:'none',name:'Rien'},{id:'lunettes',name:'Lunettes'},{id:'aureole',name:'Auréole'},{id:'biere',name:'Bière'}];
const COLORS=[{label:'Défaut',body:'#c41e3a',hat:'#ffd700'}];

let state='mode';let gameMode='classic';
const DIFFICULTIES=[{id:'easy',label:'Facile',spd:100,spawnInt:300},{id:'normal',label:'Normal',spd:150,spawnInt:200},{id:'hard',label:'Difficile',spd:220,spawnInt:120}];
let difficultyIdx=1;let charIdx=0,colorIdx=0,accIdx=0;let customName='';
let player,gargoyles,score,best=0,scoreTime=0,frames,spd,spawnInt,lastSpawn,levelTimer=0;
let mouseX=W/2,mouseY=0;let keys={};let nameInput=false;let hoverChar=-1,hoverColor=-1,hoverAcc=-1;
let shopScrollY=0;let hoverShopItem=-1;let shopFeedback=null;
let coins=parseInt(localStorage.getItem('coins')||'0');let currentLevel=1;let coinPopups=[];
let shieldActive=false,shieldTimer=0,shieldCooldown=0;const SHIELD_DURATION=3,SHIELD_COOLDOWN=8;
let windForce=0,windChangeCooldown=0;
let bossHP=0,bossMaxHP=15,bossX=W/2,bossY=80,bossVX=100,bossAnger=0;

const LEVELS=[
  {id:1,name:'Les Cloches',desc:'Cloches en groupes !',duration:25,color:'#a07fd4',spd:130,spawnInt:220,mechanic:'bells',bg:'#0d0d1f'},
  {id:2,name:'Le Bouclier',desc:'ESPACE = bouclier (3s/8s)',duration:35,color:'#4ad48a',spd:190,spawnInt:140,mechanic:'shield',bg:'#091a12'},
  {id:3,name:'La Tempête',desc:'Vent qui change de sens !',duration:30,color:'#4a9fd4',spd:160,spawnInt:180,mechanic:'wind',bg:'#0a1020'},
  {id:4,name:"L'Obscurité",desc:'Zone de vision réduite !',duration:30,color:'#d4a44a',spd:170,spawnInt:150,mechanic:'darkness',bg:'#000005'},
  {id:5,name:'Le Grand Boss',desc:'Évitez le Boss !',duration:45,color:'#d4504a',spd:200,spawnInt:160,mechanic:'boss',bg:'#1a0505'},
];

function getLevelConfig(){return LEVELS[currentLevel-1];}
function saveCoins(){localStorage.setItem('coins',coins);}
function addCoinPopup(x,y,amt){coinPopups.push({x,y,amount:amt,life:2.2,maxLife:2.2});}
function getChosenChar(){return CHARS[charIdx];}
function getChosenAcc(){return ACCESSORIES[accIdx].id;}
function getDisplayName(){return customName||getChosenChar().name;}
function getDifficulty(){return DIFFICULTIES[difficultyIdx];}

function updateDifficultyButton(){
  const btn=document.getElementById('difficultyBtn');if(!btn)return;
  if(state==='mode'||state==='shop'){btn.style.display='none';return;}
  if(gameMode==='classic'){btn.style.display='inline-block';btn.textContent='Diff: '+getDifficulty().label;}
  else{btn.style.display='none';}
}

function initGame(){
  const diff=getDifficulty();
  player={x:W/2,y:H-30,w:32,h:45,vy:0,isJumping:false};
  gargoyles=[];score=0;scoreTime=0;frames=0;levelTimer=0;coinPopups=[];
  shieldActive=false;shieldTimer=0;shieldCooldown=0;
  windForce=0;windChangeCooldown=0;
  bossHP=bossMaxHP;bossX=W/2;bossY=80;bossVX=100;bossAnger=0;
  if(gameMode==='adventure'){const lv=getLevelConfig();spd=lv.spd;spawnInt=lv.spawnInt;}
  else{spd=diff.spd;spawnInt=diff.spawnInt;}
  lastSpawn=0;state='playing';
}

// ===== INPUTS =====
document.addEventListener('keydown',e=>{
  if(state==='playing'){
    keys[e.key]=true;
    if(e.key===' '&&gameMode==='adventure'&&getLevelConfig().mechanic==='shield'){
      if(!shieldActive&&shieldCooldown<=0){shieldActive=true;shieldTimer=SHIELD_DURATION;shieldCooldown=SHIELD_COOLDOWN;}
    }
    e.preventDefault();return;
  }
  if(state==='select'){
    if(nameInput){
      if(e.key==='Backspace')customName=customName.slice(0,-1);
      else if(e.key==='Enter'||e.key==='Escape')nameInput=false;
      else if(e.key.length===1&&customName.length<12)customName+=e.key;
      return;
    }
    if(e.key==='ArrowLeft'){navigateChar(-1);}
    if(e.key==='ArrowRight'){navigateChar(1);}
    if(e.key==='ArrowUp'){navigateCharRow(-1);}
    if(e.key==='ArrowDown'){navigateCharRow(1);}
    if(e.key==='Enter')initGame();
  }
  if(state==='shop'){if(e.key==='Escape')state='mode';}
  if(state==='dead'){if(e.key==='Enter'||e.key===' '){gameMode==='classic'?initGame():(state='mode');}}
  if(state==='win'){
    if(e.key==='Enter'||e.key===' '){
      if(gameMode==='adventure'){
        if(currentLevel<LEVELS.length){currentLevel++;initGame();}
        else{currentLevel=1;state='mode';}
      }else state='mode';
    }
  }
});
document.addEventListener('keyup',e=>{keys[e.key]=false;});

function navigateChar(dir){let idx=charIdx;for(let i=0;i<CHARS.length;i++){idx=(idx+dir+CHARS.length)%CHARS.length;if(isUnlocked(CHARS[idx].id)){charIdx=idx;return;}}}
function navigateCharRow(dir){let idx=charIdx+dir*4;idx=Math.max(0,Math.min(CHARS.length-1,idx));if(isUnlocked(CHARS[idx].id))charIdx=idx;}

cv.addEventListener('click',e=>{
  const r=cv.getBoundingClientRect();
  const cx=(e.clientX-r.left)*(W/r.width);
  const cy=(e.clientY-r.top)*(H/r.height);
  if(state==='mode'){
    if(cx>=30&&cx<=210&&cy>=160&&cy<=270){gameMode='classic';state='select';updateDifficultyButton();return;}
    if(cx>=270&&cx<=450&&cy>=160&&cy<=270){gameMode='adventure';state='select';updateDifficultyButton();return;}
    if(cx>=W/2-60&&cx<=W/2+60&&cy>=115&&cy<=155){state='shop';updateDifficultyButton();return;}
  }
  if(state==='shop'){
    if(cx>=10&&cx<=80&&cy>=8&&cy<=28){state='mode';return;}
    const itemW=200,itemH=54,gap=8,cols=2,startX=(W-cols*(itemW+gap)+gap)/2,startY=40;
    SHOP_ITEMS.forEach((item,i)=>{
      const col=i%cols,row=Math.floor(i/cols),ix=startX+col*(itemW+gap),iy=startY+row*(itemH+gap)-shopScrollY;
      if(iy+itemH<35||iy>H)return;
      if(cx>=ix&&cx<=ix+itemW&&cy>=iy&&cy<=iy+itemH){
        if(isUnlocked(item.id)){
          if(item.type==='char'){const ci=CHARS.findIndex(c=>c.id===item.id);if(ci>=0)charIdx=ci;shopFeedback={msg:'Personnage équipé !',timer:1.5,color:'#4ad48a'};}
          else{const ai=ACCESSORIES.findIndex(a=>a.id===item.id);if(ai>=0)accIdx=ai;shopFeedback={msg:'Accessoire équipé !',timer:1.5,color:'#4ad48a'};}
        }else{
          const ok=tryBuy(item.id);
          if(ok){
            shopFeedback={msg:'Acheté : '+item.name+' !',timer:2,color:'#4ad48a'};
            if(item.type==='char'){const ci=CHARS.findIndex(c=>c.id===item.id);if(ci>=0)charIdx=ci;}
            else{const ai=ACCESSORIES.findIndex(a=>a.id===item.id);if(ai>=0)accIdx=ai;}
          }else{shopFeedback={msg:'Pas assez de pièces !',timer:1.5,color:'#ff5555'};}
        }
      }
    });
    return;
  }
  if(state==='select'){
    nameInput=false;
    for(let i=0;i<CHARS.length;i++){
      const x=getCharCardX(i),y=getCharCardY(i);
      if(cx>=x&&cx<=x+96&&cy>=y&&cy<=y+74){if(isUnlocked(CHARS[i].id))charIdx=i;return;}
    }
    const accW=72,accGap=6,accPerRow=3,accRowW=accPerRow*accW+(accPerRow-1)*accGap,accStartX=(W-accRowW)/2;
    for(let i=0;i<ACCESSORIES.length;i++){
      const col=i%accPerRow,row=Math.floor(i/accPerRow),x=accStartX+col*(accW+accGap),y=206+row*27;
      if(cx>=x&&cx<=x+accW&&cy>=y&&cy<=y+22){if(ACCESSORIES[i].id==='none'||isUnlocked(ACCESSORIES[i].id))accIdx=i;return;}
    }
    if(cx>=12&&cx<=W-12&&cy>=268&&cy<=290){nameInput=true;return;}
    if(cx>=W/2-75&&cx<=W/2+75&&cy>=296&&cy<=328){initGame();return;}
  }
  if(state==='dead'){gameMode==='classic'?initGame():(state='mode');}
  if(state==='win'){
    if(gameMode==='adventure'){
      if(currentLevel<LEVELS.length){currentLevel++;initGame();}
      else{currentLevel=1;state='mode';}
    }else state='mode';
  }
  if(state==='playing'&&gameMode==='adventure'&&getLevelConfig().mechanic==='shield'){
    if(!shieldActive&&shieldCooldown<=0){shieldActive=true;shieldTimer=SHIELD_DURATION;shieldCooldown=SHIELD_COOLDOWN;}
  }
});

cv.addEventListener('wheel',e=>{
  if(state==='shop'){
    shopScrollY=Math.max(0,shopScrollY+e.deltaY*0.4);
    const itemH=54,gap=8,cols=2,maxScroll=Math.max(0,Math.ceil(SHOP_ITEMS.length/cols)*(itemH+gap)-(H-60));
    shopScrollY=Math.min(shopScrollY,maxScroll);e.preventDefault();
  }
},{passive:false});

const difficultyBtn=document.getElementById('difficultyBtn');
if(difficultyBtn){difficultyBtn.addEventListener('click',()=>{if(state!=='playing'){difficultyIdx=(difficultyIdx+1)%DIFFICULTIES.length;updateDifficultyButton();}});}
updateDifficultyButton();

cv.addEventListener('mousemove',e=>{
  const r=cv.getBoundingClientRect();
  mouseX=(e.clientX-r.left)*(W/r.width);mouseY=(e.clientY-r.top)*(H/r.height);
  if(state==='shop'){
    hoverShopItem=-1;
    const itemW=200,itemH=54,gap=8,cols=2,startX=(W-cols*(itemW+gap)+gap)/2,startY=40;
    SHOP_ITEMS.forEach((item,i)=>{
      const col=i%cols,row=Math.floor(i/cols),ix=startX+col*(itemW+gap),iy=startY+row*(itemH+gap)-shopScrollY;
      if(iy+itemH>=35&&iy<=H){if(mouseX>=ix&&mouseX<=ix+itemW&&mouseY>=iy&&mouseY<=iy+itemH)hoverShopItem=i;}
    });
  }
  if(state==='select'){
    hoverChar=-1;hoverAcc=-1;
    for(let i=0;i<CHARS.length;i++){const x=getCharCardX(i),y=getCharCardY(i);if(mouseX>=x&&mouseX<=x+96&&mouseY>=y&&mouseY<=y+74)hoverChar=i;}
    const accW=72,accGap=6,accPerRow=3,accRowW=accPerRow*accW+(accPerRow-1)*accGap,accStartX=(W-accRowW)/2;
    for(let i=0;i<ACCESSORIES.length;i++){const col=i%accPerRow,row=Math.floor(i/accPerRow),x=accStartX+col*(accW+accGap),y=206+row*27;if(mouseX>=x&&mouseX<=x+accW&&mouseY>=y&&mouseY<=y+22)hoverAcc=i;}
  }
});
cv.addEventListener('touchmove',e=>{e.preventDefault();const r=cv.getBoundingClientRect();mouseX=(e.touches[0].clientX-r.left)*(W/r.width);},{passive:false});

function getCharCardX(idx){const cols=4,gap=8,cardW=96,rowW=cols*cardW+(cols-1)*gap,startX=(W-rowW)/2;return startX+(idx%cols)*(cardW+gap);}
function getCharCardY(idx){const cardH=74,gap=8;return 44+(Math.floor(idx/4))*(cardH+gap);}

// ===== UTILITAIRES =====
function drawCoin(x,y,r){
  ctx.save();
  const cg=ctx.createRadialGradient(x-r*0.3,y-r*0.3,0,x,y,r);
  cg.addColorStop(0,'#ffe870');cg.addColorStop(1,'#e0a818');
  ctx.fillStyle=cg;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#c09010';ctx.lineWidth=0.5;ctx.stroke();ctx.restore();
}

function rrect(x,y,w,h,r,fill,stroke,lw){
  ctx.fillStyle=fill||'transparent';ctx.strokeStyle=stroke||'transparent';ctx.lineWidth=lw||2;
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
  if(fill)ctx.fill();if(stroke)ctx.stroke();
}

function drawCathedral(){
  const lv=gameMode==='adventure'?getLevelConfig():null;
  const bgColor=lv?lv.bg:'#0d0d1f';
  ctx.fillStyle=bgColor;ctx.fillRect(0,0,W,H);
  if(lv){
    const bgImg=BG_IMGS[lv.id-1];
    if(bgImg&&bgImg.complete&&bgImg.naturalWidth>0){
      ctx.imageSmoothingEnabled=false;ctx.drawImage(bgImg,0,0,W,H);ctx.imageSmoothingEnabled=true;
    }
  } else {
    // Fond classique simple
    ctx.fillStyle='#1e1a3a';ctx.fillRect(0,H-80,W,80);
  }
}

// ===== ÉCRAN MODE =====
function drawModeScreen(){
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#0c0820');bg.addColorStop(1,'#160e35');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  ctx.save();ctx.globalAlpha=0.06;ctx.fillStyle='#7c5cf0';
  ctx.beginPath();ctx.arc(400,55,110,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(55,340,75,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=1;ctx.restore();
  ctx.save();ctx.shadowColor='#7c5cf0';ctx.shadowBlur=26;
  ctx.fillStyle='#f0c840';ctx.font='800 34px Outfit,sans-serif';ctx.textAlign='center';
  ctx.fillText('CHARTRES',W/2,46);ctx.restore();
  ctx.fillStyle='#3e3668';ctx.font='700 11px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('D A S H',W/2,62);
  rrect(W/2-42,70,84,24,12,'#1a1445','#f0c840',1.5);
  drawCoin(W/2-25,82,7);ctx.fillStyle='#f0c840';ctx.font='700 12px Outfit,sans-serif';ctx.textAlign='left';ctx.fillText(coins,W/2-13,88);
  ctx.save();ctx.shadowColor='#7c5cf0';ctx.shadowBlur=18;
  const sg=ctx.createLinearGradient(W/2-65,104,W/2+65,138);sg.addColorStop(0,'#3a2898');sg.addColorStop(1,'#5a3ab8');
  rrect(W/2-65,104,130,34,10,sg,'#9b7ef8',1.5);ctx.restore();
  ctx.fillStyle='#f0eaff';ctx.font='700 13px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('🛍️ BOUTIQUE',W/2,126);
  ctx.save();ctx.shadowColor='#7c5cf0';ctx.shadowBlur=14;
  const cg1=ctx.createLinearGradient(30,154,210,280);cg1.addColorStop(0,'#181440');cg1.addColorStop(1,'#241c58');
  rrect(30,154,180,120,12,cg1,'#7c5cf0',1.5);ctx.restore();
  ctx.fillStyle='#7c5cf0';ctx.fillRect(32,156,176,2);
  ctx.fillStyle='#f0c840';ctx.font='700 14px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('Mode Classique',120,182);
  ctx.fillStyle='#9a8dc8';ctx.font='400 10px Outfit,sans-serif';ctx.fillText('Survie infinie',120,200);ctx.fillText('Difficulté ajustable',120,215);
  rrect(72,225,96,20,10,'#221a50','#7c5cf0',1);ctx.fillStyle='#c0b0f8';ctx.font='600 9px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('Diff: '+getDifficulty().label,120,238);
  ctx.save();ctx.shadowColor='#2de8a0';ctx.shadowBlur=14;
  const cg2=ctx.createLinearGradient(270,154,450,280);cg2.addColorStop(0,'#0e1e40');cg2.addColorStop(1,'#102a40');
  rrect(270,154,180,120,12,cg2,'#2de8a0',1.5);ctx.restore();
  ctx.fillStyle='#2de8a0';ctx.fillRect(272,156,176,2);
  ctx.fillStyle='#2de8a0';ctx.font='700 14px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('Mode Aventure',360,182);
  ctx.fillStyle='#9a8dc8';ctx.font='400 10px Outfit,sans-serif';ctx.fillText('5 niveaux progressifs',360,200);ctx.fillText('Mécaniques spéciales',360,215);
  rrect(312,225,96,20,10,'#0a2220','#2de8a0',1);ctx.fillStyle='#2de8a0';ctx.font='600 9px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('Niveaux épiques',360,238);
  ctx.strokeStyle='rgba(60,48,120,0.5)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(30,293);ctx.lineTo(W-30,293);ctx.stroke();
  ctx.fillStyle='#2a2460';ctx.font='400 9px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('← → pour choisir un mode  •  Entrée pour jouer',W/2,H-12);
}

// ===== ÉCRAN SÉLECTION =====
function drawSelectScreen(){
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#0c0820');bg.addColorStop(1,'#160e35');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(124,92,240,0.18)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,28);ctx.lineTo(W,28);ctx.stroke();
  ctx.fillStyle='#f0eaff';ctx.font='700 14px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('Choisissez votre personnage',W/2,20);
  for(let i=0;i<CHARS.length;i++){
    const x=getCharCardX(i),y=getCharCardY(i),unlocked=isUnlocked(CHARS[i].id),selected=i===charIdx;
    ctx.save();if(selected){ctx.shadowColor='#f0c840';ctx.shadowBlur=16;}
    const cg=ctx.createLinearGradient(x,y,x,y+74);
    cg.addColorStop(0,selected?'#2c2270':unlocked?'#1a1548':'#100e28');
    cg.addColorStop(1,selected?'#201860':unlocked?'#141238':'#0c0a22');
    rrect(x,y,96,74,8,cg,selected?'#f0c840':'#2e2860',selected?2:1);ctx.restore();
    if(unlocked){CHARS[i].draw(x+48,y+52,accIdx===0?'none':ACCESSORIES[accIdx].id,40,40);}
    else{
      ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(x+4,y+4,88,50);
      ctx.fillStyle='#3e3668';ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.fillText('🔒',x+48,y+35);
      const si=SHOP_ITEMS.find(s=>s.id===CHARS[i].id);
      if(si){drawCoin(x+35,y+54,5);ctx.fillStyle='#9a8dc8';ctx.font='600 9px Outfit,sans-serif';ctx.textAlign='left';ctx.fillText(si.cost,x+44,y+59);}
    }
    ctx.fillStyle=selected?'#f0c840':unlocked?'#9a8dc8':'#3e3668';
    ctx.font=(selected?'700':'400')+' 9px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText(CHARS[i].name,x+48,y+70);
  }
  ctx.strokeStyle='rgba(124,92,240,0.18)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(20,202);ctx.lineTo(W-20,202);ctx.stroke();
  ctx.fillStyle='#7c5cf0';ctx.font='700 9px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('A C C E S S O I R E S',W/2,214);
  const accW=72,accGap=6,accPerRow=3,accRowW=accPerRow*accW+(accPerRow-1)*accGap,accStartX=(W-accRowW)/2;
  for(let i=0;i<ACCESSORIES.length;i++){
    const col=i%accPerRow,row=Math.floor(i/accPerRow),x=accStartX+col*(accW+accGap),y=213+row*27,unlocked=ACCESSORIES[i].id==='none'||isUnlocked(ACCESSORIES[i].id),selected=i===accIdx;
    ctx.save();if(selected){ctx.shadowColor='#f0c840';ctx.shadowBlur=8;}
    rrect(x,y,accW,22,6,selected?'#221a50':unlocked?'#16123a':'#100e28',selected?'#f0c840':'#2e2860',selected?1.5:1);ctx.restore();
    if(unlocked){ctx.fillStyle=selected?'#f0c840':'#9a8dc8';ctx.font=(selected?'700':'400')+' 9px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText(ACCESSORIES[i].name,x+accW/2,y+15);}
    else{ctx.fillStyle='#3e3668';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText('🔒',x+accW/2,y+15);}
  }
  rrect(12,268,W-24,22,6,nameInput?'#1c1648':'#10102a',nameInput?'#7c5cf0':'#2a2460',1.5);
  ctx.fillStyle=nameInput?'#f0eaff':'#6a5e90';ctx.font='500 11px Outfit,sans-serif';ctx.textAlign='center';
  ctx.fillText(customName||(nameInput?'|':'Entrez votre nom...'),W/2,283);
  ctx.save();ctx.shadowColor='#7c5cf0';ctx.shadowBlur=16;
  const pg=ctx.createLinearGradient(W/2-75,296,W/2+75,330);pg.addColorStop(0,'#4a2aa8');pg.addColorStop(1,'#6a40c8');
  rrect(W/2-75,296,150,32,10,pg,'#9b7ef8',1.5);ctx.restore();
  ctx.fillStyle='#f0eaff';ctx.font='700 14px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('Jouer →',W/2,317);
  ctx.fillStyle='#2a2460';ctx.font='400 9px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('← → ↑ ↓  naviguer  •  Entrée pour jouer',W/2,H-6);
}

// ===== ÉCRAN BOUTIQUE =====
function drawShopScreen(){
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#0c0820');bg.addColorStop(1,'#160e35');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(8,6,20,0.85)';ctx.fillRect(0,0,W,33);
  ctx.strokeStyle='rgba(124,92,240,0.25)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,33);ctx.lineTo(W,33);ctx.stroke();
  ctx.fillStyle='#9b7ef8';ctx.font='600 11px Outfit,sans-serif';ctx.textAlign='left';ctx.fillText('← RETOUR',12,22);
  ctx.save();ctx.shadowColor='#7c5cf0';ctx.shadowBlur=10;ctx.fillStyle='#f0eaff';ctx.font='700 15px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('BOUTIQUE',W/2,22);ctx.restore();
  drawCoin(W-56,16,7);ctx.fillStyle='#f0c840';ctx.font='700 12px Outfit,sans-serif';ctx.textAlign='left';ctx.fillText(coins,W-45,22);
  const itemW=200,itemH=54,gap=8,cols=2,startX=(W-cols*(itemW+gap)+gap)/2,startY=40;
  ctx.save();ctx.beginPath();ctx.rect(0,35,W,H-85);ctx.clip();
  SHOP_ITEMS.forEach((item,i)=>{
    const col=i%cols,row=Math.floor(i/cols),ix=startX+col*(itemW+gap),iy=startY+row*(itemH+gap)-shopScrollY;
    if(iy+itemH<35||iy>H-50)return;
    const unlocked=isUnlocked(item.id),hovered=hoverShopItem===i;
    const tc={1:'#6a5aaa',2:'#7c5cf0',3:'#a070f8',4:'#f0a020'}[item.tier||1];
    const cg=ctx.createLinearGradient(ix,iy,ix,iy+itemH);
    cg.addColorStop(0,hovered?'#221a52':unlocked?'#1a1540':'#120e2a');
    cg.addColorStop(1,hovered?'#1a1442':unlocked?'#141038':'#0e0c22');
    ctx.save();if(hovered){ctx.shadowColor=tc;ctx.shadowBlur=10;}
    rrect(ix,iy,itemW,itemH,8,cg,hovered?'#f0c840':tc,hovered?2:1.5);ctx.restore();
    ctx.fillStyle=tc;ctx.fillRect(ix,iy+6,3,itemH-12);
    if(item.tier){
      const te={1:'⭐',2:'⭐⭐',3:'⭐⭐⭐',4:'👑'},tn={1:'Basique',2:'Avancé',3:'Expert',4:'Légend.'};
      rrect(ix+itemW-58,iy+3,56,15,4,'rgba(0,0,0,0.35)',tc,1);
      ctx.fillStyle='#fff';ctx.font='700 8px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText(te[item.tier]+' '+tn[item.tier],ix+itemW-30,iy+13);
    }
    const imgSize=42;let shopImg=null;
    if(item.type==='char'&&IMGS[item.id])shopImg=IMGS[item.id].base;
    else if(item.type==='acc'&&IMGS['HommeBleu'])shopImg=IMGS['HommeBleu'][item.id];
    if(shopImg&&shopImg.complete&&shopImg.naturalWidth>0){ctx.drawImage(shopImg,ix+9,iy+6,imgSize,imgSize);}
    else{ctx.fillStyle='#9b7ef8';ctx.font='24px sans-serif';ctx.textAlign='center';ctx.fillText(item.emoji||'?',ix+30,iy+36);}
    ctx.textAlign='left';
    ctx.fillStyle=hovered?'#f0d040':'#f0eaff';ctx.font='700 11px Outfit,sans-serif';ctx.fillText(item.name,ix+60,iy+16);
    ctx.fillStyle='#7a6ca8';ctx.font='400 9px Outfit,sans-serif';ctx.fillText(item.desc,ix+60,iy+29);
    if(unlocked){ctx.fillStyle='#2de8a0';ctx.font='700 10px Outfit,sans-serif';ctx.fillText('✓ DÉBLOQUÉ',ix+60,iy+48);}
    else{
      const canAfford=coins>=item.cost;
      drawCoin(ix+60,iy+46,6);ctx.fillStyle=canAfford?'#f0c840':'#ff4757';ctx.font='700 11px Outfit,sans-serif';ctx.textAlign='left';ctx.fillText(item.cost,ix+72,iy+50);
      if(!canAfford){ctx.fillStyle='#ff4757';ctx.font='500 8px Outfit,sans-serif';ctx.fillText('manque '+(item.cost-coins),ix+96,iy+50);}
    }
  });
  ctx.restore();
  if(shopFeedback&&shopFeedback.timer>0){
    const alpha=Math.min(1,shopFeedback.timer);ctx.save();ctx.globalAlpha=alpha;
    rrect(W/2-90,H-46,180,32,8,'#0e0c22',shopFeedback.color,1.5);
    ctx.fillStyle=shopFeedback.color;ctx.font='700 12px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText(shopFeedback.msg,W/2,H-25);
    ctx.restore();
  }
  ctx.fillStyle='#2a2460';ctx.font='400 8px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('Clic: acheter/équiper  •  Molette: défiler  •  ESC: retour',W/2,H-8);
}

// ===== SPAWN GARGOYLES (complet du code 1) =====
function spawnGargoyle(){
  const lv=gameMode==='adventure'?getLevelConfig():null;
  const mechanic=lv?lv.mechanic:'';

  if(mechanic==='bells'){
    const positions=[80,160,240,320,400];
    const count=Math.random()<0.45?2:1;
    const used=new Set();
    for(let c=0;c<count;c++){
      let idx;do{idx=Math.floor(Math.random()*positions.length);}while(used.has(idx));
      used.add(idx);
      const x=positions[idx]+(Math.random()*24-12);
      const type=Math.random()<0.5?'vitrail':'cloche';
      gargoyles.push({x,y:-30,w:50,h:50,vy:spd+50+Math.random()*40,vx:0,rot:0,type,fromRight:false,isBossProj:false});
    }
    return;
  }

  if(mechanic==='wind'){
    const type=Math.random()<0.5?'masqueJoyeux':'masqueTriste';
    const rand=Math.random();
    if(rand<0.3){
      const y=H-40;
      if(rand<0.15){gargoyles.push({x:W+20,y,w:50,h:50,vx:-(spd*0.4+18+Math.random()*18),vy:0,rot:0,type,fromRight:true,isBossProj:false});}
      else{gargoyles.push({x:-20,y,w:50,h:50,vx:spd*0.4+18+Math.random()*18,vy:0,rot:0,type,fromRight:true,isBossProj:false});}
    }else{
      const x=Math.random()*(W-30)+15;
      gargoyles.push({x,y:-30,w:50,h:50,vy:spd+30+Math.random()*48,vx:0,rot:0,type,fromRight:false,isBossProj:false});
    }
    return;
  }

  if(mechanic==='shield'){
    const type=Math.random()<0.5?'popCorn':'clap';
    const rand=Math.random();
    if(rand<0.3){
      const y=H-40;
      if(rand<0.15){gargoyles.push({x:W+20,y,w:50,h:50,vx:-(spd*0.4+18+Math.random()*18),vy:0,rot:0,type,fromRight:true,isBossProj:false});}
      else{gargoyles.push({x:-20,y,w:50,h:50,vx:spd*0.4+18+Math.random()*18,vy:0,rot:0,type,fromRight:true,isBossProj:false});}
    }else{
      const x=Math.random()*(W-30)+15;
      gargoyles.push({x,y:-30,w:50,h:50,vy:spd+30+Math.random()*48,vx:0,rot:0,type,fromRight:false,isBossProj:false});
    }
    return;
  }

  if(mechanic==='darkness'){
    const type=Math.random()<0.5?'brique':'gargouille';
    const rand=Math.random();
    if(rand<0.3){
      const y=H-40;
      if(rand<0.15){gargoyles.push({x:W+20,y,w:50,h:50,vx:-(spd*0.4+18+Math.random()*18),vy:0,rot:0,type,fromRight:true,isBossProj:false});}
      else{gargoyles.push({x:-20,y,w:50,h:50,vx:spd*0.4+18+Math.random()*18,vy:0,rot:0,type,fromRight:true,isBossProj:false});}
    }else{
      const x=Math.random()*(W-30)+15;
      gargoyles.push({x,y:-30,w:50,h:50,vy:spd+30+Math.random()*48,vx:0,rot:0,type,fromRight:false,isBossProj:false});
    }
    return;
  }

  if(mechanic==='boss'){
    const rand=Math.random();
    if(rand<0.3){
      const y=H-40;
      if(rand<0.15){gargoyles.push({x:W+20,y,w:50,h:50,vx:-(spd*0.4+18+Math.random()*18),vy:0,rot:0,type:'gargouille',fromRight:true,isBossProj:false});}
      else{gargoyles.push({x:-20,y,w:50,h:50,vx:spd*0.4+18+Math.random()*18,vy:0,rot:0,type:'gargouille',fromRight:true,isBossProj:false});}
    }else{
      const x=Math.random()*(W-30)+15;
      gargoyles.push({x,y:-30,w:50,h:50,vy:spd+30+Math.random()*48,vx:0,rot:0,type:'gargouille',fromRight:false,isBossProj:false});
    }
    return;
  }

  // Mode classique : vitrail ou gargouille
  const type=Math.random()<0.3?'vitrail':'gargouille';
  const rand=Math.random();
  if(rand<0.3){
    const y=H-40;
    if(rand<0.15){gargoyles.push({x:W+20,y,w:50,h:50,vx:-(spd*0.4+18+Math.random()*18),vy:0,rot:0,type,fromRight:true,isBossProj:false});}
    else{gargoyles.push({x:-20,y,w:50,h:50,vx:spd*0.4+18+Math.random()*18,vy:0,rot:0,type,fromRight:true,isBossProj:false});}
  }else{
    const x=Math.random()*(W-30)+15;
    gargoyles.push({x,y:-30,w:50,h:50,vy:spd+30+Math.random()*48,vx:0,rot:0,type,fromRight:false,isBossProj:false});
  }
}

// ===== DESSIN PROJECTILES (images du code 1) =====
function drawGargoyle(g){
  ctx.save();
  ctx.translate(g.x,g.y);

  function drawProjImg(imgKey,w,h,rotateAmt){
    const img=PROJ_IMGS[imgKey];
    if(rotateAmt)ctx.rotate(rotateAmt);
    if(img&&img.complete&&img.naturalWidth>0){
      ctx.drawImage(img,-w/2,-h/2,w,h);
    }else{
      // Fallback pixel art si image pas chargée
      ctx.fillStyle='#9b7fd4';ctx.fillRect(-w/2,-h/2,w,h);
      ctx.fillStyle='#fff';ctx.font='8px sans-serif';ctx.textAlign='center';
      ctx.fillText(imgKey.slice(0,4),0,4);
    }
  }

  const s=g.w||32;

  switch(g.type){
    case 'vitrail':      drawProjImg('vitrail',s,s,g.rot);break;
    case 'cloche':       drawProjImg('cloche',s,s,Math.sin(g.rot)*0.3);break;
    case 'masqueJoyeux': drawProjImg('masqueJoyeux',s,s,g.rot);break;
    case 'masqueTriste': drawProjImg('masqueTriste',s,s,g.rot);break;
    case 'popCorn':      drawProjImg('popCorn',s,s,0);break;
    case 'clap':         drawProjImg('clap',s,s,g.rot);break;
    case 'brique':       drawProjImg('brique',s,s*0.6,0);break;
    case 'gargouille':   drawProjImg('gargouille',s,s,0);break;
    case 'bouleFeu':     drawProjImg('bouleFeu',s,s,g.rot);break;
    case 'bouleFeu2':    drawProjImg('bouleFeu2',s+8,s+8,g.rot);break;
    default:
      // Fallback générique
      ctx.fillStyle='#6b6080';ctx.fillRect(-12,-14,24,22);
      ctx.strokeStyle='#4a4060';ctx.lineWidth=1;ctx.strokeRect(-12,-14,24,22);
      ctx.fillStyle='#ff4444';ctx.beginPath();ctx.arc(-5,-10,3,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(5,-10,3,0,Math.PI*2);ctx.fill();
      break;
  }
  ctx.restore();
}

// ===== COLLISION =====
function checkCollision(player,g){
  const shrink=0.55;
  const left=player.x-player.w/2*0.7,right=player.x+player.w/2*0.7;
  const top=player.y+player.h*0.15,bottom=player.y+player.h*0.90;
  const gleft=g.x-(g.w/2)*shrink,gright=g.x+(g.w/2)*shrink;
  const gtop=g.y-(g.h/2)*shrink,gbottom=g.y+(g.h/2)*shrink;
  if(right<=gleft||left>=gright||bottom<=gtop||top>=gbottom)return false;
  if(player.y+player.h-5<g.y-g.h/2&&player.vy>=0)return false;
  return true;
}

// ===== BOSS (Dragon du code 1) =====
function updateBoss(dt){
  bossX+=bossVX*dt;
  if(bossX<50||bossX>W-50){bossVX*=-1;bossAnger=Math.min(1,bossAnger+0.04);}
  bossY=70+Math.sin(Date.now()/600)*20;
  if(frames%Math.max(55,110-Math.floor(bossAnger*40))===0){
    const angle=Math.atan2(player.y-bossY,player.x-bossX);
    const v=170+bossAnger*100;
    const bfType=Math.random()<0.5?'bouleFeu':'bouleFeu2';
    const bfSize=bfType==='bouleFeu2'?40:31;
    gargoyles.push({x:bossX,y:bossY,w:bfSize,h:bfSize,vx:Math.cos(angle)*v,vy:Math.sin(angle)*v,rot:0,type:bfType,fromRight:false,isBossProj:true});
  }
}

function drawBoss(){
  ctx.save();ctx.translate(bossX,bossY);
  const s=1.8+bossAnger*0.4;ctx.scale(s,s);
  if(DRAGON_IMG&&DRAGON_IMG.complete&&DRAGON_IMG.naturalWidth>0){
    ctx.globalCompositeOperation='multiply'; // ← supprime le fond noir
    ctx.drawImage(DRAGON_IMG,-45,-45,90,90);
    ctx.globalCompositeOperation='source-over'; // ← remet le mode normal
  }else{
    ctx.fillStyle=`rgb(${Math.floor(140+bossAnger*90)},40,40)`;ctx.fillRect(-16,-18,32,28);
    ctx.fillStyle='#fff';ctx.font='20px sans-serif';ctx.textAlign='center';ctx.fillText('👹',0,8);
  }
  ctx.restore();
  // Barre de vie
  const bw=80,bx=bossX-bw/2,by=bossY-46;
  rrect(bx,by,bw,10,4,'#400',null);
  rrect(bx,by,bw*(bossHP/bossMaxHP),10,4,'#f44',null);
  ctx.strokeStyle='#a00';ctx.lineWidth=1;rrect(bx,by,bw,10,4,null,'#a00');
  ctx.fillStyle='#fff';ctx.font='400 8px sans-serif';ctx.textAlign='center';ctx.fillText('BOSS',bossX,by+8);
}

// ===== BOUCLE PRINCIPALE =====
function loop(timestamp){
  const dt=Math.min((timestamp-lastTime)/1000,0.1);lastTime=timestamp;
  ctx.clearRect(0,0,W,H);

  if(state==='mode'){drawModeScreen();requestAnimationFrame(loop);return;}
  if(state==='select'){drawSelectScreen();requestAnimationFrame(loop);return;}
  if(state==='shop'){if(shopFeedback&&shopFeedback.timer>0)shopFeedback.timer-=dt;drawShopScreen();requestAnimationFrame(loop);return;}

  drawCathedral();

  if(state==='dead'||state==='win'){
    const owo=ctx.createLinearGradient(0,0,0,H);
    owo.addColorStop(0,state==='win'?'rgba(10,8,22,0.93)':'rgba(8,4,16,0.93)');
    owo.addColorStop(1,state==='win'?'rgba(18,12,32,0.93)':'rgba(16,4,10,0.93)');
    ctx.fillStyle=owo;ctx.fillRect(0,0,W,H);
    if(state==='win'){
      ctx.save();ctx.shadowColor='#f0c840';ctx.shadowBlur=30;ctx.fillStyle='#f0c840';ctx.font='800 24px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('✨ NIVEAU TERMINÉ ✨',W/2,H/2-68);ctx.restore();
      drawCoin(W/2-44,H/2-26,16);
      ctx.save();ctx.shadowColor='#f0c840';ctx.shadowBlur=14;ctx.fillStyle='#f0c840';ctx.font='700 18px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('+100 Pièces',W/2+14,H/2-18);ctx.restore();
      ctx.strokeStyle='rgba(240,200,64,0.22)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(W/2-90,H/2-4);ctx.lineTo(W/2+90,H/2-4);ctx.stroke();
      ctx.fillStyle='#9a8dc8';ctx.font='500 12px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('Total: '+coins+' pièces',W/2,H/2+16);
      if(currentLevel<LEVELS.length){
        rrect(W/2-100,H/2+26,200,28,8,'#1a1540','#7c5cf0',1.5);
        ctx.fillStyle='#c0b0f8';ctx.font='600 11px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('Niv.'+(currentLevel+1)+': '+LEVELS[currentLevel].name,W/2,H/2+44);
        ctx.fillStyle='#4a4080';ctx.font='400 9px Outfit,sans-serif';ctx.fillText(LEVELS[currentLevel].desc,W/2,H/2+60);
      }else{
        ctx.save();ctx.shadowColor='#f0c840';ctx.shadowBlur=12;ctx.fillStyle='#f0c840';ctx.font='700 14px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('🎉 Tous les niveaux terminés !',W/2,H/2+42);ctx.restore();
      }
      ctx.fillStyle='#2e2860';ctx.font='400 10px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('[ Entrée ] pour continuer',W/2,H-20);
    }else{
      ctx.fillStyle='#9a8dc8';ctx.font='500 12px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText(getDisplayName(),W/2,H/2-56);
      ctx.save();ctx.shadowColor='#ff4757';ctx.shadowBlur=24;ctx.fillStyle='#ff4757';ctx.font='800 30px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('ÉCRASÉ !',W/2,H/2-20);ctx.restore();
      ctx.strokeStyle='rgba(255,71,87,0.2)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(W/2-80,H/2-4);ctx.lineTo(W/2+80,H/2-4);ctx.stroke();
      localStorage.setItem('Best_score',score);
      rrect(W/2-96,H/2+6,192,50,10,'#140e2a','#2e2860',1.5);
      ctx.fillStyle='#f0eaff';ctx.font='800 20px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText(score,W/2-28,H/2+38);
      ctx.fillStyle='#4a4080';ctx.font='600 9px Outfit,sans-serif';ctx.fillText('SCORE',W/2-28,H/2+52);
      ctx.strokeStyle='#221a48';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(W/2,H/2+12);ctx.lineTo(W/2,H/2+56);ctx.stroke();
      ctx.fillStyle='#f0c840';ctx.font='800 20px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText(best,W/2+28,H/2+38);
      ctx.fillStyle='#4a4080';ctx.font='600 9px Outfit,sans-serif';ctx.fillText('MEILLEUR',W/2+28,H/2+52);
      ctx.fillStyle='#2e2860';ctx.font='400 10px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText(gameMode==='classic'?'[ Entrée ] pour recommencer':'[ Entrée ] pour le menu',W/2,H-20);
    }
    requestAnimationFrame(loop);return;
  }

  scoreTime+=dt;score=Math.floor(scoreTime*20);if(score>best)best=score;
  document.getElementById('sv').textContent=score;
  document.getElementById('bv').textContent=best;

  if(gameMode==='adventure'){
    const lv=getLevelConfig();levelTimer+=dt;const timeLeft=lv.duration-levelTimer;

    if(lv.mechanic==='wind'){
      windChangeCooldown-=dt;
      if(windChangeCooldown<=0){windForce=(Math.random()<0.5?1:-1)*(80+Math.random()*130);windChangeCooldown=3+Math.random()*4;}
      player.x+=windForce*dt;player.x=Math.max(player.w/2,Math.min(W-player.w/2,player.x));
      const dir=windForce>0?'→':'←';const intensity=Math.abs(windForce)/200;
      ctx.fillStyle=`rgba(100,180,255,${0.3+intensity*0.5})`;ctx.font=`${Math.floor(14+intensity*10)}px sans-serif`;ctx.textAlign='center';
      ctx.fillText(dir.repeat(4),W/2,H/2-70);
    }

    if(lv.mechanic==='shield'){
      if(shieldActive){shieldTimer-=dt;if(shieldTimer<=0)shieldActive=false;}
      if(shieldCooldown>0)shieldCooldown-=dt;
      if(shieldActive){
        ctx.fillStyle='rgba(74,212,138,0.18)';ctx.fillRect(0,0,W,H);
        ctx.strokeStyle='#4ad48a';ctx.lineWidth=3;ctx.strokeRect(2,2,W-4,H-4);
        ctx.fillStyle='#4ad48a';ctx.font='500 10px sans-serif';ctx.textAlign='left';ctx.fillText('🛡 '+shieldTimer.toFixed(1)+'s',20,38);
      }else if(shieldCooldown>0){
        ctx.fillStyle='#b8a9d8';ctx.font='400 10px sans-serif';ctx.textAlign='left';ctx.fillText('🛡 recharge '+shieldCooldown.toFixed(1)+'s',20,38);
      }else{
        ctx.fillStyle='#4ad48a';ctx.font='600 10px sans-serif';ctx.textAlign='left';ctx.fillText('🛡 ESPACE = Bouclier prêt !',20,38);
      }
    }

    if(lv.mechanic==='boss'){
      updateBoss(dt);drawBoss();
      if(Math.abs(player.x-bossX)<32&&Math.abs(player.y+player.h/2-bossY)<32){state='dead';requestAnimationFrame(loop);return;}
    }

    if(levelTimer>=lv.duration){coins+=100;saveCoins();state='win';addCoinPopup(W/2,H/2-30,100);requestAnimationFrame(loop);return;}

    if(frames%200===0){spd+=12;spawnInt=Math.max(50,spawnInt-5);}
    if(frames-lastSpawn>=spawnInt){spawnGargoyle();lastSpawn=frames;}
    frames++;

    gargoyles.forEach(g=>{
      if(g.isBossProj){g.x+=g.vx*dt;g.y+=g.vy*dt;}
      else if(g.fromRight){g.x+=g.vx*dt;}
      else{g.y+=g.vy*dt;}
      g.rot+=2.4*dt;
    });
    gargoyles=gargoyles.filter(g=>{
      if(g.isBossProj)return g.x>-50&&g.x<W+50&&g.y>-50&&g.y<H+50;
      return g.fromRight?(g.x>-40&&g.x<W+40):(g.y<H+40);
    });
    for(const g of gargoyles){if(shieldActive)continue;if(checkCollision(player,g)){state='dead';break;}}
    gargoyles.forEach(drawGargoyle);

    if(lv.mechanic==='darkness'){
      const px=player.x,py=player.y+player.h/2;
      const grad=ctx.createRadialGradient(px,py,0,px,py,200);
      grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(0.55,'rgba(0,0,0,0.55)');grad.addColorStop(1,'rgba(0,0,0,0.97)');
      ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    }

    // HUD
    const bw=W-40,bx=20,by=H-15;
    rrect(bx,by,bw,8,4,'#1a1535',null);
    const ratio=Math.max(0,timeLeft/lv.duration);
    const barCol=ratio>0.5?'#4ad48a':ratio>0.25?'#e8c97a':'#ff5555';
    rrect(bx,by,bw*ratio,8,4,barCol,null);
    ctx.fillStyle='#e8e0ff';ctx.font='500 11px sans-serif';ctx.textAlign='right';ctx.fillText(Math.max(0,Math.ceil(timeLeft))+'s',W-20,13);
    ctx.fillStyle=lv.color;ctx.font='500 10px sans-serif';ctx.textAlign='left';ctx.fillText('Niv.'+lv.id+' '+lv.name,20,13);
    drawCoin(W/2-10,12,7);ctx.fillStyle='#e8c97a';ctx.font='500 10px sans-serif';ctx.textAlign='left';ctx.fillText(coins,W/2+2,16);

  }else{
    // Mode classique
    if(frames%200===0){spd+=25;spawnInt=Math.max(25,spawnInt-8);}
    if(frames-lastSpawn>=spawnInt){spawnGargoyle();lastSpawn=frames;}
    frames++;
    gargoyles.forEach(g=>{
      if(g.fromRight){g.x+=g.vx*dt;}else{g.y+=g.vy*dt;}
      g.rot+=2.4*dt;
    });
    gargoyles=gargoyles.filter(g=>g.fromRight?(g.x>-40&&g.x<W+40):(g.y<H+40));
    for(const g of gargoyles){if(checkCollision(player,g)){state='dead';break;}}
    gargoyles.forEach(drawGargoyle);
  }

  // ===== JOUEUR =====
  const ch=CHARS[charIdx];
  if(keys['ArrowLeft'])player.x-=ch.speed*dt;
  if(keys['ArrowRight'])player.x+=ch.speed*dt;
  if(keys['ArrowUp']&&!player.isJumping){player.vy=-360;player.isJumping=true;}
  player.x=Math.max(player.w/2,Math.min(W-player.w/2,player.x));
  player.vy+=720*dt;player.y+=player.vy*dt;
  if(player.y+player.h>=H-25){player.y=H-25-player.h;player.vy=0;player.isJumping=false;}
  ch.draw(player.x,player.y+player.h,ACCESSORIES[accIdx].id);
  ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='400 11px sans-serif';ctx.textAlign='left';
  ctx.fillText(getDisplayName(),player.x-20,player.y-5);

  // Popups pièces
  coinPopups.forEach(p=>{
    p.life-=dt;p.y-=35*dt;
    ctx.globalAlpha=Math.max(0,p.life/p.maxLife);
    drawCoin(p.x,p.y,14);
    ctx.fillStyle='#e8c97a';ctx.font='700 18px sans-serif';ctx.textAlign='left';ctx.fillText('+'+p.amount,p.x+18,p.y+6);
    ctx.globalAlpha=1;
  });
  coinPopups=coinPopups.filter(p=>p.life>0);

  requestAnimationFrame(loop);
}

requestAnimationFrame(ts=>{lastTime=ts;requestAnimationFrame(loop);});
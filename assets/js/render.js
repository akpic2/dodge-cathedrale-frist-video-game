// Dessin du mode classique (fond, obstacles, personnages), partagé par le jeu et les pages IA.
// Visuels de la refonte Mote : fond clair, encre noire, Inter Tight.
// Les images sont chargées ici ; sans DOM (Node, worker) les tables restent vides de vraies images.
// Tout se dessine dans l'espace logique 480×420. Pour un canvas en ×2 (comme le jeu), l'appelant
// fait lui-même ctx.setTransform(2, 0, 0, 2, 0, 0) et ctx.imageSmoothingEnabled = false avant de dessiner.
(function (root) {
  const W = 480, H = 420;
  const FONT = '"Inter Tight",Arial,sans-serif';
  const BACKGROUND = '#f3f3f3';

  function loadImg(src) {
    if (typeof Image === 'undefined') return null;
    const i = new Image(); i.src = src; return i;
  }
  function ready(img) { return !!(img && img.complete && img.naturalWidth > 0); }

  // ===== IMAGES PROJECTILES =====
  const PROJ_IMGS = {
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
  const CHAR_IMGS = {
    HommeBleu:{base:loadImg('assets/img/perso 3/Homme/Homme_Bleu.png'),lunettes:loadImg('assets/img/perso 3/Homme/Homme_Bleu_Sunglass.png'),aureole:loadImg('assets/img/perso 3/Homme/Homme_Bleu_Aureole.png'),biere:loadImg('assets/img/perso 3/Homme/Homme_Bleu_Biere.png'),},
    FemmeBleu:{base:loadImg('assets/img/perso 3/Femme/Femme_Bleu.png'),lunettes:loadImg('assets/img/perso 3/Femme/Femme_Bleu_Sunglass.png'),aureole:loadImg('assets/img/perso 3/Femme/Femme_Bleu_Aureole.png'),biere:loadImg('assets/img/perso 3/Femme/Femme_Bleu_Biere.png'),},
    HitmanG:{base:loadImg('assets/img/Perso 2/Hitman_G/Hitmanl_G.png'),lunettes:loadImg('assets/img/Perso 2/Hitman_G/Hitman_Lunette_G.png'),aureole:loadImg('assets/img/Perso 2/Hitman_G/Hitman_Oreol_G.png'),biere:loadImg('assets/img/Perso 2/Hitman_G/Hitman_Biere_G.png'),},
    HitmanF:{base:loadImg('assets/img/Perso 2/Hitman_F/Hitmanl_F.png'),lunettes:loadImg('assets/img/Perso 2/Hitman_F/Hitman_Lunette_F.png'),aureole:loadImg('assets/img/Perso 2/Hitman_F/Hitman_Oreol_F.png'),biere:loadImg('assets/img/Perso 2/Hitman_F/Hitman_Biere_F.png'),},
    Garcon1:{base:loadImg('assets/img/Perso 1/Garcon1/Garcon1.png'),lunettes:loadImg('assets/img/Perso 1/Garcon1/Garcon_lunette1.png'),aureole:loadImg('assets/img/Perso 1/Garcon1/Garcon_oreole1.png'),biere:loadImg('assets/img/Perso 1/Garcon1/Garcon_biere1.png'),},
    Fille1:{base:loadImg('assets/img/Perso 1/Fille1/Fille1.png'),lunettes:loadImg('assets/img/Perso 1/Fille1/Fille_lunette1.png'),aureole:loadImg('assets/img/Perso 1/Fille1/Fille_oreole1.png'),biere:loadImg('assets/img/Perso 1/Fille1/Fille_biere1.png'),},
    Chevalier:{base:loadImg('assets/img/Personnages_speciaux/Chevalier.png'),lunettes:null,aureole:null,biere:null,},
    Gigachad:{base:loadImg('assets/img/Personnages_speciaux/Gigachad.png'),lunettes:null,aureole:null,biere:null,},
  };

  // Fond du mode classique (drawBackground de la refonte) : fond uni + ligne de sol 1px
  function drawClassicBackground(ctx) {
    ctx.fillStyle = BACKGROUND; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#cfcfcf'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H - 24.5); ctx.lineTo(W, H - 24.5); ctx.stroke();
  }

  // Obstacle centré en (g.x, g.y) : drawGargoyle de la refonte
  function drawObstacle(ctx, g) {
    ctx.save();
    ctx.translate(g.x, g.y);
    const s = g.w || 32;
    const draw = (key, w, h, rot) => {
      const img = PROJ_IMGS[key];
      if (rot) ctx.rotate(rot);
      if (ready(img)) ctx.drawImage(img, -w / 2, -h / 2, w, h);
      else { ctx.fillStyle = '#777'; ctx.fillRect(-w / 2, -h / 2, w, h); }
    };
    switch (g.type) {
      case 'vitrail':      draw('vitrail', s, s, g.rot); break;
      case 'cloche':       draw('cloche', s, s, Math.sin(g.rot) * 0.3); break;
      case 'masqueJoyeux': draw('masqueJoyeux', s, s, g.rot); break;
      case 'masqueTriste': draw('masqueTriste', s, s, g.rot); break;
      case 'popCorn':      draw('popCorn', s, s, 0); break;
      case 'clap':         draw('clap', s, s, g.rot); break;
      case 'brique':       draw('brique', s, s * 0.6, 0); break;
      case 'gargouille':   draw('gargouille', s, s, 0); break;
      case 'bouleFeu':     draw('bouleFeu', s, s, g.rot); break;
      case 'bouleFeu2':    draw('bouleFeu2', s + 8, s + 8, g.rot); break;
    }
    ctx.restore();
  }

  // Personnage dessiné avec les pieds en (x, yFeet). w/h : taille (52 par défaut, 40 dans l'écran de sélection).
  function drawChar(ctx, charId, x, yFeet, acc, alpha, w, h) {
    if (acc === undefined) acc = 'none';
    if (alpha === undefined) alpha = 1;
    if (w === undefined) w = 52;
    if (h === undefined) h = 52;
    const imgs = CHAR_IMGS[charId]; if (!imgs) return;
    let img = imgs.base;
    if (acc === 'lunettes' && ready(imgs.lunettes)) img = imgs.lunettes;
    else if (acc === 'aureole' && ready(imgs.aureole)) img = imgs.aureole;
    else if (acc === 'biere' && ready(imgs.biere)) img = imgs.biere;
    ctx.save();
    if (alpha !== 1) ctx.globalAlpha *= alpha;
    if (ready(img)) {
      ctx.drawImage(img, x - w / 2, yFeet - h, w, h);
    } else {
      ctx.fillStyle = '#000'; ctx.fillRect(x - w / 2, yFeet - h, w, h);
    }
    ctx.restore();
  }

  // Libellé au-dessus d'un joueur (nom du perso dans le jeu) : centré, en majuscules, encre à 45 %.
  // p : {x, y} du joueur (y = haut de la hitbox), comme dans la refonte.
  function drawPlayerLabel(ctx, text, p, alpha) {
    ctx.save();
    if (alpha !== undefined && alpha !== 1) ctx.globalAlpha *= alpha;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.font = '400 9px ' + FONT; ctx.textAlign = 'center';
    ctx.fillText(String(text).toUpperCase(), p.x, p.y - 5);
    ctx.restore();
  }

  // Dessine une ou plusieurs simulations (même graine => mêmes obstacles).
  // opts : charId, alphaFor(i), highlight (index encadré d'un trait noir fin), labels[i].
  // Canvas ×2 : l'appelant applique setTransform(2,0,0,2,0,0) + imageSmoothingEnabled=false avant.
  function drawSimFrame(ctx, sims, opts) {
    const o = opts || {};
    const charId = o.charId || 'HommeBleu';
    const alphaFor = o.alphaFor || function () { return 1; };
    const highlight = o.highlight === undefined ? -1 : o.highlight;
    const labels = o.labels || null;

    drawClassicBackground(ctx);
    if (!sims || sims.length === 0) return;

    let ref = sims[0];
    for (let i = 0; i < sims.length; i++) { if (!sims[i].dead) { ref = sims[i]; break; } }
    for (const g of ref.obstacles) drawObstacle(ctx, g);

    for (let i = 0; i < sims.length; i++) {
      const s = sims[i];
      if (s.dead) continue;
      const p = s.player, a = alphaFor(i);
      if (i === highlight) {
        ctx.save();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
        ctx.strokeRect(p.x - 26 + 0.5, p.y + p.h - 52 + 0.5, 51, 51);
        ctx.restore();
      }
      drawChar(ctx, charId, p.x, p.y + p.h, 'none', a);
      if (labels && labels[i]) drawPlayerLabel(ctx, labels[i], p, a);
    }
  }

  const DodgeRender = { FONT, BACKGROUND, PROJ_IMGS, CHAR_IMGS, drawClassicBackground, drawObstacle, drawChar, drawPlayerLabel, drawSimFrame };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeRender; else root.DodgeRender = DodgeRender;
})(typeof self !== 'undefined' ? self : globalThis);

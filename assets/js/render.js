// Dessin du mode classique (fond, obstacles, personnages), partagé par le jeu et les pages IA.
// Les images sont chargées ici ; sans DOM (Node, worker) les tables restent vides de vraies images.
(function (root) {
  const W = 480, H = 420;

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

  // Fond du mode classique (le fond uni + le sol)
  function drawClassicBackground(ctx) {
    ctx.fillStyle = '#0d0d1f'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1e1a3a'; ctx.fillRect(0, H - 80, W, 80);
  }

  // Obstacle centré en (g.x, g.y)
  function drawObstacle(ctx, g) {
    ctx.save();
    ctx.translate(g.x, g.y);

    function drawProjImg(imgKey, w, h, rotateAmt) {
      const img = PROJ_IMGS[imgKey];
      if (rotateAmt) ctx.rotate(rotateAmt);
      if (ready(img)) {
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else {
        // Fallback si image pas chargée
        ctx.fillStyle = '#9b7fd4'; ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = '#fff'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(imgKey.slice(0, 4), 0, 4);
      }
    }

    const s = g.w || 32;

    switch (g.type) {
      case 'vitrail':      drawProjImg('vitrail', s, s, g.rot); break;
      case 'cloche':       drawProjImg('cloche', s, s, Math.sin(g.rot) * 0.3); break;
      case 'masqueJoyeux': drawProjImg('masqueJoyeux', s, s, g.rot); break;
      case 'masqueTriste': drawProjImg('masqueTriste', s, s, g.rot); break;
      case 'popCorn':      drawProjImg('popCorn', s, s, 0); break;
      case 'clap':         drawProjImg('clap', s, s, g.rot); break;
      case 'brique':       drawProjImg('brique', s, s * 0.6, 0); break;
      case 'gargouille':   drawProjImg('gargouille', s, s, 0); break;
      case 'bouleFeu':     drawProjImg('bouleFeu', s, s, g.rot); break;
      case 'bouleFeu2':    drawProjImg('bouleFeu2', s + 8, s + 8, g.rot); break;
      default:
        // Fallback générique
        ctx.fillStyle = '#6b6080'; ctx.fillRect(-12, -14, 24, 22);
        ctx.strokeStyle = '#4a4060'; ctx.lineWidth = 1; ctx.strokeRect(-12, -14, 24, 22);
        ctx.fillStyle = '#ff4444'; ctx.beginPath(); ctx.arc(-5, -10, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(5, -10, 3, 0, Math.PI * 2); ctx.fill();
        break;
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
      ctx.fillStyle = '#5a4a80'; ctx.fillRect(x - w / 2, yFeet - h, w, h);
      ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(charId.slice(0, 4), x, yFeet - h / 2);
    }
    ctx.restore();
  }

  // Dessine une ou plusieurs simulations (même graine => mêmes obstacles).
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
        ctx.shadowColor = '#f0c840'; ctx.shadowBlur = 16;
        ctx.strokeStyle = '#f0c840'; ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 26, p.y + p.h - 52, 52, 52);
        ctx.restore();
      }
      drawChar(ctx, charId, p.x, p.y + p.h, 'none', a);
      if (labels && labels[i]) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '400 11px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(labels[i], p.x - 20, p.y - 5);
        ctx.restore();
      }
    }
  }

  const DodgeRender = { PROJ_IMGS, CHAR_IMGS, drawClassicBackground, drawObstacle, drawChar, drawSimFrame };
  if (typeof module !== 'undefined' && module.exports) module.exports = DodgeRender; else root.DodgeRender = DodgeRender;
})(typeof self !== 'undefined' ? self : globalThis);

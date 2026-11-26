# Bot IA qui apprend à jouer à Dodge la Cathédrale — Design

*26/11/2026 — projet d'Akpic (Mathurin Mollier)*

## 1. Intention

Coder un bot qui **apprend tout seul** à jouer à Dodge la Cathédrale par évolution, façon Code Bullet. Au début, il est nul. Génération après génération, il devient très bon, jusqu'à dépasser un joueur humain.

Akpic veut deux choses :
1. **Voir progresser un bot qu'on a codé nous-mêmes.** Le plaisir, c'est de le regarder devenir de plus en plus fort.
2. **En tirer des visuels impressionnants pour son portfolio** : des vidéos de résultats concrets, par exemple « génération 1 vs dernière génération ».

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Entraîner le bot sur le **mode Survie infinie** (classique), avec le **même gameplay que le vrai jeu**.
- Avoir un **outil local** pour Akpic, avec un tableau de bord **en direct** pendant l'entraînement : stats, courbes, liste de perfs notables.
- Pouvoir **cliquer sur n'importe quelle perf notable et la revoir en replay**, avec les vrais sprites du jeu.
- Pouvoir **exporter des vidéos** depuis l'outil pour le portfolio.
- À terme, le bot devient visiblement bien meilleur qu'un joueur humain. Akpic en juge à l'œil : il n'y a pas de record chiffré à atteindre.

**Non-objectifs (pour l'instant)**
- Entraîner sur les niveaux Aventure : c'est peut-être pour plus tard, mais pas maintenant.
- Publier l'outil sur le portfolio ou le rendre utilisable par les visiteurs. Le portfolio ne recevra que des vidéos.
- Utiliser une lib de machine learning (TensorFlow.js…) ou de l'apprentissage par renforcement.

**Anti-objectifs (échec même si ça « marche »)**
- **Le bot apprend un parcours par cœur.** Chaque partie doit rester aléatoire. Le bot doit être bon sur n'importe quelle partie, pas sur un tirage précis.
- **Le gameplay de la simu diffère de celui du vrai jeu.** « Meilleur qu'un humain » ne voudrait plus rien dire.
- **Un replay ne reproduit pas exactement la partie qui a produit la stat.**
- **On casse le jeu actuel**, en particulier le mode Aventure, qui n'est pas concerné.

## 3. État actuel du jeu (ce qui compte pour le projet)

Tout tient dans `assets/js/script.js` (~780 lignes), qui dessine sur un canvas 480×420 via `requestAnimationFrame`. **La logique et le dessin sont mélangés** dans `loop()`.

Le mode classique (`gameMode==='classic'`) fonctionne ainsi :
- **Joueur** : `x` (centre), `y` (haut), `w=32`, `h=45`, `vy`, `isJumping`. Gauche/droite à `CHARS[charIdx].speed` px/s, entre 260 et 320 selon le perso. Le saut fixe `vy=-360` (seulement au sol), avec une gravité de 720. Le sol est à `H-25`. `x` est limité aux bords.
- **Obstacles** (`spawnGargoyle`, dernier bloc « Mode classique ») :
  - 70 % tombent du haut, avec `x` aléatoire et `vy = spd+30+rand*48`.
  - 30 % arrivent **au ras du sol depuis un côté** (`y=H-40`), avec `vx = ±(spd*0.4+18+rand*18)`. Il faut les **sauter**.
  - Type visuel : vitrail (30 %) ou gargouille.
- **Difficulté** : réglages Facile/Normal/Difficile (`spd`, `spawnInt`). Toutes les `200/144` s, `spd += 25` et `spawnInt = max(25, spawnInt-8)`. Un spawn a lieu toutes les `spawnInt/144` s. **Pas de plafond de vitesse** : le jeu finit forcément par devenir injouable, donc le score mesure combien de temps on tient.
- **Collision** (`checkCollision`) : hitboxes réduites. On ne meurt pas si les pieds sont au-dessus de l'obstacle et qu'on descend.
- **Score** : `floor(temps_survécu × 20)`.
- **Hasard** : `Math.random()` partout. Le temps avance avec un `dt` variable (temps réel, plafonné à 0,1 s).

Bug existant repéré : à la mort, `localStorage.Best_score` est écrasé par le **dernier** score, pas par le meilleur (ligne ~646). Ça compte ici, parce qu'on veut comparer le bot au record humain.

## 4. Approches envisagées

| | Approche | Pour | Contre |
|---|---|---|---|
| **✅ Retenue** | **Tout dans le navigateur, entraînement réparti sur plusieurs Web Workers** (un par cœur), page `ia.html` dans le repo | Un seul outil. Stats en direct pendant l'entraînement. Replays avec les vrais sprites. Export vidéo intégré. Vitesse proche du max grâce au multi-cœurs | Il faut extraire la logique du jeu de `script.js`, ce qui touche au vrai jeu |
| | Entraînement par un script Node en terminal + page séparée pour les replays | Rapide, multi-cœurs | Pas de tableau de bord en direct, deux outils, on perd le « je vois une stat et je clique » |
| ❌ | Lib de ML (TensorFlow.js), apprentissage par renforcement | — | Plus lourd, plus lent à donner un bon bot, difficile à rendre rejouable au bit près, et ce n'est pas la méthode évolutive à la Code Bullet qu'Akpic veut voir |

Akpic a demandé « la meilleure façon possible » et m'a laissé choisir la méthode : c'est l'approche retenue.

## 5. Décisions prises avec Akpic

- **Entraînement uniquement en Survie infinie.** L'Aventure viendra peut-être plus tard.
- **Chaque partie est aléatoire** (graine différente). Les bots ne doivent jamais apprendre un parcours.
- **Les replays sont exacts** : une perf notable est sauvegardée sous la forme **graine + copie gelée du cerveau du bot**. Rejouer avec les deux reproduit la même partie au bit près.
- **Le portfolio = des vidéos** enregistrées par Akpic. L'outil reste local.
- **Tableau de bord en direct** : stats intéressantes listées, et clic sur une perf pour voir son replay.

## 6. Design

### 6.1 Découpage en fichiers

```
index.html                 vrai jeu (inchangé côté visiteur)
ia.html                    nouvel outil d'entraînement
assets/js/sim.js           NOUVEAU — logique pure du mode classique, sans DOM ni canvas
assets/js/render.js        NOUVEAU — dessin du décor, des obstacles et des persos à partir d'un état de sim
assets/js/script.js        vrai jeu — mode classique branché sur sim.js + render.js ; Aventure inchangée
assets/js/ia/brain.js      réseau de neurones + mutation/croisement
assets/js/ia/worker.js     Web Worker : fait jouer un lot de bots, renvoie leurs notes
assets/js/ia/trainer.js    boucle d'évolution, répartition entre workers, détection des perfs notables
assets/js/ia/dashboard.js  UI de ia.html : stats, courbes, liste des perfs, replays, export vidéo
```

*(Choix de Claude.)* `sim.js`, `render.js` et `brain.js` sont des **scripts classiques** qui exposent des variables globales, **pas des modules ES**. Ils se chargent avec une balise `<script>` dans les pages et via `importScripts()` dans les workers. Comme ça, le vrai jeu continue de marcher ouvert en double-clic (`file://`) et là où il est hébergé. Seul l'outil `ia.html` a besoin d'un serveur local, parce que les Web Workers ne se lancent pas en `file://` (Live Server de VS Code ou MAMP, déjà utilisés par Akpic).

*(Choix de Claude.)* Le travail se fait sur une branche `bot-ia` du repo GitHub `akpic2/dodge-cathedrale-frist-video-game`.

### 6.2 `sim.js` — la simulation

- `createSim({seed, difficulty, charSpeed})` renvoie un état : joueur, obstacles, `spd`, `spawnInt`, timers, `time`, `score`, `dead`.
- `step(state, input)` fait avancer d'**un pas fixe de 1/60 s**, avec `input = {left, right, jump}`. C'est le même pas que `FIXED_STEP` de la refonte Mote (le vrai jeu tourne déjà à pas fixe de 1/60 s).
- Elle reproduit **à l'identique** les règles du §3 (spawn, vitesses, progression de difficulté, saut, gravité, collision, score).
- **Hasard** : un générateur pseudo-aléatoire à graine (mulberry32 ou équivalent, uniquement en opérations entières) remplace `Math.random()`. Une graine donne exactement une partie.
- Aucune dépendance au DOM, au canvas, à `Date.now()` ou au `localStorage`.

**Branchement du vrai jeu** : en mode classique, `loop()` utilise un accumulateur. On ajoute le `dt` réel et on appelle `step()` autant de fois qu'il faut à 1/60 s, puis `render.js` dessine l'état. La graine est tirée au hasard à chaque partie. Pour le joueur, rien ne change à part la régularité. **Le mode Aventure garde son code actuel**, sans y toucher.

### 6.3 `brain.js` — le cerveau d'un bot

- **Réseau de neurones à taille fixe** : entrées → 2 couches cachées de 16 neurones → 4 sorties. Activation **ReLU** (`max(0,x)`) dans les couches cachées, sorties linéaires.
- **Uniquement des `+`, `×` et `max`.** Pas de `tanh`, `exp` ni `sigmoid`. Les résultats sont donc identiques au bit près sur tous les navigateurs, ce qui est nécessaire pour les replays.
- **Ce que le bot voit** (normalisé entre −1 et 1 environ) :
  - Joueur : `x`, `vy`, au sol ou non.
  - Vitesse actuelle `spd` du jeu.
  - Les **5 obstacles tombants les plus menaçants** (tri par temps avant d'atteindre la hauteur du joueur) : `dx` relatif, temps avant impact, vitesse. On met des zéros s'il y en a moins de 5.
  - Les **2 obstacles latéraux les plus proches** (un de chaque côté) : distance, vitesse, présence.
- **Sorties** : `gauche`, `rien`, `droite`. On prend la plus forte pour le déplacement, et la 4e sortie déclenche `saut` si elle est > 0.
- Le bot décide **à chaque pas** de simulation.
- Un cerveau est un simple `Float32Array` de poids, ce qui le rend facile à copier, sauvegarder et transmettre aux workers.

### 6.4 Évolution (`trainer.js` + `worker.js`)

- **Population** : 300 bots (réglable).
- **Évaluation d'une génération** : on tire **5 graines neuves**, identiques pour tous les bots de cette génération pour que la comparaison soit équitable. Chaque bot joue ses 5 parties, et sa **note est la moyenne de ses scores**. Ça évite qu'un bot gagne juste parce qu'il a eu un tirage facile.
- **Plafond de durée** par partie (ex. 10 min simulées) pour qu'un très bon bot ne bloque pas une génération. Vu que la difficulté n'a pas de plafond, c'est surtout un garde-fou.
- **Vitesse max qui monte toute seule : trouver la vraie limite** *(décision d'Akpic)*. Aujourd'hui `spd` augmente sans fin (≈ 1 200 px/s après 1 min), et le spawn est déjà plafonné (toutes les 0,17 s, au bout d'environ 30 s). Sans limite, le jeu devient forcément injouable et les scores butent sur un mur arbitraire. On ajoute donc un **plafond de vitesse `spdMax`**. La vitesse monte comme avant, puis reste bloquée à `spdMax`. Akpic ne veut pas d'une valeur « qui semble bien » : il veut la **vraie limite**. D'où ces règles :
  1. **Valeur de départ = la plus haute vitesse dont on a la preuve qu'elle est jouable.** *(Révisé pendant l'implémentation : le bot scripté ne tenait qu'environ 25 s, ce qui donnait une limite de départ de 300 px/s, beaucoup trop basse.)* Au début, il n'y a **pas de limite** : c'est le jeu réel. Dès que le champion d'une génération survit **en moyenne au moins 40 s** (au-delà du moment où l'apparition des obstacles atteint sa cadence max, vers 30 s), on fixe `spdMax` à la **plus petite vitesse atteinte au moment de sa mort sur ses parties**, arrondie à la dizaine inférieure. C'est la plus haute vitesse que le meilleur bot a prouvé tenir dans toutes ses parties.
  2. **Si un bot tient à la limite, elle monte.** Quand le champion d'une génération survit en moyenne **au moins 20 s à `spdMax`** sur ses parties, `spdMax` augmente de **+5 %** pour les générations suivantes.
  3. **La limite ne monte que si un bot le prouve.** Il n'y a pas de gel automatique ni de valeur décidée à l'avance. Si plus aucun bot n'y arrive, `spdMax` reste où il est, mais l'entraînement continue d'essayer : si un bot y arrive 200 générations plus tard, elle remonte. La « vraie limite » est la dernière valeur atteinte.
  - Les seuils (20 s, +5 %) sont réglables dans l'UI.
  - Ce mécanisme ne compte qu'une fois que les bots sont déjà très bons. Au début, ils meurent bien avant d'atteindre `spdMax`, donc la limite ne joue aucun rôle et il n'y a rien à régler.
  - Le tableau de bord affiche `spdMax` en direct, sa courbe et les générations où elle a monté. Chaque hausse est une **perf notable**, rejouable : « Gén. 82 : le premier bot à tenir 20 s à 1 450 px/s ».
  - Comme `spdMax` change pendant l'entraînement, les scores de deux générations ne se comparent pas directement. Chaque partie et chaque perf enregistre le `spdMax` en vigueur, et les replays le réutilisent pour rester exacts.
  - **Vrai jeu** : `spdMax` fait partie des règles de `sim.js`. Le mode Infini du vrai jeu utilisera la limite finale trouvée par l'entraînement. Comme elle sera largement au-dessus de ce qu'un humain peut tenir, ça ne change rien pour un joueur humain.
- **Sélection** : les 5 % meilleurs passent tels quels (élitisme). Les autres sont créés en choisissant des parents par tournoi, puis par croisement et mutation (bruit gaussien sur une partie des poids). Le taux de mutation est réglable dans l'UI.
- **Multi-cœurs** : `navigator.hardwareConcurrency − 1` workers. La population est découpée en lots, chaque worker simule son lot sans aucun rendu et renvoie les notes.
- L'aléatoire de l'évolution elle-même (mutations, tournois) utilise aussi un générateur à graine. Avec la graine d'entraînement, tout un entraînement est donc reproductible.
- Boutons **Pause / Reprendre / Réinitialiser**, et choix de la difficulté de départ.

### 6.5 Perfs notables et replays

Une perf = `{type, génération, score, graine, cerveau (copie), réglages}`. **Les cerveaux ne changent jamais pendant leur vie** : l'évolution crée de nouveaux bots. La copie sauvegardée rejoue donc toujours la même partie, même si la population a progressé entretemps.

Perfs enregistrées automatiquement :
- **Champion de chaque génération** (toujours) : c'est ce qui permet « gén. 1 vs gén. N ».
- 🏆 Nouveau record absolu.
- ⚡ Plus gros bond de score d'une génération à l'autre.
- 👤 *(Optionnel)* Premier bot à battre un record humain, si Akpic en saisit un dans l'UI. Ce n'est pas un objectif : Akpic jugera à l'œil quand le bot est « assez bon ».
- 🚀 Chaque hausse de `spdMax` (§6.4).
- Paliers de score franchis (1er bot à 1 000, 2 000, 5 000…).
- 🦘 Partie avec le plus d'obstacles latéraux sautés.
- 🎲 La « pire mort » du champion : la partie où le meilleur bot meurt le plus tôt parmi ses 5.

**Replay** : on recrée la simulation avec la graine, on la fait jouer par le cerveau gelé, et `render.js` l'affiche avec les vrais sprites. Contrôles : lecture/pause, vitesse ×0,5 à ×8. En option, on peut afficher le **cerveau** du bot (les neurones qui s'allument) et les obstacles qu'il « voit » en surbrillance.

On peut aussi relancer n'importe quel cerveau sauvegardé **sur une nouvelle graine**, pour vérifier qu'il s'en sort sur une partie inconnue.

**Éclaircissement des champions** (pour que la sauvegarde ne grossisse pas sans fin) : on garde le champion de chaque génération jusqu'à la gén. 20, puis 1 sur 10 jusqu'à 200, 1 sur 100 jusqu'à 2 000, puis 1 sur 1 000. Le champion de la dernière génération est toujours gardé. Les autres perfs (records, bonds, paliers, limite, humain battu) sont toutes gardées, sauf les esquives latérales : seulement les 20 plus récentes. Les esquives ne passent pas dans la file d'auto-sélection.

### 6.6 Tableau de bord (`ia.html`)

Dans le style visuel du jeu et de MOTE. Akpic veut **les trois à la fois** : les stats, la possibilité de choisir lui-même, et une sélection automatique de ce qui vaut le coup d'être regardé.

- **En-tête** : génération, parties jouées, vitesse (parties/s), temps écoulé.
- **Courbes en direct** : meilleur score, moyenne et médiane par génération.
- **Vue en direct (à la Code Bullet)** : à chaque génération, le thread principal fait jouer **un échantillon de la génération en cours** (ex. 30 bots, dont le champion précédent) sur une des graines de la génération, **à l'écran, en accéléré**. Ça se fait en parallèle des workers sans rendu, qui eux évaluent toute la population. Les persos sont semi-transparents, le meilleur est mis en avant, et ils meurent les uns après les autres. Un bouton coupe cette vue pour avoir la vitesse max.
- **Liste des perfs notables** (§6.5). Clic = replay dans le panneau principal.
- **Mode « Auto-sélection »** (activé par défaut) : quand l'entraînement détecte une perf notable (nouveau record, gros bond, palier…), il la **met en file d'attente et la joue automatiquement** dans le panneau de replay, avec un bandeau qui explique pourquoi elle est intéressante (« Nouveau record : +34 % vs gén. précédente »). Entre deux perfs, le panneau revient à la vue en direct. Un clic manuel sur une perf passe devant la file.
- **Panneau de réglages** : population, taux de mutation, nombre de parties par bot, difficulté, perso, record humain (optionnel).

### 6.7 Export vidéo (pour le portfolio)

- Bouton **« Exporter en vidéo »** sur un replay. Le canvas est enregistré via `canvas.captureStream()` + `MediaRecorder`, ce qui donne un fichier `.webm` téléchargé.
- Mode **comparaison côte à côte** : deux replays sur la même graine (ex. champion gén. 1 vs champion gén. N), dessinés dans un même canvas élargi, avec les étiquettes de génération et de score.
- Mode **« fantômes »** à la Code Bullet : les champions de plusieurs générations jouent la même graine en même temps, en persos semi-transparents. Les mauvais meurent l'un après l'autre et le meilleur reste.

### 6.8 Sauvegarde

- Sauvegarde automatique de l'entraînement (historique des stats + perfs notables + population actuelle) dans IndexedDB toutes les N générations. On peut fermer l'onglet et reprendre plus tard.
- Export et import d'un entraînement en `.json`, pour l'archiver ou le changer de PC.

## 7. Contraintes

- Vanilla JS, pas de framework, comme le jeu actuel. Pas de dépendance npm obligatoire.
- Le jeu actuel doit rester jouable à l'identique, Aventure comprise.
- Pas de `Co-Authored-By: Claude` dans les commits (préférence d'Akpic).
- Akpic teste lui-même : à chaque étape, le plan doit lui **décrire les tests à faire** plutôt que de tout tester à sa place.

## 8. Laissé au constructeur

- Les valeurs exactes de normalisation des entrées, l'écart-type des mutations et la méthode de croisement. On ajuste en regardant ce qui apprend le mieux.
- Le découpage exact de `render.js`, tant que le vrai jeu garde le même rendu.
- Le design précis du tableau de bord (dans l'esprit MOTE) et la lib de courbes (canvas maison conseillé).
- La correction ou non du bug `Best_score` du §3. C'est conseillé, puisque le record humain sert de référence.

## 9. Décisions et choix restants

- **Code de référence** : le jeu avec la refonte graphique Mote, c'est-à-dire la branche `refonte-mote` du repo GitHub (commit `23ce059`, « Use fixed timestep for frame-rate independent gameplay »), et non `main`. Les règles de `sim.js` en sont copiées, avec son pas fixe de 1/60 s.
- **Perso et difficulté** : **perso de base (Homme Bleu, vitesse 280), difficulté Normal**, sur décision d'Akpic. Pas de record humain à atteindre : il jugera à l'œil.
- Pas de simulation de **1/60 s** (le `FIXED_STEP` de la refonte Mote). Les sauvegardes enregistrent ce pas (format v2) : une sauvegarde d'un autre pas est refusée.
- Réseau fixe 16-16 plutôt que NEAT, où le réseau se construit lui-même : beaucoup plus simple à coder et à déboguer, et largement suffisant pour ce jeu. On garde quand même le visuel « cerveau qui s'allume ».

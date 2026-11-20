# Dodge la Cathédrale — application Windows native C++ / SDL3

Cette branche reconstruit le jeu en application Windows native, sans navigateur ni runtime JavaScript.

## Téléchargement
Les builds Windows x64 et Windows ARM64 sont produits par GitHub Actions. L'archive ARM64 est à privilégier sur les PC Snapdragon X ; l'archive x64 est prévue pour les PC Intel/AMD et fonctionne aussi via émulation Windows sur ARM.

## Compiler localement
Installer Visual Studio 2022 (Desktop development with C++), CMake et vcpkg, puis :

```powershell
cmake -S native -B native/build -DCMAKE_TOOLCHAIN_FILE="$env:VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" -DVCPKG_TARGET_TRIPLET=x64-windows
cmake --build native/build --config Release
```

L'exécutable et ses ressources sont copiés dans `native/build/Release`.

## Commandes
- Entrée : démarrer / recommencer
- Flèches gauche/droite : déplacement
- Flèche haut : saut
- P : pause
- Échap : reprendre depuis pause ou quitter depuis les menus
- Touches 1 à 8 : choisir un personnage depuis le menu

Le mode classique est verrouillé sur DIFFICILE. Le moteur utilise une simulation physique à pas fixe de 1/60 seconde, indépendante du taux de rafraîchissement.

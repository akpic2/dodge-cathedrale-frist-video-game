# Dodge la Cathédrale — édition native C++ / SDL3

Cette branche contient une réécriture native Windows, indépendante du navigateur.

## Compilation locale
1. Installer Visual Studio 2022 avec le workload « Développement Desktop en C++ ».
2. Installer CMake et vcpkg.
3. Depuis la racine du dépôt :

```powershell
cmake -S native -B native/build -DCMAKE_TOOLCHAIN_FILE="$env:VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" -DVCPKG_TARGET_TRIPLET=x64-windows
cmake --build native/build --config Release
```

Lancer `native/build/Release/DodgeCathedrale.exe` depuis la racine du dépôt afin que le dossier `assets` soit trouvé.

## Commandes
- Flèches gauche/droite : déplacement
- Flèche haut : saut
- P ou Échap : pause
- Entrée : démarrer / recommencer
- Échap depuis le menu : quitter

Le mode classique démarre directement en DIFFICILE. La simulation utilise un pas fixe de 1/60 s, et le rendu est découplé du gameplay.

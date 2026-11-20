#include <SDL3/SDL.h>
#include <SDL3_image/SDL_image.h>
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <random>
#include <string>
#include <vector>

namespace {
constexpr int LOGICAL_W = 480, LOGICAL_H = 420, SCALE = 2;
constexpr double STEP = 1.0 / 60.0;
constexpr double REFERENCE_FPS = 144.0;
constexpr double DIFFICULTY_STEP = 200.0 / REFERENCE_FPS;
constexpr SDL_Color INK{20,20,20,255}, PAPER{243,243,243,255};
enum class Screen { Menu, Playing, Paused, GameOver };
enum class ObstacleType { Vitrail, Gargouille, Cloche, MasqueHeureux, MasqueTriste, Popcorn, Clap, Brique, Fire, Fire2 };
struct Obstacle { double x{}, y{}, vx{}, vy{}, rotation{}; int w{50}, h{50}; ObstacleType type{}; bool side{}, boss{}; };
struct Player { double x{240}, y{345}, vy{}; bool jumping{}; int w{32}, h{45}; };
struct Character { const char* name; const char* path; double speed; };
const std::array<Character,8> CHARACTERS{{
 {"Homme Bleu","assets/img/perso 3/Homme/Homme_Bleu.png",280},
 {"Femme Bleu","assets/img/perso 3/Femme/Femme_Bleu.png",280},
 {"Garçon","assets/img/Perso 1/Garcon1/Garcon1.png",280},
 {"Fille","assets/img/Perso 1/Fille1/Fille1.png",280},
 {"Hitman","assets/img/Perso 2/Hitman_G/Hitmanl_G.png",300},
 {"Hitwoman","assets/img/Perso 2/Hitman_F/Hitmanl_F.png",300},
 {"Chevalier","assets/img/Personnages_speciaux/Chevalier.png",260},
 {"Gigachad","assets/img/Personnages_speciaux/Gigachad.png",320}
}};
struct Sprite { const char* key; const char* path; SDL_Texture* texture{}; };
std::array<Sprite,18> sprites{{
 {"player0","assets/img/perso 3/Homme/Homme_Bleu.png"},
 {"player1","assets/img/perso 3/Femme/Femme_Bleu.png"},
 {"player2","assets/img/Perso 1/Garcon1/Garcon1.png"},
 {"player3","assets/img/Perso 1/Fille1/Fille1.png"},
 {"player4","assets/img/Perso 2/Hitman_G/Hitmanl_G.png"},
 {"player5","assets/img/Perso 2/Hitman_F/Hitmanl_F.png"},
 {"player6","assets/img/Personnages_speciaux/Chevalier.png"},
 {"player7","assets/img/Personnages_speciaux/Gigachad.png"},
 {"vitrail","assets/img/Obstacles/Vitrail.png"},
 {"gargouille","assets/img/Obstacles/Gargouille.png"},
 {"cloche","assets/img/Obstacles/Cloches.png"},
 {"happy","assets/img/Obstacles/masqueJoyeux.png"},
 {"sad","assets/img/Obstacles/masqueTriste.png"},
 {"popcorn","assets/img/Obstacles/popCorn.png"},
 {"clap","assets/img/Obstacles/Clap.png"},
 {"brick","assets/img/Obstacles/Brique.png"},
 {"fire","assets/img/Obstacles/BouleFeu_petite.png"},
 {"fire2","assets/img/Obstacles/BouleFeu2.png"}
}};
SDL_Window* window{}; SDL_Renderer* renderer{};
std::mt19937 rng{std::random_device{}()};
double random(double a,double b){return std::uniform_real_distribution<double>(a,b)(rng);}
int randomInt(int a,int b){return std::uniform_int_distribution<int>(a,b)(rng);}
Screen screen=Screen::Menu; Player player; std::vector<Obstacle> obstacles;
int characterIndex=0; double speed=220, spawnFrames=120, spawnTimer=0, difficultyTimer=0;
double elapsed=0, accumulator=0; int score=0, best=0; bool left=false,right=false,jumpPressed=false;
bool running=true; std::string basePath;

SDL_Texture* texture(const char* key){
 for(auto& s:sprites) if(std::string(s.key)==key) return s.texture;
 return nullptr;
}
void drawTexture(SDL_Texture* tex,double x,double y,double w,double h,double angle=0){
 if(!tex) return;
 SDL_FRect dst{static_cast<float>(x-w/2),static_cast<float>(y-h/2),static_cast<float>(w),static_cast<float>(h)};
 SDL_RenderTextureRotated(renderer,tex,nullptr,&dst,angle,nullptr,SDL_FLIP_NONE);
}
void rect(float x,float y,float w,float h,SDL_Color c){
 SDL_SetRenderDrawColor(renderer,c.r,c.g,c.b,c.a); SDL_FRect r{x,y,w,h}; SDL_RenderFillRect(renderer,&r);
}
void line(float x1,float y1,float x2,float y2,SDL_Color c){
 SDL_SetRenderDrawColor(renderer,c.r,c.g,c.b,c.a); SDL_RenderLine(renderer,x1,y1,x2,y2);
}
// Petit affichage numérique bitmap, sans dépendance à une police système.
constexpr std::array<std::array<unsigned char,7>,10> DIGITS{{
 {{14,17,19,21,25,17,14}},{{4,12,4,4,4,4,14}},{{14,17,1,2,4,8,31}},
 {{30,1,1,14,1,1,30}},{{2,6,10,18,31,2,2}},{{31,16,16,30,1,1,30}},
 {{14,16,16,30,17,17,14}},{{31,1,2,4,8,8,8}},{{14,17,17,14,17,17,14}},{{14,17,17,15,1,1,14}}
}};
void number(int value,float x,float y,int scale=2){
 const std::string str=std::to_string(std::max(0,value));
 for(char c:str){const auto& glyph=DIGITS[static_cast<size_t>(c-'0')];
  for(int row=0;row<7;++row) for(int col=0;col<5;++col)
   if(glyph[row]&(1u<<(4-col))) rect(x+col*scale,y+row*scale,static_cast<float>(scale),static_cast<float>(scale),INK);
  x+=6*scale;
 }
}
void centeredTextMark(float x,float y,int width,int height){
 rect(x,y,static_cast<float>(width),static_cast<float>(height),INK);
}
void drawBackground(){
 rect(0,0,LOGICAL_W,LOGICAL_H,PAPER); line(0,395,LOGICAL_W,395,{180,180,180,255});
}
void resetGame(){
 player={240,345,0,false,32,45}; obstacles.clear(); speed=220; spawnFrames=120;
 spawnTimer=0; difficultyTimer=0; elapsed=0; score=0; accumulator=0; screen=Screen::Playing;
}
void spawn(){
 const auto type=static_cast<ObstacleType>(randomInt(0,1)==0?0:1);
 if(random(0,1)<0.30){
  const bool fromRight=random(0,1)<0.5;
  obstacles.push_back({fromRight?500.0:-20.0,380,fromRight?-(speed*.4+18+random(0,18)):(speed*.4+18+random(0,18)),0,0,50,50,type,true,false});
 }else{
  const auto t=random(0,1)<0.3?ObstacleType::Vitrail:ObstacleType::Gargouille;
  obstacles.push_back({random(15,465),-30,0,speed+30+random(0,48),0,50,50,t,false,false});
 }
}
const char* obstacleKey(ObstacleType t){
 switch(t){
  case ObstacleType::Vitrail:return "vitrail"; case ObstacleType::Gargouille:return "gargouille";
  case ObstacleType::Cloche:return "cloche"; case ObstacleType::MasqueHeureux:return "happy";
  case ObstacleType::MasqueTriste:return "sad"; case ObstacleType::Popcorn:return "popcorn";
  case ObstacleType::Clap:return "clap"; case ObstacleType::Brique:return "brick";
  case ObstacleType::Fire:return "fire"; case ObstacleType::Fire2:return "fire2";
 } return "gargouille";
}
bool collision(const Obstacle& g){
 const double pl=player.x-player.w*.35, pr=player.x+player.w*.35;
 const double pt=player.y+player.h*.15, pb=player.y+player.h*.90;
 const double gl=g.x-g.w*.275, gr=g.x+g.w*.275, gt=g.y-g.h*.275, gb=g.y+g.h*.275;
 if(pr<=gl||pl>=gr||pb<=gt||pt>=gb)return false;
 if(player.y+player.h-5<g.y-g.h/2&&player.vy>=0)return false;
 return true;
}
void update(double dt){
 if(screen!=Screen::Playing)return;
 elapsed+=dt; score=static_cast<int>(elapsed*20.0);
 difficultyTimer+=dt;
 while(difficultyTimer>=DIFFICULTY_STEP){difficultyTimer-=DIFFICULTY_STEP;speed+=25;spawnFrames=std::max(25.0,spawnFrames-8);}
 spawnTimer+=dt;
 const double interval=spawnFrames/REFERENCE_FPS;
 while(spawnTimer>=interval){spawn();spawnTimer-=interval;}
 if(left)player.x-=CHARACTERS[characterIndex].speed*dt;
 if(right)player.x+=CHARACTERS[characterIndex].speed*dt;
 player.x=std::clamp(player.x,player.w/2.0,LOGICAL_W-player.w/2.0);
 if(jumpPressed&&!player.jumping){player.vy=-360;player.jumping=true;} jumpPressed=false;
 player.vy+=720*dt;player.y+=player.vy*dt;
 if(player.y+player.h>=395){player.y=395-player.h;player.vy=0;player.jumping=false;}
 for(auto& g:obstacles){if(g.side)g.x+=g.vx*dt;else g.y+=g.vy*dt;g.rotation+=2.4*dt;}
 obstacles.erase(std::remove_if(obstacles.begin(),obstacles.end(),[](const Obstacle& g){
  return g.side?(g.x<-40||g.x>520):(g.y>460);
 }),obstacles.end());
 for(const auto& g:obstacles)if(collision(g)){screen=Screen::GameOver;best=std::max(best,score);break;}
}
void label(float x,float y,const std::string& value){
 SDL_SetRenderDrawColor(renderer,20,20,20,255);
 SDL_RenderDebugText(renderer,x,y,value.c_str());
}
void draw(){
 drawBackground();
 for(const auto& g:obstacles)drawTexture(texture(obstacleKey(g.type)),g.x,g.y,g.w,g.h,g.rotation*57.2958);
 drawTexture(texture((std::string("player")+std::to_string(characterIndex)).c_str()),player.x,player.y+player.h/2,52,52);
 label(18,10,"SCORE"); number(score,18,24,2);
 label(395,10,"RECORD"); number(best,400,24,2);
 label(18,48,"DIFFICILE");
 if(screen==Screen::Menu){
  label(112,92,"DODGE LA CATHEDRALE");
  label(112,116,"EDITION WINDOWS NATIVE");
  label(112,158,"MODE CLASSIQUE - DIFFICILE");
  label(112,184,"ENTREE : COMMENCER");
  label(112,208,"1-8 : CHOISIR UN PERSONNAGE");
  label(112,232,std::string("PERSONNAGE : ")+CHARACTERS[characterIndex].name);
  drawTexture(texture((std::string("player")+std::to_string(characterIndex)).c_str()),240,300,64,64);
  label(112,365,"FLECHES : BOUGER / SAUTER");
  label(112,382,"P : PAUSE    ECHAP : QUITTER");
 }else if(screen==Screen::Paused||screen==Screen::GameOver){
  rect(0,0,LOGICAL_W,LOGICAL_H,{243,243,243,235});
  label(176,160,screen==Screen::Paused?"PAUSE":"GAME OVER");
  if(screen==Screen::GameOver){label(185,188,"SCORE");number(score,215,208,3);}
  label(125,255,"ENTREE : REPRENDRE / REJOUER");
  label(125,275,"ECHAP : QUITTER");
 }else{
  label(18,66,"SURVIE - DIFFICULTE MAXIMALE");
 }
}
void loadAssets(){
 char* p=SDL_GetBasePath(); if(p){basePath=p;SDL_free(p);}
 for(auto& s:sprites){const std::string path=basePath+s.path;s.texture=IMG_LoadTexture(renderer,path.c_str());}
}
void events(){
 SDL_Event e;
 while(SDL_PollEvent(&e)){
  if(e.type==SDL_EVENT_QUIT)running=false;
  if(e.type==SDL_EVENT_KEY_DOWN&&!e.key.repeat){
   switch(e.key.key){
    case SDLK_ESCAPE:
     if(screen==Screen::Playing)screen=Screen::Paused;
     else if(screen==Screen::Paused)screen=Screen::Playing;
     else if(screen==Screen::Menu||screen==Screen::GameOver)running=false;
     break;
    case SDLK_RETURN: case SDLK_KP_ENTER:
     if(screen==Screen::Menu||screen==Screen::GameOver)resetGame();
     else if(screen==Screen::Paused)screen=Screen::Playing;
     break;
    case SDLK_p: if(screen==Screen::Playing)screen=Screen::Paused;else if(screen==Screen::Paused)screen=Screen::Playing;break;
    case SDLK_LEFT: left=true;break; case SDLK_RIGHT:right=true;break; case SDLK_UP:jumpPressed=true;break;
    case SDLK_1:characterIndex=0;break;case SDLK_2:characterIndex=1;break;case SDLK_3:characterIndex=2;break;
    case SDLK_4:characterIndex=3;break;case SDLK_5:characterIndex=4;break;case SDLK_6:characterIndex=5;break;
    case SDLK_7:characterIndex=6;break;case SDLK_8:characterIndex=7;break;
    default:break;
   }
  }
  if(e.type==SDL_EVENT_KEY_UP){if(e.key.key==SDLK_LEFT)left=false;if(e.key.key==SDLK_RIGHT)right=false;}
 }
}
}
int main(int argc,char** argv){
 (void)argc;(void)argv;
 if(!SDL_Init(SDL_INIT_VIDEO|SDL_INIT_EVENTS)){std::fprintf(stderr,"SDL_Init: %s\n",SDL_GetError());return 1;}
 window=SDL_CreateWindow("Dodge la Cathedrale — DIFFICILE",LOGICAL_W*SCALE,LOGICAL_H*SCALE,SDL_WINDOW_RESIZABLE|SDL_WINDOW_HIGH_PIXEL_DENSITY);
 if(!window){std::fprintf(stderr,"SDL_CreateWindow: %s\n",SDL_GetError());SDL_Quit();return 1;}
 renderer=SDL_CreateRenderer(window,nullptr);
 if(!renderer){std::fprintf(stderr,"SDL_CreateRenderer: %s\n",SDL_GetError());SDL_DestroyWindow(window);SDL_Quit();return 1;}
 SDL_SetRenderLogicalPresentation(renderer,LOGICAL_W,LOGICAL_H,SDL_LOGICAL_PRESENTATION_LETTERBOX);
 IMG_Init(IMG_INIT_PNG);loadAssets();
 SDL_SetWindowTitle(window,"DODGE LA CATHEDRALE | DIFFICILE | Entree: jouer | Fleches: bouger/sauter | P: pause");
 Uint64 previous=SDL_GetPerformanceCounter();const double frequency=static_cast<double>(SDL_GetPerformanceFrequency());
 while(running){
  events();const Uint64 now=SDL_GetPerformanceCounter();double frame=static_cast<double>(now-previous)/frequency;previous=now;
  accumulator+=std::min(frame,0.5);int steps=0;
  while(accumulator>=STEP&&steps<30){update(STEP);accumulator-=STEP;++steps;}
  SDL_SetRenderDrawColor(renderer,243,243,243,255);SDL_RenderClear(renderer);
  draw();SDL_RenderPresent(renderer);
  SDL_Delay(1);
 }
 for(auto& s:sprites)if(s.texture)SDL_DestroyTexture(s.texture);
 IMG_Quit();SDL_DestroyRenderer(renderer);SDL_DestroyWindow(window);SDL_Quit();return 0;
}

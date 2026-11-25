// src\shaders\preprocessed.scene.frag
#version 430

layout(location=0)uniform vec4 iFrame;
layout(binding=0)uniform sampler2D tex;
layout(std430, binding = 0)buffer State{
  int shotEvents,boomEvents,hitEvents,unusedEvents;
  vec2 player;
  float gameTime;
  float hurt;
  float coolDown;
  int score,lives;
  int enemyCount,shotCount,boomCount;
  vec4 enemies[20];
  vec4 shots[32];
  vec4 booms[16];
};
out vec4 fragColor;
mat2 rot(float angle)
{
  float c=cos(angle);
  angle=sin(angle);
  return mat2(c,angle,-angle,c);
}
float triangleDist(vec2 p)
{
  return max(abs(p).x*.866025+p.y*.5,-p.y);
}
float boxDist(vec2 p)
{
  p=abs(p)-vec2(.03);
  return min(max(p.x,p.y),0.)+length(max(p,0.));
}
float enemyDist(vec2 p,int i)
{
  vec3 e=enemies[i].xyz;
  p-=e.xy;
  vec2 q=rot(gameTime*4.+float(i))*p;
  return e.z<.5?
    boxDist(rot(-gameTime*4.)*p):
    e.z<1.5?
      triangleDist(q)-.02:
      max(.03-length(p),triangleDist(q)-.03);
}
float hash21(vec2 xy)
{
  return fract(sin(dot(xy,vec2(12.9898,78.233)))*43758.5453);
}
float hash31(vec3 xyz)
{
  return hash21(vec2(hash21(xyz.xy),xyz.z));
}
float noise(vec3 x)
{
  vec3 i=floor(x);
  x=fract(x);
  x=x*x*x*(x*(x*6.-15.)+10.);
  return mix(mix(mix(hash31(i+vec3(0)),hash31(i+vec3(1,0,0)),x.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),x.x),x.y),mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),x.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1)),x.x),x.y),x.z)*2.-1.;
}
float digit7(vec2 q,int n)
{
  const int digitsegs[10]=int[](95,10,118,122,43,121,125,26,127,123);
  if(n<0||n>=digitsegs.length())
    return-1.;
  n=digitsegs[n];
  const ivec2 segpos[7]=ivec2[](ivec2(-1,1),ivec2(1,1),ivec2(-1,-1),ivec2(1,-1),ivec2(0,2),ivec2(0,0),ivec2(0,-2));
  float d=1e9;
  for(int i=segpos.length();i-->0;)
    {
      if((n&1<<i)==0)
        continue;
      vec2 p=q-vec2(segpos[i])*vec2(.45);
      bool vertical=i<4;
      if(vertical)
        p=p.yx;
      p=max(abs(p)-vec2(.35,0),vec2(0));
      float dx=p.x+p.y;
      d=min(d,dx);
    }
  d*=sqrt(.5);
  return d-.05;
}
void digits7(inout vec4 o,vec4 c,vec2 q,vec2 R,uint value,int digits)
{
  float d=1e9;
  for(int i=0;i<digits;i++)
    d=min(d,digit7(q,int(value%10u))),value/=10u,q.x+=1.25;
  d=clamp(.5-.25*R.y*d,0.,1.);
  o=mix(o,c,d);
}
vec3 palette(float t)
{
  return vec3(.2)+vec3(.2)*cos(6.28318*(vec3(.2)*t+vec3(.2,.2,.9)));
}
float fbm(vec2 p)
{
  float value=0.,amplitude=.5;
  for(int i=0;i<6;i++)
    value+=amplitude*(noise(p.xyx)*.5+.5),p*=2.,amplitude*=.5;
  return value;
}
vec3 explosion_2d(vec2 uv,float progress,vec3 backgroundcolor,float time)
{
  float d=length(uv),radius=pow(sin(progress*3.14159),.15)*.15+.001;
  time=smoothstep(0.,radius*.5,d)*smoothstep(radius,radius-.05,d-noise(vec3(uv*6.,time*.5))*(.1*(1.-progress)))*pow(1.-progress,2.);
  return time<.001?
    backgroundcolor:
    mix(backgroundcolor,mix(vec3(1,.9,.7),vec3(1,.3,0),d/radius)*(1.+progress*.5),time);
}
float metaDiamond(vec2 p,vec2 pixel,float r)
{
  p=abs(p-pixel);
  return r/(p.x+p.y+1e-4);
}
vec3 background(vec2 uv)
{
  vec3 starColor=vec3(0);
  vec2 uvstars=uv*3.+vec2(0,gameTime*.1),grid=floor(uvstars);
  for(int y=-1;y<=1;y++)
    for(int x=-1;x<=1;x++)
      {
        vec2 cell=grid+vec2(x,y);
        starColor+=vec3(1,.95,.8)*metaDiamond(uvstars,cell+vec2(hash21(cell),hash21(cell.yx))-.5,hash21(cell*1.5)*.01);
      }
  float cloud1=fbm(uv*5.+vec2(0,gameTime));
  vec3 c1=pow(cloud1*palette(.5),vec3(1.+hurt*.5));
  return mix(c1,fbm(uv*2.+vec2(10))*palette(0.),.5)+.2*starColor;
}
vec3 scene(vec2 uv,vec2 texCoord)
{
  vec3 col=background(uv);
  col/=1.+pow(length(uv),4.)*.6;
  for(int i=0;i<boomCount;i++)
    {
      vec2 p=uv-booms[i].xy;
      if(length(p)<.4)
        col=explosion_2d(p,1.-booms[i].z,col,gameTime);
    }
  float size=.05+smoothstep(0.,1.,hurt)*.1;
  size=smoothstep(size,size+.01,length(uv-player))*pow(length(uv-player),.15);
  col=mix(col,vec3(1)-hurt*vec3(0,1,1),1.-sqrt(size));
  for(int i=0;i<enemyCount;i++)
    col=mix(vec3(sin(enemies[i].z),1,.2),col,smoothstep(0.,.01,enemyDist(uv,i)));
  for(int i=0;i<shotCount;i++)
    col=mix(vec3(1,1,.8),col,smoothstep(.01,.02,length(uv-shots[i].xy)));
  col=clamp(col,0.,1.);
  size=iFrame.z*60.;
  texCoord+=(vec2(hash21(uv+vec2(1)),hash21(uv+vec2(2)))*2.-1.)*.005*sqrt(size);
  return mix(col,texture(tex,texCoord).xyz,pow(clamp(hash21(uv)*1.2,.5,1.),size));
}
void main()
{
  vec2 texCoord=gl_FragCoord.xy/iFrame.xy,uv=(gl_FragCoord.xy*2.-iFrame.xy)/iFrame.x;
  if(iFrame.w<.5)
    {
      fragColor=vec4(scene(uv,texCoord),1);
      return;
    }
  fragColor=texture(tex,texCoord);
  fragColor.xyz*=mix(1.2,1.,smoothstep(0.,2.,gameTime));
  if(gameTime<0.)
    digits7(fragColor,vec4(1,0,0,1),uv*5.-vec2(2,0),iFrame.xy,uint(score),4);
  else
     digits7(fragColor,vec4(1,0,0,1),uv*20.-vec2(18,8.5),iFrame.xy,uint(score),4),digits7(fragColor,vec4(0,.5,0,1),uv*20.-vec2(-19,8.5),iFrame.xy,uint(max(lives,0)),1);
}

// src\shaders\preprocessed.game.comp
#version 430

layout(local_size_x=1)in;
layout(location=0)uniform vec4 iInput;
layout(std430, binding = 0)buffer State{
  int shotEvents,boomEvents,hitEvents,unusedEvents;
  vec2 player;
  float gameTime;
  float hurt;
  float coolDown;
  int score,lives;
  int enemyCount,shotCount,boomCount;
  vec4 enemies[20];
  vec4 shots[32];
  vec4 booms[16];
};
const float DT=1./120.;
mat2 rot(float angle)
{
  float c=cos(angle);
  angle=sin(angle);
  return mat2(c,angle,-angle,c);
}
float triangleDist(vec2 p)
{
  return max(abs(p).x*.866025+p.y*.5,-p.y);
}
float boxDist(vec2 p)
{
  p=abs(p)-vec2(.03);
  return min(max(p.x,p.y),0.)+length(max(p,0.));
}
float enemyDist(vec2 p,int i)
{
  vec3 e=enemies[i].xyz;
  p-=e.xy;
  vec2 q=rot(gameTime*4.+float(i))*p;
  return e.z<.5?
    boxDist(rot(-gameTime*4.)*p):
    e.z<1.5?
      triangleDist(q)-.02:
      max(.03-length(p),triangleDist(q)-.03);
}
void updateEnemies()
{
  enemyCount=min(2+int(ceil(max(gameTime,0.)/7.)),20);
  for(int i=0;i<enemyCount;i++)
    {
      float kind=enemies[i].z;
      vec2 target=vec2(sin(gameTime+float(i))*.8,float(i)*.1+sin(gameTime+1.5)*.5-.1);
      if(kind>.5)
        target=player;
      if(kind>1.5)
        target=vec2(sin(gameTime),player.y);
      if(kind>2.5)
        target=vec2(player.x,sin(gameTime));
      enemies[i].xy=mix(enemies[i].xy,target,.0202);
      if(length(enemies[i].xy-player)<.07)
        enemies[i].xy=vec2(sin(float(i)),10),hurt=1.,lives--,hitEvents++;
    }
}
void updateShots()
{
  for(int i=shotCount-1;i>=0;i--)
    {
      shots[i].y+=DT;
      for(int j=0;j<enemyCount;j++)
        {
          vec2 p=shots[i].xy;
          if(p.y<1.&&min(enemyDist(p,j),length(p-enemies[j].xy)-.03)<.02)
            {
              score++;
              boomEvents++;
              if(boomCount<16)
                booms[boomCount++]=vec4(p,1,0);
              enemies[j].y=-10.;
              shots[i].y=10.;
            }
        }
      if(shots[i].y>.6)
        shots[i]=shots[--shotCount];
    }
  if(iInput.z>0.&&gameTime-coolDown>.15&&shotCount<32)
    coolDown=gameTime,shots[shotCount++]=vec4(player,0,0),shotEvents++;
}
void update()
{
  gameTime+=DT;
  hurt=max(hurt-DT,0.);
  player=clamp(player+iInput.xy*DT*.8,vec2(-1,-.5),vec2(1,.5));
  for(int i=boomCount-1;i>=0;i--)
    {
      booms[i].z-=DT;
      if(booms[i].z<=0.)
        booms[i]=booms[--boomCount];
    }
  if(gameTime>=0.&&gameTime<1.)
    {
      if(gameTime<.5)
        player=mix(player,vec2(0,-.3),.1056);
      score=0;
      hurt=0.;
      lives=3;
      for(int i=0;i<20;i++)
        enemies[i]=vec4(0,10,i==3||i==4?
          1.:
          i==5?
            2.:
            i==6?
              3.:
              0.,0);
    }
  updateEnemies();
  updateShots();
  if(gameTime>2.&&lives<=0)
    gameTime=-2.,coolDown=gameTime;
}
void main()
{
  for(int i=0;i<int(iInput.w);i++)
    update();
}


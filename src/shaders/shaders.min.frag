// src\shaders\preprocessed.scene.frag
#version 430

layout(location=0)uniform vec4 iFrame;
layout(binding=0)uniform sampler2D tex;
layout(std430, binding = 0)buffer State{
  int shotEvents,hitEvents,killEvents,hurtEvents,jumpEvents,lapEvents,spitEvents;
  vec3 pos;
  float yaw;
  vec3 vel;
  float pitch;
  float yawBase;
  float light;
  float lapTime,bestLap;
  int lap;
  int checkpoint;
  float time;
  float cooldown;
  float kick;
  float shake,hurt,hitMark,lapFlash;
  float dead;
  float bob;
  int grounded,started,kills;
  int record;
  float prevButtons;
  uint rng;
  float spawnTimer;
  vec4 bolt[12];
  vec4 boltVel[12];
  vec4 enemy[10];
  int enemyKind[10];
  vec4 enemyVel[10];
  vec4 enemyInfo[10];
  vec4 spark[8];
  vec4 orb[12];
  vec4 orbVel[12];
  vec4 shot[10];
  vec4 shotVel[10];
  int lightCount;
  vec4 lightPos[32],lightCol[32];
};
const vec3 IN_LO[13]=vec3[](vec3(0,0,-6),vec3(-3,0,-2.5),vec3(39,-4,-2.5),vec3(52,-4,-16),vec3(60,-7,-8),vec3(83,-4,-2.5),vec3(84,-4,-2.5),vec3(83,1,11),vec3(24,1,8),vec3(50,1,11),vec3(19,1,26),vec3(-8,-3,16),vec3(-8,-3,-2.5)),IN_HI[13]=vec3[](vec3(40,9,6),vec3(1,4.5,2.5),vec3(53,4.5,2.5),vec3(84,10,16),vec3(76,-3.9,8),vec3(86,.5,2.5),vec3(90,6.5,16),vec3(86,5.5,16),vec3(52,7.2,34),vec3(54,5,16),vec3(25,5,32),vec3(20,10,34),vec3(-2,4.5,17)),SO_LO[9]=vec3[](vec3(4,0,-6),vec3(4,0,3.5),vec3(59,-7.5,-2),vec3(52,.5,11),vec3(52,1,10.8),vec3(84,-4,11),vec3(14,-3,24),vec3(-8,-3,-2.5),vec3(39,-4,-2.5)),SO_HI[9]=vec3[](vec3(36,1,-3.5),vec3(36,1,6),vec3(77,-4,2),vec3(84,1,16),vec3(84,2,11.2),vec3(90,1,16),vec3(20,1,34),vec3(-2,0,4),vec3(42,0,2.5)),ST_LO[5]=vec3[](vec3(42,-4,-2.5),vec3(70,-7,2),vec3(70,-7,-8),vec3(84,-4,1),vec3(-8,-3,4)),ST_HI[5]=vec3[](vec3(50,0,2.5),vec3(76,-4,8),vec3(76,-4,-2),vec3(90,1,11),vec3(-2,0,12));
const int ST_DIR[5]=int[](1,0,0,2,3);
const vec3 ROUTE[23]=vec3[](vec3(3,0,0),vec3(38,0,0),vec3(42,0,0),vec3(51,-4,0),vec3(59,-4,0),vec3(77,-4,0),vec3(87,-4,0),vec3(87,1,11),vec3(87,1,13.5),vec3(53,1,13.5),vec3(50,1,17),vec3(45,1,17),vec3(45,1,23),vec3(33,1,23),vec3(33,1,29),vec3(22,1,29),vec3(15,1,30),vec3(10,-3,31),vec3(-4,-3,30),vec3(-5,-3,18),vec3(-5,-3,12),vec3(-5,0,4),vec3(-5,0,0));
uint seenIn=~0u,seenSo=~0u;
float detail;
int tRoom;
float tInside;
vec3 tLo,tHi;
out vec4 fragColor;
vec3 eye,camF,camR,camU,gunAt;
uint seenX;
vec3 neonCol;
const vec4 ROOM_NEON[13]=vec4[](vec4(.1,.6,1,1.25),vec4(0),vec4(.3,.45,.7,4.2),vec4(1,.3,.05,.25),vec4(0),vec4(0),vec4(.1,1,.4,5.3),vec4(0),vec4(.6,.15,1,.25),vec4(0),vec4(0),vec4(1,.1,.5,.25),vec4(.2,.4,1,3.25));
const int DIE_LAP[13]=int[](7,9,3,5,9,9,4,9,2,9,9,4,3);
float gNeon;
bool withNeon=true;
float fogDensity;
vec3 glowSum,n,v,f0,glow;
float rough,metal;
float box(vec3 p,vec3 lo,vec3 hi)
{
  p=abs(p-(lo+hi)*.5)-(hi-lo)*.5;
  return length(max(p,0.))+min(max(p.x,max(p.y,p.z)),0.);
}
float stairs(vec3 p,int i)
{
  vec3 lo=ST_LO[i],hi=ST_HI[i];
  i=ST_DIR[i];
  float len=i<2?
    hi.x-lo.x:
    hi.z-lo.z,rise=hi.y-lo.y,u=i<2?
    p.x-lo.x:
    p.z-lo.z;
  if(i%2>0)
    u=len-u;
  float n=floor(rise/.25),run=len/n,d=1e9;
  if(detail>0.)
    {
      float k=clamp(floor(u/run),0.,n-1.);
      for(int j=0;j<2;j++)
        {
          float s=min(k+float(j),n-1.),h=(s+1.)*rise/n*.5;
          vec2 e=abs(vec2(u-(s+.5)*run,p.y-lo.y-h))-vec2(run*.5,h);
          d=min(d,length(max(e,0.))+min(max(e.x,e.y),0.));
        }
    }
  else
     d=(p.y-lo.y-rise*min(u/len+.5/n,1.))*len/length(vec2(len,rise));
  return max(d,box(p,lo,hi));
}
float columns(vec3 p,vec2 at,float s,float r,vec3 lo,vec3 hi)
{
  return max(length(mod(p.xz-at+s*.5,s)-s*.5)-r,box(p,lo,hi));
}
float level(vec3 p)
{
  float inside=1e9;
  for(int i=0;i<13;i++)
    {
      if((seenIn>>i&1u)==0u)
        continue;
      float d=box(p,IN_LO[i],IN_HI[i]);
      if(i==8)
        {
          vec2 c=mod(p.xz-vec2(0,2),6.)-3.;
          float y=max(p.y-4.,0.);
          d=max(d,min(length(vec2(c.x,y)),length(vec2(c.y,y)))-3.);
        }
      if(d<inside)
        inside=d,tRoom=i,tLo=IN_LO[i],tHi=IN_HI[i];
    }
  tInside=inside;
  inside=-inside;
  for(int i=0;i<9;i++)
    if((seenSo>>i&1u)!=0u)
      inside=min(inside,box(p,SO_LO[i],SO_HI[i]));
  for(int i=0;i<5;i++)
    if((seenSo>>9+i&1u)!=0u)
      inside=min(inside,stairs(p,i));
  if((seenIn&1u)!=0u)
    inside=min(min(inside,columns(vec3(p.xy,abs(p.z)),vec2(1,3.8),6.,.4,vec3(5,0,0),vec3(35,9,6))),max(abs(mod(p.x-1.,6.)-3.)-.3,box(p,vec3(0,8.3,-6),vec3(40,9,6))));
  if((seenIn>>3&1u)!=0u)
    {
      inside=min(min(inside,length(abs(p.xz-vec2(68,0))-8.)-1.2),columns(p,vec2(56,11.6),8.,.35,vec3(53,-4,11),vec3(83,1,12)));
      if(detail>0.)
        inside=min(inside,box(p,vec3(60,-8,-8),vec3(76,-6.6,8)));
    }
  if((seenIn>>8&1u)!=0u)
    inside=min(inside,columns(p,vec2(0,2),6.,.5+.15*step(p.y,1.4)+.2*step(3.6,p.y),vec3(27,1,11),vec3(51,8,35)));
  if((seenIn>>11&1u)!=0u)
    inside=min(inside,length(abs(p.xz-vec2(4,25))-1.)-.35);
  return inside;
}
float digit7(vec2 q,int n)
{
  const int digitsegs[10]=int[](95,10,118,122,43,121,125,26,127,123);
  const ivec2 segpos[7]=ivec2[](ivec2(-1,1),ivec2(1,1),ivec2(-1,-1),ivec2(1,-1),ivec2(0,2),ivec2(0,0),ivec2(0,-2));
  n=digitsegs[n];
  float d=1e9;
  for(int i=0;i<7;i++)
    {
      if((n&1<<i)==0)
        continue;
      vec2 p=q-vec2(segpos[i])*.45;
      if(i<4)
        p=p.yx;
      p=max(abs(p)-vec2(.35,0),0.);
      d=min(d,p.x+p.y);
    }
  return d*sqrt(.5)-.05;
}
void digits7(inout vec3 o,vec3 c,vec2 q,float scale,int value,int minDigits)
{
  float d=1e9;
  for(int i=0;i<6;i++)
    {
      d=min(d,digit7(q,value%10));
      value/=10;
      q.x+=1.25;
      if(value==0&&i>=minDigits-1)
        break;
    }
  o+=c*(clamp(.5-iFrame.y/scale*d*.5,0.,1.)+.2*exp(-30.*max(d,0.)));
}
float hash(vec2 p)
{
  return fract(sin(dot(p,vec2(12.9,78.2)))*4e4);
}
float noise(vec2 p)
{
  vec2 i=floor(p);
  p=fract(p);
  p*=p*(3.-2.*p);
  return mix(mix(hash(i),hash(i+vec2(1,0)),p.x),mix(hash(i+vec2(0,1)),hash(i+1.),p.x),p.y);
}
float fbm(vec2 p)
{
  return noise(p)*.5+noise(p*2.13+7.)*.3+noise(p*4.37+3.)*.2;
}
float smin(float a,float b,float k)
{
  float h=clamp(.5+.5*(b-a)/k,0.,1.);
  return mix(b,a,h)-k*h*(1.-h);
}
float capsule(vec3 p,vec3 a,vec3 b,float r)
{
  p-=a;
  a=b-a;
  return length(p-a*clamp(dot(p,a)/dot(a,a),0.,1.))-r;
}
void tube(inout float d,float t,vec3 color)
{
  if(t<d)
    d=t,neonCol=color;
}
float neon(vec3 p)
{
  vec4 c=ROOM_NEON[tRoom];
  vec2 q=abs(p.xz-(tLo.xz+tHi.xz)*.5)-(tHi.xz-tLo.xz)*.5+.12;
  float y=p.y-tLo.y-c.w;
  y=c.x+c.z>0.?
    length(vec2(length(max(q,0.))+min(max(q.x,q.y),0.),min(abs(y),abs(y-(tRoom==3?
      6.:
      3.)))))-.05:
    1e9;
  neonCol=c.xyz;
  y=max(y,-.4-tInside);
  float b=max(abs(p.x-4.)-.1,box(p,IN_LO[0],IN_HI[0]));
  if(b<1.)
    {
      vec2 e=abs(vec2(p.z,p.y-4.))-vec2(3.3,4);
      b=length(vec2(max(e.x,e.y),p.x-4.))-.06;
    }
  tube(y,b,vec3(1));
  b=length(abs(p.xz-vec2(68,0))-8.)-1.3;
  if((seenIn>>3&1u)!=0u&&b<1.)
    b=length(vec2(b+.07,min(abs(p.y+3.),abs(p.y-3.))))-.05;
  tube(y,b,vec3(1,.3,.05));
  b=max(abs(p.y-4.4)-.1,box(p,vec3(27,1,11),vec3(51,8,35)));
  if((seenIn>>8&1u)!=0u&&b<1.)
    b=max(length(vec2(length(mod(p.xz-vec2(3,5),6.)-3.)-.7,p.y-4.4))-.04,b);
  tube(y,b,vec3(.6,.15,1));
  if((seenIn>>11&1u)!=0u)
    tube(y,length(p.xz-vec2(4,25))-.45,vec3(1,.3,.7));
  int die=DIE_LAP[tRoom];
  b=hash(vec2(floor(time*9.),tRoom));
  neonCol*=lap<die?
    1.:
    lap==die?
      step(.35,b):
      .03+step(.96,b);
  return y;
}
float neonAt(vec3 p)
{
  level(p);
  return neon(p);
}
vec2 enemyShape(vec3 p,int i)
{
  vec3 e=enemy[i].xyz;
  float s=(enemy[i].w<0.?
    1.6+enemy[i].w*2.:
    max(enemyInfo[i].x,.05))*1.3;
  vec3 f=normalize(eye-e),r=normalize(cross(f,vec3(0,1,0)));
  p-=e;
  e=vec3(dot(p,r),dot(p,cross(r,f)),dot(p,f))/s;
  float t=time*3.+float(i)*1.7,body;
  if(enemyKind[i]>0)
    {
      body=length(e)-.5;
      float a=mod(atan(e.y,e.x)+t*.3+.39,.785)-.39;
      body=smin(body,capsule(vec3(length(e.xy)*vec2(cos(a),sin(a)),e.z),vec3(.3,0,-.1),vec3(1.1,0,-.4),.05),.15);
    }
  else
    {
      body=length(e*vec3(1,1.15,.8))-.5;
      for(int k=0;k<5;k++)
        {
          float a=float(k)*1.257+sin(t*.3)*.3;
          vec3 tip=vec3(cos(a)*.7,sin(a)*.7,-1.3)+.2*vec3(sin(t+float(k)*2.),cos(t*1.3+float(k)),0);
          body=smin(body,capsule(e,vec3(cos(a),sin(a),0)*.25,tip,.07),.2);
        }
    }
  body=-smin(-body,length(e-vec3(0,0,.55))-.27,.05);
  t=length(e-vec3(0,0,.3))-.2;
  return vec2(min(body,t)*s*.8,t<body?
    30.+float(i):
    10.+float(i));
}
vec2 map(vec3 p)
{
  vec2 h=vec2(level(p),0);
  gNeon=!withNeon?
    1e9:
    neon(p);
  if(gNeon<h.x)
    h=vec2(gNeon,1);
  for(int i=0;i<10;i++)
    {
      if((seenX>>i&1u)==0u)
        continue;
      float d=length(p-enemy[i].xyz)-3.;
      if(d>.3)
        h.x=min(h.x,d);
      else
        {
          vec2 e=enemyShape(p,i);
          if(e.x<h.x)
            h=e;
        }
    }
  p-=eye;
  p=vec3(dot(p,camR),dot(p,camU),dot(p,camF))-gunAt;
  float d=length(p-vec3(0,0,.03))-.27;
  if(seenX<1u<<31)
    return h;
  if(d>.1)
    h.x=min(h.x,d);
  else
    {
      float z=p.z-.04;
      z-=clamp(floor(z/.07+.5),-1.,1.)*.07;
      d=min(length(vec3(p.xy,p.z-clamp(p.z,-.12,.22)))-.03+step(abs(z),.012)*.004,length(max(abs(p-vec3(0,-.035,-.1))-vec3(.03,.04,.1),0.))-.012);
      if(d<h.x)
        h=vec2(d,abs(z)<.012&&length(p.xy)<.04?
          3.:
          2.);
    }
  return h;
}
vec3 normal(vec3 p)
{
  vec2 e=vec2(1,-1)*.001;
  return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);
}
vec2 march(vec3 ro,vec3 rd)
{
  float t=0.;
  for(int i=0;i<200;i++)
    {
      vec2 h=map(ro+rd*t);
      glowSum+=neonCol*exp(-gNeon*3.-t*fogDensity)*min(h.x,1.);
      if(h.x<2e-4*(1.+t*4.))
        return vec2(t,h.y);
      t+=h.x;
      if(t>1e2)
        break;
    }
  return vec2(t,-1);
}
bool hitBox(vec3 ro,vec3 rd,vec3 lo,vec3 hi)
{
  lo=(lo-ro)/rd;
  ro=(hi-ro)/rd;
  rd=min(lo,ro);
  ro=max(lo,ro);
  return max(max(rd.x,rd.y),max(rd.z,0.))<=min(min(ro.x,ro.y),ro.z);
}
bool hitSphere(vec3 ro,vec3 rd,vec3 c,float r)
{
  ro=c-ro;
  float b=dot(ro,rd);
  return dot(ro,ro)-b*b<r*r&&b>-r;
}
void cull(vec3 ro,vec3 rd)
{
  seenIn=seenSo=seenX=0u;
  for(int i=0;i<13;i++)
    if(hitBox(ro,rd,IN_LO[i]-1.,IN_HI[i]+1.))
      seenIn|=1u<<i;
  for(int i=0;i<9;i++)
    if(hitBox(ro,rd,SO_LO[i]-.5,SO_HI[i]+.5))
      seenSo|=1u<<i;
  for(int i=0;i<5;i++)
    if(hitBox(ro,rd,ST_LO[i]-.5,ST_HI[i]+.5))
      seenSo|=1u<<9+i;
  for(int i=0;i<10;i++)
    if(enemy[i].w!=0.&&hitSphere(ro,rd,enemy[i].xyz,3.3))
      seenX|=1u<<i;
  if(hitSphere(ro,rd,eye+mat3(camR,camU,camF)*(gunAt+vec3(0,0,.03)),.3))
    seenX|=1u<<31;
}
float occlusion(vec3 p,vec3 n)
{
  float o=0.;
  withNeon=false;
  for(int i=1;i<4;i++)
    {
      float d=float(i)*.2;
      o+=(d-map(p+n*d).x)/d;
    }
  withNeon=true;
  return clamp(1.-o*.2,0.,1.);
}
vec3 material(vec3 p,float m)
{
  rough=.5;
  metal=0.;
  glow=vec3(0);
  if(m>=30.)
    return glow=vec3(1,.05,.12)*(6.+10.*enemyInfo[int(m-30.)].y),vec3(0);
  if(m>=10.)
    {
      int i=int(m-10.);
      vec3 q=p-enemy[i].xyz;
      float veins=abs(fbm(q.xy*6.+q.z*4.+time)-.5);
      glow=vec3(1,.05,.12)*smoothstep(.06,0.,veins)*3.+vec3(1.5)*enemyInfo[i].y+vec3(10)*max(-enemy[i].w,0.);
      rough=.15;
      return vec3(.01);
    }
  if(m==1.)
    return neonAt(p),glow=neonCol*6.,vec3(0);
  if(m==3.)
    return glow=vec3(1,.75,.4)*(light*1.5+kick*3.),vec3(0);
  if(m==2.)
    return metal=1.,rough=.4,vec3(.12);
  level(p);
  int r=tRoom;
  if(n.y>.7)
    {
      if(p.y<-6.5)
        return n=normalize(n+vec3(noise(p.xz*3.+time)-.5,0,noise(p.xz*3.-time+9.)-.5)*.06),rough=.02,vec3(.005);
      if(r==2||r==6||r==12)
        {
          vec2 g=abs(fract(p.xz*4.)-.5);
          metal=.5;
          rough=.4;
          return vec3(.07,.065,.06)*(.5+.5*fbm(p.xz*5.))*(1.-.7*step(.3,min(g.x,g.y)));
        }
      vec2 g=abs(fract(p.xz/1.5)-.5);
      float wet=smoothstep(.55,.7,fbm(p.xz*.3)+.1*fbm(p.xz*3.)+(r==3?
        .15:
        0.));
      rough=mix(.6,.03,wet);
      return vec3(.055,.05,.045)*(.6+.4*hash(floor(p.xz/1.5)))*(.7+.5*fbm(p.xz*2.))*(1.-.6*step(.48,max(g.x,g.y)))*(1.-.5*wet);
    }
  if(n.y<-.7)
    return vec3(.02);
  m=p.x+p.z;
  if(r==6)
    {
      metal=.4;
      rough=.35;
      vec2 e=abs(fract(vec2(m,p.y)*vec2(.5))-.5);
      return vec3(.06,.065,.07)*(.6+.6*fbm(vec2(m,p.y)*3.))*(1.-.6*step(.48,max(e.x,e.y)));
    }
  float y=p.y*2.,row=floor(y);
  vec2 b=vec2(m+.5*mod(row,2.),y),e=abs(fract(b)-.5);
  rough=.7;
  return vec3(.07,.065,.06)*(.6+.5*hash(vec2(floor(b.x),row)))*(.6+.6*fbm(vec2(m,p.y)*4.))*(1.-.7*step(.46,max(e.x,e.y*.9+.05)));
}
vec3 shade(vec3 p,vec3 lp,vec3 c)
{
  p=lp-p;
  float d2=dot(p,p);
  p*=inversesqrt(d2);
  lp=normalize(p+v);
  float k=2./max(rough*rough,.002);
  k=(k+8.)/25.*pow(max(dot(n,lp),0.),k);
  return c*max(dot(n,p),0.)*k*f0/(d2+.3);
}
vec3 scattered(vec3 ro,vec3 rd,float tMax)
{
  vec3 c=vec3(0);
  for(int i=0;i<lightCount;i++)
    {
      vec3 color=lightCol[i].xyz,o=lightPos[i].xyz-ro;
      float b=dot(o,rd),h2=max(dot(o,o)-b*b,0.),h=sqrt(h2+.3);
      c+=color*((atan((tMax-b)/h)+atan(b/h))/h*fogDensity*.07*(i<2?
        .1:
        1.)+step(2.,float(i))*step(0.,b)*step(b,tMax)*.001/(h2+1e-4));
    }
  return c;
}
vec3 render(vec3 ro,vec3 rd)
{
  const vec3 fogColor=vec3(.004,.005,.012);
  vec3 col=vec3(0),weight=vec3(1);
  for(int bounce=0;bounce<2;bounce++)
    {
      glowSum=vec3(0);
      cull(ro,rd);
      vec2 h=march(ro,rd);
      vec3 p=ro+rd*h.x,c=fogColor;
      if(h.y>=0.)
        {
          n=normal(p);
          v=-rd;
          vec3 albedo=material(p,h.y);
          f0=mix(vec3(.04),albedo,metal);
          albedo*=1.-metal;
          float ao=occlusion(p,n),d=neonAt(p+n*.3);
          c=albedo*(neonCol*2./(1.+d*d*3.)+vec3(.01,.012,.02))*ao+glow;
          for(int i=0;i<lightCount;i++)
            {
              vec3 color=lightCol[i].xyz,l=lightPos[i].xyz-p;
              c+=albedo*color*max(dot(n,normalize(l)),0.)/(dot(l,l)+.3)+shade(p,lightPos[i].xyz,color);
            }
        }
      float fog=exp(-h.x*fogDensity);
      col+=weight*(mix(fogColor,c,fog)+glowSum*.05+scattered(ro,rd,h.x));
      if(h.y<0.)
        break;
      weight*=(f0+(1.-f0)*pow(1.-max(dot(n,v),0.),5.))*(1.-rough)*fog;
      if(rough>.3||max(weight.x,max(weight.y,weight.z))<.02)
        break;
      ro=p+n*.01;
      h=gl_FragCoord.xy;
      rd=normalize(reflect(rd,n)+rough*.3*(vec3(hash(h),hash(h+1.),hash(h+2.))-.5));
    }
  return col;
}
void main()
{
  vec2 texCoord=gl_FragCoord.xy/iFrame.xy,uv=(gl_FragCoord.xy*2.-iFrame.xy)/iFrame.y;
  if(iFrame.w<.5)
    {
      detail=1.;
      float b=sin(bob*2.8);
      eye=pos+vec3(0,1.+b*.04,0)+shake*shake*.05*vec3(sin(time*71.),sin(time*83.),sin(time*61.));
      camF=vec3(cos(yaw)*cos(pitch),sin(pitch),sin(yaw)*cos(pitch));
      camR=normalize(cross(camF,vec3(0,1,0)));
      camU=cross(camR,camF);
      gunAt=vec3(.22+sin(bob*1.4)*.01,-.21+b*.01,.36-kick*.06);
      fogDensity=.03+(1.-light)*.08;
      vec3 rd=normalize(uv.x*camR+uv.y*camU+(1.6-kick*.03)*camF);
      fragColor=vec4(clamp(render(eye,rd),0.,50.),1);
      return;
    }
  vec2 ca=(texCoord-.5)*.002;
  vec3 col=vec3(texture(tex,texCoord+ca).x,texture(tex,texCoord).y,texture(tex,texCoord-ca).z),bloom=vec3(0);
  for(int i=2;i<8;i++)
    bloom+=max(textureLod(tex,texCoord,float(i)).xyz-.4,0.);
  col+=bloom*.3;
  col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14);
  float luma=dot(col,vec3(.3,.6,.1));
  col=pow(clamp(mix(vec3(luma),col,1.2)+vec3(-.005,0,.015)*(1.-luma),0.,1.),vec3(1./2.2));
  luma=length(texCoord-.5);
  col*=max(1.-pow(luma,1.5)*(1.2+(1.-light)*2.),0.);
  col=(mix(col,vec3(col.x+.3,0,0),hurt*smoothstep(.2,.7,luma))+lapFlash*vec3(1,.75,.4)*.3)*max(1.-dead*.5,0.)+(hash(gl_FragCoord.xy+fract(time)*1e2)-.5)*.02;
  bloom=vec3(.5,.8,1);
  if(dead>1.)
    {
      float k=min(dead-1.,1.);
      bool best=lap-1>=record&&lap>1;
      digits7(col,(best?
        vec3(1,.75,.4)*(1.5+sin(time*8.)):
        bloom)*k,uv*7.-vec2(.6,1.6),7.,lap-1,1);
      col+=bloom*k*smoothstep(.01,0.,abs(length(uv-vec2(-.25,.23))-.06)-.008);
      int cs=int(bestLap*1e2);
      digits7(col,bloom*k,uv*18.-vec2(1.5,-2),18.,cs%100,2);
      digits7(col,bloom*k,uv*18.-vec2(-1.5,-2),18.,cs/100,1);
      col+=bloom*k*smoothstep(.06,.02,length(uv*18.-vec2(-.4,-3.2)));
      vec2 q=uv-vec2(-.3,-.11);
      col+=bloom*k*smoothstep(.01,0.,min(abs(length(q)-.04)-.006,max(abs(q.x)-.004,abs(q.y-.015)-.02)));
      digits7(col,vec3(1,.05,.12)*2.*k,uv*18.-vec2(1.5,-6),18.,kills,1);
      col+=vec3(1,.05,.12)*2.*k*smoothstep(.01,0.,length(uv-vec2(-.3,-.33))-.03);
      fragColor=vec4(col,1);
      return;
    }
  ca=abs(uv);
  luma=max(step(ca.x+ca.y,.004),step(abs(max(ca.x,ca.y)-.03-hitMark*.01),.002)*step(min(ca.x,ca.y),.002));
  col=mix(col,mix(vec3(.9),vec3(1,.05,.12)*2.,hitMark),luma*.8);
  int cs=int(lapTime*1e2);
  digits7(col,bloom,uv*22.-vec2(-.5,19.5),22.,cs%100,2);
  digits7(col,bloom,uv*22.-vec2(-3.5,19.5),22.,cs/100,1);
  col+=bloom*smoothstep(.06,.02,length(uv*22.-vec2(-2.4,18.3)));
  if(bestLap>0.)
    digits7(col,bloom*.5,uv*40.-vec2(1.5,33),40.,int(bestLap*1e2),3);
  digits7(col,bloom,uv*22.-vec2(-34,19.5),22.,lap,1);
  if(lapFlash>0.)
    digits7(col,vec3(1,.75,.4)*lapFlash*2.,uv*6.-vec2(.5,1.5),6.,lap,1);
  luma=step(abs(uv.y+.9),.006)*step(abs(uv.x),.35*light);
  col+=luma*vec3(1,.75,.4)*(light<.25?
    step(.5,fract(time*3.))+.3:
    .8);
  fragColor=vec4(col,1);
}

// src\shaders\preprocessed.game.comp
#version 430

layout(local_size_x=1)in;
layout(location=0)uniform vec4 iInput[2];
layout(std430, binding = 0)buffer State{
  int shotEvents,hitEvents,killEvents,hurtEvents,jumpEvents,lapEvents,spitEvents;
  vec3 pos;
  float yaw;
  vec3 vel;
  float pitch;
  float yawBase;
  float light;
  float lapTime,bestLap;
  int lap;
  int checkpoint;
  float time;
  float cooldown;
  float kick;
  float shake,hurt,hitMark,lapFlash;
  float dead;
  float bob;
  int grounded,started,kills;
  int record;
  float prevButtons;
  uint rng;
  float spawnTimer;
  vec4 bolt[12];
  vec4 boltVel[12];
  vec4 enemy[10];
  int enemyKind[10];
  vec4 enemyVel[10];
  vec4 enemyInfo[10];
  vec4 spark[8];
  vec4 orb[12];
  vec4 orbVel[12];
  vec4 shot[10];
  vec4 shotVel[10];
  int lightCount;
  vec4 lightPos[32],lightCol[32];
};
const vec3 IN_LO[13]=vec3[](vec3(0,0,-6),vec3(-3,0,-2.5),vec3(39,-4,-2.5),vec3(52,-4,-16),vec3(60,-7,-8),vec3(83,-4,-2.5),vec3(84,-4,-2.5),vec3(83,1,11),vec3(24,1,8),vec3(50,1,11),vec3(19,1,26),vec3(-8,-3,16),vec3(-8,-3,-2.5)),IN_HI[13]=vec3[](vec3(40,9,6),vec3(1,4.5,2.5),vec3(53,4.5,2.5),vec3(84,10,16),vec3(76,-3.9,8),vec3(86,.5,2.5),vec3(90,6.5,16),vec3(86,5.5,16),vec3(52,7.2,34),vec3(54,5,16),vec3(25,5,32),vec3(20,10,34),vec3(-2,4.5,17)),SO_LO[9]=vec3[](vec3(4,0,-6),vec3(4,0,3.5),vec3(59,-7.5,-2),vec3(52,.5,11),vec3(52,1,10.8),vec3(84,-4,11),vec3(14,-3,24),vec3(-8,-3,-2.5),vec3(39,-4,-2.5)),SO_HI[9]=vec3[](vec3(36,1,-3.5),vec3(36,1,6),vec3(77,-4,2),vec3(84,1,16),vec3(84,2,11.2),vec3(90,1,16),vec3(20,1,34),vec3(-2,0,4),vec3(42,0,2.5)),ST_LO[5]=vec3[](vec3(42,-4,-2.5),vec3(70,-7,2),vec3(70,-7,-8),vec3(84,-4,1),vec3(-8,-3,4)),ST_HI[5]=vec3[](vec3(50,0,2.5),vec3(76,-4,8),vec3(76,-4,-2),vec3(90,1,11),vec3(-2,0,12));
const int ST_DIR[5]=int[](1,0,0,2,3);
const vec3 ROUTE[23]=vec3[](vec3(3,0,0),vec3(38,0,0),vec3(42,0,0),vec3(51,-4,0),vec3(59,-4,0),vec3(77,-4,0),vec3(87,-4,0),vec3(87,1,11),vec3(87,1,13.5),vec3(53,1,13.5),vec3(50,1,17),vec3(45,1,17),vec3(45,1,23),vec3(33,1,23),vec3(33,1,29),vec3(22,1,29),vec3(15,1,30),vec3(10,-3,31),vec3(-4,-3,30),vec3(-5,-3,18),vec3(-5,-3,12),vec3(-5,0,4),vec3(-5,0,0));
uint seenIn=~0u,seenSo=~0u;
float detail;
int tRoom;
float tInside;
vec3 tLo,tHi;
const float DT=1./120.;
float box(vec3 p,vec3 lo,vec3 hi)
{
  p=abs(p-(lo+hi)*.5)-(hi-lo)*.5;
  return length(max(p,0.))+min(max(p.x,max(p.y,p.z)),0.);
}
float stairs(vec3 p,int i)
{
  vec3 lo=ST_LO[i],hi=ST_HI[i];
  i=ST_DIR[i];
  float len=i<2?
    hi.x-lo.x:
    hi.z-lo.z,rise=hi.y-lo.y,u=i<2?
    p.x-lo.x:
    p.z-lo.z;
  if(i%2>0)
    u=len-u;
  float n=floor(rise/.25),run=len/n,d=1e9;
  if(detail>0.)
    {
      float k=clamp(floor(u/run),0.,n-1.);
      for(int j=0;j<2;j++)
        {
          float s=min(k+float(j),n-1.),h=(s+1.)*rise/n*.5;
          vec2 e=abs(vec2(u-(s+.5)*run,p.y-lo.y-h))-vec2(run*.5,h);
          d=min(d,length(max(e,0.))+min(max(e.x,e.y),0.));
        }
    }
  else
     d=(p.y-lo.y-rise*min(u/len+.5/n,1.))*len/length(vec2(len,rise));
  return max(d,box(p,lo,hi));
}
float columns(vec3 p,vec2 at,float s,float r,vec3 lo,vec3 hi)
{
  return max(length(mod(p.xz-at+s*.5,s)-s*.5)-r,box(p,lo,hi));
}
float level(vec3 p)
{
  float inside=1e9;
  for(int i=0;i<13;i++)
    {
      if((seenIn>>i&1u)==0u)
        continue;
      float d=box(p,IN_LO[i],IN_HI[i]);
      if(i==8)
        {
          vec2 c=mod(p.xz-vec2(0,2),6.)-3.;
          float y=max(p.y-4.,0.);
          d=max(d,min(length(vec2(c.x,y)),length(vec2(c.y,y)))-3.);
        }
      if(d<inside)
        inside=d,tRoom=i,tLo=IN_LO[i],tHi=IN_HI[i];
    }
  tInside=inside;
  inside=-inside;
  for(int i=0;i<9;i++)
    if((seenSo>>i&1u)!=0u)
      inside=min(inside,box(p,SO_LO[i],SO_HI[i]));
  for(int i=0;i<5;i++)
    if((seenSo>>9+i&1u)!=0u)
      inside=min(inside,stairs(p,i));
  if((seenIn&1u)!=0u)
    inside=min(min(inside,columns(vec3(p.xy,abs(p.z)),vec2(1,3.8),6.,.4,vec3(5,0,0),vec3(35,9,6))),max(abs(mod(p.x-1.,6.)-3.)-.3,box(p,vec3(0,8.3,-6),vec3(40,9,6))));
  if((seenIn>>3&1u)!=0u)
    {
      inside=min(min(inside,length(abs(p.xz-vec2(68,0))-8.)-1.2),columns(p,vec2(56,11.6),8.,.35,vec3(53,-4,11),vec3(83,1,12)));
      if(detail>0.)
        inside=min(inside,box(p,vec3(60,-8,-8),vec3(76,-6.6,8)));
    }
  if((seenIn>>8&1u)!=0u)
    inside=min(inside,columns(p,vec2(0,2),6.,.5+.15*step(p.y,1.4)+.2*step(3.6,p.y),vec3(27,1,11),vec3(51,8,35)));
  if((seenIn>>11&1u)!=0u)
    inside=min(inside,length(abs(p.xz-vec2(4,25))-1.)-.35);
  return inside;
}
vec3 levelNormal(vec3 p)
{
  vec2 e=vec2(1,-1)*.01;
  return normalize(e.xyy*level(p+e.xyy)+e.yyx*level(p+e.yyx)+e.yxy*level(p+e.yxy)+e.xxx*level(p+e.xxx));
}
float trackLength()
{
  float s=0.;
  for(int i=0;i<23;i++)
    s+=length(ROUTE[(i+1)%23]-ROUTE[i]);
  return s;
}
float trackPos(vec3 p)
{
  float best=1e9,s=0.,at=0.;
  for(int i=0;i<23;i++)
    {
      vec3 a=ROUTE[i],ab=ROUTE[(i+1)%23]-a;
      float h=clamp(dot(p-a,ab)/dot(ab,ab),0.,1.),d=length(p-a-ab*h);
      if(d<best)
        best=d,at=s+h*length(ab);
      s+=length(ab);
    }
  return at;
}
vec3 trackPoint(float s)
{
  s=mod(s,trackLength());
  for(int i=0;i<23;i++)
    {
      vec3 a=ROUTE[i],b=ROUTE[(i+1)%23];
      float l=length(b-a);
      if(s<l)
        return mix(a,b,s/l);
      s-=l;
    }
  return ROUTE[0];
}
float rnd()
{
  rng=rng*1664525u+1013904223u;
  return float(rng>>8)/16777216.;
}
void accelerate(vec3 wish,float cap,float accel)
{
  cap-=dot(vel,wish);
  if(cap>0.)
    vel+=wish*min(cap,accel*DT);
}
void addSpark(vec3 p,float power)
{
  int k=0;
  for(int i=1;i<8;i++)
    if(spark[i].w<spark[k].w)
      k=i;
  spark[k]=vec4(p,power);
}
void newRun()
{
  started=1;
  pos=vec3(5,.51,0);
  vel=vec3(0);
  yawBase=-iInput[1].x;
  light=1.;
  lap=1;
  kills=0;
  checkpoint=0;
  lapTime=0.;
  dead=0.;
  spawnTimer=2.;
  for(int i=0;i<10;i++)
    enemy[i].w=0.;
  for(int i=0;i<12;i++)
    orb[i].w=0.;
  for(int i=0;i<10;i++)
    shot[i].w=0.;
}
void hurtPlayer(float damage)
{
  light-=damage;
  hurt=1.;
  shake=1.;
  hurtEvents++;
}
void hitEnemy(int i,vec3 dir)
{
  enemy[i].w--;
  enemyInfo[i].y=1.;
  enemyVel[i].xyz+=dir*3.;
  hitEvents++;
  hitMark=1.;
  if(enemy[i].w<=0.)
    {
      enemy[i].w=-.3;
      killEvents++;
      kills++;
      shake=max(shake,.4);
      addSpark(enemy[i].xyz,4.);
      for(int k=0,n=0;k<12&&n<3;k++)
        if(orb[k].w<=0.)
          orb[k]=vec4(enemy[i].xyz,1),orbVel[k].xyz=normalize(vec3(rnd(),rnd(),rnd())-.5)*6.+vec3(0,3,0),n++;
    }
}
void update()
{
  time+=DT;
  if(started==0)
    newRun();
  shake=max(shake-DT*3.,0.);
  hurt=max(hurt-DT*2.,0.);
  kick=max(kick-DT*6.,0.);
  hitMark=max(hitMark-DT*5.,0.);
  lapFlash=max(lapFlash-DT,0.);
  for(int i=0;i<8;i++)
    spark[i].w=max(spark[i].w-DT*5.,0.);
  float fire=mod(iInput[0].z,2.);
  yaw=iInput[1].x+yawBase;
  pitch=iInput[1].y;
  vec3 fw=vec3(cos(yaw),0,sin(yaw)),rt=vec3(-fw.z,0,fw),look=vec3(fw.x*cos(pitch),sin(pitch),fw.z*cos(pitch)),eye=pos+vec3(0,1,0);
  if(dead>0.)
    {
      dead+=DT;
      vel=vec3(0);
      if(dead>2.&&fire>prevButtons||dead>10.)
        newRun();
    }
  else
    {
      lapTime+=DT;
      light-=DT*(.014+.005*float(lap));
      if(light<=0.)
        light=0.,dead=DT,hurtEvents++,record=max(record,lap-1);
      vec3 wish=fw*iInput[0].y+rt*iInput[0].x;
      float wl=length(wish);
      if(wl>0.)
        wish/=wl;
      if(grounded>0)
        {
          float s=length(vel.xz);
          if(s>0.)
            vel.xz*=max(s-max(s,3.)*6.*DT,0.)/s;
          accelerate(wish,10.*sign(wl),1e2);
          bob+=s*DT;
          if(step(2.,iInput[0].z)>0.)
            vel.y=7.,jumpEvents++;
        }
      else
         accelerate(wish,sign(wl),10.);
      vel.y-=20.*DT;
      pos+=vel*DT;
      grounded=0;
      for(int k=0;k<3;k++)
        {
          float d=level(pos);
          if(d>=.5)
            break;
          vec3 n=levelNormal(pos);
          pos+=n*(.5-d);
          vel-=n*min(dot(vel,n),0.);
          if(n.y>.7)
            grounded=1;
        }
      cooldown-=DT;
      if(fire>0.&&cooldown<=0.)
        {
          cooldown=.11;
          kick=1.;
          shotEvents++;
          float t=0.;
          for(int k=0;k<40&&t<80.;k++)
            {
              float d=level(eye+look*t);
              if(d<.05)
                break;
              t+=d;
            }
          vec3 muzzle=eye+look*.5+rt*.2-cross(rt,look)*.15;
          for(int k=0;k<12;k++)
            if(bolt[k].w<=0.)
              {
                bolt[k]=vec4(muzzle,1.2);
                boltVel[k].xyz=normalize(eye+look*max(t,2.)-muzzle)*70.;
                break;
              }
        }
      wl=trackPos(pos);
      int q=int(wl/trackLength()*4.);
      if(q==(checkpoint+1)%4)
        {
          checkpoint=q;
          if(q==0)
            lap++,lapEvents++,bestLap=bestLap>0.?
              min(bestLap,lapTime):
              lapTime,lapTime=0.,light=min(light+.25,1.),lapFlash=1.;
        }
      q=0;
      for(int i=0;i<10;i++)
        q+=int(enemy[i].w>0.);
      spawnTimer-=DT;
      if(q<min(2+2*lap,10)&&spawnTimer<=0.)
        {
          spawnTimer=max(2.5-.25*float(lap),.7);
          vec3 s=trackPoint(wl+(rnd()<.25?
            -10.-rnd()*8.:
            18.+rnd()*15.))+vec3(rnd()*4.-2.,1.8+rnd()*1.5,rnd()*4.-2.);
          int kind=int(rnd()<min(.1+.1*float(lap),.45));
          for(int i=0;i<10;i++)
            if(enemy[i].w==0.)
              {
                enemy[i]=vec4(s,float(3+2*kind+lap/2));
                enemyKind[i]=kind;
                enemyVel[i]=vec4(0);
                enemyInfo[i]=vec4(0,0,1.5,0);
                break;
              }
        }
    }
  for(int k=0;k<12;k++)
    {
      if(bolt[k].w<=0.)
        continue;
      bolt[k].w-=DT;
      vec3 p=bolt[k].xyz,v=boltVel[k].xyz,dir=normalize(v);
      float len=length(v)*DT;
      for(int i=0;i<10;i++)
        {
          if(enemy[i].w<=0.)
            continue;
          vec3 e=enemy[i].xyz-p;
          float h=clamp(dot(e,dir),0.,len);
          if(length(e-dir*h)<.9*enemyInfo[i].x+.1)
            {
              hitEnemy(i,dir);
              addSpark(p+dir*h,1.5);
              bolt[k].w=0.;
              break;
            }
        }
      float t=0.;
      for(int s=0;s<4&&t<len&&bolt[k].w>0.;s++)
        {
          float d=level(p+dir*t);
          if(d<.05)
            addSpark(p+dir*(t-.1),1.),bolt[k].w=0.;
          t+=d;
        }
      bolt[k].xyz+=v*DT;
    }
  for(int i=0;i<10;i++)
    {
      if(enemy[i].w<0.)
        enemy[i].w=min(enemy[i].w+DT,0.);
      if(enemy[i].w<=0.)
        continue;
      vec4 info=enemyInfo[i];
      info.x=min(info.x+DT,1.);
      info.yzw=max(info.yzw-vec3(6,1,1)*DT,0.);
      vec3 e=enemy[i].xyz,v=enemyVel[i].xyz,to=eye-vec3(0,.3,0)-e;
      float dist=length(to);
      to/=dist;
      vec3 side=normalize(cross(to,vec3(0,1,0)))*sin(time*2.5+float(i)*2.);
      float speed=4.5+.5*float(lap);
      if(enemyKind[i]>0)
        {
          v+=(to*clamp(dist-14.,-1.,1.)*speed+side*4.-v)*DT*1.5;
          if(info.z<=0.&&dist<30.&&dead==0.)
            {
              info.z=.4;
              float t=1.;
              for(int k=0;k<24&&t<dist;k++)
                t+=max(level(e+to*t),.2);
              if(t>=dist)
                for(int k=0;k<10;k++)
                  if(shot[k].w<=0.)
                    {
                      shot[k]=vec4(e+to,3);
                      spitEvents++;
                      shotVel[k].xyz=to*(12.+float(lap));
                      info.z=max(2.2-.2*float(lap),1.);
                      break;
                    }
            }
        }
      else if(enemyVel[i].w>0.)
        enemyVel[i].w-=DT;
      else
        {
          v+=(to*speed+side*4.-v)*DT*2.;
          if(dist<10.&&info.z<=0.&&dead==0.)
            v=to*(13.+float(lap)),enemyVel[i].w=.6,info.z=2.5;
        }
      v.y+=sin(time*2.+float(i))*DT*2.;
      for(int j=0;j<10;j++)
        {
          vec3 d=e-enemy[j].xyz;
          float l=length(d);
          if(j!=i&&enemy[j].w>0.&&l<3.&&l>0.)
            v+=d/l*(3.-l)*DT*8.;
        }
      speed=level(e);
      if(speed<1.2)
        {
          vec3 n=levelNormal(e);
          v+=n*(1.2-speed)*DT*30.;
          if(speed<.8)
            e+=n*(.8-speed),v-=n*min(dot(v,n),0.)*1.5;
        }
      e+=v*DT*info.x;
      side=pos+vec3(0,.5,0)-e;
      if(length(side)<1.6&&dead==0.&&info.x>=1.&&info.w<=0.)
        hurtPlayer(.12),vel+=normalize(side)*8.+vec3(0,3,0),v=-normalize(side)*8.,enemyVel[i].w=0.,info.zw=vec2(2,1.5);
      enemy[i].xyz=e;
      enemyVel[i].xyz=v;
      enemyInfo[i]=info;
      if(dist>70.||dead>0.)
        enemy[i].w=0.;
    }
  for(int k=0;k<10;k++)
    {
      if(shot[k].w<=0.)
        continue;
      shot[k].w-=DT;
      shot[k].xyz+=shotVel[k].xyz*DT;
      if(level(shot[k].xyz)<.1)
        shot[k].w=0.;
      if(length(pos+vec3(0,.5,0)-shot[k].xyz)<.9&&dead==0.)
        hurtPlayer(.08),vel+=shotVel[k].xyz*.3,shot[k].w=0.;
    }
  for(int k=0;k<12;k++)
    {
      if(orb[k].w<=0.)
        continue;
      vec3 to=pos+vec3(0,.6,0)-orb[k].xyz;
      float d=length(to);
      orbVel[k].xyz=orbVel[k].xyz*.985+to/d*40.*DT;
      orb[k].xyz+=orbVel[k].xyz*DT;
      if(d<.8&&dead==0.)
        orb[k].w=0.,light=min(light+.025,1.);
    }
}
void addLight(vec3 p,vec3 c)
{
  if(lightCount<32&&c.x>0.)
    lightPos[lightCount].xyz=p,lightCol[lightCount++].xyz=c;
}
void makeLights()
{
  vec3 eye=pos+vec3(0,1,0),f=vec3(cos(yaw)*cos(pitch),sin(pitch),sin(yaw)*cos(pitch)),r=normalize(cross(f,vec3(0,1,0))),u=cross(r,f);
  lightCount=0;
  addLight(eye+u*.4-f*.3,vec3(1,.75,.4)*(light*1.2+.05));
  addLight(eye+r*.2-u*.2+f*.55,vec3(1,.75,.4)*kick*kick*6.);
  for(int i=0;i<10;i++)
    addLight(shot[i].xyz,vec3(1,.05,.12)*3.*step(1e-4,shot[i].w));
  for(int i=0;i<10;i++)
    addLight(enemy[i].xyz+normalize(eye-enemy[i].xyz)*.9,enemy[i].w<0.?
      vec3(4)*-enemy[i].w:
      vec3(1,.05,.12)*1.5*enemyInfo[i].x*step(1e-4,enemy[i].w));
  for(int i=0;i<12;i++)
    addLight(bolt[i].xyz,vec3(1,.75,.4)*2.*step(1e-4,bolt[i].w));
  for(int i=0;i<8;i++)
    addLight(spark[i].xyz,vec3(1,.75,.4)*spark[i].w*2.);
  for(int i=0;i<12;i++)
    addLight(orb[i].xyz,vec3(1,.75,.4)*1.5*orb[i].w);
}
void main()
{
  for(int i=0;i<int(iInput[0].w);i++)
    update(),prevButtons=mod(iInput[0].z,2.);
  makeLights();
}


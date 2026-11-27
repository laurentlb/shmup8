// src\shaders\preprocessed.scene.frag
#version 430

layout(location=0)uniform vec4 iFrame;
layout(binding=0)uniform sampler2D tex;
layout(std430, binding = 0)buffer State{
  int shotEvents,hitEvents,killEvents,hurtEvents,jumpEvents,lapEvents;
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
  uint rng;
  float spawnTimer;
  vec4 bolt[12];
  vec4 boltVel[12];
  vec4 enemy[10];
  vec4 enemyVel[10];
  vec4 enemyInfo[10];
  vec4 spark[8];
  vec4 orb[12];
  vec4 orbVel[12];
  int lightCount;
  vec4 lightPos[24],lightCol[24];
};
const vec3 PTS[10]=vec3[](vec3(0),vec3(36,0,0),vec3(54,12,0),vec3(54,30,0),vec3(54,46,4),vec3(30,56,4),vec3(2,56,4),vec3(-14,46,4),vec3(-20,30,0),vec3(-20,14,0));
const vec4 ARENAS[2]=vec4[](vec4(54,12,15,12),vec4(-20,14,11,9));
int tSeg;
float tU,tLat,tFloor,tArena;
uint seen=~0u;
out vec4 fragColor;
vec3 eye,camF,camR,camU,gunAt,neonCol;
const vec3 NEON[10]=vec3[](vec3(.1,.6,1),vec3(.1,.6,1),vec3(1,.3,.05),vec3(1,.3,.05),vec3(1,.1,.5),vec3(1,.1,.5),vec3(1,.1,.5),vec3(.5,.2,1),vec3(.5,.2,1),vec3(.1,1,.6));
float gNeon,fogDensity;
vec3 glowSum,n,v,f0,glow;
float rough,metal;
vec2 pillar(vec3 p)
{
  vec2 c=p.xz-ARENAS[0].xy;
  float a=mod(atan(c.y,c.x)+3.14159/6.,3.14159/3.)-3.14159/6.;
  return length(c)*vec2(cos(a),sin(a))-vec2(8,0);
}
float level(vec3 p)
{
  float lat=1e9;
  for(int i=0;i<10;i++)
    {
      if((seen>>i&1u)==0u)
        continue;
      vec3 a=PTS[i],b=PTS[(i+1)%10];
      vec2 ab=b.xy-a.xy,ap=p.xz-a.xy;
      float l=length(ab),h=clamp(dot(ap,ab)/(l*l),0.,1.);
      ap-=ab*h;
      if(length(ap)<lat)
        lat=length(ap),tSeg=i,tU=h*l,tLat=(ab.x*ap.y-ab.y*ap.x)/l,tFloor=mix(a.z,b.z,h);
    }
  lat=max(lat-3.5,max(tFloor-p.y,p.y-tFloor-5.5)*.95);
  tArena=1e9;
  for(int i=0;i<2;i++)
    {
      vec4 A=ARENAS[i];
      tArena=min(tArena,max(length(p.xz-A.xy)-A.z,max(-p.y,p.y-A.w)));
    }
  lat=-min(lat,tArena);
  float u=mod(tU,5.)-2.5;
  lat=min(lat,max(max(abs(u)-.3,-tArena),min(3.2-abs(tLat),tFloor+5.5-.6-p.y)));
  vec2 c=p.xz-ARENAS[0].xy;
  u=abs(length(c)-8.)-1.;
  lat=min(lat,u>1.?
    u:
    length(pillar(p))-1.);
  c=p.xz-ARENAS[1].xy;
  u=abs(length(c)-6.)-1.2;
  float a=mod(atan(c.y,c.x)-.39+.7853975,1.570795)-.7853975;
  return min(lat,u>1.?
    u:
    length(length(c)*vec2(cos(a),sin(a))-vec2(6,0))-1.2);
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
float capsule(vec3 p,vec3 a,vec3 b)
{
  p-=a;
  a=b-a;
  return length(p-a*clamp(dot(p,a)/dot(a,a),0.,1.))-.07;
}
float neon(vec3 p)
{
  float y=p.y-tFloor,d=max(length(vec2(abs(tLat)-3.5+.12,min(abs(y-.3),abs(y-5.5+1.3))))-.05,-tArena);
  neonCol=NEON[tSeg];
  for(int i=0;i<2;i++)
    {
      vec4 A=ARENAS[i];
      float a=max(length(vec2(length(p.xz-A.xy)-A.z+.12,min(abs(p.y-.3),abs(p.y-A.w+2.))))-.05,3.8-abs(tLat));
      if(a<d)
        d=a,neonCol=i>0?
          vec3(.6,.1,1):
          vec3(1,.25,.05);
    }
  float a=abs(length(p.xz-ARENAS[0].xy)-8.)-1.1;
  if(a<1.)
    a=length(vec2(length(pillar(p))-1.03,p.y-2.5))-.04;
  if(a<d)
    d=a,neonCol=vec3(1,.25,.05);
  vec2 b=abs(vec2(tLat,y-2.75))-vec2(3.4,2.65);
  a=max(length(vec2(max(b.x,b.y),p.x-4.))-.06,length(p.xz-vec2(4,0))-6.);
  if(a<d)
    d=a,neonCol=vec3(1);
  return d;
}
float neonAt(vec3 p)
{
  level(p);
  return neon(p);
}
vec2 enemyShape(vec3 p,int i)
{
  vec3 e=enemy[i].xyz;
  float s=max(enemyInfo[i].x,.05);
  vec3 f=normalize(eye-e),r=normalize(cross(f,vec3(0,1,0)));
  p-=e;
  e=vec3(dot(p,r),dot(p,cross(r,f)),dot(p,f))/s;
  float t=time*3.+float(i)*1.7,body=length(e*vec3(1,1.15,.8))-.5;
  for(int k=0;k<5;k++)
    {
      float a=float(k)*1.257+sin(t*.3)*.3;
      vec3 tip=vec3(cos(a)*.7,sin(a)*.7,-1.3)+.2*vec3(sin(t+float(k)*2.),cos(t*1.3+float(k)),0);
      body=smin(body,capsule(e,vec3(cos(a),sin(a),0)*.25,tip),.2);
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
  gNeon=neon(p);
  if(gNeon<h.x)
    h=vec2(gNeon,1);
  for(int i=0;i<10;i++)
    {
      if((seen>>10+i&1u)==0u)
        continue;
      float d=length(p-enemy[i].xyz)-1.8;
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
  if(seen<1u<<31)
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
  seen=0u;
  for(int i=0;i<10;i++)
    {
      vec3 a=PTS[i],b=PTS[(i+1)%10];
      if(hitBox(ro,rd,vec3(min(a.x,b.x),min(a.z,b.z),min(a.y,b.y))-vec3(4.5,1,4.5),vec3(max(a.x,b.x),max(a.z,b.z),max(a.y,b.y))+vec3(4.5,6.5,4.5)))
        seen|=1u<<i;
    }
  for(int i=0;i<10;i++)
    if(enemy[i].w>0.&&hitSphere(ro,rd,enemy[i].xyz,2.))
      seen|=1u<<10+i;
  if(hitSphere(ro,rd,eye+mat3(camR,camU,camF)*(gunAt+vec3(0,0,.03)),.3))
    seen|=1u<<31;
}
float occlusion(vec3 p,vec3 n)
{
  float o=0.;
  for(int i=1;i<5;i++)
    {
      float d=float(i)*.15;
      o+=(d-map(p+n*d).x)/d;
    }
  return clamp(1.-o*.2,0.,1.);
}
vec3 material(vec3 p,float m)
{
  rough=.5;
  metal=0.;
  glow=vec3(0);
  if(m>=30.)
    return glow=vec3(1,.05,.12)*(4.+10.*enemyInfo[int(m-30.)].y),vec3(0);
  if(m>=10.)
    {
      int i=int(m-10.);
      vec3 q=p-enemy[i].xyz;
      float veins=abs(fbm(q.xy*6.+q.z*4.+time)-.5);
      glow=vec3(1,.05,.12)*smoothstep(.06,0.,veins)*1.5+vec3(3)*enemyInfo[i].y;
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
  m=tArena<.1?
    0.:
    tFloor;
  if(n.y>.7)
    {
      vec2 g=abs(fract(p.xz*.5)-.5);
      float wet=smoothstep(.5,.65,fbm(p.xz*.3)+.1*fbm(p.xz*3.));
      rough=mix(.5,.02,wet);
      return vec3(.04)*(.6+.6*fbm(p.xz*2.))*(1.-.5*step(.48,max(g.x,g.y)))*(1.-.6*wet);
    }
  if(n.y<-.7)
    return vec3(.015);
  rough=.35;
  metal=.3;
  return vec3(.05,.05,.06)*(.6+.6*fbm(vec2(p.x+p.z,p.y)*3.))*(1.-.5*step(.47,abs(fract((p.y-m)*.5)-.5)));
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
      float b=dot(o,rd),h=sqrt(max(dot(o,o)-b*b,0.)+.3);
      c+=color*(atan((tMax-b)/h)+atan(b/h))/h*(i<2?
        .1:
        1.);
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
      col+=weight*(mix(fogColor,c,fog)+glowSum*.05+scattered(ro,rd,h.x)*fogDensity*.15);
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
  ca=abs(uv);
  luma=max(step(ca.x+ca.y,.004),step(abs(max(ca.x,ca.y)-.03-hitMark*.01),.002)*step(min(ca.x,ca.y),.002));
  col=mix(col,mix(vec3(.9),vec3(1,.05,.12)*2.,hitMark),luma*.8);
  bloom=vec3(.5,.8,1);
  int cs=int(lapTime*1e2);
  digits7(col,bloom,uv*22.-vec2(-.5,19.5),22.,cs%100,2);
  digits7(col,bloom,uv*22.-vec2(-3.5,19.5),22.,cs/100,1);
  col+=bloom*smoothstep(.06,.02,length(uv*22.-vec2(-2.4,18.3)));
  if(bestLap>0.)
    digits7(col,bloom*.5,uv*40.-vec2(1.5,33),40.,int(bestLap*1e2),3);
  digits7(col,bloom,uv*22.-vec2(-34,19.5),22.,lap,1);
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
  int shotEvents,hitEvents,killEvents,hurtEvents,jumpEvents,lapEvents;
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
  uint rng;
  float spawnTimer;
  vec4 bolt[12];
  vec4 boltVel[12];
  vec4 enemy[10];
  vec4 enemyVel[10];
  vec4 enemyInfo[10];
  vec4 spark[8];
  vec4 orb[12];
  vec4 orbVel[12];
  int lightCount;
  vec4 lightPos[24],lightCol[24];
};
const vec3 PTS[10]=vec3[](vec3(0),vec3(36,0,0),vec3(54,12,0),vec3(54,30,0),vec3(54,46,4),vec3(30,56,4),vec3(2,56,4),vec3(-14,46,4),vec3(-20,30,0),vec3(-20,14,0));
const vec4 ARENAS[2]=vec4[](vec4(54,12,15,12),vec4(-20,14,11,9));
int tSeg;
float tU,tLat,tFloor,tArena;
uint seen=~0u;
const float DT=1./120.;
vec2 pillar(vec3 p)
{
  vec2 c=p.xz-ARENAS[0].xy;
  float a=mod(atan(c.y,c.x)+3.14159/6.,3.14159/3.)-3.14159/6.;
  return length(c)*vec2(cos(a),sin(a))-vec2(8,0);
}
float level(vec3 p)
{
  float lat=1e9;
  for(int i=0;i<10;i++)
    {
      if((seen>>i&1u)==0u)
        continue;
      vec3 a=PTS[i],b=PTS[(i+1)%10];
      vec2 ab=b.xy-a.xy,ap=p.xz-a.xy;
      float l=length(ab),h=clamp(dot(ap,ab)/(l*l),0.,1.);
      ap-=ab*h;
      if(length(ap)<lat)
        lat=length(ap),tSeg=i,tU=h*l,tLat=(ab.x*ap.y-ab.y*ap.x)/l,tFloor=mix(a.z,b.z,h);
    }
  lat=max(lat-3.5,max(tFloor-p.y,p.y-tFloor-5.5)*.95);
  tArena=1e9;
  for(int i=0;i<2;i++)
    {
      vec4 A=ARENAS[i];
      tArena=min(tArena,max(length(p.xz-A.xy)-A.z,max(-p.y,p.y-A.w)));
    }
  lat=-min(lat,tArena);
  float u=mod(tU,5.)-2.5;
  lat=min(lat,max(max(abs(u)-.3,-tArena),min(3.2-abs(tLat),tFloor+5.5-.6-p.y)));
  vec2 c=p.xz-ARENAS[0].xy;
  u=abs(length(c)-8.)-1.;
  lat=min(lat,u>1.?
    u:
    length(pillar(p))-1.);
  c=p.xz-ARENAS[1].xy;
  u=abs(length(c)-6.)-1.2;
  float a=mod(atan(c.y,c.x)-.39+.7853975,1.570795)-.7853975;
  return min(lat,u>1.?
    u:
    length(length(c)*vec2(cos(a),sin(a))-vec2(6,0))-1.2);
}
vec3 levelNormal(vec3 p)
{
  vec2 e=vec2(1,-1)*.01;
  return normalize(e.xyy*level(p+e.xyy)+e.yyx*level(p+e.yyx)+e.yxy*level(p+e.yxy)+e.xxx*level(p+e.xxx));
}
float trackLength()
{
  float s=0.;
  for(int i=0;i<10;i++)
    s+=length(PTS[(i+1)%10].xy-PTS[i].xy);
  return s;
}
float trackPos()
{
  float s=tU;
  for(int i=0;i<tSeg;i++)
    s+=length(PTS[i+1].xy-PTS[i].xy);
  return s;
}
vec3 trackPoint(float s)
{
  s=mod(s,trackLength());
  for(int i=0;i<10;i++)
    {
      vec3 a=PTS[i],b=PTS[(i+1)%10];
      float l=length(b.xy-a.xy);
      if(s<l)
        return a=mix(a,b,s/l),a.xzy;
      s-=l;
    }
  return vec3(0);
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
  pos=vec3(2,.51,0);
  vel=vec3(0);
  yawBase=-iInput[1].x;
  light=1.;
  lap=1;
  checkpoint=0;
  lapTime=0.;
  dead=0.;
  spawnTimer=2.;
  for(int i=0;i<10;i++)
    enemy[i].w=0.;
  for(int i=0;i<12;i++)
    orb[i].w=0.;
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
      enemy[i].w=0.;
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
  yaw=iInput[1].x+yawBase;
  pitch=iInput[1].y;
  vec3 fw=vec3(cos(yaw),0,sin(yaw)),rt=vec3(-fw.z,0,fw),look=vec3(fw.x*cos(pitch),sin(pitch),fw.z*cos(pitch)),eye=pos+vec3(0,1,0);
  if(dead>0.)
    {
      dead+=DT;
      vel=vec3(0);
      if(dead>3.)
        newRun();
    }
  else
    {
      lapTime+=DT;
      light-=DT*(.012+.004*float(lap));
      if(light<=0.)
        light=0.,dead=DT,hurtEvents++;
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
      if(mod(iInput[0].z,2.)>0.&&cooldown<=0.)
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
      level(pos);
      int q=int(trackPos()/trackLength()*4.);
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
          vec3 s=trackPoint(trackPos()+25.+rnd()*15.)+vec3(rnd()*4.-2.,1.8+rnd()*1.5,rnd()*4.-2.);
          for(int i=0;i<10;i++)
            if(enemy[i].w<=0.)
              {
                enemy[i]=vec4(s,2.+floor(float(lap)*.5));
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
          if(length(e-dir*h)<.7*enemyInfo[i].x+.1)
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
      if(enemy[i].w<=0.)
        continue;
      vec4 info=enemyInfo[i];
      info.x=min(info.x+DT,1.);
      info.yzw=max(info.yzw-vec3(6,1,1)*DT,0.);
      vec3 e=enemy[i].xyz,v=enemyVel[i].xyz,to=eye-vec3(0,.3,0)-e;
      float dist=length(to);
      to/=dist;
      if(enemyVel[i].w>0.)
        enemyVel[i].w-=DT;
      else
        {
          v+=(to*(4.+.5*float(lap))-v)*DT*2.;
          v.y+=sin(time*2.+float(i))*DT*2.;
          if(dist<9.&&info.z<=0.&&dead==0.)
            v=to*(12.+float(lap)),enemyVel[i].w=.6,info.z=2.5;
        }
      for(int j=0;j<10;j++)
        {
          vec3 d=e-enemy[j].xyz;
          float l=length(d);
          if(j!=i&&enemy[j].w>0.&&l<2.5&&l>0.)
            v+=d/l*(2.5-l)*DT*8.;
        }
      float dl=level(e);
      if(dl<1.)
        {
          vec3 n=levelNormal(e);
          v+=n*(1.-dl)*DT*30.;
          if(dl<.6)
            e+=n*(.6-dl),v-=n*min(dot(v,n),0.)*1.5;
        }
      e+=v*DT*info.x;
      to=pos+vec3(0,.5,0)-e;
      if(length(to)<1.3&&dead==0.&&info.x>=1.&&info.w<=0.)
        light-=.12,hurt=1.,shake=1.,hurtEvents++,vel+=normalize(to)*8.+vec3(0,3,0),v=-normalize(to)*8.,enemyVel[i].w=0.,info.zw=vec2(2,1.5);
      enemy[i].xyz=e;
      enemyVel[i].xyz=v;
      enemyInfo[i]=info;
      if(dist>70.||dead>0.)
        enemy[i].w=0.;
    }
  for(int k=0;k<12;k++)
    {
      if(orb[k].w<=0.)
        continue;
      vec3 to=pos+vec3(0,.6,0)-orb[k].xyz;
      float d=length(to);
      orbVel[k].xyz=orbVel[k].xyz*.985+to/d*40.*DT;
      orb[k].xyz+=orbVel[k].xyz*DT;
      if(d<.8)
        orb[k].w=0.,light=min(light+.04,1.);
    }
}
void addLight(vec3 p,vec3 c)
{
  if(lightCount<24&&c.x>0.)
    lightPos[lightCount].xyz=p,lightCol[lightCount++].xyz=c;
}
void makeLights()
{
  vec3 eye=pos+vec3(0,1,0),f=vec3(cos(yaw)*cos(pitch),sin(pitch),sin(yaw)*cos(pitch)),r=normalize(cross(f,vec3(0,1,0))),u=cross(r,f);
  lightCount=0;
  addLight(eye+u*.4-f*.3,vec3(1,.75,.4)*(light*2.+.05));
  addLight(eye+r*.2-u*.2+f*.55,vec3(1,.75,.4)*kick*kick*6.);
  for(int i=0;i<12;i++)
    addLight(bolt[i].xyz,vec3(1,.75,.4)*3.*step(1e-4,bolt[i].w));
  for(int i=0;i<8;i++)
    addLight(spark[i].xyz,vec3(1,.75,.4)*spark[i].w*2.);
  for(int i=0;i<12;i++)
    addLight(orb[i].xyz,vec3(1,.75,.4)*1.5*orb[i].w);
  for(int i=0;i<10;i++)
    addLight(enemy[i].xyz+normalize(eye-enemy[i].xyz)*.6,vec3(1,.05,.12)*.6*enemyInfo[i].x*step(1e-4,enemy[i].w));
}
void main()
{
  for(int i=0;i<int(iInput[0].w);i++)
    update();
  makeLights();
}


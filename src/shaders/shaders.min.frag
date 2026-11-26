// src\shaders\preprocessed.scene.frag
#version 430

layout(location=0)uniform vec4 iFrame;
layout(binding=0)uniform sampler2D tex;
layout(std430, binding = 0)buffer State{
  int bumperEvents,flipperEvents,drainEvents,slingEvents;
  vec2 ball[4],vel[4];
  vec2 flip,flipVel;
  vec2 cam;
  vec2 slingFlash;
  vec4 flash;
  vec4 prevInput;
  float time;
  float plunger;
  float shake;
  float gameOver;
  float ballSave;
  float hitStop;
  float drainFlash;
  int score,balls;
  int mult;
  int lanesLit;
  int steps;
  int ballCount;
  int pending;
  float launchDelay;
  int targetsLit;
  float alignTime;
  int jackpot;
  int jackpotLit;
  int ballAdded;
  int sets;
  int multiballs;
  float jackpotFlash;
  vec4 trail[32];
};
out vec4 fragColor;
vec2 planets[3];
float lampDist,lampOn;
vec3 lampColor;
float metal,rough;
vec3 glow,n,v,albedo,f0;
mat2 rot()
{
  float c=cos(.4),s=sin(.4);
  return mat2(c,s,-s,c);
}
float boxDist(vec2 p,vec2 size)
{
  p=abs(p)-size;
  return min(max(p.x,p.y),0.)+length(max(p,0.));
}
float segDist(vec2 p,vec2 a,vec2 b)
{
  p-=a;
  a=b-a;
  return length(p-a*clamp(dot(p,a)/dot(a,a),0.,1.));
}
float triDist(vec2 p,vec2 p0,vec2 p1,vec2 p2)
{
  vec2 e0=p1-p0,e1=p2-p1,e2=p0-p2,v0=p-p0,v1=p-p1;
  p2=p-p2;
  p1=v0-e0*clamp(dot(v0,e0)/dot(e0,e0),0.,1.);
  p0=v1-e1*clamp(dot(v1,e1)/dot(e1,e1),0.,1.);
  p=p2-e2*clamp(dot(p2,e2)/dot(e2,e2),0.,1.);
  float s=sign(e0.x*e2.y-e0.y*e2.x);
  e0=min(min(vec2(dot(p1,p1),s*(v0.x*e0.y-v0.y*e0.x)),vec2(dot(p0,p0),s*(v1.x*e1.y-v1.y*e1.x))),vec2(dot(p,p),s*(p2.x*e2.y-p2.y*e2.x)));
  return-sqrt(e0.x)*sign(e0.y);
}
vec2 mirror(vec2 p)
{
  return vec2(-.019-abs(p.x+.019),p.y);
}
float areaDist(vec2 p)
{
  return min(boxDist(p-vec2(0,-.155),vec2(.26,.445)),length(p-vec2(0,.29))-.26);
}
float flipperDist(vec2 p,int i)
{
  if(i>0)
    p.x=-.038-p.x;
  p-=vec2(-.104,-.43);
  vec2 dir=vec2(cos(flip[i]),sin(flip[i]));
  float h=clamp(dot(p,dir)/.075,0.,1.);
  return length(p-dir*h*.075)-mix(.011,.005,h);
}
float planetRadius(int i)
{
  return i==0?
    .015:
    i==1?
      .02:
      .008;
}
float alignment()
{
  return alignTime>0.?
    smoothstep(0.,.8,alignTime)*smoothstep(4.,3.,alignTime):
    0.;
}
vec2 orbit(float a)
{
  a+=alignment()*(mod(-1.570795-a+3.14159,6.28318)-3.14159);
  return vec2(cos(a),sin(a));
}
vec2 planetPos(int i,float t)
{
  if(i==0)
    return vec2(-.019,.13)+.075*orbit(t*.9);
  vec2 p=vec2(-.019,.13)+.14*orbit(t*.35+2.);
  if(i>1)
    p+=.036*orbit(t*2.2);
  return p;
}
int targetIndex(vec2 p)
{
  return int(clamp(floor((p.x+.019)/.09+2.),0.,3.));
}
vec2 hit(vec2 h,float d,float m)
{
  return d<h.x?
    vec2(d,m):
    h;
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
void digits7(inout vec3 o,vec3 c,vec2 q,float scale,uint value,int digits)
{
  float d=1e9;
  for(int i=0;i<digits;i++)
    {
      d=min(d,digit7(q,int(value%10u)));
      value/=10u;
      q.x+=1.25;
      if(value==0u)
        break;
    }
  o+=c*(clamp(.5-iFrame.x/scale*d*.5,0.,1.)+.3*exp(-30.*max(d,0.)));
}
float extrude(float d,float z,float height,float r)
{
  vec2 w=vec2(d+r,abs(z-height*.5)-height*.5+r);
  return min(max(w.x,w.y),0.)+length(max(w,0.))-r;
}
float seg3(vec3 p,vec3 a,vec3 b)
{
  p-=a;
  a=b-a;
  return length(p-a*clamp(dot(p,a)/dot(a,a),0.,1.));
}
float planetHeight(int i)
{
  return.034+planetRadius(i)*1.3;
}
vec2 map(vec3 p)
{
  vec2 q=mirror(p.xy);
  float area=areaDist(p.xy);
  vec2 h=hit(hit(hit(vec2(p.z,0),extrude(min(max(-area,area-.03),segDist(p.xy,vec2(.224,-.6),vec2(.224,.2))-.004),p.z,.05,.004),1.),extrude(boxDist(p.xy-vec2(-.019,-.56),vec2(.245,.07)),p.z,.022,.006),12.),extrude(min(segDist(q,vec2(-.219,-.2),vec2(-.219,-.33)),segDist(q,vec2(-.219,-.33),vec2(-.114,-.415)))-.006,p.z,.026,.005),2.);
  area=triDist(q,vec2(-.174,-.2),vec2(-.174,-.305),vec2(-.119,-.345))-.005;
  h=hit(hit(hit(h,min(extrude(area,p.z,.024,.004),extrude(area-.003,p.z-.025,.005,.002)),3.),extrude(min(triDist(q,vec2(-.262,.08),vec2(-.212,-.03),vec2(-.262,-.06)),min(segDist(q,vec2(-.109,.4),vec2(-.109,.44)),segDist(q,vec2(-.049,.4),vec2(-.049,.44))))-.005,p.z,.032,.003),13.),extrude(segDist(p.xy,vec2(.222,.2),vec2(.262,.235))-.002,p.z-.01,.025,.001),11.);
  for(int i=0;i<2;i++)
    h=hit(h,extrude(flipperDist(p.xy,i),p.z-.002,.022,.005),4.+float(i));
  vec3 s=p-vec3(vec2(-.019,.13),0);
  h=hit(h,min(extrude(length(s.xy)-.03,p.z,.03,.004),length(s-vec3(0,0,.068))-.036*(1.+.15*flash.x)),6.);
  area=1e9;
  for(int i=0;i<3;i++)
    {
      float r=planetRadius(i),z=planetHeight(i);
      vec3 d=p-vec3(planets[i],0);
      float body=min(extrude(length(d.xy)-r*.8,p.z,.034,.003),length(d-vec3(0,0,z))-r*1.3*(1.+.25*flash[i+1]));
      if(i==1)
        d.z-=z,d.xz*=rot(),body=min(body,length(vec2(length(d.xy)-r*2.2,d.z))-.0015);
      h=hit(h,body,7.+float(i));
      d=i>1?
        vec3(planets[1],planetHeight(1)):
        vec3(vec2(-.019,.13),.068);
      area=min(area,seg3(p,d,vec3(planets[i],z)));
    }
  h=hit(hit(hit(h,area-.0022,11.),seg3(p,vec3(.244,-.502-plunger*.04,.0135),vec3(.244,-.7,.0135))-.008,11.),extrude(min(length(q-vec2(-.154,-.12)),length(q-vec2(-.064,-.15)))-.009,p.z,.03,.003),14.);
  for(int b=0;b<ballCount;b++)
    h=hit(h,length(p-vec3(ball[b],.0135))-.0135,10.);
  return h;
}
vec3 normal(vec3 p)
{
  vec2 e=vec2(1,-1)*1e-4;
  return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);
}
vec2 march(vec3 ro,vec3 rd)
{
  float t=ro.z>.11?
    (ro.z-.11)/max(-rd.z,.001):
    0.;
  for(int i=0;i<150;i++)
    {
      vec3 p=ro+rd*t;
      vec2 h=map(p);
      if(h.x<1e-4*(1.+t*4.))
        return vec2(t,h.y);
      if(p.z>.12&&rd.z>0.||t>4.)
        break;
      t+=h.x;
    }
  return vec2(9);
}
float shadow(vec3 p,vec3 l)
{
  float s=1.,t=.003;
  for(int i=0;i<40&&t<.3;i++)
    {
      float d=map(p+l*t).x;
      s=min(s,16.*d/t);
      if(s<.01)
        break;
      t+=clamp(d,.002,.03);
    }
  return clamp(s,0.,1.);
}
float occlusion(vec3 p,vec3 n)
{
  float o=0.;
  for(int i=1;i<6;i++)
    {
      float d=float(i)*.006;
      o+=(d-map(p+n*d).x)/d;
    }
  return clamp(1.-o*.25,0.,1.);
}
float hash(vec2 p)
{
  return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);
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
float stars(vec2 p,float density)
{
  float h=hash(floor(p*density));
  return step(.8,h)*smoothstep(.12,0.,length(fract(p*density)-.25-.5*vec2(h,fract(h*17.))))*(.6+.4*sin(time*3.+h*60.));
}
void lamp(vec2 q,float r,float on,vec3 color)
{
  if(length(q)<r)
    lampDist=length(q)/r,lampOn=on,lampColor=color;
}
vec3 material(vec3 p,float m)
{
  float wear=fbm(p.xy*3e2+p.z*2e2);
  vec3 brass=vec3(.85,.6,.3)*(.75+.35*wear),rubber=vec3(.02,.018,.017)*(.8+.4*wear);
  metal=0.;
  glow=vec3(0);
  rough=.15+.2*wear;
  lampDist=1.;
  if(m==0.)
    {
      if(areaDist(p.xy)>0.)
        return rough=1.,glow=vec3(.8,.85,1)*stars(p.xy,40.)*2.+vec3(.02,.005,.04)*fbm(p.xy*4.)*2.,vec3(0);
      vec2 s=p.xy-vec2(-.019,.13);
      float r=length(s),a=atan(s.y,s.x),plank=floor(p.x/.065),x=p.x+.004*sin(p.y*25.+plank*3.)+.002*fbm(p.xy*60.);
      vec3 c=vec3(.17,.06,.02)*(.85+.15*(sin(x*7e2+fbm(vec2(x*90.,p.y*6.))*8.)*.5+sin(x*23e2)*.25))*(.8+.4*hash(vec2(plank)))*(.85+.3*fbm(p.xy*vec2(20,4)))*(1.-.6*smoothstep(.0305,.0322,abs(fract(p.x/.065)-.5)*.065));
      rough=.05+.15*smoothstep(.4,.8,fbm(p.xy*25.));
      plank=r-.195-.006*clamp(sin(a*24.)*4.,-1.,1.);
      if(plank<0.)
        {
          float cloud=fbm(p.xy*30.);
          c=mix(vec3(.004,.008,.035),vec3(.05,.015,.07),cloud*cloud*1.5)*(1.-r*2.);
          glow=vec3(.9,.9,1)*stars(p.xy,90.)*.6;
        }
      if(min(min(abs(r-.075),abs(r-.14))-.0012,abs(plank)-.002)<0.)
        return metal=.5,rough=.3,brass;
      for(int i=0;i<4;i++)
        {
          if(i<3)
            lamp(p.xy-vec2(-.019+.06*float(i-1),.37),.009,float(lanesLit>>i&1),vec3(1,.5,.1));
          lamp(p.xy-vec2(-.064+.03*float(i),-.27),.007,float(mult>=i+2),vec3(.2,.6,1));
        }
      vec2 q=mirror(p.xy);
      q-=q.x<-.109?
        vec2(-.154,-.16):
        vec2(-.064,-.19);
      lamp(q,.016*(.6+.4*cos(5.*atan(q.x,q.y))),float(targetsLit>>targetIndex(p.xy)&1)+.5*flash.x,vec3(1,.8,.3));
      lamp(p.xy-vec2(-.019,-.37),.01,float(ballSave>0.&&fract(time*(ballSave<2.?
        4.:
        1.5))<.6),vec3(1,.15,.1));
      a=floor(a*1.91+.5);
      lamp(s-.052*vec2(cos(a/1.91),sin(a/1.91)),.006,step(fract((a-time*4.)/12.),.3)*.5+flash.x*2.,vec3(1,.45,.1));
      if(lampDist<1.)
        return rough=.05,glow=lampColor*lampOn*(4.-2.5*lampDist*lampDist)*(.8+.4*noise(p.xy*3e3)),lampColor*.08;
      r=alignTime*.35-r;
      glow+=vec3(1,.7,.3)*(exp(-r*r*3e3)*max(1.-alignTime*.5,0.)*3.+alignment()*exp(-pow(p.x+.019,2.)*3e3)*step(p.y,.13)*1.5);
      return c;
    }
  if(m==1.)
    {
      if(p.z>.045)
        return metal=1.,brass;
      rough=.3;
      return vec3(.09,.035,.012)*(.7+.6*fbm(vec2(p.x+p.y,p.z)*vec2(40,300)));
    }
  if(m==12.)
    return rough=.35,mix(vec3(.03,.025,.05),brass*.5,smoothstep(.75,.9,wear));
  if(m==2.||m==11.)
    return metal=1.,rough*=.6,m==11.?
      brass:
      vec3(.7,.7,.72)*(.85+.2*wear);
  if(m==3.)
    {
      if(p.z>.024)
        return glow=vec3(1,.25,.08)*slingFlash[p.x>-.019?
          1:
          0]*3.,rough=.05,vec3(.12,.012,.01);
      rough=.5;
      return rubber;
    }
  if(m==13.||m==4.||m==5.)
    {
      if(p.z>.004&&p.z<.02)
        return rough=.5,rubber;
      metal=1.;
      return brass;
    }
  if(m==6.)
    {
      metal=1.;
      if(p.z>.035)
        glow=mix(vec3(1,.5,.15),vec3(.6,.8,1.2)*(1.5+sin(time*12.)),float(ballCount+pending>1&&jackpotLit>0))*(1.5+flash.x*8.)*(.8+.4*fbm(p.xy*4e2+time));
      return brass;
    }
  if(m==14.)
    return glow=vec3(1,.75,.25)*float(targetsLit>>targetIndex(p.xy)&1)*(2.+sin(time*8.)),rough=.1,vec3(.35,.25,.05);
  if(m>=7.&&m<10.)
    {
      int i=int(m-7.);
      if(p.z<.034)
        return rough=.5,rubber;
      if(i==1&&abs(length(p.xy-planets[1])-.044)<.004)
        return metal=1.,brass;
      vec3 c=(i==0?
        vec3(.7,.2,.06):
        i==1?
          vec3(.08,.25,.7):
          vec3(.6))*(.6+.6*fbm(vec2(p.z*6e2,p.x*60.)));
      glow=c*flash[i+1]*4.;
      rough=.1;
      return c;
    }
  metal=1.;
  rough=.01+.03*wear;
  return vec3(.95);
}
vec3 light(vec3 l,vec3 color)
{
  float nl=max(dot(n,l),0.);
  l=normalize(l+v);
  float k=2./max(rough*rough,.002);
  k=(k+8.)/25.*pow(max(dot(n,l),0.),k);
  return color*nl*(albedo+f0*k);
}
vec3 trailGlow(vec3 ro,vec3 rd,float tMax)
{
  vec3 col=vec3(0);
  for(int i=0;i<31;i++)
    {
      vec3 a=vec3(trail[i].xy,.0135),b=vec3(trail[i+1].xy,.0135);
      float t=dot(a-ro,rd),age=float(i)/float(32),w=.0135*(.9-.7*age),d=seg3(ro+rd*t,a,b);
      if(t<tMax&&length(a-b)<.05)
        col+=mix(vec3(.6,.8,1),vec3(1,.3,.05),age)*smoothstep(.4,2.,trail[i].z)*(1.-age)*exp(-d*d/(w*w))*.6;
    }
  return col;
}
vec3 render(vec3 ro,vec3 rd)
{
  const vec3 key=normalize(vec3(-.3,-.45,1)),fill=normalize(vec3(.7,.6,.5));
  vec3 col=vec3(0),weight=vec3(1),ro0=ro,rd0=rd;
  float tHit=9.;
  for(int bounce=0;bounce<2;bounce++)
    {
      vec2 h=march(ro,rd);
      if(bounce==0)
        tHit=h.x;
      if(h.x>8.)
        {
          col+=weight*(vec3(.05,.05,.09)*(.4+.6*max(rd.z,0.))+vec3(1,.85,.65)*4.*smoothstep(.75,.92,rd.z)*smoothstep(.3,.15,abs(rd.x))+vec3(.3,.5,1)*1.5*smoothstep(.85,.95,-rd.y)*smoothstep(.3,.1,abs(rd.z-.3)));
          break;
        }
      vec3 p=ro+rd*h.x;
      n=normal(p);
      v=-rd;
      albedo=material(p,h.y);
      f0=mix(vec3(h.y==0.?
        .07:
        .04),albedo,metal);
      albedo*=1.-metal;
      float shade=bounce==0?
        shadow(p+n*.001,key):
        1.,ao=bounce==0?
        occlusion(p,n):
        1.;
      vec3 toSun=vec3(vec2(-.019,.13),.068)-p;
      float sunPower=(.5+flash.x*3.)*.0012/dot(toSun,toSun);
      toSun=light(key,vec3(1,.85,.7)*1.5*shade)+light(fill,vec3(.3,.45,1)*.5*ao)+light(normalize(toSun),vec3(1,.5,.15)*sunPower)+albedo*mix(vec3(.12,.06,.03),vec3(.08,.1,.2),n.z*.5+.5)*ao;
      for(int i=0;i<4;i++)
        {
          vec3 l=vec3(-.019+(i%2>0?
            .215:
            -.215),i>1?
            .2:
            -.15,.04)-p;
          toSun+=light(normalize(l),vec3(1,.6,.3)*5e-4/dot(l,l))*ao;
        }
      col+=weight*(toSun+glow);
      sunPower=pow(1.-max(dot(n,v),0.),5.);
      weight*=(f0+(1.-f0)*sunPower)*(1.-rough)*ao;
      if(max(weight.x,max(weight.y,weight.z))<.02)
        break;
      ro=p+n*.002;
      h=gl_FragCoord.xy;
      rd=normalize(reflect(rd,n)+rough*.5*(vec3(hash(h),hash(h+1.),hash(h+2.))-.5));
    }
  return col+trailGlow(ro0,rd0,tHit);
}
void main()
{
  vec2 texCoord=gl_FragCoord.xy/iFrame.xy,uv=(gl_FragCoord.xy*2.-iFrame.xy)/iFrame.x;
  if(iFrame.w<.5)
    {
      for(int i=0;i<3;i++)
        planets[i]=planetPos(i,time);
      vec3 ta=vec3(cam,0),ro=ta+vec3(0,-cos(.88),sin(.88))*1.3+shake*shake*.006*vec3(sin(time*71.),sin(time*83.),sin(time*61.)),fw=normalize(ta-ro);
      ta=normalize(cross(fw,vec3(0,0,1)));
      fragColor=vec4(clamp(render(ro,normalize(uv.x*ta+uv.y*cross(ta,fw)+1.9*fw)),0.,50.),1);
      return;
    }
  vec2 ca=(texCoord-.5)*.0015;
  vec3 col=vec3(texture(tex,texCoord+ca).x,texture(tex,texCoord).y,texture(tex,texCoord-ca).z),bloom=vec3(0);
  for(int i=2;i<8;i++)
    bloom+=max(textureLod(tex,texCoord,float(i)).xyz-.6,0.);
  col+=bloom*.25+max(textureLod(tex,1.-texCoord,6.).xyz-.6,0.)*.1;
  col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14);
  float luma=dot(col,vec3(.3,.6,.1));
  col=pow(clamp(mix(vec3(luma),col,1.15)+vec3(-.01,0,.02)*(1.-luma),0.,1.),vec3(1./2.2))*max(1.-pow(length(texCoord-.5),1.5)*1.2,0.)+(hash(gl_FragCoord.xy+fract(time)*1e2)-.5)*.02+jackpotFlash*vec3(.35,.3,.25);
  col=mix(col,col.x*vec3(.9,.1,.05),drainFlash*.8);
  bloom=vec3(1,.45,.1)*(1.+2.*max(max(flash.x,flash.y),max(flash.z,flash.w)));
  if(balls>0)
    digits7(col,bloom,uv*18.-vec2(16.5,8),18.,uint(score),7),digits7(col,bloom*.6,uv*18.-vec2(-16.5,8),18.,uint(balls),1);
  else
     digits7(col,bloom,uv*6.-vec2(1.8,0),6.,uint(score),7);
  fragColor=vec4(col,1);
}

// src\shaders\preprocessed.game.comp
#version 430

layout(local_size_x=1)in;
layout(location=0)uniform vec4 iInput;
layout(std430, binding = 0)buffer State{
  int bumperEvents,flipperEvents,drainEvents,slingEvents;
  vec2 ball[4],vel[4];
  vec2 flip,flipVel;
  vec2 cam;
  vec2 slingFlash;
  vec4 flash;
  vec4 prevInput;
  float time;
  float plunger;
  float shake;
  float gameOver;
  float ballSave;
  float hitStop;
  float drainFlash;
  int score,balls;
  int mult;
  int lanesLit;
  int steps;
  int ballCount;
  int pending;
  float launchDelay;
  int targetsLit;
  float alignTime;
  int jackpot;
  int jackpotLit;
  int ballAdded;
  int sets;
  int multiballs;
  float jackpotFlash;
  vec4 trail[32];
};
const float DT=1./120.;
float boxDist(vec2 p,vec2 size)
{
  p=abs(p)-size;
  return min(max(p.x,p.y),0.)+length(max(p,0.));
}
float segDist(vec2 p,vec2 a,vec2 b)
{
  p-=a;
  a=b-a;
  return length(p-a*clamp(dot(p,a)/dot(a,a),0.,1.));
}
float triDist(vec2 p,vec2 p0,vec2 p1,vec2 p2)
{
  vec2 e0=p1-p0,e1=p2-p1,e2=p0-p2,v0=p-p0,v1=p-p1;
  p2=p-p2;
  p1=v0-e0*clamp(dot(v0,e0)/dot(e0,e0),0.,1.);
  p0=v1-e1*clamp(dot(v1,e1)/dot(e1,e1),0.,1.);
  p=p2-e2*clamp(dot(p2,e2)/dot(e2,e2),0.,1.);
  float s=sign(e0.x*e2.y-e0.y*e2.x);
  e0=min(min(vec2(dot(p1,p1),s*(v0.x*e0.y-v0.y*e0.x)),vec2(dot(p0,p0),s*(v1.x*e1.y-v1.y*e1.x))),vec2(dot(p,p),s*(p2.x*e2.y-p2.y*e2.x)));
  return-sqrt(e0.x)*sign(e0.y);
}
vec2 flipPivot(int i)
{
  return vec2(-.019+(i>0?
    .085:
    -.085),-.43);
}
float flipperDist(vec2 p,int i)
{
  if(i>0)
    p.x=-.038-p.x;
  p-=flipPivot(0);
  vec2 dir=vec2(cos(flip[i]),sin(flip[i]));
  float h=clamp(dot(p,dir)/.075,0.,1.);
  return length(p-dir*h*.075)-mix(.011,.005,h);
}
vec2 orbit(float a)
{
  a+=(alignTime>0.?
    smoothstep(0.,.8,alignTime)*smoothstep(4.,3.,alignTime):
    0.)*(mod(-1.570795-a+3.14159,6.28318)-3.14159);
  return vec2(cos(a),sin(a));
}
vec2 planetPos(int i,float t)
{
  if(i==0)
    return vec2(-.019,.13)+.075*orbit(t*.9);
  vec2 p=vec2(-.019,.13)+.14*orbit(t*.35+2.);
  if(i>1)
    p+=.036*orbit(t*2.2);
  return p;
}
vec2 hit(vec2 h,float d,float m)
{
  return d<h.x?
    vec2(d,m):
    h;
}
vec2 field(vec2 p,bool down)
{
  vec2 q=vec2(-.019-abs(p.x+.019),p.y),h=vec2(-min(boxDist(p-vec2(0,-.155),vec2(.26,.445)),length(p-vec2(0,.29))-.26),1);
  h=hit(hit(hit(hit(hit(h,min(segDist(p,vec2(.224,-.6),vec2(.224,.2))-.004,boxDist(p-vec2(.244,-.55),vec2(.02,.05))),1.),min(segDist(q,vec2(-.219,-.2),vec2(-.219,-.33)),segDist(q,vec2(-.219,-.33),vec2(-.114,-.415)))-.006,2.),triDist(q,vec2(-.174,-.2),vec2(-.174,-.305),vec2(-.119,-.345))-.005,3.),min(triDist(q,vec2(-.262,.08),vec2(-.212,-.03),vec2(-.262,-.06)),min(segDist(q,vec2(-.109,.4),vec2(-.109,.44)),segDist(q,vec2(-.049,.4),vec2(-.049,.44))))-.005,13.),min(length(q-vec2(-.154,-.12)),length(q-vec2(-.064,-.15)))-.009,14.);
  if(down)
    h=hit(h,segDist(p,vec2(.222,.2),vec2(.262,.235))-.002,1.);
  for(int i=0;i<2;i++)
    h=hit(h,flipperDist(p,i),4.+float(i));
  h=hit(h,length(p-vec2(-.019,.13))-.03,6.);
  for(int i=0;i<3;i++)
    h=hit(h,length(p-planetPos(i,time))-(i==0?
      .015:
      i==1?
        .02:
        .008),7.+float(i));
  return h;
}
bool multiball()
{
  return ballCount+pending>1;
}
vec2 surfaceVelocity(vec2 p,float m)
{
  if(m>=7.&&m<10.)
    {
      int i=int(m-7.);
      return(planetPos(i,time+.01)-planetPos(i,time-.01))*50.;
    }
  if(m>=4.&&m<6.)
    {
      int i=int(m-4.);
      vec2 r=p-flipPivot(i);
      return flipVel[i]*(i>0?
        -1.:
        1.)*vec2(-r.y,r);
    }
  return vec2(0);
}
void bumper(int b,int i,vec2 n,int points)
{
  if(flash[i]<.8)
    {
      vel[b]+=n*.55;
      flash[i]=1.;
      score+=points*mult;
      bumperEvents++;
      shake=max(shake,.4);
      if(i==0)
        {
          hitStop=.05;
          if(multiball()&&jackpotLit>0)
            jackpotLit=0,score+=jackpot*mult,jackpot+=2500,jackpotFlash=1.,hitStop=.2,shake=1.,slingEvents++;
        }
    }
}
void addBalls(int n)
{
  pending=min(pending+n,3-ballCount);
}
void target(vec2 p)
{
  int k=int(clamp(floor((p.x+.019)/.09+2.),0.,3.));
  if(multiball())
    jackpotLit=1;
  if((targetsLit&1<<k)!=0)
    {
      score+=50*mult;
      return;
    }
  targetsLit|=1<<k;
  score+=250*mult;
  slingEvents++;
  if(targetsLit==15)
    {
      targetsLit=0;
      shake=1.;
      flash=vec4(1);
      bumperEvents++;
      if(multiball())
        {
          if(ballAdded==0)
            addBalls(1),ballAdded=1;
          else
             score+=25000*mult;
          hitStop=.2;
          return;
        }
      if(++sets<=multiballs)
        {
          score+=2000*mult;
          hitStop=.15;
          return;
        }
      sets=0;
      multiballs++;
      score+=5000*mult;
      addBalls(2);
      ballSave=max(ballSave,12.);
      alignTime=.001;
      if(jackpot==0)
        jackpot=5000;
      jackpotLit=1;
      launchDelay=1.5;
      hitStop=.4;
    }
}
void collide(int b)
{
  vec2 p=ball[b],h=field(p,vel[b].y<0.);
  if(h.x>=.0135)
    return;
  float m=h.y;
  vec2 e=vec2(1e-4,0),n=normalize(vec2(field(p+e,vel[b].y<0.).x-field(p-e,vel[b].y<0.).x,field(p+e.yx,vel[b].y<0.).x-field(p-e.yx,vel[b].y<0.).x));
  e=surfaceVelocity(p-n*h.x,m);
  ball[b]+=n*(.0135-h.x);
  h=vel[b]-e;
  float vn=dot(h,n);
  if(vn>=0.)
    return;
  vel[b]=e+h-(1.+(m==2.||m==3.||m==13.?
    .7:
    m==4.||m==5.?
      .45:
      .5))*vn*n;
  if(m==6.)
    bumper(b,0,n,100);
  if(m>=7.&&m<10.)
    bumper(b,int(m-7.)+1,n,m>8.5?
      500:
      50);
  if(m==14.&&vn<-.2)
    target(p);
  if(m==3.)
    {
      int side=p.x>-.019?
        1:
        0;
      if((side>0?
        -n.x:
        n.x)>.5&&slingFlash[side]<.5)
        vel[b]+=n*.75,slingFlash[side]=1.,score+=10*mult,slingEvents++,shake=max(shake,.3);
    }
}
void collideBalls()
{
  for(int i=0;i<ballCount;i++)
    for(int j=i+1;j<ballCount;j++)
      {
        vec2 d=ball[j]-ball[i];
        float l=length(d);
        if(l>.027||l<1e-6)
          continue;
        d/=l;
        ball[i]-=d*(.0135-l*.5);
        ball[j]+=d*(.0135-l*.5);
        l=dot(vel[j]-vel[i],d);
        if(l<0.)
          vel[i]+=d*l*.95,vel[j]-=d*l*.95;
      }
}
bool inLane(vec2 p)
{
  return p.x>.226&&p.y<-.3;
}
void serve()
{
  ball[0]=vec2(.244,-.4865);
  vel[0]=vec2(0);
  ballCount=1;
  ballSave=8.;
}
void lanes(vec2 p)
{
  int k=int(floor((p.x+.019+.09)/.06));
  if(p.y>.4&&p.y<.44&&k>=0&&k<3&&(lanesLit&1<<k)==0)
    lanesLit|=1<<k,score+=100*mult,slingEvents++;
  if(lanesLit==7)
    lanesLit=0,mult=min(mult+1,5),score+=1000*mult,flash=vec4(1),bumperEvents++,shake=1.,hitStop=.15;
}
void update()
{
  drainFlash=max(drainFlash-DT*2.,0.);
  jackpotFlash=max(jackpotFlash-DT*2.,0.);
  if(hitStop>0.)
    {
      hitStop-=DT;
      return;
    }
  time+=DT;
  if(alignTime>0.)
    alignTime=alignTime>4.?
      0.:
      alignTime+DT;
  if((++steps&1)==0)
    {
      for(int i=31;i>0;i--)
        trail[i]=trail[i-1];
      trail[0]=vec4(ball[0],length(vel[0]),0);
    }
  flash=max(flash-DT*4.,0.);
  slingFlash=max(slingFlash-DT*4.,0.);
  shake=max(shake-DT*3.,0.);
  if(balls<=0)
    {
      ballCount=0;
      pending=0;
      gameOver-=DT;
      if(gameOver<=0.)
        score=0,balls=3,mult=1,lanesLit=0,targetsLit=0,jackpot=0,sets=0,multiballs=0,serve();
    }
  launchDelay-=DT;
  bool laneFree=true;
  for(int b=0;b<ballCount;b++)
    laneFree=laneFree&&!inLane(ball[b]);
  if(pending>0&&launchDelay<=0.&&laneFree)
    ball[ballCount]=vec2(.244,-.45),vel[ballCount++]=vec2(0,2.8),pending--,launchDelay=.8,flipperEvents++;
  vec2 up=iInput.xy;
  for(int i=0;i<2;i++)
    if(up[i]>prevInput[i])
      flipperEvents++,lanesLit=(i>0?
        lanesLit<<1|lanesLit>>2:
        lanesLit>>1|lanesLit<<2)&7;
  const float h=DT/float(8);
  for(int s=0;s<8;s++)
    {
      for(int i=0;i<2;i++)
        {
          float speed=up[i]>0.?
            25.:
            12.;
          speed=clamp((up[i]>0.?
            .45:
            -.55)-flip[i],-speed*h,speed*h);
          flipVel[i]=speed/h;
          flip[i]+=speed;
        }
      for(int b=0;b<ballCount;b++)
        vel[b].y-=1.1*h,ball[b]+=vel[b]*h,collide(b);
      collideBalls();
    }
  laneFree=false;
  float lowest=1.;
  up=ball[0];
  for(int b=0;b<ballCount;b++)
    {
      lanes(ball[b]);
      laneFree=laneFree||ball[b].x<.22;
      vel[b]*=1.-.1*DT;
      float speed=length(vel[b]);
      if(speed>3.2)
        vel[b]*=3.2/speed;
      if(ball[b].y<lowest)
        lowest=ball[b].y,up=ball[b];
    }
  if(laneFree)
    ballSave=max(ballSave-DT,0.);
  if(iInput.z>0.)
    plunger=min(plunger+DT*1.2,1.);
  else if(plunger>0.)
    {
      for(int b=0;b<ballCount;b++)
        if(ball[b].x>.226&&ball[b].y<-.45)
          vel[b].y=plunger*2.6+.4;
      plunger=0.;
    }
  if(iInput.z<0.&&prevInput.z>=0.&&shake<.5)
    {
      for(int b=0;b<ballCount;b++)
        vel[b]+=vec2(0,.25);
      shake=1.;
    }
  prevInput.xyz=iInput.xyz;
  for(int b=ballCount-1;b>=0;b--)
    if(ball[b].y<-.53)
      {
        drainEvents++;
        shake=1.;
        ball[b]=ball[--ballCount];
        vel[b]=vel[ballCount];
        if(ballSave>0.&&multiball())
          addBalls(1);
      }
  if(!multiball())
    ballAdded=0;
  if(balls>0&&ballCount+pending==0)
    {
      drainFlash=1.;
      if(ballSave>0.)
        serve(),ballSave=0.,flash=vec4(1);
      else
        {
          mult=1;
          jackpot=0;
          if(--balls>0)
            serve();
          else
             gameOver=3.;
        }
    }
  up=vec2(-.019+(up.x+.019)*.15,clamp(up.y,-.5,.5)*.06+-.1);
  cam+=(up-cam)*DT*3.;
}
void main()
{
  for(int i=0;i<int(iInput.w);i++)
    update();
}


// src\shaders\preprocessed.scene.frag
#version 430

layout(location=0)uniform vec4 iFrame;
layout(binding=0)uniform sampler2D tex;
layout(std430, binding = 0)buffer State{
  int bumperEvents,flipperEvents,drainEvents,slingEvents;
  vec2 ball,vel;
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
};
out vec4 fragColor;
vec2 planets[3];
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
vec2 planetPos(int i,float t)
{
  if(i==0)
    return vec2(-.019,.13)+.075*vec2(cos(t*.9),sin(t*.9));
  vec2 p=vec2(-.019,.13)+.14*vec2(cos(t*.35+2.),sin(t*.35+2.));
  if(i>1)
    p+=.036*vec2(cos(t*2.2),sin(t*2.2));
  return p;
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
float extrude(float d,float z,float height)
{
  vec2 w=vec2(d,abs(z-height*.5)-height*.5);
  return min(max(w.x,w.y),0.)+length(max(w,0.));
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
  q=hit(hit(hit(hit(hit(hit(vec2(p.z,0),extrude(min(max(-area,area-.03),segDist(p.xy,vec2(.224,-.6),vec2(.224,.2))-.004),p.z,.05),1.),extrude(boxDist(p.xy-vec2(-.019,-.56),vec2(.245,.07)),p.z,.022),12.),extrude(min(segDist(q,vec2(-.219,-.2),vec2(-.219,-.33)),segDist(q,vec2(-.219,-.33),vec2(-.114,-.415)))-.006,p.z,.03),2.),extrude(triDist(q,vec2(-.174,-.2),vec2(-.174,-.305),vec2(-.119,-.345))-.005,p.z,.032),3.),extrude(min(triDist(q,vec2(-.262,.08),vec2(-.212,-.03),vec2(-.262,-.06)),min(segDist(q,vec2(-.109,.4),vec2(-.109,.44)),segDist(q,vec2(-.049,.4),vec2(-.049,.44))))-.005,p.z,.032),13.),extrude(segDist(p.xy,vec2(.222,.2),vec2(.262,.235))-.002,p.z-.01,.025),11.);
  for(int i=0;i<2;i++)
    q=hit(q,extrude(flipperDist(p.xy,i),p.z-.002,.024),4.+float(i));
  vec3 s=p-vec3(vec2(-.019,.13),0);
  q=hit(q,min(extrude(length(s.xy)-.03,p.z,.03),length(s-vec3(0,0,.068))-.036*(1.+.15*flash.x)),6.);
  area=1e9;
  for(int i=0;i<3;i++)
    {
      float r=planetRadius(i),z=planetHeight(i);
      vec3 d=p-vec3(planets[i],0);
      float body=min(extrude(length(d.xy)-r*.8,p.z,.034),length(d-vec3(0,0,z))-r*1.3*(1.+.25*flash[i+1]));
      if(i==1)
        d.z-=z,d.xz*=rot(),body=min(body,length(vec2(length(d.xy)-r*2.2,d.z))-.0015);
      q=hit(q,body,7.+float(i));
      d=i>1?
        vec3(planets[1],planetHeight(1)):
        vec3(vec2(-.019,.13),.068);
      area=min(area,seg3(p,d,vec3(planets[i],z)));
    }
  return hit(hit(hit(q,area-.0022,11.),seg3(p,vec3(.244,-.502-plunger*.04,.0135),vec3(.244,-.7,.0135))-.008,11.),length(p-vec3(ball,.0135))-.0135,10.);
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
vec3 material(vec3 p,float m,out float metal,out vec3 glow,out float gloss)
{
  const vec3 brass=vec3(.85,.6,.28);
  metal=0.;
  glow=vec3(0);
  gloss=.5;
  if(m==0.)
    {
      if(areaDist(p.xy)>0.)
        return vec3(.03,.02,.012);
      vec2 s=p.xy-vec2(-.019,.13);
      float r=length(s),a=atan(s.y,s.x),x=p.x+.004*sin(p.y*25.+floor(p.x/.065)*3.),k=floor(a/(3.14159/6.)+.5);
      if(min(min(abs(r-.075),abs(r-.14))-.0012,abs(r-.195-.006*clamp(sin(a*24.)*4.,-1.,1.))-.0018)<0.)
        return metal=1.,brass;
      vec3 insert;
      r=-1.;
      for(int i=0;i<4;i++)
        {
          if(i<3&&length(p.xy-vec2(-.019+.06*float(i-1),.37))<.009)
            r=float(lanesLit>>i&1),insert=vec3(1,.5,.1);
          if(length(p.xy-vec2(-.064+.03*float(i),-.1))<.007)
            r=float(mult>=i+2),insert=vec3(.2,.6,1);
        }
      if(length(p.xy-vec2(-.019,-.37))<.01)
        r=float(ballSave>0.&&fract(time*(ballSave<2.?
          4.:
          1.5))<.6),insert=vec3(1,.15,.1);
      if(r>=0.)
        return glow=insert*r*3.,insert*.06;
      if(length(s-.052*vec2(cos(k*3.14159/6.),sin(k*3.14159/6.)))-.006<0.)
        {
          float lit=step(fract((k-time*4.)/12.),.3);
          glow=vec3(1,.45,.1)*(lit*1.5+flash.x*6.);
          return vec3(.4,.3,.2);
        }
      gloss=.35;
      return vec3(.2,.08,.03)*(.85+.15*(sin(x*7e2+sin(p.y*9.+x*90.)*3.)*.5+sin(x*23e2)*.25))*(1.-.6*smoothstep(.0305,.0322,abs(fract(p.x/.065)-.5)*.065));
    }
  if(m==1.)
    return p.z>.0495?
      metal=1.,brass:
      vec3(.08,.035,.015);
  if(m==12.)
    return gloss=.3,vec3(.04,.03,.025);
  if(m==2.||m==11.)
    return metal=1.,m==11.?
      brass:
      vec3(.8);
  if(m==3.||m==13.)
    {
      if(m==3.)
        glow=vec3(1,.7,.4)*slingFlash[p.x>-.019?
          1:
          0]*3.;
      return p.z<.026?
        vec3(.5,.04,.02):
        vec3(.75,.7,.6);
    }
  if(m==4.||m==5.)
    return p.z<.016?
      vec3(.5,.04,.02):
      vec3(.8,.75,.65);
  if(m==6.)
    {
      metal=1.;
      if(p.z>.035)
        glow=vec3(1,.5,.15)*(1.+flash.x*8.);
      return brass;
    }
  if(m>=7.&&m<10.)
    {
      int i=int(m-7.);
      if(p.z<.034)
        return vec3(.04,.02,.01);
      if(i==1&&abs(length(p.xy-planets[1])-.044)<.004)
        return metal=1.,brass;
      vec3 c=i==0?
        vec3(.7,.2,.08):
        i==1?
          vec3(.1,.25,.6):
          vec3(.7);
      glow=c*flash[i+1]*3.;
      return c;
    }
  metal=1.;
  return vec3(.9);
}
vec3 render(vec3 ro,vec3 rd)
{
  const vec3 L=normalize(vec3(-.25,-.35,1));
  vec3 col=vec3(0),weight=vec3(1);
  for(int bounce=0;bounce<2;bounce++)
    {
      vec2 h=march(ro,rd);
      if(h.x>8.)
        {
          col+=weight*(vec3(.25,.2,.16)*(.3+.7*max(rd.z,0.))+vec3(1,.85,.65)*3.*smoothstep(.7,.9,rd.z)*smoothstep(.25,.15,abs(rd.x)));
          break;
        }
      vec3 p=ro+rd*h.x,n=normal(p);
      float metal,gloss;
      vec3 glow,albedo=material(p,h.y,metal,glow,gloss);
      float diffuse=max(dot(n,L),0.);
      if(bounce==0&&diffuse>0.)
        diffuse*=shadow(p+n*.001,L);
      float ao=bounce==0?
        occlusion(p,n):
        1.;
      vec3 toSun=vec3(vec2(-.019,.13),.068)-p;
      float sunLight=max(dot(n,normalize(toSun)),0.)*(.4+flash.x*3.)*.0015/dot(toSun,toSun);
      toSun=vec3(1,.92,.8)*1.3*diffuse+vec3(.3,.35,.5)*.25*ao*(.6+.4*n.z)+vec3(1,.5,.15)*sunLight;
      col+=weight*(albedo*(1.-metal)*toSun+glow);
      sunLight=.04+.96*pow(1.-max(dot(n,-rd),0.),5.);
      weight*=mix(vec3(sunLight*gloss),albedo*ao,metal);
      if(max(weight.x,max(weight.y,weight.z))<.02)
        break;
      ro=p+n*.002;
      rd=reflect(rd,n);
    }
  return col;
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
  vec3 col=texture(tex,texCoord).xyz,bloom=vec3(0);
  for(int i=2;i<8;i++)
    bloom+=textureLod(tex,texCoord,float(i)).xyz;
  col+=bloom*bloom*.02;
  col=pow(clamp(col*(2.51*col+.03)/(col*(2.43*col+.59)+.14),0.,1.),vec3(1./2.2))*(1.-.3*dot(uv,uv));
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
  vec2 ball,vel;
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
vec2 planetPos(int i,float t)
{
  if(i==0)
    return vec2(-.019,.13)+.075*vec2(cos(t*.9),sin(t*.9));
  vec2 p=vec2(-.019,.13)+.14*vec2(cos(t*.35+2.),sin(t*.35+2.));
  if(i>1)
    p+=.036*vec2(cos(t*2.2),sin(t*2.2));
  return p;
}
vec2 hit(vec2 h,float d,float m)
{
  return d<h.x?
    vec2(d,m):
    h;
}
vec2 field(vec2 p)
{
  vec2 q=vec2(-.019-abs(p.x+.019),p.y),h=vec2(-min(boxDist(p-vec2(0,-.155),vec2(.26,.445)),length(p-vec2(0,.29))-.26),1);
  h=hit(hit(hit(hit(h,min(segDist(p,vec2(.224,-.6),vec2(.224,.2))-.004,boxDist(p-vec2(.244,-.55),vec2(.02,.05))),1.),min(segDist(q,vec2(-.219,-.2),vec2(-.219,-.33)),segDist(q,vec2(-.219,-.33),vec2(-.114,-.415)))-.006,2.),triDist(q,vec2(-.174,-.2),vec2(-.174,-.305),vec2(-.119,-.345))-.005,3.),min(triDist(q,vec2(-.262,.08),vec2(-.212,-.03),vec2(-.262,-.06)),min(segDist(q,vec2(-.109,.4),vec2(-.109,.44)),segDist(q,vec2(-.049,.4),vec2(-.049,.44))))-.005,13.);
  if(vel.y<0.)
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
vec2 fieldNormal(vec2 p)
{
  vec2 e=vec2(1e-4,0);
  return normalize(vec2(field(p+e).x-field(p-e).x,field(p+e.yx).x-field(p-e.yx).x));
}
vec2 surfaceVelocity(vec2 p,float m)
{
  if(m>=7.)
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
void bumper(int i,vec2 n,int points)
{
  if(flash[i]<.8)
    {
      if(i==0)
        hitStop=.05;
      vel+=n*.55;
      flash[i]=1.;
      score+=points*mult;
      bumperEvents++;
      shake=max(shake,.4);
    }
}
void collide()
{
  vec2 h=field(ball);
  if(h.x>=.0135)
    return;
  float m=h.y;
  vec2 n=fieldNormal(ball),vs=surfaceVelocity(ball-n*h.x,m);
  ball+=n*(.0135-h.x);
  h=vel-vs;
  float vn=dot(h,n);
  if(vn>=0.)
    return;
  vel=vs+h-(1.+(m==2.||m==3.||m==13.?
    .7:
    m==4.||m==5.?
      .45:
      .5))*vn*n;
  if(m==6.)
    bumper(0,n,100);
  if(m>=7.)
    bumper(int(m-7.)+1,n,m>8.5?
      500:
      50);
  if(m==3.)
    {
      int side=ball.x>-.019?
        1:
        0;
      if((side>0?
        -n.x:
        n.x)>.5&&slingFlash[side]<.5)
        vel+=n*.75,slingFlash[side]=1.,score+=10*mult,slingEvents++,shake=max(shake,.3);
    }
}
void serve()
{
  ball=vec2(.244,-.4865);
  vel=vec2(0);
  ballSave=8.;
}
void lanes()
{
  int k=int(floor((ball.x+.019+.09)/.06));
  if(ball.y>.4&&ball.y<.44&&k>=0&&k<3&&(lanesLit&1<<k)==0)
    lanesLit|=1<<k,score+=100*mult,slingEvents++;
  if(lanesLit==7)
    lanesLit=0,mult=min(mult+1,5),score+=1000*mult,flash=vec4(1),bumperEvents++,shake=1.,hitStop=.15;
}
void update()
{
  drainFlash=max(drainFlash-DT*2.,0.);
  if(hitStop>0.)
    {
      hitStop-=DT;
      return;
    }
  time+=DT;
  flash=max(flash-DT*4.,0.);
  slingFlash=max(slingFlash-DT*4.,0.);
  shake=max(shake-DT*3.,0.);
  if(balls<=0)
    {
      ball=vec2(0,-2);
      gameOver-=DT;
      if(gameOver<=0.)
        score=0,balls=3,mult=1,lanesLit=0,serve();
    }
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
      if(balls>0)
        vel.y-=1.1*h,ball+=vel*h,collide();
    }
  lanes();
  if(ball.x<.22)
    ballSave=max(ballSave-DT,0.);
  vel*=1.-.1*DT;
  float speed=length(vel);
  if(speed>3.2)
    vel*=3.2/speed;
  if(iInput.z>0.)
    plunger=min(plunger+DT*1.2,1.);
  else if(plunger>0.)
    {
      if(ball.x>.226&&ball.y<-.45)
        vel.y=plunger*2.6+.4;
      plunger=0.;
    }
  if(iInput.z<0.&&prevInput.z>=0.&&shake<.5)
    vel+=vec2(0,.25),shake=1.;
  prevInput.xyz=iInput.xyz;
  if(balls>0&&ball.y<-.53)
    {
      drainEvents++;
      shake=1.;
      drainFlash=1.;
      if(ballSave>0.)
        serve(),ballSave=0.,flash=vec4(1);
      else
        {
          mult=1;
          if(--balls>0)
            serve();
          else
             gameOver=3.;
        }
    }
  up=vec2(-.019+(ball.x+.019)*.15,clamp(ball.y,-.5,.5)*.06+-.1);
  cam+=(up-cam)*DT*3.;
}
void main()
{
  for(int i=0;i<int(iInput.w);i++)
    update();
}


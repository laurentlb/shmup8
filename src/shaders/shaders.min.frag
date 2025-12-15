#version 430

layout(location=0)uniform float state[200];
layout(location=200)uniform float missiles[200];
layout(location=400)uniform float enemies[200];
layout(location=600)uniform float explosions[200];
layout(location=1000)uniform sampler2D tex;
out vec4 fragColor;
const float TIME=state[8];
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
vec3 explosion_2d(vec2 uv,float progress,vec3 backgroundcolor)
{
  float d=length(uv),radius=pow(sin(progress*3.14159),.15)*.15,alpha=smoothstep(0.,radius*.5,d)*smoothstep(radius,radius-.05,d-noise(vec3(uv*6.,TIME*.5))*(.1*(1.-progress)))*pow(1.-progress,2.);
  return alpha<.001?
    backgroundcolor:
    mix(backgroundcolor,mix(vec3(1,.9,.7),vec3(1,.3,0),d/radius)*(1.+progress*.5),alpha);
}
float metaDiamond(vec2 p,vec2 pixel,float r)
{
  p=abs(p-pixel);
  return r/(p.x+p.y);
}
vec3 background(vec2 uv)
{
  vec3 starColor=vec3(0);
  vec2 uvstars=uv*3.+vec2(0,TIME*.1),grid=floor(uvstars);
  for(int y=-1;y<=1;y++)
    for(int x=-1;x<=1;x++)
      {
        vec2 cell=grid+vec2(x,y);
        starColor+=vec3(1,.95,.8)*metaDiamond(uvstars,cell+vec2(hash21(cell),hash21(cell.yx))-.5,hash21(cell*1.5)*.01);
      }
  return mix(pow(fbm(uv*5.+vec2(0,TIME))*palette(.5),vec3(1.+state[0]*.5)),fbm(uv*2.+vec2(10))*palette(0.),.5)+.2*starColor;
}
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
void main()
{
  vec2 iResolution=vec2(1280,720),texCoord=gl_FragCoord.xy/iResolution.xy,uv=(texCoord*2.-1.)*vec2(1,iResolution.y/iResolution.x);
  fragColor.xyz=vec3(.5);
  vec2 pos=vec2(state[1],state[2]);
  fragColor.xyz=background(uv);
  fragColor/=1.+pow(length(uv),4.)*.6;
  int nExplo=int(explosions[0]);
  for(int i=0;i<nExplo;i++)
    {
      vec2 pos2=vec2(explosions[3*i+1],explosions[3*i+2]);
      float progress=1.-explosions[3*i+3];
      fragColor.xyz=explosion_2d(uv-pos2,progress,fragColor.xyz);
    }
  {
    float size=.05+smoothstep(0.,1.,state[4])*.1;
    fragColor.xyz=vec3(mix(fragColor.xyz,vec3(1)-state[4]*vec3(0,1,1),1.-pow(smoothstep(size,size+.01,length(uv-pos))*pow(length(uv-pos),.15),.5)));
  }
  nExplo=int(enemies[0]);
  for(int i=0;i<nExplo;i++)
    {
      vec2 pos2=vec2(enemies[4*i+3],enemies[4*i+4]),uvrot=rot(-TIME*4.)*(uv-pos2);
      float kind=enemies[4*i+1],mask=smoothstep(0.,.01,kind<.5?
        boxDist(uvrot):
        kind<1.5?
          triangleDist(rot(TIME*4.+float(i))*(uv-pos2))-.02:
          max(-length(uvrot)+.03,triangleDist(rot(TIME*4.+float(i))*(uv-pos2))-.03));
      fragColor.xyz=mix(fragColor.xyz,vec3(sin(kind),1,.2),1.-mask);
    }
  nExplo=int(missiles[0]);
  for(int i=0;i<nExplo;i++)
    {
      vec2 pos2=vec2(missiles[1+2*i],missiles[1+2*i+1]);
      fragColor.xyz=mix(fragColor.xyz,vec3(1,1,.8),1.-smoothstep(.01,.02,length(uv-pos2)));
    }
  texCoord+=(vec2(hash21(uv+vec2(1)),hash21(uv+vec2(2)))*2.-1.)*.005;
  fragColor.xyz=mix(fragColor.xyz,texture(tex,texCoord).xyz,clamp(hash21(uv)*1.2,.5,1.));
  fragColor.xyz*=mix(1.2,1.,smoothstep(0.,2.,TIME));
  if(TIME<0.)
    digits7(fragColor,vec4(1,0,0,1),uv*5.-vec2(2,0),iResolution,uint(state[5]),4);
  else
     digits7(fragColor,vec4(1,0,0,1),uv*20.-vec2(18,8.5),iResolution,uint(state[5]),4),digits7(fragColor,vec4(0,.5,0,1),uv*20.-vec2(-19,8.5),iResolution,uint(state[6]),1);
}


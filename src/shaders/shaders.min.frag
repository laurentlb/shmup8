#version 430

layout(location=0)uniform float state[200];
layout(location=200)uniform float missiles[200];
layout(location=400)uniform float enemies[200];
layout(location=1000)uniform sampler2D tex;
out vec4 fragColor;
const float TIME=state[0];
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
  return noise(p.xyx)*.5+.5;
}
void main()
{
  vec2 iResolution=vec2(1280,720),texCoord=gl_FragCoord.xy/iResolution.xy,uv=(texCoord*2.-1.)*vec2(1,iResolution.y/iResolution.x);
  fragColor.xyz=vec3(.5);
  fragColor.xyz=mix(pow(fbm(uv*2.+vec2(0,state[0]))*palette(.5),vec3(1.+state[0]*.5)),fbm(uv*1.4+vec2(10))*palette(0.),.5);
  fragColor/=1.+pow(length(uv),4.)*.6;
  {
    float size=.05+smoothstep(0.,1.,state[4])*.1;
    fragColor.xyz=vec3(mix(fragColor.xyz,vec3(1)-state[4]*vec3(0,1,1),1.-smoothstep(size,size+.01,length(uv-vec2(state[1],state[2])))));
  }
  int n=int(enemies[0]);
  for(int i=0;i<n;i++)
    {
      vec2 pos2=vec2(enemies[4*i+3],enemies[4*i+4]);
      fragColor.xyz=mix(fragColor.xyz,vec3(0,1,0),1.-smoothstep(.03,.04,length(uv-pos2)));
    }
  n=int(missiles[0]);
  for(int i=0;i<n;i++)
    {
      vec2 pos2=vec2(missiles[1+2*i],missiles[1+2*i+1]);
      fragColor.xyz=mix(fragColor.xyz,vec3(1,.1,.1),1.-smoothstep(.01,.02,length(uv-pos2)));
    }
  texCoord+=(vec2(hash21(uv+vec2(1)),hash21(uv+vec2(2)))*2.-1.)*.005;
  fragColor.xyz=mix(fragColor.xyz,texture(tex,texCoord).xyz,clamp(hash21(uv)*1.2,.5,1.));
  float fade=state[7];
  fragColor.xyz=mix(fragColor.xyz,vec3(0),smoothstep(0.,.5,fade)*smoothstep(1.,.5,fade));
  digits7(fragColor,vec4(1,0,0,1),uv*20.-vec2(18,8.5),iResolution,uint(state[5]),4);
  digits7(fragColor,vec4(0,.5,0,1),uv*20.-vec2(-19,8.5),iResolution,uint(state[6]),1);
}


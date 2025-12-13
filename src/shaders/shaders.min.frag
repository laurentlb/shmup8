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
  vec2 iResolution=vec2(1280,720),texCoord=gl_FragCoord.xy/iResolution.xy;
  iResolution=(texCoord*2.-1.)*vec2(1,iResolution.y/iResolution.x);
  fragColor.xyz=vec3(.5);
  fragColor/=1.+pow(length(iResolution),4.)*.6;
  fragColor.xyz=mix(pow(fbm(iResolution*2.+vec2(0,state[0]))*palette(.5),vec3(1.+state[0]*.5)),fbm(iResolution*1.4+vec2(10))*palette(0.),.5);
  fragColor.xyz=mix(fragColor.xyz,vec3(0,1,1),1.-smoothstep(.05,.06,length(iResolution-vec2(state[1],state[2]))));
  int n=int(enemies[0]);
  for(int i=0;i<n;i++)
    {
      vec2 pos2=vec2(enemies[4*i+3],enemies[4*i+4]);
      fragColor.xyz=mix(fragColor.xyz,vec3(0,1,0),1.-smoothstep(.03,.04,length(iResolution-pos2)));
    }
  n=int(missiles[0]);
  for(int i=0;i<n;i++)
    {
      vec2 pos2=vec2(missiles[1+2*i],missiles[1+2*i+1]);
      fragColor.xyz=mix(fragColor.xyz,vec3(1,.1,.1),1.-smoothstep(.01,.02,length(iResolution-pos2)));
    }
  texCoord+=(vec2(hash21(iResolution+vec2(1)),hash21(iResolution+vec2(2)))*2.-1.)*.005;
  fragColor.xyz=mix(fragColor.xyz,texture(tex,texCoord).xyz,clamp(hash21(iResolution+10.1*vec2(state[0]))*1.2,.5,1.));
}


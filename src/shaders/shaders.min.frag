#version 150

out vec4 fragColor;
void main()
{
  vec2 iResolution=vec2(1920,1080),texCoord=gl_FragCoord.xy/iResolution.xy;
  iResolution=(texCoord*2.-1.)*vec2(1,iResolution.y/iResolution.x);
  fragColor.xyz=vec3(.5);
  fragColor/=1.+pow(length(iResolution),4.)*.6;
  texCoord=vec2(ARR[0],ARR[1])*.1;
  fragColor*=smoothstep(.05,.26,length(iResolution-texCoord));
  int n=int(ARR[2]);
  for(int i=0;i<n;i++)
    {
      vec2 pos2=vec2(ARR[3+2*i],ARR[4+2*i])*.5;
      fragColor*=smoothstep(.05,.26,length(iResolution-pos2));
    }
  n=int(ARR[8]);
  for(int i=0;i<n;i++)
    {
      vec2 pos2=vec2(ARR[9+2*i],ARR[9+2*i+1])*.1;
      fragColor.x*=smoothstep(.05,.06,length(iResolution-pos2));
    }
}


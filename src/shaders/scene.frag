#version 150

const float INF = 1e6;
#include "shared.h"

out vec4 fragColor;
uniform float ARR[200];

#define TIME ARR[0]
uniform sampler2D tex;

#include "common.frag"

// https://iquilezles.org/articles/palettes/
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d)
{
    return a + b*cos(6.28318*(c*t+d));
}

vec3 palette(float t) {
  return pal(t, vec3(0.2),vec3(0.2),vec3(0.2),vec3(0.2,0.20,0.90));
  // return pal(t, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.10,0.20));
}

float fbm(vec2 p) {
    return noise(p.xyx) * 0.5 + 0.5;
}

float fbm1d(float v_p)
{
      float pvpx = 2.0*v_p;
      vec2 V1 = vec2(0.5*floor(pvpx      ));
      vec2 V2 = vec2(0.5*floor(pvpx + 1.0));
      return mix(hash21(V1),hash21(V2),smoothstep(0.0,1.0,fract(pvpx)));
}

vec3 background(vec2 uv) {
    vec3 col = vec3(0);
    
    vec2 p = uv*5.;
    vec2 b;
    float cloud1 = fbm(uv*2. + vec2(0., ARR[3]*1.));
    vec3 c1 = cloud1 * palette(0.5);
    float cloud2 = fbm(uv*1.4 + vec2(10));
    vec3 c2 = cloud2 * palette(0.0);
    vec3 cloudCol = mix(c1, c2, 0.5);
    return cloudCol;
}

void main()
{
    vec2 iResolution = vec2(XRES, YRES);
    vec2 texCoord = gl_FragCoord.xy/iResolution.xy;
    vec2 uv = (texCoord * 2. - 1.) * vec2(1., iResolution.y / iResolution.x);

    fragColor.rgb = vec3(0.5);

    fragColor /= 1.+pow(length(uv),4.)*0.6;

    // fragColor += ARR[0] * 0.1;

    vec2 pos = vec2(ARR[0], ARR[1]);
    fragColor.rgb = background(uv);

    {
        float mask = smoothstep(0.05, 0.06, length(uv - pos));
        fragColor.rgb = mix(fragColor.rgb, vec3(0,1,1), 1.0 - mask);
    }

    int n = int(ARR[2]);
    for (int i = 0; i < n; i++) {
        vec2 pos2 = vec2(ARR[3 + 2*i], ARR[4 + 2*i]) * 0.5;
        float mask = smoothstep(0.03, 0.04, length(uv - pos2));
        fragColor.rgb = mix(fragColor.rgb, vec3(0,1,0), 1.0 - mask);
    }


   /*
   {
        int i = 6; // int(ARR[8]) - 1;
        vec2 pos2 = vec2(ARR[9 + 2*i], ARR[9 + 2*i + 1]) * 0.2;
        fragColor.r *= smoothstep(0.05, 0.06, length(uv - pos2));
   }
    vec2 pos2 = vec2(ARR[8], ARR[9]) * 0.1;
    fragColor.b *= smoothstep(0.05, 0.06, length(uv - pos2));
    */

    int nMis = int(ARR[8]);
    for (int i = 0; i < nMis; i++) {
        vec2 pos2 = vec2(ARR[9 + 2*i], ARR[9 + 2*i + 1]);
        float mask = smoothstep(0.02,  0.03, length(uv - pos2));
        fragColor.rgb = mix(fragColor.rgb, vec3(1,0,0), 1.0 - mask);
    }
    // fragColor.b = 0.5;

    float coef = hash21(uv + vec2(ARR[3])) * 0.8;
    texCoord += (vec2(hash21(uv+vec2(1)), hash21(uv+vec2(2))) * 2. - 1.)*0.001;
    fragColor.rgb = mix(fragColor.rgb, texture(tex, texCoord).rgb, coef);
}

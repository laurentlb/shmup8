#version 430

layout (location = 0) uniform float state[200];
layout (location = 200) uniform float missiles[200];
layout (location = 400) uniform float enemies[200];
layout (location = 1000) uniform sampler2D tex;

// #version 150

const float INF = 1e6;
#include "shared.h"

out vec4 fragColor;


const float TIME = state[0];

#include "common.frag"

// https://iquilezles.org/articles/palettes/
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d)
{
    return a + b*cos(6.28318*(c*t+d));
}

vec3 palette(float t) {
  return pal(t, vec3(0.2),vec3(0.2),vec3(0.2),vec3(0.2,0.20,0.90));
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
    float cloud1 = fbm(uv*2. + vec2(0., state[0]*1.));
    vec3 c1 = cloud1 * palette(0.5);
    c1 = pow(c1, vec3(1. + state[0]*0.5));
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

    vec2 pos = vec2(state[1], state[2]);
    fragColor.rgb = background(uv);

    {
        float mask = smoothstep(0.05, 0.06, length(uv - pos));
        fragColor.rgb = mix(fragColor.rgb, vec3(0,1,1), 1.0 - mask);
    }


    int n = int(enemies[0]);
    for (int i = 0; i < n; i++) {
        vec2 pos2 = vec2(enemies[4*i+3], enemies[4*i+4]);
        float mask = smoothstep(0.03, 0.04, length(uv - pos2));
        fragColor.rgb = mix(fragColor.rgb, vec3(0,1,0), 1.0 - mask);
    }

    int nMis = int(missiles[0]);
    for (int i = 0; i < nMis; i++) {
        vec2 pos2 = vec2(missiles[1 + 2*i], missiles[1 + 2*i + 1]);
        float mask = smoothstep(0.01,  0.02, length(uv - pos2));
        fragColor.rgb = mix(fragColor.rgb, vec3(1,0.1,0.1), 1.0 - mask);
   }  
     
    float coef = hash21(uv + 10.1*vec2(state[0])) * 1.2;
    coef = clamp(coef, 0.5, 1.);
    texCoord += (vec2(hash21(uv+vec2(1)), hash21(uv+vec2(2))) * 2. - 1.)*0.005;
    fragColor.rgb = mix(fragColor.rgb, texture(tex, texCoord).rgb, coef);
}

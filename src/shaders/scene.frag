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

// had some brief spurt of inspiration when looking at this toy
// Simple 7-segment Numbers by Kamoshika https://shadertoy.com/view/ftsSzB
// but code is completely original by spalmer.  hope it's useful!

// returns local (non-Euclidean metric) distance to segment edge
float digit7(vec2 q, int n)
{ // could add a few more 'digit' glyphs for minus sign and decimal point
	const int digitsegs[10] = int[] ( 
		95,10,118,122,43,121,125,26,127,123
		);
	if (n < 0 || n >= digitsegs.length()) return -1.; // just in case, array bound check
	int segs = digitsegs[n];
	const ivec2 segpos[7] = ivec2[] ( 
		  ivec2(-1,1), ivec2(1,1), ivec2(-1,-1), ivec2(1,-1) // 4 vertical segments
		, ivec2(0,2), ivec2(0,0), ivec2(0,-2) // 3 horizontal segments
		// maybe a period TODO
		);
	float d = 1e9;
	for (int i = segpos.length(); i-- > 0; ) {
		if ((segs & (1 << i)) == 0) continue;
		vec2 p = vec2(segpos[i]); //vec2(.0, .0); 
		p *= vec2(.45, .45);
		p = q - p; //p -= q; // doesn't matter
		bool vertical = i < 4;
		//bool period = false;
		//bool minus = false;
		if (vertical) p = p.yx; // rotate some 90degrees
		p = abs(p);
		vec2 w = vec2(.35, .0); //vec2(period ? 0. : .35, 0.); //
		p -= w;
		p = max(p, vec2(0));
		float dx = (p.x + p.y);
		d = min(d, dx);
	}
	d *= sqrt(.5); // correct for metric
	return d - .05; // seg thickness
}

void digits7(inout vec4 o, vec4 c, vec2 q, vec2 R, uint value, int digits)
{
	float d = 1e9;
	for (int i = 0; i < digits; i++) {
		d = min(d, digit7(q, int(value%10u)));
		value = value / 10u;
		q.x += 1.25;
	}
	float a = clamp(.5 - .25 * R.y * d, 0., 1.); // antialias edge
    o = mix(o, c, a);
}

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

    vec2 pos = vec2(state[1], state[2]);
    fragColor.rgb = background(uv);
    fragColor /= 1.+pow(length(uv),4.)*0.6;

    {
        float size = 0.05 + smoothstep(0., 1., state[4]) * 0.1;
        float mask = smoothstep(size, size + 0.01, length(uv - pos));
        fragColor.rgb = vec3(mix(fragColor.rgb, vec3(1,1,1)-state[4]*vec3(0,1,1), 1.0 - mask));

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
     
    float coef = hash21(uv) * 1.2;
    coef = clamp(coef, 0.5, 1.);
    texCoord += (vec2(hash21(uv+vec2(1)), hash21(uv+vec2(2))) * 2. - 1.)*0.005;
    fragColor.rgb = mix(fragColor.rgb, texture(tex, texCoord).rgb, coef);

    // 0 -> normal
    // 0.5 -> black
    // 1 -> normal
    float fade = state[7];
    fragColor.rgb = mix(fragColor.rgb, vec3(0), smoothstep(0.0, 0.5, fade)*smoothstep(1.0, 0.5, fade));
//    fragColor.rgb = mix(fragColor.rgb, vec3(0), );

    digits7(fragColor, vec4(1.,.0,0,1), uv*20.-vec2(18,8.5), iResolution, uint(state[5]), 4);
    digits7(fragColor, vec4(0,0.5,0,1), uv*20.-vec2(-19,8.5), iResolution, uint(state[6]), 1);
}

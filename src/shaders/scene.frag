#version 430

layout(location = 0) uniform vec4 iFrame; // xy: resolution, z: time since the last frame, w: pass (0: scene, 1: final)
layout(binding = 0) uniform sampler2D tex; // last scene pass, with the trails

#include "tweaks.frag"
#include "state.glsl"
#include "world.glsl"


out vec4 fragColor;

float hash21(vec2 xy) { return fract(sin(dot(xy, vec2(12.9898, 78.233))) * 43758.5453); }
float hash31(vec3 xyz) { return hash21(vec2(hash21(xyz.xy), xyz.z)); }

float noise(vec3 x) {

    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*f*(f*(f*6.0-15.0)+10.0);
    return mix(mix(mix( hash31(i+vec3(0,0,0)), 
                        hash31(i+vec3(1,0,0)),f.x),
                   mix( hash31(i+vec3(0,1,0)), 
                        hash31(i+vec3(1,1,0)),f.x),f.y),
               mix(mix( hash31(i+vec3(0,0,1)), 
                        hash31(i+vec3(1,0,1)),f.x),
                   mix( hash31(i+vec3(0,1,1)), 
                        hash31(i+vec3(1,1,1)),f.x),f.y),f.z)*2.-1.;
}


#define TIME gameTime

// https://www.shadertoy.com/view/NtsXR2
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

void digits7(inout vec4 o, vec4 c, vec2 q, vec2 R, uint value, int digits) {
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
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b*cos(6.28318*(c*t+d));
}

vec3 palette(float t) {
  return pal(t, vec3(0.2),vec3(0.2),vec3(0.2),vec3(0.2,0.20,0.90));
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 6; i++) {
        value += amplitude * (noise(p.xyx) * 0.5 + 0.5);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

vec3 explosion_2d(vec2 uv, float progress, vec3 backgroundcolor, float time) {
    const float MAX_RADIUS = 0.15;
    const float NOISE_SCALE = 6.;
    const float NOISE_AMPLITUDE = 0.1;
    
    float d = length(uv);
    
    float radius = pow(sin(progress * 3.14159), 0.15) * MAX_RADIUS + 0.001;
    
    float noise_val = noise(vec3(uv * NOISE_SCALE, time * 0.5)); // * 2.0 - 1.0;
    float distortion_amp = NOISE_AMPLITUDE * (1.0 - progress);
    float d_distorted = d - noise_val * distortion_amp;
    float mask_inner = smoothstep(0.0, radius * 0.5, d);
    float mask_outer = smoothstep(radius, radius - 0.05, d_distorted);
    float mask_final = mask_inner * mask_outer;
    
    float alpha = mask_final * pow(1.0 - progress, 2.0);
    
    if (alpha < 0.001) {
        return backgroundcolor;
    }
    
    float flame_gradient = d / radius;
    vec3 col_inner = vec3(1.0, 0.9, 0.7);
    vec3 col_outer = vec3(1.0, 0.3, 0.0);
    vec3 fire_color = mix(col_inner, col_outer, flame_gradient);
    fire_color *= (1.0 + progress * 0.5); 
    
    return mix(backgroundcolor, fire_color, alpha);
}

float metaDiamond(vec2 p, vec2 pixel, float r) {
    vec2 d = abs(p - pixel);
    return r / (d.x + d.y + 1e-4);
}

vec3 background(vec2 uv) {
    vec3 starColor = vec3(0.0);
    vec2 uvstars = uv * 3. + vec2(0, TIME * 0.1);
    vec2 grid = floor(uvstars);
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 cell = grid + vec2(x, y);
            vec2 starPos = cell + vec2(hash21(cell), hash21(cell.yx)) - 0.5;
            float starSize = hash21(cell * 1.5) * 0.01;
            starColor += vec3(1.0, 0.95, 0.8) * metaDiamond(uvstars, starPos, starSize);
        }
    }

    float cloud1 = fbm(uv*5. + vec2(0., TIME*1.));
    vec3 c1 = cloud1 * palette(0.5);
    c1 = pow(c1, vec3(1. + hurt*0.5));
    float  cloud2 = fbm(uv*2. + vec2(10));
    vec3 c2 = cloud2 * palette(0.0);
    vec3 cloudCol = mix(c1, c2, 0.5) + 0.2*starColor;
    return cloudCol;
}

// The scene, blended with the previous frame.
vec3 scene(vec2 uv, vec2 texCoord)
{
    vec3 col = background(uv);
    col /= 1. + pow(length(uv), 4.) * 0.6;

    for (int i = 0; i < boomCount; i++) {
        vec2 p = uv - booms[i].xy;
        if (length(p) < 0.4)
            col = explosion_2d(p, 1. - booms[i].z, col, TIME);
    }

    // player
    float size = PLAYER_RADIUS + smoothstep(0., 1., hurt) * 0.1;
    float mask = smoothstep(size, size + 0.01, length(uv - player));
    mask *= pow(length(uv - player), 0.15);
    col = mix(col, vec3(1) - hurt * vec3(0, 1, 1), 1. - sqrt(mask));

    for (int i = 0; i < enemyCount; i++)
        col = mix(vec3(sin(enemies[i].z), 1, 0.2), col, smoothstep(0., 0.01, enemyDist(uv, i)));

    for (int i = 0; i < shotCount; i++)
        col = mix(vec3(1, 1, 0.8), col, smoothstep(0.01, SHOT_RADIUS, length(uv - shots[i].xy)));

    // A NaN would spread through the trails.
    col = clamp(col, 0., 1.);

    // Trails. Tuned at 60 fps; the exponent makes them independent of the frame rate.
    float coef = clamp(hash21(uv) * _TV(trail, 1.2), 0.5, 1.);
    float frames = iFrame.z * 60.;
    vec2 jitter = vec2(hash21(uv + vec2(1)), hash21(uv + vec2(2))) * 2. - 1.;
    texCoord += jitter * 0.005 * sqrt(frames);
    return mix(col, texture(tex, texCoord).rgb, pow(coef, frames));
}

void main()
{
    vec2 texCoord = gl_FragCoord.xy / iFrame.xy;
    vec2 uv = (gl_FragCoord.xy * 2. - iFrame.xy) / iFrame.x;

    if (iFrame.w < 0.5) {
        fragColor = vec4(scene(uv, texCoord), 1);
        return;
    }

    // Final image: the score is not part of the trails
    fragColor = texture(tex, texCoord);
    fragColor.rgb *= mix(1.2, 1., smoothstep(0., 2., TIME));
    if (TIME < 0.) {
        digits7(fragColor, vec4(1, 0, 0, 1), uv * 5. - vec2(2, 0), iFrame.xy, uint(score), 4);
    } else {
        digits7(fragColor, vec4(1, 0, 0, 1), uv * 20. - vec2(18, 8.5), iFrame.xy, uint(score), 4);
        digits7(fragColor, vec4(0, 0.5, 0, 1), uv * 20. - vec2(-19, 8.5), iFrame.xy, uint(max(lives, 0)), 1);
    }
}

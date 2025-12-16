#version 430

layout (location = 0) uniform float state[200];
layout (location = 200) uniform float missiles[200];
layout (location = 400) uniform float enemies[200];
layout (location = 600) uniform float explosions[200];
layout (location = 1000) uniform sampler2D tex;

// Include begin: shared.h
// --------------------------------------------------------------------




const int XRES = 1280;
const int YRES = 720;

const int DEMO_LENGTH_IN_S = (60 + 47);
// --------------------------------------------------------------------
// Include end: shared.h


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


const float TIME = state[8];







float digit7(vec2 q, int n)
{ 
	const int digitsegs[10] = int[] ( 
		95,10,118,122,43,121,125,26,127,123
		);
	if (n < 0 || n >= digitsegs.length()) return -1.; 
	int segs = digitsegs[n];
	const ivec2 segpos[7] = ivec2[] ( 
		  ivec2(-1,1), ivec2(1,1), ivec2(-1,-1), ivec2(1,-1) 
		, ivec2(0,2), ivec2(0,0), ivec2(0,-2) 
		
		);
	float d = 1e9;
	for (int i = segpos.length(); i-- > 0; ) {
		if ((segs & (1 << i)) == 0) continue;
		vec2 p = vec2(segpos[i]); 
		p *= vec2(.45, .45);
		p = q - p; 
		bool vertical = i < 4;
		
		
		if (vertical) p = p.yx; 
		p = abs(p);
		vec2 w = vec2(.35, .0); 
		p -= w;
		p = max(p, vec2(0));
		float dx = (p.x + p.y);
		d = min(d, dx);
	}
	d *= sqrt(.5); 
	return d - .05; 
}

void digits7(inout vec4 o, vec4 c, vec2 q, vec2 R, uint value, int digits) {
	float d = 1e9;
	for (int i = 0; i < digits; i++) {
		d = min(d, digit7(q, int(value%10u)));
		value = value / 10u;
		q.x += 1.25;
	}
	float a = clamp(.5 - .25 * R.y * d, 0., 1.); 
    o = mix(o, c, a);
}


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
    
    float radius = pow(sin(progress * 3.14159), 0.15) * MAX_RADIUS;
    
    float noise_val = noise(vec3(uv * NOISE_SCALE, time * 0.5)); 
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
    return r / (d.x + d.y);
}

vec3 background(vec2 uv) {
    vec3 col = vec3(0);

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

    vec2 p  = uv*5.;
    float cloud1 = fbm(uv*5. + vec2(0., TIME*1.));
    vec3 c1 = cloud1 * palette(0.5);
    c1 = pow(c1, vec3(1. + state[0]*0.5));
    float  cloud2 = fbm(uv*2. + vec2(10));
    vec3 stars = vec3(0.1,0.1,0) * smoothstep(0.8, 0.98, fbm(uv*50. + vec2(0, TIME)));
    vec3 c2 = cloud2 * palette(0.0);
    vec3 cloudCol = mix(c1, c2, 0.5) + 0.2*starColor;
    return cloudCol;
}

mat2 rot(float angle)
{
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, s, -s, c);
}

float triangleDist(vec2 p)
{
	return max(abs(p).x * 0.866025 + 
			   p.y * 0.5, -p.y);
}

float boxDist(vec2 p, vec2 size)
{
	vec2 d = abs(p) - size;
  	return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
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

    int nExplo = int(explosions[0]);
    for (int i = 0; i < nExplo; i++) {
        vec2 pos2 = vec2(explosions[3*i+1], explosions[3*i + 2]);
        float progress = 1. - explosions[3*i + 3];
        fragColor.rgb = explosion_2d(uv - pos2, progress, fragColor.rgb, TIME);
    }

    
    {
        float size = 0.05 + smoothstep(0., 1., state[4]) * 0.1;
        float mask = smoothstep(size, size + 0.01, length(uv - pos));
        mask *= pow(length(uv - pos), 0.15);
        
        fragColor.rgb = vec3(mix(fragColor.rgb, vec3(1)-state[4]*vec3(0,1,1), 1.0 - pow(mask, 0.5)));
   }


    int n = int(enemies[0]);
    for (int i = 0; i < n; i++) {
        vec2 pos2 = vec2(enemies[4*i+3], enemies[4*i+4]);
        vec2 uvrot = rot(-TIME*4.)*(uv - pos2);
        float kind = enemies[4*i+1];
        float mask;
        if (kind < 0.5) { 
            mask = boxDist(uvrot, vec2(0.03));
        } else if (kind < 1.5) { 
            mask = triangleDist(rot(TIME*4.+float(i))*(uv - pos2)) - 0.02;
        } else {
            mask = length(uvrot) - 0.03; 
            mask = max(-mask, triangleDist(rot(TIME*4.+float(i))*(uv - pos2)) - 0.03);
        }
        mask = smoothstep(0.0, 0.01, mask);
        fragColor.rgb = mix(fragColor.rgb, vec3(sin(kind), 1, 0.2), 1.0 - mask);
    }

    int nMis = int(missiles[0]);
    for (int i = 0; i < nMis; i++) {
        vec2 pos2 = vec2(missiles[1 + 2*i], missiles[1 + 2*i + 1]);
        float mask = smoothstep(0.01,  0.02, length(uv - pos2));
        fragColor.rgb = mix(fragColor.rgb, vec3(1,1,0.8), 1.0 - mask);
   }

    float coef = hash21(uv) * 1.2;
    coef = clamp(coef, 0.5, 1.);
    texCoord += (vec2(hash21(uv+vec2(1)), hash21(uv+vec2(2))) * 2. - 1.)*0.005;
    fragColor.rgb = mix(fragColor.rgb, texture(tex, texCoord).rgb, coef);

    fragColor.rgb *= mix(1.2, 1., smoothstep(0., 2., TIME));
    if (TIME < 0.) {
        digits7(fragColor, vec4(1.,.0,0,1), uv*5.-vec2(2,0), iResolution, uint(state[5]), 4);
    } else {
        digits7(fragColor, vec4(1.,.0,0,1), uv*20.-vec2(18,8.5), iResolution, uint(state[5]), 4);
        digits7(fragColor, vec4(0,0.5,0,1), uv*20.-vec2(-19,8.5), iResolution, uint(state[6]), 1);
    }
}

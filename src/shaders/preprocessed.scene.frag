#version 430

layout(location = 0) uniform vec4 iFrame; 
layout(binding = 0) uniform sampler2D tex; 

// Include begin: tweaks.frag
// --------------------------------------------------------------------





#define _TV(name, value)  (value)
#define _TVC(name, value) (value)
// --------------------------------------------------------------------
// Include end: tweaks.frag

// Include begin: state.glsl
// --------------------------------------------------------------------







#define TRAIL 32
#define MAX_BALLS 4

layout(std430, binding = 0) buffer State {
    
    
    int bumperEvents, flipperEvents, drainEvents, slingEvents;

    vec2 ball[MAX_BALLS], vel[MAX_BALLS]; 
    vec2 flip, flipVel; 
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
    int score, balls;   
    int mult;           
    int lanesLit;       
    int steps;
    int ballCount;      
    int pending;        
    float launchDelay;
    int targetsLit;     
    float alignTime;    
    int jackpot;        
    int jackpotLit;     
    int ballAdded;      
    int sets;           
    int multiballs;     
    float jackpotFlash;
    vec4 trail[TRAIL];  
};
// --------------------------------------------------------------------
// Include end: state.glsl

// Include begin: world.glsl
// --------------------------------------------------------------------




#define PI 3.14159
#define BALL_R 0.0135
#define CX -0.019     
#define LANE_X 0.244  
#define SUN vec2(CX, 0.13)
#define FLIP_REST -0.55 
#define FLIP_UP 0.45
#define FLIP_LEN 0.075


#define M_FLOOR 0.
#define M_WALL 1.
#define M_RAIL 2.
#define M_SLING 3.
#define M_FLIP 4.   
#define M_SUN 6.
#define M_PLANET 7. 
#define M_BALL 10.
#define M_ARM 11.
#define M_APRON 12.
#define M_POST 13.
#define M_TARGET 14.

mat2 rot(float a)
{
    float c = cos(a), s = sin(a);
    return mat2(c, s, -s, c);
}

float boxDist(vec2 p, vec2 size)
{
    vec2 d = abs(p) - size;
    return min(max(d.x, d.y), 0.) + length(max(d, 0.));
}

float segDist(vec2 p, vec2 a, vec2 b)
{
    vec2 pa = p - a, ba = b - a;
    return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.));
}


float triDist(vec2 p, vec2 p0, vec2 p1, vec2 p2)
{
    vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
    vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
    vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0., 1.);
    vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0., 1.);
    vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0., 1.);
    float s = sign(e0.x * e2.y - e0.y * e2.x);
    vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                     vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                     vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
    return -sqrt(d.x) * sign(d.y);
}


vec2 mirror(vec2 p)
{
    return vec2(CX - abs(p.x - CX), p.y);
}


float areaDist(vec2 p)
{
    return min(boxDist(p - vec2(0, -0.155), vec2(0.26, 0.445)), length(p - vec2(0, 0.29)) - 0.26);
}


float laneDist(vec2 p)
{
    return segDist(p, vec2(0.224, -0.6), vec2(0.224, 0.2)) - 0.004;
}


float railDist(vec2 q)
{
    return min(segDist(q, vec2(CX - 0.2, -0.2), vec2(CX - 0.2, -0.33)),
               segDist(q, vec2(CX - 0.2, -0.33), vec2(CX - 0.095, -0.415))) - 0.006;
}


float slingDist(vec2 q)
{
    return triDist(q, vec2(CX - 0.155, -0.2), vec2(CX - 0.155, -0.305), vec2(CX - 0.1, -0.345)) - 0.005;
}



float postDist(vec2 q)
{
    float d = triDist(q, vec2(CX - 0.243, 0.08), vec2(CX - 0.193, -0.03), vec2(CX - 0.243, -0.06));
    d = min(d, min(segDist(q, vec2(CX - 0.09, 0.4), vec2(CX - 0.09, 0.44)),
                   segDist(q, vec2(CX - 0.03, 0.4), vec2(CX - 0.03, 0.44))));
    return d - 0.005;
}


float gateDist(vec2 p)
{
    return segDist(p, vec2(0.222, 0.2), vec2(0.262, 0.235)) - 0.002;
}

vec2 flipPivot(int i)
{
    return vec2(CX + (i > 0 ? 0.085 : -0.085), -0.43);
}


float flipperDist(vec2 p, int i)
{
    if (i > 0) p.x = 2. * CX - p.x;
    p -= flipPivot(0);
    vec2 dir = vec2(cos(flip[i]), sin(flip[i]));
    float h = clamp(dot(p, dir) / FLIP_LEN, 0., 1.);
    return length(p - dir * h * FLIP_LEN) - mix(0.011, 0.005, h);
}


float planetRadius(int i)
{
    return i == 0 ? 0.015 : i == 1 ? 0.02 : 0.008;
}


float alignment()
{
    return alignTime > 0. ? smoothstep(0., 0.8, alignTime) * smoothstep(4., 3., alignTime) : 0.;
}


vec2 orbit(float a)
{
    a += alignment() * (mod(-PI / 2. - a + PI, 2. * PI) - PI);
    return vec2(cos(a), sin(a));
}

vec2 planetPos(int i, float t)
{
    if (i == 0) return SUN + 0.075 * orbit(t * 0.9);
    vec2 p = SUN + 0.14 * orbit(t * 0.35 + 2.);
    if (i > 1) p += 0.036 * orbit(t * 2.2);
    return p;
}



float targetDist(vec2 q)
{
    return min(length(q - vec2(CX - 0.135, -0.12)), length(q - vec2(CX - 0.045, -0.15))) - 0.009;
}


int targetIndex(vec2 p)
{
    return int(clamp(floor((p.x - CX) / 0.09 + 2.), 0., 3.));
}

vec2 hit(vec2 h, float d, float m)
{
    return d < h.x ? vec2(d, m) : h;
}



vec2 field(vec2 p, bool down)
{
    vec2 q = mirror(p);
    vec2 h = vec2(-areaDist(p), M_WALL);
    h = hit(h, min(laneDist(p), boxDist(p - vec2(LANE_X, -0.55), vec2(0.02, 0.05))), M_WALL);
    h = hit(h, railDist(q), M_RAIL);
    h = hit(h, slingDist(q), M_SLING);
    h = hit(h, postDist(q), M_POST);
    h = hit(h, targetDist(q), M_TARGET);
    if (down)
        h = hit(h, gateDist(p), M_WALL);
    for (int i = 0; i < 2; i++)
        h = hit(h, flipperDist(p, i), M_FLIP + float(i));
    h = hit(h, length(p - SUN) - 0.03, M_SUN);
    for (int i = 0; i < 3; i++)
        h = hit(h, length(p - planetPos(i, time)) - planetRadius(i), M_PLANET + float(i));
    return h;
}
// --------------------------------------------------------------------
// Include end: world.glsl


out vec4 fragColor;


float digit7(vec2 q, int n)
{
    const int digitsegs[10] = int[](95, 10, 118, 122, 43, 121, 125, 26, 127, 123);
    const ivec2 segpos[7] = ivec2[](ivec2(-1, 1), ivec2(1, 1), ivec2(-1, -1), ivec2(1, -1),
                                    ivec2(0, 2), ivec2(0, 0), ivec2(0, -2));
    int segs = digitsegs[n];
    float d = 1e9;
    for (int i = 0; i < 7; i++) {
        if ((segs & (1 << i)) == 0) continue;
        vec2 p = q - vec2(segpos[i]) * .45;
        if (i < 4) p = p.yx;
        p = max(abs(p) - vec2(.35, 0), 0.);
        d = min(d, p.x + p.y);
    }
    return d * sqrt(.5) - .05;
}

void digits7(inout vec3 o, vec3 c, vec2 q, float scale, uint value, int digits)
{
    float d = 1e9;
    for (int i = 0; i < digits; i++) {
        d = min(d, digit7(q, int(value % 10u)));
        value /= 10u;
        q.x += 1.25;
        if (value == 0u) break;
    }
    o += c * (clamp(.5 - iFrame.x / scale * d * .5, 0., 1.) + .3 * exp(-30. * max(d, 0.)));
}




vec2 planets[3];



float extrude(float d, float z, float height, float r)
{
    vec2 w = vec2(d + r, abs(z - height * .5) - height * .5 + r);
    return min(max(w.x, w.y), 0.) + length(max(w, 0.)) - r;
}

float seg3(vec3 p, vec3 a, vec3 b)
{
    vec3 pa = p - a, ba = b - a;
    return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.));
}

float planetHeight(int i)
{
    return 0.034 + planetRadius(i) * 1.3;
}

vec2 map(vec3 p)
{
    vec2 q = mirror(p.xy);
    float area = areaDist(p.xy);
    vec2 h = vec2(p.z, M_FLOOR);
    h = hit(h, extrude(min(max(-area, area - 0.03), laneDist(p.xy)), p.z, 0.05, 0.004), M_WALL);
    h = hit(h, extrude(boxDist(p.xy - vec2(CX, -0.56), vec2(0.245, 0.07)), p.z, 0.022, 0.006), M_APRON);
    h = hit(h, extrude(railDist(q), p.z, 0.026, 0.005), M_RAIL);
    
    float sling = slingDist(q);
    h = hit(h, min(extrude(sling, p.z, 0.024, 0.004), extrude(sling - 0.003, p.z - 0.025, 0.005, 0.002)), M_SLING);
    h = hit(h, extrude(postDist(q), p.z, 0.032, 0.003), M_POST);
    h = hit(h, extrude(gateDist(p.xy), p.z - 0.01, 0.025, 0.001), M_ARM);
    for (int i = 0; i < 2; i++)
        h = hit(h, extrude(flipperDist(p.xy, i), p.z - 0.002, 0.022, 0.005), M_FLIP + float(i));

    
    vec3 s = p - vec3(SUN, 0);
    h = hit(h, min(extrude(length(s.xy) - 0.03, p.z, 0.03, 0.004), length(s - vec3(0, 0, 0.068)) - 0.036 * (1. + 0.15 * flash.x)), M_SUN);

    
    float arms = 1e9;
    for (int i = 0; i < 3; i++) {
        float r = planetRadius(i), z = planetHeight(i);
        vec3 d = p - vec3(planets[i], 0);
        float body = min(extrude(length(d.xy) - r * 0.8, p.z, 0.034, 0.003), length(d - vec3(0, 0, z)) - r * 1.3 * (1. + 0.25 * flash[i + 1]));
        if (i == 1) { 
            d.z -= z;
            d.xz *= rot(0.4);
            body = min(body, length(vec2(length(d.xy) - r * 2.2, d.z)) - 0.0015);
        }
        h = hit(h, body, M_PLANET + float(i));
        vec3 from = i > 1 ? vec3(planets[1], planetHeight(1)) : vec3(SUN, 0.068);
        arms = min(arms, seg3(p, from, vec3(planets[i], z)));
    }
    h = hit(h, arms - 0.0022, M_ARM);
    
    h = hit(h, seg3(p, vec3(LANE_X, -0.502 - plunger * 0.04, BALL_R), vec3(LANE_X, -0.7, BALL_R)) - 0.008, M_ARM);

    h = hit(h, extrude(targetDist(q), p.z, 0.03, 0.003), M_TARGET);
    for (int b = 0; b < ballCount; b++)
        h = hit(h, length(p - vec3(ball[b], BALL_R)) - BALL_R, M_BALL);
    return h;
}

vec3 normal(vec3 p)
{
    vec2 e = vec2(1, -1) * 1e-4;
    return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x +
                     e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}


vec2 march(vec3 ro, vec3 rd)
{
    
    float t = ro.z > 0.11 ? (ro.z - 0.11) / max(-rd.z, 1e-3) : 0.;
    for (int i = 0; i < 150; i++) {
        vec3 p = ro + rd * t;
        vec2 h = map(p);
        if (h.x < 1e-4 * (1. + t * 4.))
            return vec2(t, h.y);
        if (p.z > 0.12 && rd.z > 0. || t > 4.)
            break;
        t += h.x;
    }
    return vec2(9);
}

float shadow(vec3 p, vec3 l)
{
    float s = 1., t = 0.003;
    for (int i = 0; i < 40 && t < 0.3; i++) {
        float d = map(p + l * t).x;
        s = min(s, 16. * d / t);
        if (s < 0.01) break;
        t += clamp(d, 0.002, 0.03);
    }
    return clamp(s, 0., 1.);
}

float occlusion(vec3 p, vec3 n)
{
    float o = 0.;
    for (int i = 1; i < 6; i++) {
        float d = float(i) * 0.006;
        o += (d - map(p + n * d).x) / d;
    }
    return clamp(1. - o * 0.25, 0., 1.);
}



vec3 env(vec3 rd)
{
    return vec3(0.05, 0.05, 0.09) * (0.4 + 0.6 * max(rd.z, 0.))
         + vec3(1, 0.85, 0.65) * 4. * smoothstep(0.75, 0.92, rd.z) * smoothstep(0.3, 0.15, abs(rd.x))
         + vec3(0.3, 0.5, 1) * 1.5 * smoothstep(0.85, 0.95, -rd.y) * smoothstep(0.3, 0.1, abs(rd.z - 0.3));
}

float hash(vec2 p)
{
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p)
{
    vec2 i = floor(p), f = fract(p);
    f *= f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), f.x), f.y);
}


float fbm(vec2 p)
{
    return noise(p) * 0.5 + noise(p * 2.13 + 7.) * 0.3 + noise(p * 4.37 + 3.) * 0.2;
}


float stars(vec2 p, float density)
{
    vec2 c = floor(p * density);
    float h = hash(c);
    vec2 q = fract(p * density) - 0.25 - 0.5 * vec2(h, fract(h * 17.));
    return step(0.8, h) * smoothstep(0.12, 0., length(q)) * (0.6 + 0.4 * sin(time * 3. + h * 60.));
}


float lampDist, lampOn;
vec3 lampColor;
void lamp(vec2 q, float r, float on, vec3 color)
{
    if (length(q) < r) {
        lampDist = length(q) / r;
        lampOn = on;
        lampColor = color;
    }
}



float metal, rough;
vec3 glow;
vec3 material(vec3 p, float m)
{
    
    float wear = fbm(p.xy * 300. + p.z * 200.);
    vec3 brass = vec3(0.85, 0.6, 0.3) * (0.75 + 0.35 * wear);
    vec3 rubber = vec3(0.02, 0.018, 0.017) * (0.8 + 0.4 * wear);
    metal = 0.;
    glow = vec3(0);
    rough = 0.15 + 0.2 * wear;
    lampDist = 1.;
    if (m == M_FLOOR) {
        if (areaDist(p.xy) > 0.) {
            
            rough = 1.;
            glow = vec3(0.8, 0.85, 1) * stars(p.xy, 40.) * 2. + vec3(0.02, 0.005, 0.04) * fbm(p.xy * 4.) * 2.;
            return vec3(0);
        }
        vec2 s = p.xy - SUN;
        float r = length(s), a = atan(s.y, s.x);
        
        float plank = floor(p.x / 0.065);
        float x = p.x + 0.004 * sin(p.y * 25. + plank * 3.) + 0.002 * fbm(p.xy * 60.);
        float grain = sin(x * 700. + fbm(vec2(x * 90., p.y * 6.)) * 8.) * 0.5 + sin(x * 2300.) * 0.25;
        vec3 c = vec3(0.17, 0.06, 0.02) * (0.85 + 0.15 * grain) * (0.8 + 0.4 * hash(vec2(plank)))
               * (0.85 + 0.3 * fbm(p.xy * vec2(20, 4)))
               * (1. - 0.6 * smoothstep(0.0305, 0.0322, abs(fract(p.x / 0.065) - 0.5) * 0.065));
        
        rough = 0.05 + 0.15 * smoothstep(0.4, 0.8, fbm(p.xy * 25.));
        
        float gear = r - 0.195 - 0.006 * clamp(sin(a * 24.) * 4., -1., 1.);
        if (gear < 0.) {
            float cloud = fbm(p.xy * 30.);
            c = mix(vec3(0.004, 0.008, 0.035), vec3(0.05, 0.015, 0.07), cloud * cloud * 1.5) * (1. - r * 2.);
            glow = vec3(0.9, 0.9, 1) * stars(p.xy, 90.) * 0.6;
        }
        
        float d = min(min(abs(r - 0.075), abs(r - 0.14)) - 0.0012, abs(gear) - 0.002);
        if (d < 0.) {
            
            metal = 0.5;
            rough = 0.3;
            return brass;
        }
        
        
        for (int i = 0; i < 4; i++) {
            if (i < 3)
                lamp(p.xy - vec2(CX + 0.06 * float(i - 1), 0.37), 0.009, float(lanesLit >> i & 1), vec3(1, 0.5, 0.1));
            lamp(p.xy - vec2(CX - 0.045 + 0.03 * float(i), -0.27), 0.007, float(mult >= i + 2), vec3(0.2, 0.6, 1));
        }
        vec2 q = mirror(p.xy);
        q -= q.x < CX - 0.09 ? vec2(CX - 0.135, -0.16) : vec2(CX - 0.045, -0.19);
        lamp(q, 0.016 * (0.6 + 0.4 * cos(5. * atan(q.x, q.y))), float(targetsLit >> targetIndex(p.xy) & 1) + 0.5 * flash.x, vec3(1, 0.8, 0.3));
        lamp(p.xy - vec2(CX, -0.37), 0.01, float(ballSave > 0. && fract(time * (ballSave < 2. ? 4. : 1.5)) < 0.6), vec3(1, 0.15, 0.1));
        float k = floor(a * 1.91 + 0.5); 
        lamp(s - 0.052 * vec2(cos(k / 1.91), sin(k / 1.91)), 0.006, step(fract((k - time * 4.) / 12.), 0.3) * 0.5 + flash.x * 2., vec3(1, 0.45, 0.1));
        if (lampDist < 1.) {
            
            rough = 0.05;
            glow = lampColor * lampOn * (4. - 2.5 * lampDist * lampDist) * (0.8 + 0.4 * noise(p.xy * 3000.));
            return lampColor * 0.08;
        }
        
        float wave = alignTime * 0.35 - r;
        glow += vec3(1, 0.7, 0.3) * (exp(-wave * wave * 3000.) * max(1. - alignTime * 0.5, 0.) * 3.
             + alignment() * exp(-pow(p.x - CX, 2.) * 3000.) * step(p.y, SUN.y) * 1.5);
        return c;
    }
    if (m == M_WALL) {
        if (p.z > 0.045) { metal = 1.; return brass; } 
        rough = 0.3;
        return vec3(0.09, 0.035, 0.012) * (0.7 + 0.6 * fbm(vec2(p.x + p.y, p.z) * vec2(40, 300)));
    }
    if (m == M_APRON) {
        
        rough = 0.35;
        return mix(vec3(0.03, 0.025, 0.05), brass * 0.5, smoothstep(0.75, 0.9, wear));
    }
    if (m == M_RAIL || m == M_ARM) {
        metal = 1.;
        rough *= 0.6;
        return m == M_ARM ? brass : vec3(0.7, 0.7, 0.72) * (0.85 + 0.2 * wear);
    }
    if (m == M_SLING) {
        if (p.z > 0.024) {
            
            int side = p.x > CX ? 1 : 0;
            glow = vec3(1, 0.25, 0.08) * slingFlash[side] * 3.;
            rough = 0.05;
            return vec3(0.12, 0.012, 0.01);
        }
        rough = 0.5;
        return rubber;
    }
    if (m == M_POST || m == M_FLIP || m == M_FLIP + 1.) {
        
        if (p.z > 0.004 && p.z < 0.02) {
            rough = 0.5;
            return rubber;
        }
        metal = 1.;
        return brass;
    }
    if (m == M_SUN) {
        metal = 1.;
        
        if (p.z > 0.035)
            glow = mix(vec3(1, 0.5, 0.15), vec3(0.6, 0.8, 1.2) * (1.5 + sin(time * 12.)), float(ballCount + pending > 1 && jackpotLit > 0))
                 * (1.5 + flash.x * 8.) * (0.8 + 0.4 * fbm(p.xy * 400. + time));
        return brass;
    }
    if (m == M_TARGET) {
        
        glow = vec3(1, 0.75, 0.25) * float(targetsLit >> targetIndex(p.xy) & 1) * (2. + sin(time * 8.));
        rough = 0.1;
        return vec3(0.35, 0.25, 0.05);
    }
    if (m >= M_PLANET && m < M_BALL) {
        int i = int(m - M_PLANET);
        if (p.z < 0.034) { rough = 0.5; return rubber; }
        if (i == 1 && abs(length(p.xy - planets[1]) - 0.044) < 0.004) { metal = 1.; return brass; }
        
        vec3 c = i == 0 ? vec3(0.7, 0.2, 0.06) : i == 1 ? vec3(0.08, 0.25, 0.7) : vec3(0.6);
        c *= 0.6 + 0.6 * fbm(vec2(p.z * 600., p.x * 60.));
        glow = c * flash[i + 1] * 4.;
        rough = 0.1;
        return c;
    }
    
    metal = 1.;
    rough = 0.01 + 0.03 * wear;
    return vec3(0.95);
}



vec3 n, v, albedo, f0;
vec3 light(vec3 l, vec3 color)
{
    float nl = max(dot(n, l), 0.);
    vec3 h = normalize(l + v);
    float k = 2. / max(rough * rough, 0.002);
    float spec = (k + 8.) / 25. * pow(max(dot(n, h), 0.), k);
    return color * nl * (albedo + f0 * spec);
}


vec3 trailGlow(vec3 ro, vec3 rd, float tMax)
{
    vec3 col = vec3(0);
    for (int i = 0; i < TRAIL - 1; i++) {
        vec3 a = vec3(trail[i].xy, BALL_R), b = vec3(trail[i + 1].xy, BALL_R);
        
        float t = dot(a - ro, rd), age = float(i) / float(TRAIL), w = BALL_R * (0.9 - 0.7 * age);
        float d = seg3(ro + rd * t, a, b);
        if (t < tMax && distance(a, b) < 0.05) 
            col += mix(vec3(0.6, 0.8, 1), vec3(1, 0.3, 0.05), age) * smoothstep(0.4, 2., trail[i].z) * (1. - age)
                 * exp(-d * d / (w * w)) * 0.6;
    }
    return col;
}

vec3 render(vec3 ro, vec3 rd)
{
    const vec3 key = normalize(vec3(-0.3, -0.45, 1.));
    const vec3 fill = normalize(vec3(0.7, 0.6, 0.5));
    vec3 col = vec3(0), weight = vec3(1);
    vec3 ro0 = ro, rd0 = rd;
    float tHit = 9.;
    for (int bounce = 0; bounce < 2; bounce++) {
        vec2 h = march(ro, rd);
        if (bounce == 0) tHit = h.x;
        if (h.x > 8.) {
            col += weight * env(rd);
            break;
        }
        vec3 p = ro + rd * h.x;
        n = normal(p);
        v = -rd;
        albedo = material(p, h.y);
        f0 = mix(vec3(h.y == M_FLOOR ? 0.07 : 0.04), albedo, metal); 
        albedo *= 1. - metal;

        float shade = bounce == 0 ? shadow(p + n * 0.001, key) : 1.;
        float ao = bounce == 0 ? occlusion(p, n) : 1.;
        vec3 toSun = vec3(SUN, 0.068) - p;
        float sunPower = (0.5 + flash.x * 3.) * 0.0012 / dot(toSun, toSun);
        vec3 c = light(key, vec3(1, 0.85, 0.7) * 1.5 * shade)
               + light(fill, vec3(0.3, 0.45, 1) * 0.5 * ao)
               + light(normalize(toSun), vec3(1, 0.5, 0.15) * sunPower)
               
               + albedo * mix(vec3(0.12, 0.06, 0.03), vec3(0.08, 0.1, 0.2), n.z * 0.5 + 0.5) * ao;
        
        for (int i = 0; i < 4; i++) {
            vec3 l = vec3(CX + (i % 2 > 0 ? 0.215 : -0.215), i > 1 ? 0.2 : -0.15, 0.04) - p;
            c += light(normalize(l), vec3(1, 0.6, 0.3) * 0.0005 / dot(l, l)) * ao;
        }
        col += weight * (c + glow);

        float fresnel = pow(1. - max(dot(n, v), 0.), 5.);
        weight *= (f0 + (1. - f0) * fresnel) * (1. - rough) * ao;
        if (max(weight.x, max(weight.y, weight.z)) < 0.02)
            break;
        ro = p + n * 0.002;
        
        vec2 f = gl_FragCoord.xy;
        rd = normalize(reflect(rd, n) + rough * 0.5 * (vec3(hash(f), hash(f + 1.), hash(f + 2.)) - 0.5));
    }
    return col + trailGlow(ro0, rd0, tHit);
}

void main()
{
    vec2 texCoord = gl_FragCoord.xy / iFrame.xy;
    vec2 uv = (gl_FragCoord.xy * 2. - iFrame.xy) / iFrame.x;

    if (iFrame.w < 0.5) {
        for (int i = 0; i < 3; i++)
            planets[i] = planetPos(i, time);
        
        vec3 ta = vec3(cam, 0);
        float pitch = _TV(camPitch, 0.88);
        vec3 ro = ta + vec3(0, -cos(pitch), sin(pitch)) * _TV(camDistance, 1.3);
        ro += shake * shake * 0.006 * vec3(sin(time * 71.), sin(time * 83.), sin(time * 61.));
        vec3 fw = normalize(ta - ro);
        vec3 rt = normalize(cross(fw, vec3(0, 0, 1)));
        vec3 rd = normalize(uv.x * rt + uv.y * cross(rt, fw) + _TV(focal, 1.9) * fw);
        
        fragColor = vec4(clamp(render(ro, rd), 0., 50.), 1);
        return;
    }

    
    vec2 ca = (texCoord - 0.5) * 0.0015; 
    vec3 col = vec3(texture(tex, texCoord + ca).r, texture(tex, texCoord).g, texture(tex, texCoord - ca).b);
    vec3 bloom = vec3(0);
    for (int i = 2; i < 8; i++)
        bloom += max(textureLod(tex, texCoord, float(i)).rgb - 0.6, 0.);
    col += bloom * _TV(bloomAmount, 0.25) + max(textureLod(tex, 1. - texCoord, 6.).rgb - 0.6, 0.) * 0.1;
    col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
    
    float luma = dot(col, vec3(0.3, 0.6, 0.1));
    col = mix(vec3(luma), col, 1.15) + vec3(-0.01, 0, 0.02) * (1. - luma);
    col = pow(clamp(col, 0., 1.), vec3(1. / 2.2));
    col *= max(1. - pow(length(texCoord - 0.5), 1.5) * 1.2, 0.);
    col += (hash(gl_FragCoord.xy + fract(time) * 100.) - 0.5) * 0.02; 
    col += jackpotFlash * vec3(0.35, 0.3, 0.25); 
    
    col = mix(col, col.r * vec3(0.9, 0.1, 0.05), drainFlash * 0.8);

    vec3 amber = vec3(1, 0.45, 0.1) * (1. + 2. * max(max(flash.x, flash.y), max(flash.z, flash.w)));
    if (balls > 0) {
        digits7(col, amber, uv * 18. - vec2(16.5, 8.), 18., uint(score), 7);
        digits7(col, amber * 0.6, uv * 18. - vec2(-16.5, 8.), 18., uint(balls), 1);
    } else {
        digits7(col, amber, uv * 6. - vec2(1.8, 0), 6., uint(score), 7);
    }
    fragColor = vec4(col, 1);
}

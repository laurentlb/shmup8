#version 430

layout(location = 0) uniform vec4 iFrame; // xy: resolution, z: final pass: the part of the scene texture used, w: pass (0: scene, 1: final)
layout(binding = 0) uniform sampler2D tex; // the scene pass (linear HDR)

#include "tweaks.frag"
#include "state.glsl"
#include "world.glsl"

out vec4 fragColor;

// Materials: the enemies' bodies are 10 + index, their eyes 30 + index.
#define M_LEVEL 0.
#define M_NEON 1.
#define M_GUN 2.
#define M_COIL 3.
#define M_CRATE 4.
#define M_TUBE 5.


// Simple 7-segment numbers, after spalmer https://www.shadertoy.com/view/NtsXR2
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

// A number right-aligned at q (at least minDigits digits, with zeros).
void digits7(inout vec3 o, vec3 c, vec2 q, float scale, int value, int minDigits)
{
    float d = 1e9;
    for (int i = 0; i < 6; i++) {
        d = min(d, digit7(q, value % 10));
        value /= 10;
        q.x += 1.25;
        if (value == 0 && i >= minDigits - 1) break;
    }
    o += c * (clamp(.5 - iFrame.y / scale * d * .5, 0., 1.) + .2 * exp(-30. * max(d, 0.)));
}

float hash(vec2 p)
{
    return fract(sin(dot(p, vec2(12.9, 78.2))) * 4e4);
}

float noise(vec2 p)
{
    vec2 i = floor(p), f = fract(p);
    f *= f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), f.x), f.y);
}

float fbm(vec2 p)
{
    return noise(p) * .5 + noise(p * 2.13 + 7.) * .3 + noise(p * 4.37 + 3.) * .2;
}

float smin(float a, float b, float k)
{
    float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
    return mix(b, a, h) - k * h * (1. - h);
}

float capsule(vec3 p, vec3 a, vec3 b, float r)
{
    vec3 pa = p - a, ba = b - a;
    return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)) - r;
}

// ---------------------------------------------------------------------------
// The scene

vec3 eye, camF, camR, camU, gunAt;
uint seenX; // what a ray can meet besides the level: the enemies (bits 0 to 9), the gun (31)

// Neon tubes, after level(p); sets neonCol. Two tubes along the walls of each
// room (color, and the lower tube's height above the floor; black: none), not
// across the doorways; and a few others.
vec3 neonCol;


void tube(inout float d, float t, vec3 color)
{
    if (t < d) {
        d = t;
        neonCol = color;
    }
}

float neon(vec3 p)
{
    // the room's tubes, 0.12 m from its walls
    vec4 c = tNeon;
    vec2 q = abs(p.xz - (tLo.xz + tHi.xz) * .5) - (tHi.xz - tLo.xz) * .5 + .12;
    float y = p.y - tLo.y - c.w;
    float d = c.r + c.b > 0. ? length(vec2(length(max(q, 0.)) + min(max(q.x, q.y), 0.), min(abs(y), abs(y - (tRoom == 3 ? 6. : 3.))))) - .05 : 1e9;
    neonCol = c.rgb;
    d = max(d, -.4 - tInside); // where the wall is (not in a doorway)
    // the other tubes, computed only near them
    float b = max(abs(p.x - 4.) - .1, box(p, IN_LO[0], IN_HI[0]));
    if (b < 1.) {
        // A: the start line, a white frame across the hall
        vec2 e = abs(vec2(p.z, p.y - 4.)) - vec2(3.3, 4.);
        b = length(vec2(max(e.x, e.y), p.x - 4.)) - .06;
    }
    tube(d, b, vec3(1));
    b = length(abs(p.xz - vec2(68, 0)) - 8.) - 1.3;
    if ((seenIn >> 3 & 1u) != 0u && b < 1.)
        // C: rings around the pit's pillars
        b = length(vec2(b + .07, min(abs(p.y + 3.), abs(p.y - 3.)))) - .05;
    tube(d, b, vec3(1, .3, .05));
    b = max(abs(p.y - 4.4) - .1, box(p, vec3(27, 1, 11), vec3(51, 8, 35)));
    if ((seenIn >> 8 & 1u) != 0u && b < 1.)
        // F: rings under the pillars' capitals
        b = max(length(vec2(length(mod(p.xz - vec2(3, 5), 6.) - 3.) - .7, p.y - 4.4)) - .04, b);
    tube(d, b, vec3(.6, .15, 1));
    if ((seenIn >> 11 & 1u) != 0u)
        // G: the pylon's core
        tube(d, length(p.xz - vec2(4, 25)) - .45, vec3(1, .3, .7));
    // from lap 2, the neon dies room by room: it flickers, then it's dark
    // with rare flashes
    if (lap >= tDie) {
        float flash = hash(vec2(floor(time * 9.), tRoom));
        neonCol *= lap == tDie ? step(.35, flash) : .03 + step(.96, flash);
    }
    return d;
}

float neonAt(vec3 p)
{
    level(p);
    return neon(p);
}

#define ENEMY_SIZE 1.3

vec2 enemyShape(vec3 p, int i)
{
    vec3 e = enemy[i].xyz;
    int kind = enemyKind[i];
    // appearing: grows; bursting: swells
    float s = (enemy[i].w < 0. ? 1.6 + enemy[i].w * 2. : max(enemyInfo[i].x, .05)) * ENEMY_SIZE * enemyScale(kind);
    vec3 f = normalize(eye - e);
    if (kind == 2)
        f = normalize(vec3(f.x, 0, f.z)); // skitters stay level
    vec3 r = normalize(cross(f, vec3(0, 1, 0))), u = cross(r, f);
    vec3 q = p - e;
    vec3 l = vec3(dot(q, r), dot(q, u), dot(q, f)) / s;
    float t = time * 3. + float(i) * 1.7, body;
    if (kind == 2) {
        // skitter: a low body on six running legs
        body = length(l * vec3(1, 1.6, .8)) - .5;
        for (int k = 0; k < 6; k++) {
            float side = k < 3 ? -1. : 1., z = float(k % 3 - 1) * .45, a = time * 16. + float(k) * 2.1;
            vec3 hip = vec3(side * .3, 0, z), foot = vec3(side * 1.1, -.8 + max(sin(a), 0.) * .3, z * 1.5 + cos(a) * .2);
            vec3 knee = (hip + foot) * .5 + vec3(side * .1, .55, 0);
            body = smin(body, min(capsule(l, hip, knee, .07), capsule(l, knee, foot, .05)), .08);
        }
    } else if (kind == 3) {
        // brute: an armored ball with four heavy horns and a belt
        body = length(l) - .55;
        body = smin(body, capsule(vec3(abs(l.xy), l.z), vec3(.3, .3, -.1), vec3(.75, .75, -.5), .12), .15);
        body = min(body, length(vec2(length(l.xy) - .58, l.z + .05)) - .07);
    } else if (kind == 1) {
        // spitter: a ball with a ring of eight spikes turning around the eye
        body = length(l) - .5;
        float a = mod(atan(l.y, l.x) + t * .3 + .39, .785) - .39;
        body = smin(body, capsule(vec3(length(l.xy) * vec2(cos(a), sin(a)), l.z), vec3(.3, 0, -.1), vec3(1.1, 0, -.4), .05), .15);
    } else {
        // wraith: tentacles trailing behind
        body = length(l * vec3(1, 1.15, .8)) - .5;
        for (int k = 0; k < 5; k++) {
            float a = float(k) * 1.257 + sin(t * .3) * .3;
            vec3 tip = vec3(cos(a) * .7, sin(a) * .7, -1.3) + .2 * vec3(sin(t + float(k) * 2.), cos(t * 1.3 + float(k)), 0);
            body = smin(body, capsule(l, vec3(cos(a), sin(a), 0) * .25, tip, .07), .2);
        }
    }
    // an eye in a socket
    body = -smin(-body, length(l - vec3(0, 0, .55)) - .27, .05);
    float eyeD = length(l - vec3(0, 0, .3)) - .2;
    return vec2(min(body, eyeD) * s * .8, eyeD < body ? 30. + float(i) : 10. + float(i));
}

float gNeon; // the distance to the neon tubes, set by map()

bool withNeon = true;
vec2 map(vec3 p)
{
    vec2 h = vec2(level(p), M_LEVEL);
    gNeon = !withNeon ? 1e9 : neon(p);
    if (gNeon < h.x)
        h = vec2(gNeon, M_NEON);
    for (int i = 0; i < MAX_ENEMIES; i++) {
        if ((seenX >> i & 1u) == 0u)
            continue;
        float d = length(p - enemy[i].xyz) - 2.4 * enemyScale(enemyKind[i]);
        if (d > .3)
            h.x = min(h.x, d);
        else {
            vec2 e = enemyShape(p, i);
            if (e.x < h.x)
                h = e;
        }
    }
    // ammo crates: turning diamonds
    for (int k = 0; k < NP; k++)
        if ((seenX >> (16 + k) & 1u) != 0u) {
            vec3 q = p - PICKUPS[k] - vec3(0, .15 * sin(time * 2. + float(k)), 0);
            float a = time * 1.5;
            q.xz = mat2(cos(a), sin(a), -sin(a), cos(a)) * q.xz;
            float d = (dot(abs(q), vec3(1)) - .35) * .577;
            if (d < h.x)
                h = vec2(d, M_CRATE);
        }
    // the gun, in front of the camera
    vec3 g = p - eye;
    vec3 l = vec3(dot(g, camR), dot(g, camU), dot(g, camF)) - gunAt;
    float d = length(l - vec3(0, 0, .03)) - .27;
    if (seenX < 1u << 31) // not on this ray
        return h;
    if (d > .1)
        h.x = min(h.x, d);
    else {
        // a barrel with three glowing bands, on a box
        float z = l.z - .04;
        z -= clamp(floor(z / .07 + .5), -1., 1.) * .07;
        d = min(length(vec3(l.xy, l.z - clamp(l.z, -.12, .22))) - .03 + step(abs(z), .012) * .004,
                length(max(abs(l - vec3(0, -.035, -.1)) - vec3(.03, .04, .1), 0.)) - .012);
        if (d < h.x)
            h = vec2(d, abs(z) < .012 && length(l.xy) < .04 ? M_COIL : M_GUN);
        // the rocket launcher under the barrel, its tip glows when loaded
        d = length(vec3(l.xy - vec2(0, -.065), l.z - clamp(l.z, -.08, .15))) - .022;
        if (d < h.x)
            h = vec2(d, l.z > .13 ? M_TUBE : M_GUN);
    }
    return h;
}

vec3 normal(vec3 p, float m)
{
    vec2 e = vec2(1, -1) * 1e-3;
    withNeon = m == M_NEON;
    vec3 n = normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x +
                       e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
    withNeon = true;
    return n;
}

float fogDensity;
vec3 glowSum; // neon glow in the fog along the ray

// Returns the distance along the ray and the material (-1: nothing).
int maxSteps; // fewer for reflections
vec2 march(vec3 ro, vec3 rd)
{
    float t = 0.;
    for (int i = 0; i < maxSteps; i++) {
        vec2 h = map(ro + rd * t);
        glowSum += neonCol * exp(-gNeon * 3. - t * fogDensity) * min(h.x, 1.);
        if (h.x < 2e-4 * (1. + t * 4.))
            return vec2(t, h.y);
        t += h.x;
        if (t > 100.)
            break;
    }
    return vec2(t, -1);
}

bool hitBox(vec3 ro, vec3 rd, vec3 lo, vec3 hi)
{
    vec3 a = (lo - ro) / rd, b = (hi - ro) / rd;
    vec3 n = min(a, b), f = max(a, b);
    return max(max(n.x, n.y), max(n.z, 0.)) <= min(min(f.x, f.y), f.z);
}

bool hitSphere(vec3 ro, vec3 rd, vec3 c, float r)
{
    vec3 o = c - ro;
    float b = dot(o, rd);
    return dot(o, o) - b * b < r * r && b > -r;
}

// What a ray can meet: the level's parts (see world.glsl), and the rest.
void cull(vec3 ro, vec3 rd)
{
    seenIn = seenSo = seenX = 0u;
    for (int i = 0; i < NI; i++)
        if (hitBox(ro, rd, IN_LO[i] - 1., IN_HI[i] + 1.))
            seenIn |= 1u << i;
    for (int i = 0; i < NS; i++)
        if (hitBox(ro, rd, SO_LO[i] - .5, SO_HI[i] + .5))
            seenSo |= 1u << i;
    for (int i = 0; i < NST; i++)
        if (hitBox(ro, rd, ST_LO[i] - .5, ST_HI[i] + .5))
            seenSo |= 1u << (NS + i);
    for (int i = 0; i < MAX_ENEMIES; i++)
        if (enemy[i].w != 0. && hitSphere(ro, rd, enemy[i].xyz, 2.7 * enemyScale(enemyKind[i])))
            seenX |= 1u << i;
    if (hitSphere(ro, rd, eye + mat3(camR, camU, camF) * (gunAt + vec3(0, 0, .03)), .3))
        seenX |= 1u << 31;
    for (int k = 0; k < NP; k++)
        if ((taken >> k & 1) == 0 && hitSphere(ro, rd, PICKUPS[k], .7))
            seenX |= 1u << (16 + k);
}

float occlusion(vec3 p, vec3 n)
{
    float o = 0.;
    withNeon = false;
    for (int i = 1; i < 3; i++) {
        float d = float(i) * .3;
        o += (d - map(p + n * d).x) / d;
    }
    withNeon = true;
    return clamp(1. - o * .3, 0., 1.);
}

// Shafts of light falling from the ceiling: x, z, bottom, top.
#define NB 6
const vec4 BEAMS[NB] = vec4[](vec4(10, 0, 0, 9), vec4(22, 0, 0, 9), vec4(34, 0, 0, 9),
                              vec4(64, 0, -7, 10), vec4(72, 0, -7, 10), vec4(-2, 24, -3, 10));
#define BEAM_R 1.2
#define BEAM_COL vec3(.45, .6, 1)

// How much p is in a shaft (0 to 1).
float inBeam(vec3 p)
{
    float k = 0.;
    for (int i = 0; i < NB; i++) {
        vec4 b = BEAMS[i];
        k = max(k, smoothstep(BEAM_R, BEAM_R * .5, length(p.xz - b.xy)) * step(b.z - .1, p.y) * step(p.y, b.w + .1));
    }
    return k;
}

// The shafts' light in the fog along the ray, up to tMax: the length of the
// ray inside each, softer at the edges.
vec3 beams(vec3 ro, vec3 rd, float tMax)
{
    float c = 0.;
    for (int i = 0; i < NB; i++) {
        vec4 b = BEAMS[i];
        vec2 o = ro.xz - b.xy, d = rd.xz;
        float dd = dot(d, d) + 1e-6, tc = -dot(o, d) / dd;
        float h2 = dot(o + d * tc, o + d * tc), r2 = BEAM_R * BEAM_R;
        float hw = sqrt(max(r2 - h2, 0.) / dd);
        float ta = (b.z - ro.y) / rd.y, tb = (b.w - ro.y) / rd.y;
        float t0 = max(max(tc - hw, 0.), min(ta, tb)), t1 = min(min(tc + hw, tMax), max(ta, tb));
        c += max(t1 - t0, 0.) * max(1. - h2 / r2, 0.) * exp(-t0 * fogDensity);
    }
    return BEAM_COL * c * _TV(beam, .04);
}

// Surface at p (material m): returns the albedo, sets rough, metal and glow.
vec3 n, v, f0, glow;
float rough, metal;
vec3 material(vec3 p, float m)
{
    rough = .5;
    metal = 0.;
    glow = vec3(0);
    if (m >= 30.) {
        glow = RED * (6. + 10. * enemyInfo[int(m - 30.)].y);
        return vec3(0);
    }
    if (m >= 10.) {
        // a black shell with glowing veins, white when hit
        int i = int(m - 10.);
        vec3 q = p - enemy[i].xyz;
        float veins = abs(fbm(q.xy * 6. + q.z * 4. + time) - .5);
        glow = RED * smoothstep(.06, 0., veins) * 3. + vec3(1.5) * enemyInfo[i].y + vec3(10) * max(-enemy[i].w, 0.);
        rough = .15;
        return vec3(.01);
    }
    if (m == M_NEON) {
        neonAt(p);
        glow = neonCol * 6.;
        return vec3(0);
    }
    if (m == M_COIL) {
        // one band lit per power level of the gun
        vec3 g = p - eye;
        float band = floor((dot(g, camF) - gunAt.z - .04) / .07 + .5) + 1.;
        glow = GOLD * (light * 1.5 + kick * 3.) * (band < float(min(lap, 3)) ? 1. : .08);
        return vec3(0);
    }
    if (m == M_CRATE) {
        glow = ORANGE * (2.5 + 1.5 * sin(time * 6.));
        return vec3(0);
    }
    if (m == M_TUBE) {
        glow = ORANGE * (rockets > 0 ? 3. : .05);
        return vec3(0);
    }
    if (m == M_GUN) {
        metal = 1.;
        rough = .4;
        return vec3(.12);
    }
    level(p);
    int r = tRoom;
    if (n.y > .7) {
        if (p.y < -6.5) {
            // the cistern's water: dark, a mirror with ripples
            n = normalize(n + vec3(noise(p.xz * 3. + time) - .5, 0, noise(p.xz * 3. - time + 9.) - .5) * .06);
            rough = .02;
            return vec3(.005);
        }
        if (r == 2 || r == 6 || r == 12) {
            // stairs and ramps: metal grating
            vec2 g = abs(fract(p.xz * 4.) - .5);
            metal = .5;
            rough = .4;
            return vec3(.07, .065, .06) * (.5 + .5 * fbm(p.xz * 5.)) * (1. - .7 * step(.3, min(g.x, g.y)));
        }
        // the route: dashes of light on the floor, moving the way to run
        float at = trackPos(p);
        glow = vec3(.4, .6, 1) * .35 * smoothstep(.08, .04, trackDist) * step(fract((at - time * 5.) * .4), .3);
        // stone tiles, worn, with puddles (more in the cistern)
        vec2 g = abs(fract(p.xz / 1.5) - .5);
        float wet = smoothstep(.55, .7, fbm(p.xz * .3) + .1 * fbm(p.xz * 3.) + (r == 3 ? .15 : 0.));
        rough = mix(.6, .03, wet);
        return vec3(.055, .05, .045) * (.6 + .4 * hash(floor(p.xz / 1.5))) * (.7 + .5 * fbm(p.xz * 2.))
             * (1. - .6 * step(.48, max(g.x, g.y))) * (1. - .5 * wet);
    }
    if (n.y < -.7) {
        // where a shaft starts: a grate letting the light in
        glow = BEAM_COL * inBeam(p - vec3(0, .2, 0)) * step(.5, fract(p.x * 3.)) * 3.;
        return vec3(.02);
    }
    float w = p.x + p.z;
    if (r == 6) {
        // the ramp room: metal panels
        metal = .4;
        rough = .35;
        vec2 e = abs(fract(vec2(w, p.y) * vec2(.5, .5)) - .5);
        return vec3(.06, .065, .07) * (.6 + .6 * fbm(vec2(w, p.y) * 3.)) * (1. - .6 * step(.48, max(e.x, e.y)));
    }
    // stone blocks: rows of 0.5 m, staggered
    float y = p.y * 2., row = floor(y);
    vec2 b = vec2(w + .5 * mod(row, 2.), y), e = abs(fract(b) - .5);
    rough = .7;
    return vec3(.07, .065, .06) * (.6 + .5 * hash(vec2(floor(b.x), row))) * (.6 + .6 * fbm(vec2(w, p.y) * 4.))
         * (1. - .7 * step(.46, max(e.x, e.y * .9 + .05)));
}

vec3 shade(vec3 p, vec3 lp, vec3 c)
{
    vec3 l = lp - p;
    float d2 = dot(l, l);
    l *= inversesqrt(d2);
    vec3 h = normalize(l + v);
    float k = 2. / max(rough * rough, .002);
    float spec = (k + 8.) / 25. * pow(max(dot(n, h), 0.), k);
    return c * max(dot(n, l), 0.) * spec * f0 / (d2 + .3);
}

// The point lights seen along the ray, up to tMax: light scattered by the
// fog, and a bright core (bolts, shots, released light, sparks).
vec3 scattered(vec3 ro, vec3 rd, float tMax)
{
    vec3 c = vec3(0);
    for (int i = 0; i < lightCount; i++) {
        vec3 color = lightCol[i].rgb, o = lightPos[i].xyz - ro;
        float b = dot(o, rd), h2 = max(dot(o, o) - b * b, 0.), h = sqrt(h2 + .3);
        c += color * ((atan((tMax - b) / h) + atan(b / h)) / h * _TV(scatter, .002) * exp(-b * fogDensity) * (i < 2 ? .1 : 1.) // less for the lantern and muzzle
                      + step(2., float(i)) * step(0., b) * step(b, tMax) * _TV(core, .001) / (h2 + 1e-4));
    }
    return c;
}

// The rockets' explosions: growing balls of fire, along the ray up to tMax.
vec3 fireballs(vec3 ro, vec3 rd, float tMax)
{
    vec3 c = vec3(0);
    for (int k = 0; k < MAX_ROCKETS; k++) {
        float age = blast[k].w / .6, r = .5 + 4. * sqrt(age);
        vec3 o = blast[k].xyz - ro;
        float b = dot(o, rd), h = sqrt(max(dot(o, o) - b * b, 0.));
        if (age > 0. && b - r < tMax)
            c += mix(vec3(2, 1.4, .8), ORANGE, age) * 2. * (1. - age) * (1. - age) * smoothstep(r, r * .2, h)
                 * (.7 + .3 * noise(rd.xy * 30. + time * 5.));
    }
    return c;
}

float depth0;
vec3 render(vec3 ro, vec3 rd)
{
    const vec3 fogColor = vec3(.004, .005, .012);
    vec3 col = vec3(0), weight = vec3(1);
    for (int bounce = 0; bounce < 2; bounce++) {
        glowSum = vec3(0);
        cull(ro, rd);
        maxSteps = bounce > 0 ? 60 : 200;
        vec2 h = march(ro, rd);
        vec3 p = ro + rd * h.x, c = fogColor;
        if (bounce == 0) depth0 = min(h.x, 100.);
        if (h.y >= 0.) {
            n = normal(p, h.y);
            v = -rd;
            vec3 albedo = material(p, h.y);
            f0 = mix(vec3(.04), albedo, metal);
            albedo *= 1. - metal;
            float ao = occlusion(p, n);
            // neon: by the distance to the tubes, a bit off the surface (so
            // that surfaces facing away get less)
            float d = neonAt(p + n * .3);
            c = albedo * (neonCol * _TV(neonLight, 2.) / (1. + d * d * 3.) + vec3(.01, .012, .02)
                          + BEAM_COL * 1.5 * inBeam(p) * max(n.y, 0.)) * ao + glow;
            for (int i = 0; i < lightCount; i++) {
                vec3 color = lightCol[i].rgb, l = lightPos[i].xyz - p;
                c += albedo * color * max(dot(n, normalize(l)), 0.) / (dot(l, l) + .3) + shade(p, lightPos[i].xyz, color);
            }
        }
        float fog = exp(-h.x * fogDensity);
        col += weight * (mix(fogColor, c, fog) + glowSum * _TV(neonGlow, .05)
                         + scattered(ro, rd, h.x) + beams(ro, rd, h.x) + fireballs(ro, rd, h.x));
        if (h.y < 0.)
            break;
        weight *= (f0 + (1. - f0) * pow(1. - max(dot(n, v), 0.), 5.)) * (1. - rough) * fog;
        if (rough > .08 || max(weight.x, max(weight.y, weight.z)) < .02)
            break;
        ro = p + n * .01;
        vec2 f = gl_FragCoord.xy;
        rd = normalize(reflect(rd, n) + rough * .3 * (vec3(hash(f), hash(f + 1.), hash(f + 2.)) - .5));
    }
    return col;
}

// Ink: the image inverted on paper; outlines where the depth changes, bright
// lights as ink blots, hatching in the midtones, red ink for red.
vec3 ink(vec3 col, vec2 tc)
{
    vec2 px = 1. / vec2(textureSize(tex, 0));
    float d = texture(tex, tc).a;
    float e = abs(texture(tex, tc - vec2(px.x, 0)).a + texture(tex, tc + vec2(px.x, 0)).a - 2. * d)
            + abs(texture(tex, tc - vec2(0, px.y)).a + texture(tex, tc + vec2(0, px.y)).a - 2. * d);
    float line = smoothstep(.03, .12, e / d) * smoothstep(60., 20., d);
    float luma = dot(col, vec3(.3, .6, .1));
    vec2 f = gl_FragCoord.xy;
    float hatch = smoothstep(.04, .14, luma) * step(.6, fract((f.x + f.y) / 7.)) * .6
                + smoothstep(.15, .3, luma) * step(.6, fract((f.x - f.y) / 7.)) * .6;
    float amount = min(max(max(line, smoothstep(.3, .8, luma)), hatch), 1.);
    vec3 paper = vec3(.93, .89, .8) * (.9 + .1 * fbm(f * .02)) * (.95 + .05 * noise(f * .5));
    vec3 inkCol = col.r > max(col.g, col.b) * 1.8 && col.r > .15 ? vec3(.75, .08, .05) : vec3(.07, .06, .07);
    return mix(paper, inkCol, amount * (.85 + .15 * noise(f * .3)));
}

void main()
{
    vec2 texCoord = gl_FragCoord.xy / iFrame.xy;
    vec2 uv = (gl_FragCoord.xy * 2. - iFrame.xy) / iFrame.y;

    if (iFrame.w < .5) {
        detail = 1.;
        // camera: head bob while running, shake
        float b = sin(bob * 2.8);
        eye = pos + vec3(0, EYE + b * .04, 0) + shake * shake * .05 * vec3(sin(time * 71.), sin(time * 83.), sin(time * 61.));
        camF = vec3(cos(yaw) * cos(pitch), sin(pitch), sin(yaw) * cos(pitch));
        camR = normalize(cross(camF, vec3(0, 1, 0)));
        camU = cross(camR, camF);
        gunAt = vec3(.22 + sin(bob * 1.4) * .01, -.21 + b * .01, .36 - kick * .06);
        fogDensity = _TV(fog, .03) + (1. - light) * .08;

        vec3 rd = normalize(uv.x * camR + uv.y * camU + (_TV(focal, 1.6) - kick * .03) * camF);
        // A NaN would spread through the bloom.
        fragColor.rgb = clamp(render(eye, rd), 0., 50.);
        fragColor.a = depth0;
        return;
    }

    // Final image. Bloom: the mipmaps of the scene.
    vec2 tc = texCoord * iFrame.z, ca = (texCoord - .5) * .002; // chromatic aberration, toward the edges
    vec3 col = vec3(texture(tex, tc + ca).r, texture(tex, tc).g, texture(tex, tc - ca).b);
    vec3 bloom = vec3(0);
    for (int i = 2; i < 8; i++)
        bloom += max(textureLod(tex, tc, float(i)).rgb - .4, 0.);
    col += bloom * _TV(bloomAmount, .1);
    col = col * (2.51 * col + .03) / (col * (2.43 * col + .59) + .14);
    // grading: cold shadows, a little more saturation
    float luma = dot(col, vec3(.3, .6, .1));
    col = mix(vec3(luma), col, 1.2) + vec3(-.005, 0, .015) * (1. - luma);
    col = pow(clamp(col, 0., 1.), vec3(1. / 2.2));
    // the vignette closes in when the light is low; red when hurt
    float edge = length(texCoord - .5);
    col *= max(1. - pow(edge, 1.5) * (1.2 + (1. - light) * 2.), 0.);
    col = mix(col, vec3(col.r + .3, 0, 0), hurt * smoothstep(.2, .7, edge));
    col += lapFlash * GOLD * .3;
    col *= max(1. - dead * .5, 0.);
    col += (hash(gl_FragCoord.xy + fract(time) * 100.) - .5) * .02; // grain

    vec3 cold = vec3(.5, .8, 1);
    if (dead > 1.) {
        // the results: laps (gold when it's a record), best lap, kills
        float k = min(dead - 1., 1.);
        bool best = lap - 1 >= record && lap > 1;
        digits7(col, (best ? GOLD * (1.5 + sin(time * 8.)) : cold) * k, uv * 7. - vec2(.6, 1.6), 7., lap - 1, 1);
        col += cold * k * smoothstep(.01, 0., abs(length(uv - vec2(-.25, .23)) - .06) - .008); // a ring: laps
        int cs = int(bestLap * 100.);
        digits7(col, cold * k, uv * 18. - vec2(1.5, -2.), 18., cs % 100, 2);
        digits7(col, cold * k, uv * 18. - vec2(-1.5, -2.), 18., cs / 100, 1);
        col += cold * k * smoothstep(.06, .02, length(uv * 18. - vec2(-.4, -3.2)));
        // a clock: the best lap
        vec2 q = uv - vec2(-.3, -.11);
        col += cold * k * smoothstep(.01, 0., min(abs(length(q) - .04) - .006, max(abs(q.x) - .004, abs(q.y - .015) - .02)));
        digits7(col, RED * 2. * k, uv * 18. - vec2(1.5, -6.), 18., kills, 1);
        col += RED * 2. * k * smoothstep(.01, 0., length(uv - vec2(-.3, -.33)) - .03); // an eye: kills
        fragColor = vec4(ink(col, tc), 1);
        return;
    }
    // HUD: crosshair (red on hits), lap time, best lap, lap, light
    vec2 c = abs(uv);
    float aim = max(step(c.x + c.y, .004), step(abs(max(c.x, c.y) - .03 - hitMark * .01), .002) * step(min(c.x, c.y), .002));
    col = mix(col, mix(vec3(.9), RED * 2., hitMark), aim * .8);
    int cs = int(lapTime * 100.);
    digits7(col, cold, uv * 22. - vec2(-.5, 19.5), 22., cs % 100, 2);
    digits7(col, cold, uv * 22. - vec2(-3.5, 19.5), 22., cs / 100, 1);
    col += cold * smoothstep(.06, .02, length(uv * 22. - vec2(-2.4, 18.3)));
    if (bestLap > 0.)
        digits7(col, cold * .5, uv * 40. - vec2(1.5, 33.), 40., int(bestLap * 100.), 3);
    digits7(col, cold, uv * 22. - vec2(-34., 19.5), 22., lap, 1);
    // a new lap: its number, big
    if (lapFlash > 0.)
        digits7(col, GOLD * lapFlash * 2., uv * 6. - vec2(.5, 1.5), 6., lap, 1);
    float bar = step(abs(uv.y + .9), .006) * step(abs(uv.x), .35 * light);
    col += bar * GOLD * (light < .25 ? step(.5, fract(time * 3.)) + .3 : .8);
    // rockets: a diamond and the count, orange when taking a crate
    vec3 orange = ORANGE * (rockets > 0 ? 1.5 : .4);
    col += orange * smoothstep(.003, 0., dot(abs(uv - vec2(.42, -.9)), vec2(1)) - .018);
    digits7(col, orange, uv * 22. - vec2(10.9, -19.8), 22., rockets, 1);
    col += ORANGE * pickupFlash * .15;
    fragColor = vec4(ink(col, tc), 1);
}

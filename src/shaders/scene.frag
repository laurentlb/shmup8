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

// A time in seconds, with hundredths: 12.34
void clock7(inout vec3 o, vec3 c, vec2 q, float scale, float t)
{
    int cs = int(t * 100.);
    digits7(o, c, q, scale, cs % 100, 2);
    digits7(o, c, q + vec2(3, 0), scale, cs / 100, 1);
    o += c * smoothstep(.16, .1, length(q + vec2(2.12, .85)));
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
    // Abyss: bioluminescent, teal to green, slowly pulsing
    neonCol = mix(vec3(0, .9, .7), vec3(.3, 1, .3), noise(vec2(p.x + p.z, p.y) * .2)) * (.7 + .3 * sin(time * 2. + p.x * .5));
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
    vec3 f = normalize((eye - e) * vec3(1, kind == 2 ? 0. : .3, 1)); // skitters stay level, drones almost
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
    } else if (kind == 1 || kind == 4) {
        // gunship drone: an armored hull, a cannon under the nose, ducted
        // fans on struts (two; four and two cannons for the warden)
        vec3 r = abs(l - vec3(0, 0, -.05)) - vec3(.36, .22, .48);
        body = length(max(r, 0.)) + min(max(r.x, max(r.y, r.z)), 0.) - .12;
        body = max(body, (abs(l.x) + l.y) * .707 - .38); // beveled top
        vec3 c = vec3(kind == 4 ? abs(l.x) - .22 : l.x, l.y + .34, l.z);
        body = min(body, capsule(c, vec3(0, 0, -.1), vec3(0, 0, .72), .07));
        vec3 q = vec3(abs(l.x), l.y - .05, kind == 4 ? abs(l.z) : l.z) - vec3(.9, 0, kind == 4 ? .5 : 0.);
        body = min(body, capsule(vec3(abs(l.x), l.y - .05, q.z), vec3(.3, 0, 0), vec3(.9, 0, 0), .05));
        body = min(body, max(abs(length(q.xz) - .3) - .04, abs(q.y) - .1)); // duct
        float a = time * 25. + float(i);
        q.xz *= mat2(cos(a), sin(a), -sin(a), cos(a));
        body = min(body, length(max(abs(q) - vec3(.27, .01, .035), 0.)) - .005); // blades
    } else {
        // hunter drone: a flat pod on four arms with ducted rotors
        body = (length(l / vec3(.5, .3, .6)) - 1.) * .3;
        vec3 q = vec3(abs(l.x), l.y, abs(l.z));
        body = smin(body, capsule(q, vec3(.15, 0, .1), vec3(.7, .08, .5), .045), .08);
        q -= vec3(.7, .08, .5);
        body = min(body, max(abs(length(q.xz) - .26) - .035, abs(q.y) - .07)); // duct
        float a = time * 30. + float(i);
        q.xz *= mat2(cos(a), sin(a), -sin(a), cos(a));
        body = min(body, length(max(abs(q) - vec3(.24, .008, .03), 0.)) - .004); // blades
    }
    // an eye in a socket
    // (drones: a smaller lens)
    float lens = kind == 2 || kind == 3 ? 1. : .6;
    body = -smin(-body, length(l - vec3(0, 0, .55)) - .27 * lens, .05);
    float eyeD = length(l - vec3(0, 0, .55 - .25 * lens)) - .2 * lens;
    return vec2(min(body, eyeD) * s * .8, eyeD < body ? 30. + float(i) : 10. + float(i));
}

float gNeon; // the distance to the neon tubes, set by map()

// p in the gun's frame (x right, y up, z along the barrel), turned a little
// toward the crosshair so that its side shows
vec3 gunLocal(vec3 p)
{
    vec3 g = p - eye, l = vec3(dot(g, camR), dot(g, camU), dot(g, camF)) - gunAt;
    return vec3(l.x * .985 + l.z * .17, l.y, l.z * .985 - l.x * .17);
}

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
    vec3 l = gunLocal(p);
    float d = length(l - vec3(0, 0, .03)) - .27;
    if (seenX < 1u << 31) // not on this ray
        return h;
    if (d > .1)
        h.x = min(h.x, d);
    else {
        // a light rifle: a beveled receiver, a hexagonal shroud with vents
        // showing a glowing core, a muzzle ring, a rail with a sight
        vec2 a = abs(l.xy);
        vec3 r = abs(l - vec3(0, -.04, -.07)) - vec3(.03, .036, .09);
        d = max(length(max(r, 0.)) + min(max(r.x, max(r.y, r.z)), 0.) - .006, (a.x + l.y) * .707 - .012); // receiver
        float hex = max(a.x * .866 + a.y * .5, a.y) - .03;
        float shroud = max(hex, abs(l.z - .09) - .11);
        shroud = max(shroud, -max(abs(mod(l.z, .036) - .018) - .007, max(a.y - .011, abs(l.z - .09) - .075))); // vents
        d = min(d, shroud);
        d = min(d, max(max(length(l.xy) - .037, .015 - length(l.xy)), abs(l.z - .215) - .016)); // muzzle
        d = min(d, length(max(abs(l - vec3(0, .035, -.04)) - vec3(.007, .008, .08), 0.)) - .002); // rail
        d = min(d, length(max(abs(l - vec3(0, .048, -.1)) - vec3(.012, .01, .012), 0.)) - .002); // sight
        float core = max(length(l.xy) - .016, abs(l.z - .09) - .1);
        if (d < h.x)
            h = vec2(d, M_GUN);
        if (core < h.x)
            h = vec2(core, M_COIL);
        // the rocket launcher under the barrel, its tip glows when loaded
        d = length(vec3(l.xy - vec2(0, -.062), l.z - clamp(l.z, -.02, .14))) - .02;
        d = min(d, max(length(l.xy - vec2(0, -.062)) - .025, abs(abs(l.z - .06) - .06) - .006)); // two clamps
        if (d < h.x)
            h = vec2(d, l.z > .13 && length(l.xy - vec2(0, -.062)) < .021 ? M_TUBE : M_GUN);
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
    if (started > 0 && hitSphere(ro, rd, eye + mat3(camR, camU, camF) * (gunAt + vec3(0, 0, .03)), .3))
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
#define BEAM_COL vec3(.4, .9, 1)

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
        glow = vec3(1, .04, .015) * (3. + 4. * enemyInfo[int(m - 30.)].y);
        return vec3(0);
    }
    if (m >= 10.) {
        // a black shell with glowing veins, white when hit
        int i = int(m - 10.);
        vec3 q = p - enemy[i].xyz;
        int kind = enemyKind[i];
        float sc = enemyScale(kind);
        float flash = enemyInfo[i].y;
        // hit: a hot rim; bursting: hot cracks, fading
        float burst = max(-enemy[i].w, 0.) / .3;
        glow = vec3(1, .5, .3) * flash * flash * pow(1. - max(dot(n, v), 0.), 2.) * 2.
             + vec3(4, 1.2, .3) * burst * (.4 + 3. * smoothstep(.06, 0., abs(noise(q.xz * 12. / sc + q.y * 7.) - .5)));
        if (kind == 2 || kind == 3) {
            // creatures: glowing veins
            float veins = abs(fbm(q.xy * 6. + q.z * 4. + time) - .5);
            glow += RED * smoothstep(.06, 0., veins) * 3.;
            rough = .15;
            return vec3(.01);
        }
        // drones: worn dark metal, a red light strip around the hull
        rough = .3 + .3 * noise(q.xz * 20. / sc);
        glow += RED * 3. * smoothstep(.025, .01, abs(q.y / sc + .03)) * step(length(q.xz), .55 * sc);
        return vec3(.012, .012, .014) * (.6 + .8 * noise(q.xz * 20. / sc));
    }
    if (m == M_NEON) {
        neonAt(p);
        glow = neonCol * 8. * smoothstep(.3, .1, length(fract(vec2(p.x + p.z, p.y) * 4.) - .5));
        return vec3(0);
    }
    if (m == M_COIL) {
        // the core, in three parts: one lit per power level of the gun
        float band = floor((gunLocal(p).z + .01) / .067);
        glow = GOLD * (light * 1.5 + kick * 3.) * (band < float(min(lap, 3)) ? 1. : .08);
        return vec3(0);
    }
    if (m == M_CRATE) {
        glow = ORANGE * (2.5 + 1.5 * sin(time * 6.));
        return vec3(0);
    }
    if (m == M_TUBE) {
        glow = ORANGE * (rockets > 0 ? 1.5 : .05);
        return vec3(0);
    }
    if (m == M_GUN) {
        // dark gunmetal, worn; a brass muzzle
        vec3 l = gunLocal(p);
        metal = 1.;
        rough = .3 + .2 * noise(l.zy * 150.);
        vec3 c = l.z > .198 ? vec3(.6, .42, .2) : vec3(.2, .21, .23) * (.7 + .5 * noise(l.zx * 90.));
        // a soft light from above and a cold rim, so that the gun reads in the dark
        glow = c * (.06 * max(dot(n, normalize(camU - camR * .5 - camF * .3)), 0.)
                    + vec3(.1, .3, .3) * pow(1. - max(dot(n, v), 0.), 3.));
        return c;
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
        glow = vec3(.2, 1, .8) * .3 * smoothstep(.08, .04, trackDist) * step(fract((at - time * 5.) * .4), .3);
        // polished black marble slabs with pale veins: a dark mirror
        vec2 g = abs(fract(p.xz / 1.5) - .5);
        float vein = smoothstep(.03, 0., abs(fbm(p.xz * .7 + fbm(p.xz * 2.) * 1.5) - .5));
        rough = .03;
        return mix(vec3(.008, .01, .01), vec3(.3, .33, .3), vein * .5) * (1. - .8 * step(.49, max(g.x, g.y)));
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
    return mix(vec3(.06, .08, .07), vec3(.02, .1, .06), fbm(vec2(w, p.y) * 1.5)) * (.6 + .5 * hash(vec2(floor(b.x), row))) * (.6 + .6 * fbm(vec2(w, p.y) * 4.))
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
        float k = lightPos[i].w; // see addLight
        c += color * ((atan((tMax - b) / h) + atan(b / h)) / h * _TV(scatter, .002) * exp(-b * fogDensity) * (k < 0. ? 1. : .1 + .9 * k)
                      + max(k, 0.) * step(0., b) * step(b, tMax) * _TV(core, .001) / (h2 + 1e-4));
    }
    return c;
}

// The rockets' explosions: growing balls of fire, along the ray up to tMax.
vec3 fireballs(vec3 ro, vec3 rd, float tMax)
{
    vec3 c = vec3(0);
    for (int k = 0; k < MAX_ROCKETS; k++) {
        float age = blast[k].w / .6, r = .5 + 3. * sqrt(age);
        vec3 o = blast[k].xyz - ro;
        float b = dot(o, rd), h = sqrt(max(dot(o, o) - b * b, 0.));
        if (age > 0. && b - r < tMax)
            // (thinner from inside: it must not hide the fight)
            c += mix(vec3(2, 1.4, .8), ORANGE, age) * 1.3 * (1. - age) * (1. - age) * smoothstep(r, r * .2, h) * min(length(o) / r, 1.)
                 * (.7 + .3 * noise(rd.xy * 30. + time * 5.));
    }
    return c;
}

// The enemies' shots: tracers, a hot head and a fading tail.
vec3 tracers(vec3 ro, vec3 rd, float tMax)
{
    vec3 c = vec3(0);
    for (int k = 0; k < MAX_SHOTS; k++) {
        vec3 a = shot[k].xyz - ro, d = -shotVel[k].xyz * .07;
        float rdd = dot(rd, d), s = clamp((dot(rd, a) * rdd - dot(d, a)) / max(dot(d, d) - rdd * rdd, 1e-5), 0., 1.);
        vec3 q = a + d * s;
        float t = dot(q, rd);
        q -= rd * t;
        if (shot[k].w > 0. && t > 0. && t < tMax)
            c += FIRE * (1. - s) * .002 / (dot(q, q) + 3e-4);
    }
    return c;
}

// Light focused by waves above: bright moving lines.
float caustics(vec3 p)
{
    vec2 q = p.xz * .7 + p.y * .2;
    float c = 0.;
    for (int i = 0; i < 3; i++) {
        q += vec2(sin(q.y * 1.3 + time * .7), cos(q.x * 1.1 - time * .6)) * .5;
        c += abs(sin(q.x + q.y));
    }
    return pow(1. - c / 3., 4.) * 10.;
}

vec3 render(vec3 ro, vec3 rd)
{
    vec3 fogColor = vec3(0, .025, .03) * (.2 + .8 * light); // darker as the light runs out
    vec3 col = vec3(0), weight = vec3(1);
    for (int bounce = 0; bounce < 2; bounce++) {
        glowSum = vec3(0);
        cull(ro, rd);
        maxSteps = bounce > 0 ? 48 : 200;
        vec2 h = march(ro, rd);
        vec3 p = ro + rd * h.x, c = fogColor;
        if (h.y >= 0.) {
            n = normal(p, h.y);
            v = -rd;
            vec3 albedo = material(p, h.y);
            f0 = mix(vec3(.04), albedo, metal);
            albedo *= 1. - metal;
            float ao = bounce > 0 ? 1. : occlusion(p, n); // (reflections: cheaper)
            // neon: by the distance to the tubes, a bit off the surface (so
            // that surfaces facing away get less)
            float d = neonAt(p + n * .3);
            c = albedo * (neonCol * _TV(neonLight, 2.) / (1. + d * d * 3.) + vec3(.01, .012, .02)
                          + BEAM_COL * 1.5 * inBeam(p) * max(n.y, 0.)
                          + vec3(.5, 1.2, 1.3) * caustics(p) * (.3 + .7 * max(n.y, 0.)) * (.3 + .7 * light)) * ao + glow;
            for (int i = 0; i < lightCount; i++) {
                vec3 color = lightCol[i].rgb, l = lightPos[i].xyz - p;
                c += albedo * color * max(dot(n, normalize(l)), 0.) / (dot(l, l) + .3) + (bounce > 0 ? vec3(0) : shade(p, lightPos[i].xyz, color));
            }
        }
        float fog = exp(-h.x * fogDensity);
        c *= exp(-h.x * vec3(.07, .02, .015));
        col += weight * (mix(fogColor, c, fog) + glowSum * _TV(neonGlow, .05)
                         + scattered(ro, rd, h.x) + beams(ro, rd, h.x) + fireballs(ro, rd, h.x) + tracers(ro, rd, h.x));
        if (h.y < 0.)
            break;
        weight *= (f0 + (1. - f0) * pow(1. - max(dot(n, v), 0.), 5.)) * (1. - rough) * fog;
        if (rough > .08 || max(weight.x, max(weight.y, weight.z)) < .06)
            break;
        ro = p + n * .01;
        vec2 f = gl_FragCoord.xy;
        rd = normalize(reflect(rd, n) + rough * .3 * (vec3(hash(f), hash(f + 1.), hash(f + 2.)) - .5));
    }
    return col;
}

void main()
{
    vec2 texCoord = gl_FragCoord.xy / iFrame.xy;
    vec2 uv = (gl_FragCoord.xy * 2. - iFrame.xy) / iFrame.y;

    if (iFrame.w < .5) {
        detail = 1.;
        // camera: head bob while running, shake
        float b = sin(bob * 1.2);
        float fall = smoothstep(0., 1., dead); // dead: you fall
        eye = pos + vec3(0, EYE * (1. - .75 * fall) + b * .04, 0) + shake * shake * .05 * vec3(sin(time * 71.), sin(time * 83.), sin(time * 61.));
        camF = vec3(cos(yaw) * cos(pitch), sin(pitch), sin(yaw) * cos(pitch));
        camR = cross(camF, vec3(0, 1, 0));
        camR = normalize(cross(camF, vec3(0, 1, 0) - camR * fall * .6)); // rolling over
        camU = cross(camR, camF);
        gunAt = vec3(.19 + sin(bob * .6) * .012, -.165 - abs(sin(bob * .6)) * .012 - fall * .3, .4 - kick * .05);
        fogDensity = _TV(fog, .05) + (1. - light) * .08;

        vec3 rd = normalize(uv.x * camR + uv.y * camU + (_TV(focal, 1.6) - kick * .03) * camF);
        // A NaN would spread through the bloom.
        fragColor = vec4(clamp(render(eye, rd), 0., 50.), 1);
        return;
    }

    // Final image. Bloom: the mipmaps of the scene.
    vec2 tc = texCoord * iFrame.z, ca = (texCoord - .5) * .003; // chromatic aberration, toward the edges
    vec3 col = vec3(texture(tex, tc + ca).r, texture(tex, tc).g, texture(tex, tc - ca).b);
    vec3 bloom = vec3(0);
    for (int i = 2; i < 8; i++)
        bloom += max(textureLod(tex, tc, float(i)).rgb - .4, 0.);
    col += bloom * _TV(bloomAmount, .45);
    col = col * (2.51 * col + .03) / (col * (2.43 * col + .59) + .14);
    // grading: cold shadows, a little more saturation
    float luma = dot(col, vec3(.3, .6, .1));
    col = mix(vec3(luma), col, 1.15) * vec3(.85, 1., 1.) + vec3(-.01, .01, .02) * (1. - luma);
    col = pow(clamp(col, 0., 1.), vec3(1. / 2.2));
    // the vignette closes in when the light is low; red when hurt
    float edge = length(texCoord - .5);
    float pulse = step(light, .3) * exp((beatAt - time) * 8.); // the heartbeat squeezes the view
    col *= max(1. - pow(edge, 1.5) * (1.2 + (1. - light) * 2. + pulse * 2.), 0.);
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
        // a clock: the best lap
        vec2 q = uv - vec2(-.3, -.11);
        if (bestLap > 0.) {
            clock7(col, cold * k, uv * 18. - vec2(1.5, -2.), 18., bestLap);
            col += cold * k * smoothstep(.01, 0., min(abs(length(q) - .04) - .006, max(abs(q.x) - .004, abs(q.y - .015) - .02)));
        }
        digits7(col, RED * 2. * k, uv * 18. - vec2(1.5, -6.), 18., kills, 1);
        col += RED * 2. * k * smoothstep(.01, 0., length(uv - vec2(-.3, -.33)) - .03); // an eye: kills
        fragColor = vec4(col, 1);
        return;
    }
    if (started == 0) {
        // the title: letterbox, and a slowly pulsing "play" sign
        col *= step(abs(uv.y), .78);
        // the name, in glowing strokes: each letter is a polyline on a 3x3
        // grid (4 bits per point, 15 ends it)
        const uint letters[7] = uint[](0xF015760u, 0x2435860u, 0xF02860u, 0xF82406u, 0xF8260u, 0x2034368u, 0xF015760u);
        float d = 9.;
        for (int i = 0; i < 7; i++)
            for (int j = 0; j < 6; j++) {
                uint a = letters[i] >> 4 * j & 15u, b = letters[i] >> 4 * j + 4 & 15u;
                if (b > 14u) break;
                vec2 pa = vec2(a % 3u, a / 3u), pb = vec2(b % 3u, b / 3u);
                vec2 e = (uv - vec2(-.83 + float(i) * .25, .12)) / .07 - pa, s = pb - pa;
                d = min(d, length(e - s * clamp(dot(e, s) / dot(s, s), 0., 1.)) + max(1. + float(i) * .2 - time, 0.) * 9.); // the letters come one by one
            }
        float on = (.9 + .1 * sin(time * 40.) * step(fract(time * .37), .05)); // a flicker now and then
        col += vec3(.6, 1, 1) * on * (smoothstep(.12, .04, d) * 1.5 + .25 / (1. + d * d * 6.));
        vec2 q = (uv - vec2(0, -.6)) * .5;
        col += cold * (.6 + .4 * sin(time * 3.)) * smoothstep(.004, 0., max(-q.x - .02, abs(q.y) * 1.7 + q.x - .02));
        fragColor = vec4(col, 1);
        return;
    }
    // HUD: crosshair (red on hits), lap time, best lap, lap, light
    vec2 c = abs(uv);
    float aim = max(step(c.x + c.y, .004), step(abs(max(c.x, c.y) - .03 - hitMark * .01), .002) * step(min(c.x, c.y), .002));
    col = mix(col, mix(vec3(.9), RED * 2., hitMark), aim * .8);
    clock7(col, cold, uv * 22. - vec2(-.5, 19.5), 22., lapTime);
    if (bestLap > 0.)
        clock7(col, cold * .5, uv * 40. - vec2(6.8, 34.6), 40., bestLap);
    digits7(col, cold, uv * 22. - vec2(-34., 19.5), 22., lap, 1);
    col += cold * smoothstep(.004, 0., abs(length(uv - vec2(-1.62, .886)) - .022) - .003); // a ring: the lap
    // a new lap: its number, big
    if (lapFlash > 0.)
        digits7(col, GOLD * lapFlash * 2., uv * 6. - vec2(.5, 1.5), 6., lap, 1);
    float bar = step(abs(uv.y + .9), .006) * step(abs(uv.x), .35 * light);
    col += bar * GOLD * (light < .25 ? step(.5, fract(time * 3.)) + .3 : .8);
    // the warden's health, at the top; it drinks your light: the bar pulses red
    for (int i = 0; i < MAX_ENEMIES; i++)
        if (enemyKind[i] == 4 && enemy[i].w > 0.)
            col += bar * RED * max(sin(time * 6.), 0.) * 2.,
            col += RED * 1.5 * step(abs(uv.y - .74), .008) * step(abs(uv.x), .5 * enemy[i].w / float(ENEMY_HEALTH[4] + lap / 2 * healthUp(4)));
    // rockets: a diamond and the count, orange when taking a crate
    vec3 orange = ORANGE * (rockets > 0 ? 1.5 : .4);
    col += orange * smoothstep(.003, 0., dot(abs(uv - vec2(.42, -.9)), vec2(1)) - .018);
    digits7(col, orange, uv * 22. - vec2(10.9, -19.8), 22., rockets, 1);
    col += ORANGE * pickupFlash * .15;
    fragColor = vec4(col, 1);
}

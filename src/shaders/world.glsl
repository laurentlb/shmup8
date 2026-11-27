// The level, shared by the gameplay (collisions, game.comp) and the rendering
// (scene.frag). Units: meters; y is up.
//
// Built like a Quake map: rooms and doorways are boxes carved out of the rock
// (interiors), then solid boxes and stairs are added, and a few details
// (columns, pillars, vaults). The route is a separate path through the rooms:
// laps, where enemies appear, and the capture bot (src/edit/capture.cpp, keep
// it in sync).
//
//   A start hall -> B stairs down -> C cistern (bridge over a flooded pit)
//   -> D ramp up -> balcony above C -> F crypt (pillars, vaults)
//   -> G tower (drop from a ledge) -> H stairs up -> A

#define PI 3.14159
#define R_BODY 0.5  // the player is a sphere
#define EYE 1.      // eye above the sphere's center

// Colors: the player's light is gold, the world cold neon, the enemies red.
#define GOLD vec3(1, .75, .4)
#define RED vec3(1, .05, .12)

// Interiors: low and high corners. Connected interiors must overlap (if they
// only touch, the shared face is an invisible wall).
#define NI 13
const vec3 IN_LO[NI] = vec3[](
    vec3(0, 0, -6),     // 0 A start hall
    vec3(-3, 0, -2.5),  // 1 door H-A
    vec3(39, -4, -2.5), // 2 B stairs down
    vec3(52, -4, -16),  // 3 C cistern
    vec3(60, -7, -8),   // 4 C pit
    vec3(83, -4, -2.5), // 5 door C-D
    vec3(84, -4, -2.5), // 6 D ramp up
    vec3(83, 1, 11),    // 7 door D-balcony
    vec3(24, 1, 8),     // 8 F crypt
    vec3(50, 1, 11),    // 9 door balcony-F
    vec3(19, 1, 26),    // 10 door F-G
    vec3(-8, -3, 16),   // 11 G tower
    vec3(-8, -3, -2.5));// 12 H stairs up
const vec3 IN_HI[NI] = vec3[](
    vec3(40, 9, 6), vec3(1, 4.5, 2.5), vec3(53, 4.5, 2.5), vec3(84, 10, 16), vec3(76, -3.9, 8),
    vec3(86, .5, 2.5), vec3(90, 6.5, 16), vec3(86, 5.5, 16), vec3(52, 7.2, 34), vec3(54, 5, 16),
    vec3(25, 5, 32), vec3(20, 10, 34), vec3(-2, 4.5, 17));

// Solids: low and high corners.
#define NS 9
const vec3 SO_LO[NS] = vec3[](
    vec3(4, 0, -6), vec3(4, 0, 3.5),  // A walkways
    vec3(59, -7.5, -2),               // C bridge
    vec3(52, .5, 11),                 // C balcony
    vec3(52, 1, 10.8),                // C balcony rail
    vec3(84, -4, 11),                 // D landing
    vec3(14, -3, 24),                 // G ledge
    vec3(-8, -3, -2.5),               // H landing
    vec3(39, -4, -2.5));              // B landing
const vec3 SO_HI[NS] = vec3[](
    vec3(36, 1, -3.5), vec3(36, 1, 6), vec3(77, -4, 2), vec3(84, 1, 16), vec3(84, 2, 11.2),
    vec3(90, 1, 16), vec3(20, 1, 34), vec3(-2, 0, 4), vec3(42, 0, 2.5));

// Stairs: low and high corners, rising along 0: +x, 1: -x, 2: +z, 3: -z.
#define NST 5
const vec3 ST_LO[NST] = vec3[](vec3(42, -4, -2.5), vec3(70, -7, 2), vec3(70, -7, -8), vec3(84, -4, 1), vec3(-8, -3, 4));
const vec3 ST_HI[NST] = vec3[](vec3(50, 0, 2.5), vec3(76, -4, 8), vec3(76, -4, -2), vec3(90, 1, 11), vec3(-2, 0, 12));
const int ST_DIR[NST] = int[](1, 0, 0, 2, 3);

// The route: points on the floor (x, y, z), a closed loop.
#define NR 22
const vec3 ROUTE[NR] = vec3[](
    vec3(3, 0, 0), vec3(38, 0, 0), vec3(42, 0, 0), vec3(51, -4, 0), vec3(59, -4, 0), vec3(77, -4, 0),
    vec3(87, -4, 0), vec3(87, 1, 11), vec3(87, 1, 13.5), vec3(53, 1, 13.5), vec3(45, 1, 14), vec3(45, 1, 23),
    vec3(33, 1, 23), vec3(33, 1, 29), vec3(22, 1, 29), vec3(15, 1, 30), vec3(10, -3, 31), vec3(-4, -3, 30),
    vec3(-5, -3, 18), vec3(-5, -3, 12), vec3(-5, 0, 4), vec3(-5, 0, 0));

// What level() looks at, one bit each: interiors (seenIn), solids then stairs
// (seenSo). The scene only keeps what a ray can meet: leaving out an interior
// makes the distance smaller, and a ray never reaches a solid it doesn't cross.
uint seenIn = ~0u, seenSo = ~0u;
float detail; // 1 in the scene: steps on the stairs (ramps for the collisions), water

// Set by level(p): the interior p is most inside of (index, corners), and how
// much (negative).
int tRoom;
float tInside;
vec3 tLo, tHi;

// Signed distance to a box given by its corners.
float box(vec3 p, vec3 lo, vec3 hi)
{
    vec3 q = abs(p - (lo + hi) * .5) - (hi - lo) * .5;
    return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.);
}

float stairs(vec3 p, int i)
{
    vec3 lo = ST_LO[i], hi = ST_HI[i];
    int dir = ST_DIR[i];
    float len = dir < 2 ? hi.x - lo.x : hi.z - lo.z, rise = hi.y - lo.y;
    float u = dir < 2 ? p.x - lo.x : p.z - lo.z;
    if (dir % 2 > 0)
        u = len - u;
    float n = floor(rise / .25), run = len / n, d = 1e9;
    if (detail > 0.) {
        // this step and the next: boxes from the bottom
        float k = clamp(floor(u / run), 0., n - 1.);
        for (int j = 0; j < 2; j++) {
            float s = min(k + float(j), n - 1.), h = (s + 1.) * rise / n * .5;
            vec2 e = abs(vec2(u - (s + .5) * run, p.y - lo.y - h)) - vec2(run * .5, h);
            d = min(d, length(max(e, 0.)) + min(max(e.x, e.y), 0.));
        }
    } else // a ramp through the middle of the steps
        d = (p.y - lo.y - rise * min(u / len + .5 / n, 1.)) * len / length(vec2(len, rise));
    return max(d, box(p, lo, hi));
}

// Distance to the nearest column of a row or grid (cell size s), within the box lo-hi.
float columns(vec3 p, vec2 at, float s, float r, vec3 lo, vec3 hi)
{
    vec2 q = mod(p.xz - at + s * .5, s) - s * .5;
    return max(length(q) - r, box(p, lo, hi));
}

// Distance to the solid parts of the level.
float level(vec3 p)
{
    float inside = 1e9;
    for (int i = 0; i < NI; i++) {
        if ((seenIn >> i & 1u) == 0u)
            continue;
        float d = box(p, IN_LO[i], IN_HI[i]);
        if (i == 8) {
            // the crypt's ceiling: groin vaults between the pillars (from 3 m up)
            vec2 c = mod(p.xz - vec2(0, 2), 6.) - 3.; // from the middle of a cell
            float y = max(p.y - 4., 0.);
            d = max(d, min(length(vec2(c.x, y)), length(vec2(c.y, y))) - 3.);
        }
        if (d < inside) {
            inside = d;
            tRoom = i;
            tLo = IN_LO[i];
            tHi = IN_HI[i];
        }
    }
    tInside = inside;
    float d = -inside;
    for (int i = 0; i < NS; i++)
        if ((seenSo >> i & 1u) != 0u)
            d = min(d, box(p, SO_LO[i], SO_HI[i]));
    for (int i = 0; i < NST; i++)
        if ((seenSo >> (NS + i) & 1u) != 0u)
            d = min(d, stairs(p, i));

    // details, in the rooms the ray can meet
    if ((seenIn & 1u) != 0u) {
        // A: columns along the walkways, beams under the ceiling
        d = min(d, columns(vec3(p.x, p.y, abs(p.z)), vec2(1, 3.8), 6., .4, vec3(5, 0, 0), vec3(35, 9, 6)));
        d = min(d, max(abs(mod(p.x - 1., 6.) - 3.) - .3, box(p, vec3(0, 8.3, -6), vec3(40, 9, 6))));
    }
    if ((seenIn >> 3 & 1u) != 0u) {
        // C: four pillars at the corners of the pit, columns under the balcony
        d = min(d, length(abs(p.xz - vec2(68, 0)) - 8.) - 1.2);
        d = min(d, columns(p, vec2(56, 11.6), 8., .35, vec3(53, -4, 11), vec3(83, 1, 12)));
        // the water, only seen
        if (detail > 0.)
            d = min(d, box(p, vec3(60, -8, -8), vec3(76, -6.6, 8)));
    }
    if ((seenIn >> 8 & 1u) != 0u)
        // F: a grid of pillars, under the vaults
        d = min(d, columns(p, vec2(0, 2), 6., .5 + .15 * step(p.y, 1.4) + .2 * step(3.6, p.y), vec3(27, 1, 11), vec3(51, 8, 35)));
    if ((seenIn >> 11 & 1u) != 0u)
        // G: four posts around the glowing core of a pylon
        d = min(d, length(abs(p.xz - vec2(4, 25)) - 1.) - .35);
    return d;
}

vec3 levelNormal(vec3 p)
{
    vec2 e = vec2(1, -1) * .01;
    return normalize(e.xyy * level(p + e.xyy) + e.yyx * level(p + e.yyx) +
                     e.yxy * level(p + e.yxy) + e.xxx * level(p + e.xxx));
}

float trackLength()
{
    float s = 0.;
    for (int i = 0; i < NR; i++)
        s += length(ROUTE[(i + 1) % NR] - ROUTE[i]);
    return s;
}

// The distance along the route of the point nearest to p.
float trackPos(vec3 p)
{
    float best = 1e9, s = 0., at = 0.;
    for (int i = 0; i < NR; i++) {
        vec3 a = ROUTE[i], ab = ROUTE[(i + 1) % NR] - a;
        float h = clamp(dot(p - a, ab) / dot(ab, ab), 0., 1.);
        float d = length(p - a - ab * h);
        if (d < best) {
            best = d;
            at = s + h * length(ab);
        }
        s += length(ab);
    }
    return at;
}

// The point on the floor at distance s along the route.
vec3 trackPoint(float s)
{
    s = mod(s, trackLength());
    for (int i = 0; i < NR; i++) {
        vec3 a = ROUTE[i], b = ROUTE[(i + 1) % NR];
        float l = length(b - a);
        if (s < l)
            return mix(a, b, s / l);
        s -= l;
    }
    return ROUTE[0];
}

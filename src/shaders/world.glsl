// The level, shared by the gameplay (collisions, game.comp) and the rendering
// (scene.frag). Units: meters; y is up.
//
// The track is a closed loop of corridors through two round arenas. Each point
// of the loop: x, z, and the floor's height there; a corridor's floor goes in a
// straight line from one point to the next (ramps). Keep the points in sync with
// the bot in src/edit/capture.cpp.

#define PI 3.14159
#define NPTS 10
#define CW 3.5      // corridor half width
#define CH 5.5      // corridor height
#define R_BODY 0.5  // the player is a sphere
#define EYE 1.      // eye above the sphere's center

// Colors: the player's light is gold, the world cold neon, the enemies red.
#define GOLD vec3(1, .75, .4)
#define RED vec3(1, .05, .12)

const vec3 PTS[NPTS] = vec3[](
    vec3(0, 0, 0), vec3(36, 0, 0), vec3(54, 12, 0), vec3(54, 30, 0), vec3(54, 46, 4),
    vec3(30, 56, 4), vec3(2, 56, 4), vec3(-14, 46, 4), vec3(-20, 30, 0), vec3(-20, 14, 0));
// arenas: x, z, radius, height (the floor is at 0)
const vec4 ARENAS[2] = vec4[](vec4(54, 12, 15, 12), vec4(-20, 14, 11, 9));

// Set by level(p): the nearest corridor (index), the position along it (u,
// meters), the signed distance from its axis (lat), its floor's height; the
// distance to the arenas' inside (negative inside).
int tSeg;
float tU, tLat, tFloor, tArena;

// What level() and the scene look at, one bit each: corridors (0 to 9), and
// in the scene, enemies (10 to 19) and the gun (31). A ray only needs what it
// can meet: leaving a corridor out only makes the distance smaller.
uint seen = ~0u;

// Offset from the nearest pillar's axis in arena 0 (six pillars on a circle).
vec2 pillar(vec3 p)
{
    vec2 c = p.xz - ARENAS[0].xy;
    float a = mod(atan(c.y, c.x) + PI / 6., PI / 3.) - PI / 6.;
    return length(c) * vec2(cos(a), sin(a)) - vec2(8, 0);
}

// Distance to the solid parts of the level (walls, floors, pillars).
float level(vec3 p)
{
    // the corridors seen from above, and the floor of the nearest one (at a
    // joint, both floors are at the same height: no steps)
    float lat = 1e9;
    for (int i = 0; i < NPTS; i++) {
        if ((seen >> i & 1u) == 0u)
            continue;
        vec3 a = PTS[i], b = PTS[(i + 1) % NPTS];
        vec2 ab = b.xy - a.xy, ap = p.xz - a.xy;
        float l = length(ab);
        float h = clamp(dot(ap, ab) / (l * l), 0., 1.);
        vec2 q = ap - ab * h;
        if (length(q) < lat) {
            lat = length(q);
            tSeg = i;
            tU = h * l;
            tLat = (ab.x * q.y - ab.y * q.x) / l;
            tFloor = mix(a.z, b.z, h);
        }
    }
    float inside = max(lat - CW, max(tFloor - p.y, p.y - tFloor - CH) * .95);
    tArena = 1e9;
    for (int i = 0; i < 2; i++) {
        vec4 A = ARENAS[i];
        tArena = min(tArena, max(length(p.xz - A.xy) - A.z, max(-p.y, p.y - A.w)));
    }
    float d = -min(inside, tArena);
    // corridors: ribs on the walls and beams under the ceiling, every 5 m (not in the arenas)
    float u = mod(tU, 5.) - 2.5;
    d = min(d, max(max(abs(u) - .3, -tArena), min(CW - .3 - abs(tLat), tFloor + CH - .6 - p.y)));
    // arena 0: pillars; arena 1: four pillars, between the doorways
    // (only near them: the angles are costly)
    vec2 c = p.xz - ARENAS[0].xy;
    float r = abs(length(c) - 8.) - 1.;
    d = min(d, r > 1. ? r : length(pillar(p)) - 1.);
    c = p.xz - ARENAS[1].xy;
    r = abs(length(c) - 6.) - 1.2;
    float a = mod(atan(c.y, c.x) - .39 + PI / 4., PI / 2.) - PI / 4.;
    d = min(d, r > 1. ? r : length(length(c) * vec2(cos(a), sin(a)) - vec2(6, 0)) - 1.2);
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
    for (int i = 0; i < NPTS; i++)
        s += length(PTS[(i + 1) % NPTS].xy - PTS[i].xy);
    return s;
}

// After level(p): the distance along the track from the start.
float trackPos()
{
    float s = tU;
    for (int i = 0; i < tSeg; i++)
        s += length(PTS[i + 1].xy - PTS[i].xy);
    return s;
}

// The point on the floor at distance s along the track.
vec3 trackPoint(float s)
{
    s = mod(s, trackLength());
    for (int i = 0; i < NPTS; i++) {
        vec3 a = PTS[i], b = PTS[(i + 1) % NPTS];
        float l = length(b.xy - a.xy);
        if (s < l) {
            a = mix(a, b, s / l);
            return a.xzy;
        }
        s -= l;
    }
    return vec3(0);
}

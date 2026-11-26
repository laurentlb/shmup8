// Table geometry, shared by the physics (game.comp, in 2D) and the rendering
// (scene.frag, in 3D). Units: meters. x: across the table, y: up the table,
// z: above the playfield.

#define PI 3.14159
#define BALL_R 0.0135
#define CX -0.019     // center of the playfield (the shooter lane is on the right)
#define LANE_X 0.244  // the ball in the shooter lane
#define SUN vec2(CX, 0.13)
#define FLIP_REST -0.55 // flipper angles (radians)
#define FLIP_UP 0.45
#define FLIP_LEN 0.075

// Materials
#define M_FLOOR 0.
#define M_WALL 1.
#define M_RAIL 2.
#define M_SLING 3.
#define M_FLIP 4.   // + side: 0 left, 1 right
#define M_SUN 6.
#define M_PLANET 7. // + index: 0, 1, 2 (the moon)
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

// https://iquilezles.org/articles/distfunctions2d/
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

// Mirrors the right half of the playfield onto the left half.
vec2 mirror(vec2 p)
{
    return vec2(CX - abs(p.x - CX), p.y);
}

// Negative inside the cabinet: a rectangle with an arch at the top.
float areaDist(vec2 p)
{
    return min(boxDist(p - vec2(0, -0.155), vec2(0.26, 0.445)), length(p - vec2(0, 0.29)) - 0.26);
}

// Wall between the playfield and the shooter lane.
float laneDist(vec2 p)
{
    return segDist(p, vec2(0.224, -0.6), vec2(0.224, 0.2)) - 0.004;
}

// Metal rails between the outlanes and the inlanes, down to the flippers (q: mirrored).
float railDist(vec2 q)
{
    return min(segDist(q, vec2(CX - 0.2, -0.2), vec2(CX - 0.2, -0.33)),
               segDist(q, vec2(CX - 0.2, -0.33), vec2(CX - 0.095, -0.415))) - 0.006;
}

// Slingshots above the flippers (q: mirrored). The face toward the center kicks.
float slingDist(vec2 q)
{
    return triDist(q, vec2(CX - 0.155, -0.2), vec2(CX - 0.155, -0.305), vec2(CX - 0.1, -0.345)) - 0.005;
}

// Rubber posts (q: mirrored): deflectors on the side walls, which send a ball
// running down the wall into the playfield, and the top lanes.
float postDist(vec2 q)
{
    float d = triDist(q, vec2(CX - 0.243, 0.08), vec2(CX - 0.193, -0.03), vec2(CX - 0.243, -0.06));
    d = min(d, min(segDist(q, vec2(CX - 0.09, 0.4), vec2(CX - 0.09, 0.44)),
                   segDist(q, vec2(CX - 0.03, 0.4), vec2(CX - 0.03, 0.44))));
    return d - 0.005;
}

// One-way gate at the top of the shooter lane: only stops a ball going down.
float gateDist(vec2 p)
{
    return segDist(p, vec2(0.222, 0.2), vec2(0.262, 0.235)) - 0.002;
}

vec2 flipPivot(int i)
{
    return vec2(CX + (i > 0 ? 0.085 : -0.085), -0.43);
}

// Flipper i at its angle (mirrored for the right flipper).
float flipperDist(vec2 p, int i)
{
    if (i > 0) p.x = 2. * CX - p.x;
    p -= flipPivot(0);
    vec2 dir = vec2(cos(flip[i]), sin(flip[i]));
    float h = clamp(dot(p, dir) / FLIP_LEN, 0., 1.);
    return length(p - dir * h * FLIP_LEN) - mix(0.011, 0.005, h);
}

// Orrery: two planets orbit the sun, a moon orbits the second planet.
float planetRadius(int i)
{
    return i == 0 ? 0.015 : i == 1 ? 0.02 : 0.008;
}

// 0 to 1: the planets line up (multiball), then go back to their orbits.
float alignment()
{
    return alignTime > 0. ? smoothstep(0., 0.8, alignTime) * smoothstep(4., 3., alignTime) : 0.;
}

// Angle a on an orbit, moved toward the alignment (pointing at the player).
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

// Star targets in an arc below the orrery (q: mirrored): round, so that the
// ball can't get stuck against them.
float targetDist(vec2 q)
{
    return min(length(q - vec2(CX - 0.135, -0.12)), length(q - vec2(CX - 0.045, -0.15))) - 0.009;
}

// Index of the target at p (0 to 3, from left to right).
int targetIndex(vec2 p)
{
    return int(clamp(floor((p.x - CX) / 0.09 + 2.), 0., 3.));
}

vec2 hit(vec2 h, float d, float m)
{
    return d < h.x ? vec2(d, m) : h;
}

// Distance from p to the nearest collider (x) and its material (y), for a ball
// going down or not (the lane gate).
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

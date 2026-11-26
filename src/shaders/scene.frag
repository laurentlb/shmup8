#version 430

layout(location = 0) uniform vec4 iFrame; // xy: resolution, z: time since the last frame, w: pass (0: scene, 1: final)
layout(binding = 0) uniform sampler2D tex; // the scene pass (linear HDR)

#include "tweaks.frag"
#include "state.glsl"
#include "world.glsl"

out vec4 fragColor;

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

// ---------------------------------------------------------------------------
// The table in 3D

vec2 planets[3];

float extrude(float d, float z, float height)
{
    vec2 w = vec2(d, abs(z - height * .5) - height * .5);
    return min(max(w.x, w.y), 0.) + length(max(w, 0.));
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
    h = hit(h, extrude(min(max(-area, area - 0.03), laneDist(p.xy)), p.z, 0.05), M_WALL);
    h = hit(h, extrude(boxDist(p.xy - vec2(CX, -0.56), vec2(0.245, 0.07)), p.z, 0.022), M_APRON);
    h = hit(h, extrude(railDist(q), p.z, 0.03), M_RAIL);
    h = hit(h, extrude(slingDist(q), p.z, 0.032), M_SLING);
    h = hit(h, extrude(postDist(q), p.z, 0.032), M_POST);
    h = hit(h, extrude(gateDist(p.xy), p.z - 0.01, 0.025), M_ARM);
    for (int i = 0; i < 2; i++)
        h = hit(h, extrude(flipperDist(p.xy, i), p.z - 0.002, 0.024), M_FLIP + float(i));

    // the sun: a brass skirt under a sphere
    vec3 s = p - vec3(SUN, 0);
    h = hit(h, min(extrude(length(s.xy) - 0.03, p.z, 0.03), length(s - vec3(0, 0, 0.068)) - 0.036 * (1. + 0.15 * flash.x)), M_SUN);

    // planets: a rubber ring at the ball's height, a sphere above, an arm from the sun
    float arms = 1e9;
    for (int i = 0; i < 3; i++) {
        float r = planetRadius(i), z = planetHeight(i);
        vec3 d = p - vec3(planets[i], 0);
        float body = min(extrude(length(d.xy) - r * 0.8, p.z, 0.034), length(d - vec3(0, 0, z)) - r * 1.3 * (1. + 0.25 * flash[i + 1]));
        if (i == 1) { // a ring
            d.z -= z;
            d.xz *= rot(0.4);
            body = min(body, length(vec2(length(d.xy) - r * 2.2, d.z)) - 0.0015);
        }
        h = hit(h, body, M_PLANET + float(i));
        vec3 from = i > 1 ? vec3(planets[1], planetHeight(1)) : vec3(SUN, 0.068);
        arms = min(arms, seg3(p, from, vec3(planets[i], z)));
    }
    h = hit(h, arms - 0.0022, M_ARM);
    // plunger
    h = hit(h, seg3(p, vec3(LANE_X, -0.502 - plunger * 0.04, BALL_R), vec3(LANE_X, -0.7, BALL_R)) - 0.008, M_ARM);

    h = hit(h, length(p - vec3(ball, BALL_R)) - BALL_R, M_BALL);
    return h;
}

vec3 normal(vec3 p)
{
    vec2 e = vec2(1, -1) * 1e-4;
    return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x +
                     e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}

// Returns the distance along the ray and the material; distance 9 when leaving the table.
vec2 march(vec3 ro, vec3 rd)
{
    // everything is below z = 0.11
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

// The cabinet and the lights above the table, seen in reflections.
vec3 env(vec3 rd)
{
    return vec3(0.25, 0.2, 0.16) * (0.3 + 0.7 * max(rd.z, 0.))
         + vec3(1, 0.85, 0.65) * 3. * smoothstep(0.7, 0.9, rd.z) * smoothstep(0.25, 0.15, abs(rd.x));
}

// Surface at p: albedo; metal: 0 to 1; glow: emitted light; gloss: reflection strength.
vec3 material(vec3 p, float m, out float metal, out vec3 glow, out float gloss)
{
    const vec3 brass = vec3(0.85, 0.6, 0.28);
    metal = 0.;
    glow = vec3(0);
    gloss = 0.5;
    if (m == M_FLOOR) {
        if (areaDist(p.xy) > 0.)
            return vec3(0.03, 0.02, 0.012);
        vec2 s = p.xy - SUN;
        float r = length(s), a = atan(s.y, s.x);
        // planks along the table, with a fine grain
        float x = p.x + 0.004 * sin(p.y * 25. + floor(p.x / 0.065) * 3.);
        float grain = sin(x * 700. + sin(p.y * 9. + x * 90.) * 3.) * 0.5 + sin(x * 2300.) * 0.25;
        vec3 c = vec3(0.2, 0.08, 0.03) * (0.85 + 0.15 * grain) * (1. - 0.6 * smoothstep(0.0305, 0.0322, abs(fract(p.x / 0.065) - 0.5) * 0.065));
        // brass inlays: the orbits, a toothed wheel around the orrery
        float d = min(abs(r - 0.075), abs(r - 0.14)) - 0.0012;
        d = min(d, abs(r - 0.195 - 0.006 * clamp(sin(a * 24.) * 4., -1., 1.)) - 0.0018);
        // a clock dial: 12 lamps around the sun, a light chase
        float k = floor(a / (PI / 6.) + 0.5);
        float lamp = length(s - 0.052 * vec2(cos(k * PI / 6.), sin(k * PI / 6.))) - 0.006;
        if (d < 0.) {
            metal = 1.;
            return brass;
        }
        // inserts: top lanes, multiplier (x2 to x5), ball save
        vec3 insert;
        float on = -1.;
        for (int i = 0; i < 4; i++) {
            if (i < 3 && length(p.xy - vec2(CX + 0.06 * float(i - 1), 0.37)) < 0.009) {
                on = float(lanesLit >> i & 1);
                insert = vec3(1, 0.5, 0.1);
            }
            if (length(p.xy - vec2(CX - 0.045 + 0.03 * float(i), -0.1)) < 0.007) {
                on = float(mult >= i + 2);
                insert = vec3(0.2, 0.6, 1);
            }
        }
        if (length(p.xy - vec2(CX, -0.37)) < 0.01) {
            on = float(ballSave > 0. && fract(time * (ballSave < 2. ? 4. : 1.5)) < 0.6);
            insert = vec3(1, 0.15, 0.1);
        }
        if (on >= 0.) {
            glow = insert * on * 3.;
            return insert * 0.06;
        }
        if (lamp < 0.) {
            float lit = step(fract((k - time * 4.) / 12.), 0.3);
            glow = vec3(1, 0.45, 0.1) * (lit * 1.5 + flash.x * 6.);
            return vec3(0.4, 0.3, 0.2);
        }
        gloss = 0.35;
        return c;
    }
    if (m == M_WALL) {
        if (p.z > 0.0495) { metal = 1.; return brass; }
        return vec3(0.08, 0.035, 0.015);
    }
    if (m == M_APRON) {
        metal = 0.8;
        return vec3(0.35, 0.25, 0.15);
    }
    if (m == M_RAIL || m == M_ARM) {
        metal = 1.;
        return m == M_ARM ? brass : vec3(0.8);
    }
    if (m == M_SLING || m == M_POST) {
        int side = p.x > CX ? 1 : 0;
        if (m == M_SLING)
            glow = vec3(1, 0.7, 0.4) * slingFlash[side] * 3.;
        return p.z < 0.026 ? vec3(0.5, 0.04, 0.02) : vec3(0.75, 0.7, 0.6);
    }
    if (m == M_FLIP || m == M_FLIP + 1.)
        return p.z < 0.016 ? vec3(0.5, 0.04, 0.02) : vec3(0.8, 0.75, 0.65);
    if (m == M_SUN) {
        metal = 1.;
        if (p.z > 0.035)
            glow = vec3(1, 0.5, 0.15) * (1. + flash.x * 8.);
        return brass;
    }
    if (m >= M_PLANET && m < M_BALL) {
        int i = int(m - M_PLANET);
        if (p.z < 0.034) return vec3(0.04, 0.02, 0.01);
        if (i == 1 && abs(length(p.xy - planets[1]) - 0.044) < 0.004) { metal = 1.; return brass; }
        vec3 c = i == 0 ? vec3(0.7, 0.2, 0.08) : i == 1 ? vec3(0.1, 0.25, 0.6) : vec3(0.7);
        glow = c * flash[i + 1] * 3.;
        return c;
    }
    // the ball: chrome
    metal = 1.;
    return vec3(0.9);
}

vec3 render(vec3 ro, vec3 rd)
{
    const vec3 L = normalize(vec3(-0.25, -0.35, 1.));
    vec3 col = vec3(0), weight = vec3(1);
    for (int bounce = 0; bounce < 2; bounce++) {
        vec2 h = march(ro, rd);
        if (h.x > 8.) {
            col += weight * env(rd);
            break;
        }
        vec3 p = ro + rd * h.x;
        vec3 n = normal(p);
        float metal, gloss;
        vec3 glow;
        vec3 albedo = material(p, h.y, metal, glow, gloss);

        float diffuse = max(dot(n, L), 0.);
        if (bounce == 0 && diffuse > 0.)
            diffuse *= shadow(p + n * 0.001, L);
        float ao = bounce == 0 ? occlusion(p, n) : 1.;
        // warm light from the sun
        vec3 toSun = vec3(SUN, 0.068) - p;
        float sunLight = max(dot(n, normalize(toSun)), 0.) * (0.4 + flash.x * 3.) * 0.0015 / dot(toSun, toSun);
        vec3 light = vec3(1, 0.92, 0.8) * 1.3 * diffuse + vec3(0.3, 0.35, 0.5) * 0.25 * ao * (0.6 + 0.4 * n.z)
                   + vec3(1, 0.5, 0.15) * sunLight;
        col += weight * (albedo * (1. - metal) * light + glow);

        float fresnel = 0.04 + 0.96 * pow(1. - max(dot(n, -rd), 0.), 5.);
        weight *= mix(vec3(fresnel * gloss), albedo * ao, metal);
        if (max(weight.x, max(weight.y, weight.z)) < 0.02)
            break;
        ro = p + n * 0.002;
        rd = reflect(rd, n);
    }
    return col;
}

void main()
{
    vec2 texCoord = gl_FragCoord.xy / iFrame.xy;
    vec2 uv = (gl_FragCoord.xy * 2. - iFrame.xy) / iFrame.x;

    if (iFrame.w < 0.5) {
        for (int i = 0; i < 3; i++)
            planets[i] = planetPos(i, time);
        vec3 ta = vec3(cam.x, cam.y + 0.07, 0);
        vec3 ro = vec3(cam.x, cam.y - 0.5, 0.42);
        ro += shake * shake * 0.006 * vec3(sin(time * 71.), sin(time * 83.), sin(time * 61.));
        vec3 fw = normalize(ta - ro);
        vec3 rt = normalize(cross(fw, vec3(0, 0, 1)));
        vec3 rd = normalize(uv.x * rt + uv.y * cross(rt, fw) + _TV(focal, 1.9) * fw);
        // A NaN would spread through the bloom.
        fragColor = vec4(clamp(render(ro, rd), 0., 50.), 1);
        return;
    }

    // Final image: bloom, tone mapping, score
    vec3 col = texture(tex, texCoord).rgb;
    // bloom: the mipmaps of the scene
    vec3 bloom = vec3(0);
    for (int i = 2; i < 8; i++)
        bloom += textureLod(tex, texCoord, float(i)).rgb;
    col += bloom * bloom * _TV(bloomAmount, 0.02);
    col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
    col = pow(clamp(col, 0., 1.), vec3(1. / 2.2));
    col *= 1. - 0.3 * dot(uv, uv);
    // a drain: red, darker
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

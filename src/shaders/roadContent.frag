const float warningHeight = 3.;

vec2 panelWarning(vec3 p) {
    p -= panelWarningPos;
    float pan = Triangle(p - vec3(0., warningHeight,-5.), vec2(1.7, .1), .3);
    if (pan > 8.) {
        return vec2(INF, GROUND_ID);
    }

    pan = smax(pan, -Triangle(p - vec3(0., warningHeight, -5.1), vec2(1.6,.1), .3), .001);
    
    float tube = Box3(p-vec3(0., 2.,-5.1), vec3(.11, 2., .08), 0.);
    vec3 pp = p;
    pp.y = abs(pp.y - 3.65)-.3;
    tube = min(tube, Box3(pp-vec3(0.,0.,-5.05), vec3(.35,.1,.05), 0.));
    
    vec2 dmat = vec2(tube, METAL_ID);
    return MinDist(dmat, vec2(pan, PANEL_ID));
}

vec2 blood(vec3 p) {
    if (sceneID != SCENE_BLOOD) {
        return vec2(INF, GROUND_ID);
    }
    p -= vec3(0, 1.2, -2.5);

    float d = p.y + smoothstep(1.5,8.,length(p.xz)) + 1.;
    if (d < 0.4) {
        d -= pow((noise(p*.9+0.)*.5+noise(p*1.6)*.3+noise(p*2.7)*.1)*.5+.5, 3.) *.45
             ;//* (1.-exp(-(iTime-137.3)*3.));
        return vec2(d, BLOOD_ID);
    }
    return vec2(d, GROUND_ID);
}

vec2 terrainShape(vec3 p)
{
    // Compute the road presence
    float isRoad = 1.0 - smoothstep(3.5, 5., abs(p.x));

    // If (even partly) on the road, flatten road
    float height = mix(
        noise(p*5.)*0.1 + 0.5 * noise(vec3(p.xz,0) * .4),
        0.,
        isRoad*isRoad);

    if (isRoad > 0.0)
    {
        float x = clamp(abs(p.x / 3.5), 0., 1.);
        float roadBumpHeight = 0.2 * (1. - x * x * x);
        height += roadBumpHeight + pow(noise(mod(p*50, 100))*.5+.5, .01) * .1;
    }

    return vec2(p.y - height, GROUND_ID);
}

const float treeSpace = 10.;

float tree(vec3 localP, vec2 id) {
    float h1 = hash21(id);
    float h2 = hash11(h1);
    float terrainHeight = -1.;

    float d = treeSpace * 0.5 * 0.7;

    // No trees on road.
    if (abs(id.x) < 14.) return d;

    float treeHeight = mix(7., 20., h1);
    float treeWidth = max(3.5, treeHeight * mix(0.3, 0.4, h2*h2));

    localP.y -= terrainHeight + 0.5 * treeHeight;
    localP.xz += (vec2(h1, h2) - 0.5) * 1.5; // We cannot move the trees too much due to artifacts.

    d = min(d, Ellipsoid(localP, 0.5*vec3(treeWidth, treeHeight, treeWidth)));

    // leaves
    vec2 pNoise = vec2(2.*atan(localP.z, localP.x), localP.y) + id;
    d += 0.2*noise(2. * pNoise.xyy) + 0.5;

    return d;
}

vec2 treesShape(vec3 p)
{
    // iq - repeated_ONLY_SYMMETRIC_SDFS (https://iquilezles.org/articles/sdfrepetition/)
    //vec3 lim = vec3(1e8,0,1e8);
    vec2 id = round(p.xz / treeSpace) * treeSpace;
    vec3 localP = p;
    localP.xz -= id;
    return vec2(tree(localP, id), TREE_ID);
}

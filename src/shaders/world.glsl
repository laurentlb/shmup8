// Shapes used for both collision (game.comp) and rendering (scene.frag).

const float PLAYER_RADIUS = 0.05;
const float SHOT_RADIUS = 0.02;

mat2 rot(float angle)
{
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, s, -s, c);
}

float triangleDist(vec2 p)
{
    return max(abs(p).x * 0.866025 + p.y * 0.5, -p.y);
}

float boxDist(vec2 p, vec2 size)
{
    vec2 d = abs(p) - size;
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// Signed distance from p to the i-th enemy.
float enemyDist(vec2 p, int i)
{
    vec3 e = enemies[i].xyz;
    p -= e.xy;
    vec2 q = rot(gameTime * 4. + float(i)) * p;
    if (e.z < 0.5) // square
        return boxDist(rot(-gameTime * 4.) * p, vec2(0.03));
    if (e.z < 1.5) // triangle
        return triangleDist(q) - 0.02;
    return max(0.03 - length(p), triangleDist(q) - 0.03); // hollow triangle
}

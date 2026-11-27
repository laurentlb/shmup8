// Game state, shared by the gameplay (game.comp) and the rendering (scene.frag).
// It lives on the GPU; only the event counters are read back by the host.
//
// Fields can be added or moved freely: the editor resets the state when this
// declaration changes. The event counters must stay first.

// Not "const int": Shader Minifier would drop constants used only in the buffer declaration.
#define MAX_BOLTS 12
#define MAX_ENEMIES 10
#define MAX_SPARKS 8
#define MAX_ORBS 12
#define MAX_LIGHTS 24

layout(std430, binding = 0) buffer State {
    // Event counters, they trigger the sound effects.
    // Same order as SFX in src/music/song.py.
    int shotEvents, hitEvents, killEvents, hurtEvents, jumpEvents, lapEvents;

    vec3 pos; float yaw;     // pos: the center of the player's sphere; yaw, pitch: the view
    vec3 vel; float pitch;
    float yawBase;           // added to the input's yaw: a new run faces along the track
    float light;             // 0 to 1, drains; kills give light back; 0: the dark takes you
    float lapTime, bestLap;
    int lap;
    int checkpoint;          // the last quarter of the track reached
    float time;
    float cooldown;          // before the next shot
    float kick;              // 1 on a shot, then decreases (recoil)
    float shake, hurt, hitMark, lapFlash;
    float dead;              // > 0: seconds since the light ran out
    float bob;               // distance walked (head and gun bob)
    int grounded, started, kills;
    uint rng;
    float spawnTimer;
    vec4 bolt[MAX_BOLTS];        // xyz, w: life left (s), 0: free
    vec4 boltVel[MAX_BOLTS];
    vec4 enemy[MAX_ENEMIES];     // xyz, w: health, 0: free
    vec4 enemyVel[MAX_ENEMIES];  // xyz, w: > 0 while charging
    vec4 enemyInfo[MAX_ENEMIES]; // x: appearing (0 to 1), y: hit flash, z: before the next charge, w: before the next bite
    vec4 spark[MAX_SPARKS];      // impacts: xyz, w: intensity (decreases)
    vec4 orb[MAX_ORBS];          // light released by a kill, flies to the player: xyz, w: 1, 0: free
    vec4 orbVel[MAX_ORBS];
    // the point lights for the rendering, made by the gameplay (xyz, color)
    int lightCount;
    vec4 lightPos[MAX_LIGHTS], lightCol[MAX_LIGHTS];
};

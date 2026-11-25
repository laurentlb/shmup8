// Game state, shared by the gameplay (game.comp) and the rendering (scene.frag).
// It lives on the GPU; only the event counters are read back by the host.
//
// Fields can be added or moved freely: the editor resets the state when this
// declaration changes. The event counters must stay first.

// Not "const int": Shader Minifier would drop constants used only in the buffer declaration.
#define MAX_ENEMIES 20
#define MAX_SHOTS 32
#define MAX_BOOMS 16

layout(std430, binding = 0) buffer State {
    // Event counters, they trigger the sound effects: shots fired, explosions, hits taken.
    // Same order as SFX in src/music/song.py.
    int shotEvents, boomEvents, hitEvents, unusedEvents;

    vec2 player;
    float gameTime; // negative: game over screen
    float hurt;     // 1 after losing a life, then decreases
    float coolDown;
    int score, lives;
    int enemyCount, shotCount, boomCount;

    vec4 enemies[MAX_ENEMIES]; // xy: position, z: kind
    vec4 shots[MAX_SHOTS];     // xy: position
    vec4 booms[MAX_BOOMS];     // xy: position, z: remaining time (1 to 0)
};

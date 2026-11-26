// Game state, shared by the gameplay (game.comp) and the rendering (scene.frag).
// It lives on the GPU; only the event counters are read back by the host.
//
// Fields can be added or moved freely: the editor resets the state when this
// declaration changes. The event counters must stay first.

// Not "const int": Shader Minifier would drop constants used only in the buffer declaration.
#define TRAIL 32

layout(std430, binding = 0) buffer State {
    // Event counters, they trigger the sound effects.
    // Same order as SFX in src/music/song.py.
    int bumperEvents, flipperEvents, drainEvents, slingEvents;

    vec2 ball, vel;
    vec2 flip, flipVel; // flipper angles (mirrored for the right one), angular velocities
    vec2 cam;           // the camera follows the ball
    vec2 slingFlash;    // 1 when kicking, then decreases
    vec4 flash;         // sun, planets, moon: 1 when hit, then decreases
    vec4 prevInput;
    float time;         // never reset: the orrery keeps turning
    float plunger;      // 0 to 1 while pulling
    float shake;        // camera shake
    float gameOver;     // > 0: waiting for a new game
    float ballSave;     // > 0: a drain gives the ball back
    float hitStop;      // > 0: the game freezes for a moment on big hits
    float drainFlash;   // 1 on a drain, then decreases
    int score, balls;   // balls left, including the one in play
    int mult;           // score multiplier, 1 to 5
    int lanesLit;       // top lanes, one bit each
    int steps;
    vec4 trail[TRAIL];  // recent ball positions (xy) and speeds (z), the newest first
};

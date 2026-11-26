// Game state, shared by the gameplay (game.comp) and the rendering (scene.frag).
// It lives on the GPU; only the event counters are read back by the host.
//
// Fields can be added or moved freely: the editor resets the state when this
// declaration changes. The event counters must stay first.

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
    int score, balls;   // balls left, including the one in play
};

#pragma once

// The player's input: the uniform iInput[2] of the gameplay shader.
struct GameInput
{
	float x, y;       // strafe (-1 left, 1 right), move (-1 back, 1 forward)
	float buttons;    // 1 fire + 2 jump
	float steps;      // set by stepGame
	float yaw, pitch; // view angles (radians), from the mouse
	float unused[2];
};

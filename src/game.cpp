#include <cmath>

GLfloat arrLocals[200] = {};
GLfloat arrState[200] = {};
GLfloat arrMissiles[200] = {};
GLfloat arrEnemies[200] = {};

#define GET_KEY(vk) ((GetAsyncKeyState(vk) & 0x8000) ? 1.0f : 0.f)
#define CLAMP(v, min, max) ( (v)<(min) ? (min) : ( (v)>(max) ? (max) : (v) ) )
#define MIX(a, b, t) ( (a)*(1.f-(t)) + (b)*(t) )

void game(float time) {
	static float lastTime = 0;
	float dt = time - lastTime;
	lastTime = time;

	arrState[1] += 0.02f * (GET_KEY(VK_RIGHT) - GET_KEY(VK_LEFT));
	arrState[2] += 0.02f * (GET_KEY(VK_UP) - GET_KEY(VK_DOWN));

	arrState[1] = CLAMP(arrState[1], -1.f, 1.f);
	arrState[2] = CLAMP(arrState[2], -1.f, 1.f);

	arrState[0] = time;
	arrState[3]; // cool down

	// Enemy data:
	// - kind
	// - seed
	// - px, py
	int enemyDataSize = 4; // 4 floats per enemy

	// Enemy spawning
	if (time < 1.f) {
		arrEnemies[0] = 4.; // nb enemies
		for (int i = 0; i < int(arrEnemies[0]); i++) {
			arrEnemies[1 + i * enemyDataSize + 0] = 1.f; // kind
			arrEnemies[1 + i * enemyDataSize + 1] = float(i); // seed
		}
	}

	// Enemy movement
	for (int i = 0; i < int(arrEnemies[0]); i++) {
		arrEnemies[1 + i * enemyDataSize + 2] = sin(time + float(i)) * 0.8f; // px
		float target = float(i) * .1f + cos(time) * 0.5f - 0.1f;
		arrEnemies[1 + i * enemyDataSize + 3] = MIX(arrEnemies[1 + i * enemyDataSize + 3], target, 0.02f); // py
	}
  
	// Missile movement
	int nbMissiles = int(arrMissiles[0]);
	for (int i = nbMissiles - 1; i >= 0; i--) {
		arrMissiles[1 + i * 2 + 1] += 2.f * dt;

		for (int j = 0; j < int(arrEnemies[0]); j++) {
			float ex = arrEnemies[1 + j * enemyDataSize + 2];
			float ey = arrEnemies[1 + j * enemyDataSize + 3];
			float mx = arrMissiles[1 + i * 2 + 0];
			float my = arrMissiles[1 + i * 2 + 1];
			float dx = ex - mx;
			float dy = ey - my;
			float dist2 = dx * dx + dy * dy;
			float boundingRadius = 0.05f;
			if (dist2 < boundingRadius * boundingRadius) {
				arrEnemies[1 + j * enemyDataSize + 3] = 10.f; // move out of screen
   				arrMissiles[1 + i * 2 + 1] = 10.f; // move out of screen
			}
		}

		if (arrMissiles[1 + i * 2 + 1] > 2.f) {
			// swap with last missile to remove
			arrMissiles[1 + i * 2] = arrMissiles[1 + (nbMissiles - 1) * 2];
			arrMissiles[1 + i * 2 + 1] = arrMissiles[1 + (nbMissiles - 1) * 2 + 1];
			arrMissiles[0] -= 1.f;
		}
	}
	float coolDown = arrState[3];
	if (GET_KEY(VK_SPACE) > 0.5f && time - coolDown > 0.25f) {
		arrState[3] = time; // coolDown
		arrMissiles[0] += 1.f; // count

		arrMissiles[1 + nbMissiles * 2] = arrState[0];
		arrMissiles[1 + nbMissiles * 2 + 1] = arrState[1];
	}

	// ((PFNGLUNIFORM1FPROC)wglGetProcAddress("glUniform1f"))(0, time);
	((PFNGLUNIFORM1FVPROC)wglGetProcAddress("glUniform1fv"))(0, 200, arrState);
	((PFNGLUNIFORM1FVPROC)wglGetProcAddress("glUniform1fv"))(200, 200, arrMissiles);
	((PFNGLUNIFORM1FVPROC)wglGetProcAddress("glUniform1fv"))(400, 200, arrEnemies);
//	((PFNGLUNIFORM1IPROC)wglGetProcAddress("glUniform1i"))(1000, 0); // Previous frame
}

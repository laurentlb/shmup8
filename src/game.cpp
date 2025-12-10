#include <cmath>

GLfloat arrState[200] = {};
GLfloat arrMissiles[200] = {};
GLfloat arrEnemies[200] = {};

#define GET_KEY(vk) ((GetAsyncKeyState(vk) & 0x8000) ? 1.0f : 0.f)
#define CLAMP(v, min, max) ( (v)<(min) ? (min) : ( (v)>(max) ? (max) : (v) ) )

void game(float time) {
	static float lastTime = 0;
	float dt = time - lastTime;
	lastTime = time;

	arrState[0] += 0.02f * (GET_KEY(VK_RIGHT) - GET_KEY(VK_LEFT));
	arrState[1] += 0.02f * (GET_KEY(VK_UP) - GET_KEY(VK_DOWN));

	arrState[0] = CLAMP(arrState[0], -1.f, 1.f);
	arrState[1] = CLAMP(arrState[1], -1.f, 1.f);

	arrEnemies[0] = 2.; // nb enemies
	arrEnemies[1] = sin(time);
	arrEnemies[2] = 0.5;
	arrEnemies[3] = 0.5;
	arrEnemies[4] = cos(time);

	float coolDown = arrState[7];
	int nbMissiles = int(arrMissiles[0]);
	for (int i = nbMissiles - 1; i >= 0; i--) {
		// missile movement
		arrMissiles[1 + i * 2 + 1] += 2.f * dt;

		if (arrMissiles[1 + i * 2 + 1] > 2.f) {
			// swap with last missile and remove
			arrMissiles[1 + i * 2] = arrMissiles[1 + (nbMissiles - 1) * 2];
			arrMissiles[1 + i * 2 + 1] = arrMissiles[1 + (nbMissiles - 1) * 2 + 1];
			arrMissiles[0] -= 1.f;
		}
	}
	if (GET_KEY(VK_SPACE) > 0.5f && time - coolDown > 0.5f) {
		arrState[7] = time; // coolDown
		arrMissiles[0] += 1.f; // count

		arrMissiles[1 + nbMissiles * 2] = arrState[0];
		arrMissiles[1 + nbMissiles * 2 + 1] = arrState[1];
	}

	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
	glCopyTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, 0, 0, XRES, YRES, 0);
	((PFNGLUSEPROGRAMPROC)wglGetProcAddress("glUseProgram"))(shaderMain);
	// ((PFNGLUNIFORM1FPROC)wglGetProcAddress("glUniform1f"))(0, time);
	((PFNGLUNIFORM1FVPROC)wglGetProcAddress("glUniform1fv"))(0, 200, arrState);
	((PFNGLUNIFORM1FVPROC)wglGetProcAddress("glUniform1fv"))(200, 200, arrMissiles);
	((PFNGLUNIFORM1FVPROC)wglGetProcAddress("glUniform1fv"))(400, 200, arrEnemies);
	((PFNGLUNIFORM1IPROC)wglGetProcAddress("glUniform1i"))(1000, 0); // Previous frame
}

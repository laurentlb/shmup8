#include <cmath>

GLfloat floatArray[200] = {};
#define GET_KEY(vk) ((GetAsyncKeyState(vk) & 0x8000) ? 1.0f : 0.f)
#define CLAMP(v, min, max) ( (v)<(min) ? (min) : ( (v)>(max) ? (max) : (v) ) )

void game(float time) {
	static float lastTime = 0;
	float dt = time - lastTime;
	lastTime = time;

	floatArray[0] += 0.02f * (GET_KEY(VK_RIGHT) - GET_KEY(VK_LEFT));
	floatArray[1] += 0.02f * (GET_KEY(VK_UP) - GET_KEY(VK_DOWN));

	floatArray[0] = CLAMP(floatArray[0], -1.f, 1.f);
	floatArray[1] = CLAMP(floatArray[1], -1.f, 1.f);

	floatArray[2] = 2.; // nb ennemies
	floatArray[3] = sin(time);
	floatArray[4] = 0.5;
	floatArray[5] = 0.5;
	floatArray[6] = cos(time);

	float coolDown = floatArray[7];
	int nbMissiles = int(floatArray[8]);
	for (int i = 0; i < nbMissiles; i++) {
		// missile movement
		floatArray[9 + i * 2 + 1] += 2.f * dt;
	}
	if (GET_KEY(VK_SPACE) > 0.5f && time - coolDown > 1.f) {
		floatArray[7] = time; // coolDown
		floatArray[8] += 1.f; // count

		// nbMissiles = 0;
		floatArray[9 + nbMissiles * 2] = floatArray[0];
		floatArray[9 + nbMissiles * 2 + 1] = floatArray[1];
		// floatArray[7] = 1.f;
	}

	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
	glCopyTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, 0, 0, XRES, YRES, 0);
	((PFNGLUSEPROGRAMPROC)wglGetProcAddress("glUseProgram"))(shaderMain);
	// ((PFNGLUNIFORM1FPROC)wglGetProcAddress("glUniform1f"))(0, time);
	((PFNGLUNIFORM1FVPROC)wglGetProcAddress("glUniform1fv"))(0, 200, floatArray);
	((PFNGLUNIFORM1IPROC)wglGetProcAddress("glUniform1i"))(1, 0); // Previous frame
}

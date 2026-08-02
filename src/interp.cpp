// bytecode interpreter

#include <stdio.h>
#include <cmath>
#include <windows.h>

typedef unsigned char byte;

enum stmt_code {
	PRINT = 0x00,
	SET = 0x01,
	JUMP = 0x02,
	JUMPIF = 0x03,
	JUMPIFNOT = 0x04,
};

enum exp_code {
	CONSTANT = 0x00, // load a constant float32
	GET_KEY = 0x01,
	ADD = 0x02,
	SUB = 0x03,
	MUL = 0x04,
	VAR = 0x05,
	CLAMP = 0x06,
	SIN = 0x07,
	MIX = 0x08,
	EQ = 0x09,
	LT = 0x0A,
	LTE = 0x0B,
	BYTE_CONST = 0x0C, // load a constant unsigned byte
};

float variables[5][256];

//#define LOG(fmt, ...) fprintf(stdout, fmt, __VA_ARGS__)
#define LOG(fmt, ...) void(0)

#if defined(EDITOR_CONTROLS)
# define ERR(fmt, ...) fprintf(stdout, fmt, __VA_ARGS__)
#else
# define ERR(fmt, ...) void(0)
#endif

float mysinf(const float x) {
	float r; _asm fld  dword ptr[x];
	_asm fsin;
	_asm fstp dword ptr[r];
	return r;
}


#if 1

float eval(byte** expp) {
	enum exp_code e = (enum exp_code) * (*expp)++;
	float a, b;

	switch (e) {
	case ADD:
		a = eval(expp);
		b = eval(expp);
		return a + b;
	case SUB:
		a = eval(expp);
		b = eval(expp);
		return a - b;
	case CONSTANT: {
		float* pt = (float*)(*expp);
		float val = *pt;
		*expp += sizeof(float);
		return val;
	}
	case BYTE_CONST: {
		byte val = **expp;
		(*expp)++;
		return (float)val;
	}
	case MUL:
		a = eval(expp);
		b = eval(expp);
		return a * b;
	case VAR: {
		byte array = **expp;
		(*expp)++;
		float index = eval(expp);		
		LOG("fetching var %d[%d] = %f\n", array, (int)index, variables[array][(int)index]);
		return variables[array][(int)index];
	}
	case SIN:
		a = eval(expp);
		return mysinf(a);
	case CLAMP: {
		a = eval(expp);
		float min = eval(expp);
		float max = eval(expp);
		if (a < min) return min;
		if (a > max) return max;
		return a;
	}
	case MIX: {
		float x = eval(expp);
		float y = eval(expp);
		a = eval(expp);
		return x * (1.f - a) + y * a;
	}
	case GET_KEY: {
		float vk = eval(expp);
		return (GetAsyncKeyState((int)vk) & 0x8000) ? 1.0f : 0.f;
	}
	case EQ: {
		float x = eval(expp);
		float y = eval(expp);
		return (fabsf(x - y) < 0.0001f) ? 1.f : 0.f;
	}
	case LT: {
		float a = eval(expp);
		float b = eval(expp);
		return (a < b) ? 1.f : 0.f;
	}
	case LTE: {
		float a = eval(expp);
		float b = eval(expp);
		return (a <= b) ? 1.f : 0.f;
	}
	}
	ERR("Unknown expr opcode: %d\n", e);
	return 0.f;
}

void exec_private(byte* tree, int size) {
	LOG("Executing bytecode...\n");
	byte* tree_start = tree;
	byte* tree_end = tree + size;
	while (tree < tree_end) {
		enum tree_code tc = (enum tree_code)*tree++;
		switch (tc) {
		case PRINT: {
			float val = eval(&tree);
#if EDITOR_CONTROLS
			fprintf(stdout, "print: %f\n", val);
#endif
			break;
		}
		case SET: {
			byte array = *tree;
			tree++;
			float index = eval(&tree);
			float value = eval(&tree);
			variables[array][(int) index] = value;
			LOG("set var %d[%d] to %f\n", array, (int)index, value);
			break;
		}
		case JUMP: {
			int address = *(int*)tree;
			tree = tree_start + address;
			LOG("jump to address %d\n", address);
			break;
		}
		case JUMPIF: {
			float cond = eval(&tree);
			int address = *(int*)tree;
			tree += sizeof(int);
			if (cond > 0.5f) { // in the world of floats... you need to be greater than 0.5 to be true!
				tree = tree_start + address;
				LOG("jumpif to address %d\n", address);
			} else {
				LOG("jumpif not taken\n");
			}
		}
		case JUMPIFNOT: {
			float cond = eval(&tree);
			int address = *(int*)tree;
			tree += sizeof(int);
			if (cond <= 0.5f) {
				tree = tree_start + address;
				LOG("jumpifnot to address %d\n", address);
			} else {
				LOG("jumpifnot not taken\n");
			}
			break;
		}
		default:
			ERR("Unknown stmt opcode: %d\n", tc);
		}
	}
}

#ifndef EDITOR_CONTROLS

#include "bytecode.cpp"

void exec() {
	exec_private(game_bytes, sizeof(game_bytes));
}

#else
byte* tree = nullptr;
int tree_size = 0;
void exec() {
	if (tree == nullptr || tree_size == 0) return;
	exec_private(tree, tree_size);
}

void exec_file(const char* filename) {
	FILE* f = fopen(filename, "rb");
	if (f) {
		if (tree != nullptr) {
			delete[] tree;
		}
		fseek(f, 0, SEEK_END);
		tree_size = ftell(f);
		fseek(f, 0, SEEK_SET);
		tree = new byte[tree_size];
		fread(tree, sizeof(byte), tree_size, f);
		fclose(f);
		// exec(tree, tree_size);
		// delete[] tree;
	}
}
#endif


#else

// Definitions
const float left = 37;
const float up = 38;
const float right = 39;
const float down = 40;
const float space = 32;

#define dt state[0] // filled by the engine
#define time state[8]

#define playerX state[1]
#define playerY state[2]
#define score state[5]
#define lives state[6]

#define state variables[1]
#define missiles variables[2]
#define enemies variables[3]
#define explosions variables[4]

float get_key(float vk) {
	return (GetAsyncKeyState((int)vk) & 0x8000) ? 1.0f : 0.f;
}

float clamp(float x, float min, float max) {
	if (x < min) return min;
	if (x > max) return max;
	return x;
}

float mix(float x, float y, float a) {
	return x * (1.f - a) + y * a;
}

void exec() {
	static int level;
	static int index, mixer, i, j;
	static float coolDown;
	static float t;
	static float dx, dy, dist2, tx, ty;

	time += dt;

	playerX += (get_key(right) - get_key(left)) * dt * 0.8f;
	playerY += (get_key(up) - get_key(down)) * dt * 0.8f;

	playerX = clamp(playerX, -1, 1);
	playerY = clamp(playerY, -0.5f, 0.5f);

	// Animation after losing life
	state[4] = clamp(state[4] - dt, 0., 1.);

	#define enemyDataSize 4

	// spawning
	if ((time >= 0) * (time < 0.5)) { // reset
		enemies[0] = 0;
		playerX = mix(playerX, 0, 0.2);
		playerY = mix(playerY, -0.3, 0.2);
		score = 0;
		lives = 0;
		level = 0;
	}
	else if (time < 1) {
		lives = 3;

		// init enemies data
		for (i = 0; i < 20; i += 1) {
			enemies[i * enemyDataSize + 1] = 0; // kind
			enemies[i * enemyDataSize + 2] = (float) i; // seed
			enemies[i * enemyDataSize + 3] = 0;
			enemies[i * enemyDataSize + 4] = 10;
		}
		// set enemy kinds
		index = 3 * enemyDataSize + 1;
		enemies[index] = 1;
		index += enemyDataSize;
		enemies[index] = 1;

		index += enemyDataSize;
		enemies[index] = 2;

		index += enemyDataSize;
		enemies[index] = 3;
	}

	// Add enemies over time
	t = time;
	enemies[0] = 2;
	while (t > 0) {
		t -= 7;
		enemies[0] += 1;
	}

	// Enemy movement
	for (i = 0; i < enemies[0]; i += 1) {
		float kind = enemies[i * enemyDataSize + 1];
		mixer = 0;
		if (kind == 0) {
			tx = mysinf(time + i) * 0.8f; // px
			ty = i * 0.1f + mysinf(time + 1.5f) * 0.5f - 0.1f;
		}
		if (kind == 1) {
			tx = playerX;
			ty = playerY;
			mixer = 0;
		}
		if (kind == 2) {
			tx = mysinf(time);
			ty = playerY;
			mixer = 0;
		}
		if (kind == 3) {
			tx = playerX;
			ty = mysinf(time);
			mixer = 0;
		}

		// Two interpolation modes
		if (mixer == 1) {
			enemies[i * enemyDataSize + 3] += clamp(tx - enemies[i * enemyDataSize + 3], -0.01, 0.01); // px
			enemies[i * enemyDataSize + 4] += clamp(ty - enemies[i * enemyDataSize + 4], -0.01, 0.01); // px
		}
		else {
			// non-linear speed, slowing down when reaching target
			enemies[i * enemyDataSize + 3] = mix(enemies[i * enemyDataSize + 3], tx, 0.04); // px
			enemies[i * enemyDataSize + 4] = mix(enemies[i * enemyDataSize + 4], ty, 0.04); // py
		}
	}

	// collision with enemies
	for (j = 0; j < enemies[0]; j += 1) {
		dx = enemies[j * enemyDataSize + 3] - playerX;
		dy = enemies[j * enemyDataSize + 4] - playerY;
		if (dx * dx + dy * dy < 0.07 * 0.07) {
			enemies[j * enemyDataSize + 3] = mysinf((float) j);
			enemies[j * enemyDataSize + 4] = 10; // move out of screen
			state[4] = 1.;
			lives -= 1;
		}
	}

	// Move missiles
	for (i = (int) missiles[0] - 1; i >= 0; i -= 1) {
		missiles[i * 2 + 2] += 1 * dt;

		// collisions with enemies
		for (j = 0; j < enemies[0]; j += 1) {
			dx = enemies[j * enemyDataSize + 3] - missiles[i * 2 + 1];
			dy = enemies[j * enemyDataSize + 4] - missiles[i * 2 + 2];
			dist2 = dx * dx + dy * dy;
			if (dist2 < 0.05 * 0.05) {
				enemies[j * enemyDataSize + 4] = -10; // move out of screen
				score += 1;

				int nbexplo = (int) explosions[0];
				explosions[nbexplo * 3 + 1] = missiles[i * 2 + 1];
				explosions[nbexplo * 3 + 2] = missiles[i * 2 + 2];
				explosions[nbexplo * 3 + 3] = 1;
				explosions[0] += 1;

				missiles[i * 2 + 2] = 10; // move out of screen
			}
		}

		// remove missiles outside the screen
		if (missiles[i * 2 + 2] > 0.5) {
			// O(1) removal: swap element with the last one in the array
			missiles[i * 2 + 1] = missiles[(int) (missiles[0] - 1) * 2 + 1];
			missiles[i * 2 + 2] = missiles[(int) (missiles[0] - 1) * 2 + 2];
			missiles[0] -= 1;
		}
	}

	// update explosions
	for (i = (int) explosions[0] - 1; i >= 0; i -= 1) {
		explosions[i * 3 + 3] -= dt;
		if (explosions[i * 3 + 3] <= 0) {
			explosions[i * 3 + 1] = explosions[(int) (explosions[0] - 1) * 2 + 1];
			explosions[i * 3 + 2] = explosions[(int) (explosions[0] - 1) * 2 + 2];
			explosions[0] -= 1;
		}
	}


	if (get_key(space)) {
		if (time - coolDown > 0.15) {
			coolDown = time;
			// Fire, create missile
			missiles[(int) missiles[0] * 2 + 1] = playerX;
			missiles[(int) missiles[0] * 2 + 2] = playerY;
			missiles[0] += 1; // number of missiles
		}
	}

	// death
	if ((time > 2) * (lives <= 0)) {
		time = -2.0;
		coolDown = time;
	}
}

void exec_file(const char* filename) {
	// nothing to do
}

#endif


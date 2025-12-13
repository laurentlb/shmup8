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
	CONSTANT = 0x00,
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
	BYTE_CONST = 0x0C,
};

float variables[4][256];

//#define LOG(fmt, ...) fprintf(stdout, fmt, __VA_ARGS__)
#define LOG(fmt, ...) void(0)

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
		return sinf(a);
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
	fprintf(stderr, "Unknown expr opcode: %d\n", e);
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
			fprintf(stdout, "print: %f\n", val);
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
			fprintf(stderr, "Unknown stmt opcode: %d\n", tc);
		}
	}
}

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

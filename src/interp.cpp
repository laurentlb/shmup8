// bytecode interpreter

#include <stdio.h>
#include <cmath>

typedef unsigned char byte;

enum stmt_code {
	PRINT = 0x00,
	SET = 0x01,
	JUMP = 0x02,
	JUMPIF = 0x03,
	JUMPIFNOT = 0x04,
};

enum exp_code {
	INT = 0x00,
	FLOAT = 0x01,
	ADD = 0x02,
	SUB = 0x03,
	MUL = 0x04,
	VAR = 0x05,
	CLAMP = 0x06,
	SIN = 0x07,
	MIX = 0x08,
};

float variables[256];

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
	case INT: {
		int val = *(int*)(*expp);
		*expp += sizeof(int);
		return float(val);
	}
	case FLOAT: {
		float* pt = (float*)(*expp);
		float val = *pt;
		*expp += sizeof(float);
		return val;
	}
	case MUL:
		a = eval(expp);
		b = eval(expp);
		return a * b;
	case VAR: {
		int index = **expp;
		(*expp)++;
		fprintf(stdout, "fetching var %d = %f\n", index, variables[index]);
		return variables[index];
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
	}
	return 0.f;
}

void exec(byte* tree, int size) {
	fprintf(stdout, "Executing bytecode...\n");
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
			byte index = *tree;
			tree++;
			float value = eval(&tree);
			variables[index] = value;
			fprintf(stdout, "set var %d to %f\n", index, value);
			break;
		}
		case JUMP: {
			int address = *(int*)tree;
			tree = tree_start + address;
			fprintf(stdout, "jump to address %d\n", address);
			break;
		}
		case JUMPIF: {
			float cond = eval(&tree);
			int address = *(int*)tree;
			tree += sizeof(int);
			if (cond > 0.5f) { // in the world of floats... you need to be greater than 0.5 to be true!
				tree = tree_start + address;
				fprintf(stdout, "jumpif to address %d\n", address);
			} else {
				fprintf(stdout, "jumpif not taken\n");
			}
		}
		case JUMPIFNOT: {
			float cond = eval(&tree);
			int address = *(int*)tree;
			tree += sizeof(int);
			if (cond <= 0.5f) {
				tree = tree_start + address;
				fprintf(stdout, "jumpifnot to address %d\n", address);
			} else {
				fprintf(stdout, "jumpifnot not taken\n");
			}
			break;
		}
		}
	}
}

void exec_file(const char* filename) {
	FILE* f = fopen(filename, "rb");
	if (f) {
		fseek(f, 0, SEEK_END);
		long size = ftell(f);
		fseek(f, 0, SEEK_SET);
		byte* tree = new byte[size];
		fread(tree, 1, size, f);
		fclose(f);
		exec(tree, size);
		delete[] tree;
	}
}

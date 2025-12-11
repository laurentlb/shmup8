// bytecode interpreter

typedef unsigned char byte;

#include "stdio.h"

enum tree_code {
	PRINT = 0x00,
	SET = 0x01,
};

enum exp_code {
	INT = 0x00,
	FLOAT = 0x01,
	ADD = 0x02,
	SUB = 0x03,
	MUL = 0x04,
	VAR = 0x05,
	//ROUND = 0x05,
	//CLAMP = 0x06,
	//SIN = 0x07,
};

byte* labels[256];
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
		int index = *(byte*)(*expp);
		*expp += sizeof(byte);
		return variables[index];
	}
	}
	return 0.f;
}

//void init(byte * tree, int tree_size) {
//	int c, i;
//	int l = 0;
//	for (i = 0; i < tree_size; i++) {
//		if (tree[i] == LABEL) {
//			labels[l++] = &tree[i + 1];
//		}
//	}
//}

void exec(byte* tree) {
	enum tree_code tc = (enum tree_code)*tree++;
	switch (tc) {
	case PRINT: {
		float val = eval(&tree);
		fprintf(stdout, "print: %f\n", val);
		break;
	}
	case SET: {
		int index = *(byte*)(tree);
		tree += sizeof(byte);
		float value = eval(&tree);
		variables[index] = value;
		break;
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
		exec(tree);
		delete[] tree;
	}
}

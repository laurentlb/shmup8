// bytecode interpreter

// typedef unsigned char byte;

#include "stdio.h"

enum tree_code {
	PRINT = 0x00,
};

enum exp_code {
	INT = 0x00,
	FLOAT = 0x01,
	ADD = 0x02,
	SUB = 0x03,
	MUL = 0x04,
	//ROUND = 0x05,
	//CLAMP = 0x06,
	//SIN = 0x07,
};

float eval(char** expp) {
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
	}

	return 0.f;
}

void exec(char* tree) {
	enum tree_code tc = (enum tree_code)*tree++;
	switch (tc) {
	case PRINT:
		float val = eval(&tree);
		fprintf(stdout, "print: %f\n", val);
	}
}

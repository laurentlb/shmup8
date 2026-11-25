// Runs a game made of two shaders that share a buffer (the game state):
// - a compute shader: gameplay, advances the state by fixed time steps;
// - a fragment shader: rendering, in two passes (scene with trails, final image).
// The host only sends inputs and reads back a few event counters.
#pragma once

#include "definitions.h"
#include "glext.h"

#define STEPS_PER_SECOND 120
#define MAX_STEPS 12 // don't try to catch up after a long pause
#define STATE_SIZE 4096
#define EVENT_COUNT 4

typedef BOOL (WINAPI* PFNWGLSWAPINTERVALEXTPROC)(int interval);

#define GLCALL(type, name) ((type)wglGetProcAddress(name))

static int gameProgram;
static int sceneProgram;
static GLuint sceneFramebuffer;

// Zeros to initialize the state. Then, its beginning is a copy of the event
// counters, which is also read by the audio thread.
static int stateCopy[STATE_SIZE / 4];

static void resetState()
{
	for (int i = 0; i < EVENT_COUNT; i++)
		stateCopy[i] = 0;
	GLCALL(PFNGLBUFFERDATAPROC, "glBufferData")(GL_SHADER_STORAGE_BUFFER, STATE_SIZE, stateCopy, GL_DYNAMIC_COPY);
}

// Texture 1 is the previous scene (input), texture 2 the current one (attached to sceneFramebuffer).
static void initEngine(int width, int height)
{
	// In a compatibility context, buffers and textures don't need glGen* (framebuffers do).
	GLCALL(PFNGLBINDBUFFERBASEPROC, "glBindBufferBase")(GL_SHADER_STORAGE_BUFFER, 0, 1);
	resetState();

	GLCALL(PFNGLGENFRAMEBUFFERSPROC, "glGenFramebuffers")(1, &sceneFramebuffer);
	GLCALL(PFNGLBINDFRAMEBUFFERPROC, "glBindFramebuffer")(GL_FRAMEBUFFER, sceneFramebuffer);
	for (int i = 2; i; i--)
	{
		glBindTexture(GL_TEXTURE_2D, i);
		// floats, otherwise trails don't fade out completely at high frame rates
		glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, width, height, 0, GL_RGBA, GL_FLOAT, 0);
		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
	}
	GLCALL(PFNGLFRAMEBUFFERTEXTURE2DPROC, "glFramebufferTexture2D")(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, 2, 0);
	glViewport(0, 0, width, height);
	glClear(GL_COLOR_BUFFER_BIT);
	glCopyTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, 0, 0, width, height);
}

// input: direction (x, y), fire
static void stepGame(float x, float y, float fire, int steps)
{
	GLCALL(PFNGLUSEPROGRAMPROC, "glUseProgram")(gameProgram);
	GLCALL(PFNGLUNIFORM4FPROC, "glUniform4f")(0, x, y, fire, (float)steps);
	GLCALL(PFNGLDISPATCHCOMPUTEPROC, "glDispatchCompute")(1, 1, 1);
	GLCALL(PFNGLMEMORYBARRIERPROC, "glMemoryBarrier")(GL_ALL_BARRIER_BITS);
	GLCALL(PFNGLGETBUFFERSUBDATAPROC, "glGetBufferSubData")(GL_SHADER_STORAGE_BUFFER, 0, EVENT_COUNT * 4, stateCopy);
}

// frameTime: seconds since the previous frame. The final image goes to 'target' (0: window).
static void drawGame(int width, int height, float frameTime, int target)
{
	GLCALL(PFNGLUSEPROGRAMPROC, "glUseProgram")(sceneProgram);
	GLCALL(PFNGLUNIFORM4FPROC, "glUniform4f")(0, (float)width, (float)height, frameTime, 0);
	GLCALL(PFNGLBINDFRAMEBUFFERPROC, "glBindFramebuffer")(GL_FRAMEBUFFER, sceneFramebuffer);
	glRects(-1, -1, 1, 1);
	glCopyTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, 0, 0, width, height);

	GLCALL(PFNGLUNIFORM4FPROC, "glUniform4f")(0, (float)width, (float)height, frameTime, 1);
	GLCALL(PFNGLBINDFRAMEBUFFERPROC, "glBindFramebuffer")(GL_FRAMEBUFFER, target);
	glRects(-1, -1, 1, 1);
}

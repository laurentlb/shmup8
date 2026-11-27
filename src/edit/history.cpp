#include "history.h"

#include "definitions.h"
#include "glext.h"

#include <cstdio>
#include <cmath>

namespace History
{
	static const int SNAPSHOT_STEPS = 120; // one second

	static void (*stepGame)(GameInput, int);
	static int* events;
	static int eventCount;
	static int stateSize;

	static std::vector<Input> recorded;
	static std::vector<std::vector<char>> snapshots; // index: step / SNAPSHOT_STEPS, empty if unknown
	static int pos;
	static bool replay;

	#define GLFN(type, name) static type name##_() { return (type)wglGetProcAddress(#name); }
	GLFN(PFNGLGETBUFFERSUBDATAPROC, glGetBufferSubData)
	GLFN(PFNGLBUFFERSUBDATAPROC, glBufferSubData)
	#undef GLFN

	static const float PI = 3.14159265f;

	Input encode(const GameInput& in)
	{
		int buttons = (int)in.buttons;
		Input input;
		input.keys = (unsigned char)((in.x < 0) | (in.x > 0) << 1 | (in.y > 0) << 2 | (in.y < 0) << 3 | (buttons & 3) << 4);
		float turns = in.yaw / (2 * PI);
		input.yaw = (short)(int)floorf((turns - floorf(turns)) * 65536.f + 0.5f); // wraps
		input.pitch = (short)(int)floorf(in.pitch * 20000.f + 0.5f);
		return input;
	}

	GameInput decode(Input input)
	{
		GameInput in = {};
		in.x = (float)((input.keys >> 1 & 1) - (input.keys & 1));
		in.y = (float)((input.keys >> 2 & 1) - (input.keys >> 3 & 1));
		in.buttons = (float)(input.keys >> 4 & 3);
		in.yaw = input.yaw * (2 * PI / 65536.f);
		in.pitch = input.pitch / 20000.f;
		return in;
	}

	static void takeSnapshot()
	{
		size_t i = pos / SNAPSHOT_STEPS;
		if (snapshots.size() <= i) snapshots.resize(i + 1);
		snapshots[i].resize(stateSize);
		glGetBufferSubData_()(GL_SHADER_STORAGE_BUFFER, 0, stateSize, &snapshots[i][0]);
	}

	void init(void (*step)(GameInput, int), int* eventCounters, int counterCount, int size)
	{
		stepGame = step;
		events = eventCounters;
		eventCount = counterCount < 16 ? counterCount : 16;
		stateSize = size;
		restart();
	}

	void restart()
	{
		pos = 0;
		snapshots.clear();
		takeSnapshot();
	}

	// Simulate up to 'steps' steps, stopping at snapshot boundaries.
	static void run(Input live, int steps, bool useRecorded)
	{
		while (steps > 0)
		{
			int n = SNAPSHOT_STEPS - pos % SNAPSHOT_STEPS;
			if (n > steps) n = steps;
			Input input = live;
			if (useRecorded && pos < (int)recorded.size())
			{
				input = recorded[pos];
				int same = 1;
				while (same < n && pos + same < (int)recorded.size() && recorded[pos + same] == input)
					same++;
				n = same;
			}
			else
			{
				useRecorded = false;
				if (pos < (int)recorded.size())
				{
					recorded.resize(pos);
					invalidate();
				}
				recorded.insert(recorded.end(), n, input);
			}

			stepGame(decode(input), n);
			pos += n;
			steps -= n;
			if (pos % SNAPSHOT_STEPS == 0)
				takeSnapshot();
		}
	}

	void advance(Input live, int steps)
	{
		if (replay && pos >= (int)recorded.size())
			replay = false;
		run(live, steps, replay);
	}

	void seek(int target)
	{
		if (target < 0) target = 0;
		if (target > (int)recorded.size()) target = (int)recorded.size();
		if (target == pos) return;

		// Keep the event counters, so the sound effects aren't triggered.
		int counters[16];
		for (int i = 0; i < eventCount; i++) counters[i] = events[i];

		int k = target / SNAPSHOT_STEPS;
		if (k >= (int)snapshots.size()) k = (int)snapshots.size() - 1;
		while (k > 0 && snapshots[k].empty()) k--;
		glBufferSubData_()(GL_SHADER_STORAGE_BUFFER, 0, stateSize, &snapshots[k][0]);
		pos = k * SNAPSHOT_STEPS;
		run(Input(), target - pos, true);

		glBufferSubData_()(GL_SHADER_STORAGE_BUFFER, 0, eventCount * 4, counters);
		for (int i = 0; i < eventCount; i++) events[i] = counters[i];
	}

	void invalidate()
	{
		size_t keep = pos / SNAPSHOT_STEPS + 1;
		if (snapshots.size() > keep) snapshots.resize(keep);
		// the snapshot at the current step (if any) is still right
	}

	Input last() { return pos > 0 && pos <= (int)recorded.size() ? recorded[pos - 1] : Input(); }

	int position() { return pos; }
	int length() { return (int)recorded.size(); }
	bool& replaying() { return replay; }
	const std::vector<Input>& inputs() { return recorded; }

	bool save(const std::string& path)
	{
		FILE* f = fopen(path.c_str(), "w");
		if (!f) return false;
		fprintf(f, "# shmup8 inputs: steps (1/120 s), keys (1 left, 2 right, 4 forward, 8 back, 16 fire, 32 jump), yaw (65536 a turn), pitch (1/20000 rad)\n");
		for (size_t i = 0; i < recorded.size();)
		{
			size_t j = i;
			while (j < recorded.size() && recorded[j] == recorded[i]) j++;
			fprintf(f, "%u %u %d %d\n", (unsigned)(j - i), (unsigned)recorded[i].keys, recorded[i].yaw, recorded[i].pitch);
			i = j;
		}
		return fclose(f) == 0;
	}

	bool load(const std::string& path, std::vector<Input>& inputs)
	{
		FILE* f = fopen(path.c_str(), "r");
		if (!f) return false;
		inputs.clear();
		char line[256];
		bool ok = true;
		while (fgets(line, sizeof(line), f))
		{
			if (line[0] == '#' || line[0] == '\n' || line[0] == '\r') continue;
			unsigned count, keys;
			int yaw, pitch;
			if (sscanf(line, "%u %u %d %d", &count, &keys, &yaw, &pitch) != 4 || keys > 63)
			{
				ok = false;
				break;
			}
			Input input = { (unsigned char)keys, (short)yaw, (short)pitch };
			inputs.insert(inputs.end(), count, input);
		}
		fclose(f);
		return ok;
	}

	bool load(const std::string& path)
	{
		std::vector<Input> inputs;
		if (!load(path, inputs)) return false;
		recorded.swap(inputs);
		return true;
	}
}

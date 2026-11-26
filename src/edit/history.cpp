#include "history.h"

#include "definitions.h"
#include "glext.h"

#include <cstdio>

namespace History
{
	static const int SNAPSHOT_STEPS = 120; // one second

	static void (*stepGame)(float, float, float, int);
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

	Input encode(float x, float y, float fire)
	{
		return (Input)((x < 0) | (x > 0) << 1 | (y > 0) << 2 | (y < 0) << 3 | (fire > 0) << 4 | (fire < 0) << 5);
	}

	void decode(Input input, float& x, float& y, float& fire)
	{
		x = (float)((input >> 1 & 1) - (input & 1));
		y = (float)((input >> 2 & 1) - (input >> 3 & 1));
		fire = (float)((input >> 4 & 1) - (input >> 5 & 1));
	}

	static void takeSnapshot()
	{
		size_t i = pos / SNAPSHOT_STEPS;
		if (snapshots.size() <= i) snapshots.resize(i + 1);
		snapshots[i].resize(stateSize);
		glGetBufferSubData_()(GL_SHADER_STORAGE_BUFFER, 0, stateSize, &snapshots[i][0]);
	}

	void init(void (*step)(float, float, float, int), int* eventCounters, int counterCount, int size)
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

			float x, y, fire;
			decode(input, x, y, fire);
			stepGame(x, y, fire, n);
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
		run(0, target - pos, true);

		glBufferSubData_()(GL_SHADER_STORAGE_BUFFER, 0, eventCount * 4, counters);
		for (int i = 0; i < eventCount; i++) events[i] = counters[i];
	}

	void invalidate()
	{
		size_t keep = pos / SNAPSHOT_STEPS + 1;
		if (snapshots.size() > keep) snapshots.resize(keep);
		// the snapshot at the current step (if any) is still right
	}

	int position() { return pos; }
	int length() { return (int)recorded.size(); }
	bool& replaying() { return replay; }
	const std::vector<Input>& inputs() { return recorded; }

	bool save(const std::string& path)
	{
		FILE* f = fopen(path.c_str(), "w");
		if (!f) return false;
		fprintf(f, "# shmup8 inputs: steps (1/120 s) and keys (1 left, 2 right, 4 up, 8 down, 16 fire)\n");
		for (size_t i = 0; i < recorded.size();)
		{
			size_t j = i;
			while (j < recorded.size() && recorded[j] == recorded[i]) j++;
			fprintf(f, "%u %u\n", (unsigned)(j - i), (unsigned)recorded[i]);
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
			unsigned count, input;
			if (sscanf(line, "%u %u", &count, &input) != 2 || input > 31)
			{
				ok = false;
				break;
			}
			inputs.insert(inputs.end(), count, (Input)input);
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

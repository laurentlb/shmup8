# Engine8

A demoscene framework intended for 4k and 8k PC intros. This framework is based
on [Leviathan 2.0](https://github.com/armak/Leviathan-2.0/), but it's updated
and has more features.

This framework is used by Ctrl-Alt-Test 8k intros. The goal is to maintain and
improve this repository as we work on new intros.

## How this works

### Workflow

Select the "Editor" configuration, run the project.

* You should get an OpenGL window that displays a pixel shader.
* The default shader is quite big; modify `src\shaders\scene.frag` with your favorite editor.
    * When you press `ctrl+s` anywhere, the demo will recompile the shader and update the view.
    * The vertex shader and the postprocess are disabled by default, but the
      code is still around.

### Shortcuts

* `alt-down`: pause
* `alt-up`: play
* `alt-right`: go forward in time (use `shift` for smaller steps)
* `alt-left`: go back in time (use `shift` for smaller steps)

A new ImGui widget has been added to go anywhere in time.
In the future, we'd like to provide more ImGui widgets.

### Music

* `src/music/music.asm` comes from [Sointu](https://github.com/vsariola/sointu).
  Replace it with your music.
* `music.obj` is expected, run `compile.bat` in `src/music` to build it.
* To synchronize the graphics with the music, you'll want to enable music in the `Editor` build:
    - Make sure `#define SOUND_ON` is set.
    - It needs a .wav file called `themusic.wav`; you can generate it by running the `wav_export` project.

We plan to simplify this workflow in the future.

## Updates

Here's what changed compared to Leviathan 2.0:

* ImGui integration (slider to control the time as in a video player).
* Maintenance:
    - Updated to Visual Studio 2022 (tested with the free Community edition).
    - Updated Shader Minifier.
* Added a shader preprocessor to support `#include` statements.
* Made it easier to switch the resolution (cf. `shared.h`).
* Updated the editor mode to work without sound.
* Switched the music to [Sointu](https://github.com/vsariola/sointu), a successor to 4klang.
* Added a `shaders.min.frag` file to track changes in the minified code.


## Tips

* Set the resolution in `src/shaders/shared.h`; the file is shared between the
  C++ and the GLSL code. Set also the demo duration there.
* Use "Editor" configuration when developing.
* Try "Snapshot" configuration to make sure the demo works outside the editor.
    * In your commit messages, include the size of the binary (snapshot configuration). This is useful to identify size regressions and make sure bytes are well spent.
* Use "Release" if the snapshot size becomes too big.
* Use "Heavy release" if "release" is not enough and you don't mind waiting even longer.

## "Features"
* Kept as simple as possible, made for productivity.
* No external dependencies, instantly ready for development.
* Readymade configurations for different use cases.
* Automated shader minification upon compilation.
* Simple unintrusive editor mode with seeking and hot reloading.
* Easy to customize for your needs.

## Compatibility

This framework is developed with Visual Studio Community 2022. It is
Windows-specific.

## Configurations
This section describes the different build configurations available from Visual Studio IDE

### Heavy Release
Uses heavier Crinkler settings to squeeze out maximum compression (note though that the /VERYSLOW flag could sometimes backfire and produce a larger executable). Also doesn't do shader minification since it assumes the user is performing hand minifications to the .inl source, which would be overwritten by the Shader Minifier.

### Release
Generally recommended for producing a final executable to be released. Uses moderate Crinkler settings.

### Snapshot
Use for general development. Only minimal crinklering but nothing extra included. Useful still for keeping track of relative size changes. This configuration overwrites Release configuration binaries, but doesn't generate and overwrite crinkler report.

### Debug
Deprecated, might work but currently not really useful and not updated. Editor covers everything in this configuration.

### Editor
Creates a bigger exe similar to Debug, but with keyboard controls for pausing and seeking around temporally. Requires a pre-rendered copy of the audio track used (well, not a must but...). Overwrites Debug configuration binaries.

## Build Flags
This section describes the preprocessor definitions available for various features and size optimizations.

### FULLSCREEN
Changes the display mode to fullscreen instead of a static window. You want to use this in your final release but probably not while developing and debugging. Disabling this saves around 20 bytes.

### DESPERATE
Enabling this disables message handling, which isn't strictly necessary but makes running the intro much more reliable and compatible. Enabling this saves around 20 bytes.

### BREAK_COMPATIBILITY
Enabling this uses a pixel format descriptor that uses parameters that are mostly zeroes. This improves the compressability at the cost of violating the API specifications. You might be able to run your intro currently, but might break in the future or on other peoples' configurations right now. Enabling this saves around 5 bytes.

### USE_POSTPROCESS
Enables using the OpenGL backbuffer as a framebuffer and texture to perform simple post processing or other functionality.

### SOUND_ON
Play the music during the demo. The framework uses Sointu.
Put your music in `src/music`, run `compile.bat` and build the project.

Unset the macro when working on a demo and you don't have a music yet. Or
if you don't want to listen to it for the 100th time.

## Contributing

Ideas are always welcome. Feel free to file bug reports and request features.

## Acknowledgements

* [noby](https://github.com/armak) for [Leviathan](https://github.com/armak/Leviathan-2.0/).
* Omar Cornut and other contributors for [Dear ImGui](https://github.com/ocornut/imgui).
* Anat for the original integration in [Mouton](http://github.com/ctrl-alt-test/mouton).
* [Sointu](https://github.com/vsariola/sointu) contributors

Acknowledgements inherited from the Leviathan project:
* Rimina for initial motivation and OpenGL debug functions.
* LJ for giving suggestions for some nice hacks.
* Fizzer for help with implementing some of said hacks.
* iq for the original 4k intro framework.
* Mentor and Blueberry for Crinkler.
* LLB for Shader Minifier.
* Numerous people for various resources and information: auld, ps, cce, msqrt, ferris, yzi, las to name a few.

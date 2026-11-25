@pushd %~dp0
cd src\shaders
..\..\ShaderPreprocessor.exe scene.frag || exit /b 1
..\..\ShaderPreprocessor.exe game.comp || exit /b 1
@popd

@set shader_file_list=^
    src\shaders\preprocessed.scene.frag ^
    src\shaders\preprocessed.game.comp

@if "%~1"=="--minify" (
    shader_minifier.exe --preprocess -v -o src\shaders\shaders.inl --readable-output src\shaders\shaders.min.frag %shader_file_list%
)

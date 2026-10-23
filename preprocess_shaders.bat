@pushd %~dp0
cd src\shaders
..\..\ShaderPreprocessor.exe scene.frag
..\..\ShaderPreprocessor.exe scene.vert
@popd

@set shader_file_list=^
    src\shaders\preprocessed.scene.frag

:: Uncomment to include the vertex shader:
:: @set shader_file_list=%shader_file_list% src\shaders\preprocessed.scene.vert

@if "%~1"=="--minify" (
    shader_minifier.exe --preprocess -v -o src\shaders\shaders.inl --readable-output src\shaders\shaders.min.frag %shader_file_list%
)

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
    shader_minifier.exe -v -o src\shaders\shaders.inl %shader_file_list%
    shader_minifier.exe    -o src\shaders\shaders.min.frag --no-renaming --format indented %shader_file_list%
)

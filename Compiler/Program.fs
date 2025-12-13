
let compile ast =
    let bytes = ResizeArray<byte>()
    for stmt in ast do
        Compile.compile_stmt bytes stmt
    System.IO.File.WriteAllBytes("game.bytes", bytes.ToArray())

    // also output as a C file
    use sw = new System.IO.StreamWriter("src/bytecode.cpp")
    fprintfn sw "typedef unsigned char byte;"
    fprintfn sw "byte game_bytes[] = {"
    for b in bytes do
        fprintfn sw "  0x%02X," b
    fprintfn sw "};"

[<EntryPoint>]
let main _ =
    // let ast = Parse.parse "a = 12 + 30; a;"
    // let ast = Parse.parse "print(12 + 30);"

    let arg = System.Environment.GetCommandLineArgs().[1]
    let ast = Parse.parse (System.IO.File.ReadAllText(arg))
    compile ast
    0

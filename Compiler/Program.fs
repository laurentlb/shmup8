do
    // let ast = Parse.parse "a = 12 + 30; a;"
    // let ast = Parse.parse "print(12 + 30);"

    // read file on argv and parse it
    let arg = System.Environment.GetCommandLineArgs().[1]
    let ast = Parse.parse (System.IO.File.ReadAllText(arg))
    Compile.compile ast

module Compile

let rec compile_expr (bytes: ResizeArray<byte>) = function
    | Ast.Number n ->
        bytes.Add(0x01uy)
        let b = System.BitConverter.GetBytes(float32 n)
        bytes.AddRange(b)
        printfn "Compiling Number: %f" n
    //| Ast.Var ident ->
    //    bytes.Add(0x02)
    //    let nameBytes = System.Text.Encoding.UTF8.GetBytes(ident.Name)
    //    bytes.Add(byte nameBytes.Length)
    //    bytes.AddRange(nameBytes)
    //    printfn "Compiling Var: %s" ident.Name
    //| Ast.FunCall (fct, args) ->
    //    bytes.Add(0x03)
    //    compile_expr bytes fct
    //    bytes.Add(byte args.Length)
    //    for arg in args do
    //        compile_expr bytes arg
    //    printfn "Compiling FunCall"
    | Ast.Binop("+", x, y) ->
        bytes.Add(0x02uy)
        compile_expr bytes x
        compile_expr bytes y
    | Ast.Binop("-", x, y) ->
        bytes.Add(0x03uy)
        compile_expr bytes x
        compile_expr bytes y
    | Ast.Binop("*", x, y) ->
        bytes.Add(0x04uy)
        compile_expr bytes x
        compile_expr bytes y
    //    let opBytes = System.Text.Encoding.UTF8.GetBytes(op)
    //    bytes.Add(byte opBytes.Length)
    //    bytes.AddRange(opBytes)
    //    printfn "Compiling Op: %s" op)
    | _ -> Printf.printf "Expression type not implemented yet.\n"

let compile_stmt (bytes: ResizeArray<byte>) = function
    | Ast.Print expr ->
        bytes.Add(0x00uy)
        compile_expr bytes expr
        printfn "Compiling Print statement"
    | Ast.ExprStmt (Ast.FunCall("print", [arg])) ->
        bytes.Add(0x00uy)
        compile_expr bytes arg
        printfn "Compiling Print function call"
    | Ast.ExprStmt expr ->
        compile_expr bytes expr
        printfn "Compiling ExprStmt"
    | _ -> Printf.printf "Statement type not implemented yet.\n"

let compile ast =
    let bytes = ResizeArray<byte>()
    for stmt in ast do
        compile_stmt bytes stmt
    // save to file
    System.IO.File.WriteAllBytes("game.bytes", bytes.ToArray())

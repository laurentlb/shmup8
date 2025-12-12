module Compile

open System.Collections.Generic

// dictionary to hold variable names to their id
let varDict = Dictionary<string, byte>()

type StmtOpcode =
    | PRINT = 0x0uy
    | ASSIGN = 0x01uy
    | JUMP = 0x02uy
    | JUMPIF = 0x03uy
    | JUMPIFNOT = 0x04uy

type ExpOpcode = 
    | INT = 0x00uy
    | FLOAT = 0x01uy
    | ADD = 0x02uy
    | SUB = 0x03uy
    | MUL = 0x04uy
    | VAR = 0x05uy
    | CLAMP = 0x06uy
    | SIN = 0x07uy
    | MIX = 0x08uy

let functions = dict([
    ("sin", (byte ExpOpcode.SIN, 1))
    ("clamp", (byte ExpOpcode.CLAMP, 3))
    ("mix", (byte ExpOpcode.MIX, 3))
])

let getVarID (name: string) : byte =
    if varDict.ContainsKey(name) then
        varDict.[name]
    else
        let id = byte varDict.Count
        varDict.Add(name, id)
        id

let newLabel =
    let counter = ref 0uy
    fun () ->
        let lbl = counter.Value
        counter.Value <- counter.Value + 1uy
        lbl

// Insert a placeholder for a label address and return a function to backpatch it later
let placeholderLabel (bytes: ResizeArray<byte>) =
    let addr = bytes.Count
    bytes.AddRange([|0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy|])
    fun (newaddr: int) ->
        let b = System.BitConverter.GetBytes(newaddr)
        for i in 0 .. 3 do
            bytes.[addr + i] <- b.[i]


let rec compile_expr (bytes: ResizeArray<byte>) = function
    | Ast.Number n ->
        bytes.Add(byte ExpOpcode.FLOAT)
        let b = System.BitConverter.GetBytes(float32 n)
        bytes.AddRange(b)
    | Ast.Binop("+", x, y) ->
        bytes.Add(byte ExpOpcode.ADD)
        compile_expr bytes x
        compile_expr bytes y
    | Ast.Binop("-", x, y) ->
        bytes.Add(byte ExpOpcode.SUB)
        compile_expr bytes x
        compile_expr bytes y
    | Ast.Binop("*", x, y) ->
        bytes.Add(byte ExpOpcode.MUL)
        compile_expr bytes x
        compile_expr bytes y
    | Ast.Var ident ->
        bytes.Add(byte ExpOpcode.VAR)
        let varId = getVarID ident.Name
        bytes.Add(varId)
        printfn "Compiling Var: %s with id %d" ident.Name varId
    | Ast.FunCall (name, args) when functions.ContainsKey(name) ->
        let (opcode, argCount) = functions.[name]
        if argCount <> args.Length then
            failwithf "Function %s expects %d arguments but got %d" name argCount args.Length
        bytes.Add(opcode)
        for arg in args do
            compile_expr bytes arg
        printfn "Compiling function call %s" name
    | x -> Printf.printf "Expression type not implemented yet - %A.\n" x

let rec compile_stmt (bytes: ResizeArray<byte>) = function
    | Ast.Print expr ->
        bytes.Add(byte StmtOpcode.PRINT)
        compile_expr bytes expr
        printfn "Compiling Print statement"
    | Ast.Block stmts ->
        for stmt in stmts do
            compile_stmt bytes stmt
    | Ast.ExprStmt (Ast.FunCall("print", [arg])) ->
        bytes.Add(byte StmtOpcode.PRINT)
        compile_expr bytes arg
        printfn "Compiling Print function call"
    | Ast.Assign (ident, expr) ->
        bytes.Add(byte StmtOpcode.ASSIGN)
        let varId = getVarID ident.Name
        bytes.Add(varId)
        compile_expr bytes expr
        printfn "Compiling Assign statement to variable: %s with id %d" ident.Name varId
    | Ast.If (cond, thenStmt) ->
        bytes.Add(byte StmtOpcode.JUMPIFNOT)
        compile_expr bytes cond
        let patchAfterBlockAddr = placeholderLabel bytes
        compile_stmt bytes thenStmt
        patchAfterBlockAddr bytes.Count
        printfn "Compiling If statement"
    | Ast.IfElse (cond, thenStmt, elseStmt) ->
        bytes.Add(byte StmtOpcode.JUMPIFNOT)
        compile_expr bytes cond
        let patchElseAddr = placeholderLabel bytes
        compile_stmt bytes thenStmt
        // for stmt in thenStmts do
        //    compile_stmt bytes stmt
        bytes.Add(byte StmtOpcode.JUMP)

        let patchAfterElseAddr = placeholderLabel bytes

        patchElseAddr bytes.Count
        compile_stmt bytes elseStmt
        patchAfterElseAddr bytes.Count
        printfn "Compiling If-Else statement"
    | Ast.While (cond, bodyStmt) ->
        let loopStartAddr = bytes.Count
        bytes.Add(byte StmtOpcode.JUMPIFNOT)
        compile_expr bytes cond
        let patchAfterLoopAddr = placeholderLabel bytes

        compile_stmt bytes bodyStmt
        bytes.Add(byte StmtOpcode.JUMP)
        let b = System.BitConverter.GetBytes(loopStartAddr)
        bytes.AddRange(b)
        patchAfterLoopAddr bytes.Count
        printfn "Compiling While statement"
    | x -> Printf.printf "Statement type not implemented yet - %A\n" x

let compile ast =
    let bytes = ResizeArray<byte>()
    for stmt in ast do
        compile_stmt bytes stmt
    System.IO.File.WriteAllBytes("game.bytes", bytes.ToArray())

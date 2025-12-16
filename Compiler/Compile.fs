module Compile

open System.Collections.Generic

// dictionary to hold variable names to their id
let varDict = Dictionary<string, byte>()
let inlineDecls = Dictionary<string, Ast.Expr>()

type StmtOpcode =
    | PRINT = 0x0uy
    | ASSIGN = 0x01uy
    | JUMP = 0x02uy
    | JUMPIF = 0x03uy
    | JUMPIFNOT = 0x04uy

type ExpOpcode = 
    | CONSTANT = 0x00uy
    | GET_KEY = 0x01uy
    | ADD = 0x02uy
    | SUB = 0x03uy
    | MUL = 0x04uy
    | VAR = 0x05uy
    | CLAMP = 0x06uy
    | SIN = 0x07uy
    | MIX = 0x08uy
    | EQ = 0x09uy
    | LT = 0x0Auy
    | LTE = 0x0Buy
    | BYTE = 0x0Cuy

let functions = dict([
    ("sin", (byte ExpOpcode.SIN, 1))
    ("clamp", (byte ExpOpcode.CLAMP, 3))
    ("mix", (byte ExpOpcode.MIX, 3))
    ("get_key", (byte ExpOpcode.GET_KEY, 1))
])

let getVarID (name: string) : byte =
    if varDict.ContainsKey(name) then
        varDict.[name]
    else
        let id = byte varDict.Count
        varDict.Add(name, id)
        id

// Insert a placeholder for a label address and return a function to backpatch it later
let placeholderLabel (bytes: ResizeArray<byte>) =
    let addr = bytes.Count
    bytes.AddRange([|0xFFuy; 0xFFuy; 0xFFuy; 0xFFuy|])
    fun (newaddr: int) ->
        let b = System.BitConverter.GetBytes(newaddr)
        for i in 0 .. 3 do
            bytes.[addr + i] <- b.[i]

let arrayId = function
    | "state" -> 0x01uy
    | "missiles" -> 0x02uy
    | "enemies" -> 0x03uy
    | "explosions" -> 0x04uy
    | name -> failwithf "Unknown subscript namespace: %s" name

// Make floats smaller
// https://www.ctrl-alt-test.fr/2018/making-floating-point-numbers-smaller/
let truncateb (f: float32) (bitsToKeep: int) =
    let initialIntBits = System.BitConverter.SingleToInt32Bits(f)
    let bitsToClear = 32 - bitsToKeep
    let truncationMask = -1 <<< bitsToClear
    let finalIntBits = initialIntBits &&& truncationMask
    System.BitConverter.GetBytes(finalIntBits)

let rec compile_expr (bytes: ResizeArray<byte>) = function
    | Ast.Number n ->
        // test if float is actually an integer that fits in a byte
        let intN = int n
        if float intN = n && intN >= 0 && intN <= 255 then
            bytes.Add(byte ExpOpcode.BYTE)
            bytes.Add(byte intN)
        else
            bytes.Add(byte ExpOpcode.CONSTANT)
            let bits = truncateb (float32 n) 16
            bytes.AddRange(bits)
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
    | Ast.Binop("==", x, y) ->
        bytes.Add(byte ExpOpcode.EQ)
        compile_expr bytes x
        compile_expr bytes y
    | Ast.Binop("<", x, y) ->
        bytes.Add(byte ExpOpcode.LT)
        compile_expr bytes x
        compile_expr bytes y
    | Ast.Binop("<=", x, y) ->
        bytes.Add(byte ExpOpcode.LTE)
        compile_expr bytes x
        compile_expr bytes y
    | Ast.Binop(">", x, y) ->
        compile_expr bytes (Ast.Binop("<", y, x))
    | Ast.Binop(">=", x, y) ->
        compile_expr bytes (Ast.Binop("<=", y, x))
    | Ast.Var ident when inlineDecls.ContainsKey(ident.Name) ->
        compile_expr bytes inlineDecls.[ident.Name]
    | Ast.Var ident ->
        bytes.Add(byte ExpOpcode.VAR)
        bytes.Add(0x00uy)
        let varId = getVarID ident.Name
        compile_expr bytes (Ast.Number (float varId))
        printfn "Compiling Var: %s with id %d" ident.Name varId
    | Ast.Subscript (ident, index) ->
        bytes.Add(byte ExpOpcode.VAR)
        bytes.Add(arrayId ident.Name)
        compile_expr bytes index
        printfn "Compiling Subscript of variable: %s[%A]" ident.Name index
    | Ast.FunCall (name, args) when functions.ContainsKey(name) ->
        let (opcode, argCount) = functions.[name]
        if argCount <> args.Length then
            failwithf "Function %s expects %d arguments but got %d" name argCount args.Length
        bytes.Add(opcode)
        for arg in args do
            compile_expr bytes arg
        printfn "Compiling function call %s" name
    | x -> failwithf "Expression type not implemented yet - %A" x

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
    | Ast.Assign (Ast.Var ident, expr) when inlineDecls.ContainsKey(ident.Name) ->
        compile_stmt bytes (Ast.Assign (inlineDecls.[ident.Name], expr))
    | Ast.Assign (Ast.Var ident, expr) ->
        bytes.Add(byte StmtOpcode.ASSIGN)
        bytes.Add(0x00uy)
        let varId = getVarID ident.Name
        compile_expr bytes (Ast.Number (float varId))
        compile_expr bytes expr
        printfn "Compiling Assign statement to variable: %s with id %d" ident.Name varId
    | Ast.Assign (Ast.Subscript (ident, index), expr) ->
        bytes.Add(byte StmtOpcode.ASSIGN)
        bytes.Add(arrayId ident.Name)
        compile_expr bytes index
        compile_expr bytes expr
        printfn "Compiling Assign statement to variable: %s[%A]" ident.Name expr
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
    | Ast.InlineDecl (ident, expr) ->
        inlineDecls.Add(ident.Name, expr)
    | x -> failwithf "Statement type not implemented yet - %A" x

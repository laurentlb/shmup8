module Parse

open FParsec.Primitives
open FParsec.CharParsers
open FParsec

let commentLine = parse {
    do! skipString "//"
    do! skipManyTill anyChar (followedBy newline) } |> attempt

let ws = (many (choice [spaces1; commentLine] <?> "") |>> ignore<unit list>)
let ch c = skipChar c >>. ws
let str s = skipString s >>. ws

let statement, stmtRef = createParserForwardedToRef()

let keywords = System.Collections.Generic.HashSet<_>([
  "if"; "while"; "for"
])

let keyword s = attempt (pstring s .>> notFollowedBy letter .>> notFollowedBy digit .>> notFollowedBy (ch '_')) .>> ws

let number =
    let r = @"-?(\d+\.?\d*|\.\d+)"
    let conv s =
        let ok, res = System.Double.TryParse(s : string)
        if ok then Ast.Number res
        else failwith ("invalid number: " + s)
    
    regex r .>> ws |>> conv

let opp = OperatorPrecedenceParser<_,_,_>()
let expr = opp.ExpressionParser

let parenExp = between (ch '(') (ch ')') expr

let argList = sepBy expr (ch ',')
let fcall = between (ch '(') (ch ')') argList |>>
            (fun args fct -> Ast.FunCall(fct, args))

let subscript = between (ch '[') (ch ']') expr |>> (fun index var -> Ast.Subscript(var, index))

let ident =
    let nonDigit = asciiLetter <|> pchar '_'
    let p = pipe3 getPosition nonDigit (manyChars (nonDigit <|> digit <?> "")) (
        fun pos c s -> {Ast.Ident.Name = c.ToString() + s})
    let p = p >>= (fun s -> if keywords.Contains(s.Name) then fail "ident is a keyword" else preturn s)
    (p .>> ws) <?> "identifier"

let primitive = choice [
                    parenExp;
                    attempt (pipe2 ident fcall (fun i f -> f i.Name));
                    attempt (pipe2 ident subscript (fun i sub -> sub i));
                    ident |>> Ast.Var;
                    number]
            <?> "expression"

do opp.TermParser <- primitive

// Operators
let precedence = [
    ["*"; "/"; "%"], Associativity.Left
    ["+"; "-"], Associativity.Left
    ["<"; ">"; "<="; ">="], Associativity.Left
    ["=="; "!="], Associativity.Left
    ["&&"], Associativity.Left
    ["^^"], Associativity.Left
    ["||"], Associativity.Left
]

// let simpleStatement = opt expr .>> ch ';' |>> (function Some exp -> Ast.ExprStmt exp | None -> Ast.Block [])
let simpleStatement = expr |>> Ast.ExprStmt

let assignmentStatement =
    pipe3 primitive (ch '=') expr (fun lvalue _ exp -> Ast.Assign(lvalue, exp))

let plusEqualStatement =
    pipe3 primitive (str "+=") expr (fun lvalue _ exp -> Ast.Assign(lvalue, Ast.Binop("+", lvalue, exp)))

let minusEqualStatement =
    pipe3 primitive (str "-=") expr (fun lvalue _ exp -> Ast.Assign(lvalue, Ast.Binop("-", lvalue, exp)))

let multEqualStatement =
    pipe3 primitive (str "*=") expr (fun lvalue _ exp -> Ast.Assign(lvalue, Ast.Binop("*", lvalue, exp)))

let sstatement =
    choice [attempt plusEqualStatement; attempt minusEqualStatement; attempt multEqualStatement; attempt assignmentStatement; simpleStatement]

let inlineDecl =
    let lvalue = keyword "inline" >>. ident
    let value = ch '=' >>. expr
    pipe2 lvalue value (fun lvalue value -> Ast.InlineDecl(lvalue, value))

let ifStatement =
    pipe3 (keyword "if" >>. parenExp) statement (opt (keyword "else" >>. statement))
        (fun cond stmt1 elseOpt ->
            match elseOpt with
            | Some stmt2 -> Ast.IfElse(cond, stmt1, stmt2)
            | None -> Ast.If(cond, stmt1)
        )

let whileLoop =
    pipe2 (keyword "while" >>. parenExp) statement
        (fun cond body -> Ast.While(cond, body))

let forLoop =
    let init = opt sstatement .>> ch ';' |>> (function Some st -> st | None -> Ast.Block [])
    let cond = expr .>> ch ';'
    let inc = opt sstatement .>> ch ')' |>> (function Some st -> st | None -> Ast.Block [])
    pipe4 (keyword "for" >>. ch '(' >>. init) cond inc statement
        (fun init cond inc statement -> Ast.Block [init; Ast.While(cond, Ast.Block [statement; inc])])

let blockStatement =
    between (ch '{') (ch '}') (many statement) |>> Ast.Block

stmtRef.Value <- choice [blockStatement; ifStatement; whileLoop; forLoop; inlineDecl; sstatement .>> ch ';'] <?> "statement"

do
    let mutable precCounter = 20 // we have at most 20 different precedence levels
    let addInfix li =
        for ops, assoc in li do
            precCounter <- precCounter - 1
            for op in ops do
                opp.AddOperator(InfixOperator(op, ws, precCounter, assoc, fun x y -> Ast.Binop(op, x, y)))

    addInfix precedence

let entrypoint = ws >>. many statement .>> eof

// subscript

let parse str =
    let res = runParserOnString entrypoint () "stream-name" str
    Printf.printf "%A\n" res
    match res with
        | Success (stmts, _, _) -> stmts
        | Failure (errMsg, _, _) -> failwith errMsg

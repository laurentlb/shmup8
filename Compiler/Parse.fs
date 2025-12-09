module Parse

open FParsec.Primitives
open FParsec.CharParsers
open FParsec

let commentLine = parse {
    do! skipString "//"
    do! skipManyTill anyChar (followedBy newline) } |> attempt

let ws = (many (choice [spaces1; commentLine] <?> "") |>> ignore<unit list>)
let ch c = skipChar c >>. ws

let keywords = System.Collections.Generic.HashSet<_>([
  "if"; "while"
])

let keyword s = attempt (pstring s .>> notFollowedBy letter .>> notFollowedBy digit .>> notFollowedBy (ch '_')) .>> ws

let number =
    let r = @"(\d+\.?\d*|\.\d+)"
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

let ident =
    let nonDigit = asciiLetter <|> pchar '_'
    let p = pipe3 getPosition nonDigit (manyChars (nonDigit <|> digit <?> "")) (
        fun pos c s -> {Ast.Ident.Name = c.ToString() + s})
    let p = p >>= (fun s -> if keywords.Contains(s.Name) then fail "ident is a keyword" else preturn s)
    (p .>> ws) <?> "identifier"

let primitive = choice [parenExp; ident |>> Ast.Var; number]
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
    // ["="; "+="; "-="; "*="; "/="], Associativity.Right
]

// let simpleStatement = opt expr .>> ch ';' |>> (function Some exp -> Ast.ExprStmt exp | None -> Ast.Block [])
let simpleStatement = expr .>> ch ';' |>> Ast.ExprStmt

let assignmentStatement =
    pipe3 ident (ch '=') expr (fun id _ exp -> Ast.Assign(id, exp)) .>> ch ';'

let statement = choice [attempt assignmentStatement; simpleStatement] <?> "statement"

do
    let mutable precCounter = 20 // we have at most 20 different precedence levels
    let addInfix li =
        for ops, assoc in li do
            precCounter <- precCounter - 1
            for op in ops do
                opp.AddOperator(InfixOperator(op, ws, precCounter, assoc, fun x y -> Ast.FunCall(Ast.Op op, [x; y])))

    addInfix precedence

let entrypoint = ws >>. many statement .>> eof

let parse() =
    let res = runParserOnString entrypoint () "stream-name" "a = 12 + 30; a;"
    Printf.printf "%A\n" res
    res

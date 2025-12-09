module Ast

type Ident = { Name: string }

type Expr =
    | Number of float
    | Var of Ident
    | FunCall of Expr * Expr list
    | Op of string
    | VerbatimExp of string

type Stmt =
    | ExprStmt of Expr
    | Assign of Ident * Expr
    //| If of Expr * Stmt list * Stmt list option
    //| While of Expr * Stmt list

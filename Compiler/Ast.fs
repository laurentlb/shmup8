module Ast

type Ident = { Name: string }

type Expr =
    | Number of float
    | Var of Ident
    | FunCall of string * Expr list
    | Subscript of Ident * Expr
    | Binop of string * Expr * Expr

type Stmt =
    | ExprStmt of Expr
    | Assign of Expr * Expr
    | Block of Stmt list
    | Print of Expr
    | If of Expr * Stmt
    | IfElse of Expr * Stmt * Stmt
    | While of Expr * Stmt
    //| If of Expr * Stmt list * Stmt list option
    //| While of Expr * Stmt list

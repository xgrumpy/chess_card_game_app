module Utils

open System
open System.IO
open System.Collections.Generic
open Microsoft

open System.Threading.Tasks

type Imperative<'T> = unit -> option<'T>

type ImperativeBuilder() = 
  member x.Combine(a, b) = (fun () ->
    match a() with 
    | Some(v) -> Some(v) 
    | _ -> b() )
  member x.Delay(f:unit -> Imperative<_>) : Imperative<_> = (fun () -> f()())
  member x.Return(v) : Imperative<_> = (fun () -> Some(v))
  member x.Zero() = (fun () -> None)
  member x.Run(imp) = 
    match imp() with
    | Some(v) -> v
    | _ -> failwith "Nothing returned!"
    
  member x.For(inp:seq<_>, f) =
    let rec loop(en:IEnumerator<_>) = 
      if not(en.MoveNext()) then x.Zero() else
        x.Combine(f(en.Current), x.Delay(fun () -> loop(en)))
    loop(inp.GetEnumerator())
  member x.While(gd, body) = 
    let rec loop() =
      if not(gd()) then x.Zero() else
        x.Combine(body, x.Delay(fun () -> loop()))
    loop()

let imperative = new ImperativeBuilder()  

let bodyString (ctx : AspNetCore.Http.HttpContext) =
    try 
        let e = Text.Encoding.UTF8 
        use reader = new StreamReader(ctx.Request.Body, e)
        reader.ReadToEndAsync()
    with ex -> 
        (ValueTask<string>("")).AsTask()

// Encode Guid as a special base64 string usable in URLs
let encodeSpecial (guid: Guid) =
    let encoded = Convert.ToBase64String(guid.ToByteArray())
    let replaced = encoded.Replace("/", "_").Replace("+", "-")
    replaced.Substring(0, 22)

// Decode the special string usable in URLs as a guid
let decodeSpecial(value: string) =
    let replaced = value.Replace("_", "/").Replace("-", "+")
    let buffer = Convert.FromBase64String(replaced + "==")
    new Guid(buffer)
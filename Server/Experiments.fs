module Experiments
open Messages
open State
open Chiron
open Giraffe


// ---------------------------------
// Models
// ---------------------------------

type Message =
    {
        Text : string
    }

// ---------------------------------
// Views
// ---------------------------------

module Views =
    open Giraffe.ViewEngine

    let layout (content: XmlNode list) =
        html [] [
            head [] [
                title []  [ encodedText "GiraffeExample" ]
                link [ _rel  "stylesheet"
                       _type "text/css"
                       _href "/main.css" ]
            ]
            body [] content
        ]

    let partial () =
        h1 [] [ encodedText "GiraffeExample" ]

    let index (model : Message) =
        [
            partial()
            p [] [ encodedText model.Text ]
        ] |> layout


let indexHandler (name : string): HttpHandler =
    let greetings = sprintf "Hello %s, from Giraffe!" name
    let model     = { Text = greetings }
    let view      = Views.index model
    htmlView view







open System.Text.Json
open System.Text.Json.Serialization


let options =
    JsonFSharpOptions.Default()
        // Add any .WithXXX() calls here to customize the format
        .ToJsonSerializerOptions()

// this is for experimenting with stuff in the product
let experiments_main argv =
    let p:Pairing = 
        { White = UserOfToken "hello"
          Black = UserOfToken "something" 
          BTime = 9999
          WTime = 9999 }

    let g = freshGame(p)
    let s = (Json.serialize >> Json.format) g

    //printfn "%A" out
    printfn "----"
    printfn "%s" s

    printfn "-----"

    let kk:Option<string> = None
    let za = ToJsonDefaults.ToJson kk

    let mmm = Map.ofList ["a","b"; "c", "d"]
    let kkk:Option<string> = None
    let sss = JsonSerializer.Serialize({| x = "Hello"; y = ["world!"; "blah"]; z = mmm; nn=kkk |}, options)
    printfn "%s" sss
    0 // return an integer exit code
module Messages

open Chiron

//type Card = string


type Move = { Source:string; Destination:string} with
    static member FromJson( _: Move) = json {
        let! src = Json.read "src"
        let! dst = Json.read "dst" 
        return {Source = src; Destination = dst}
    }

    static member ToJson( m:Move) = json {
        do! Json.write "src" m.Source
        do! Json.write "dst" m.Destination
    }

type ValidMove = {
    Source:string
    Destination:string
    ParsedSource: int*int
    ParsedDestination: int*int 
} with 
    static member ToJson( m:ValidMove) = json {
        do! Json.write "src" m.Source
        do! Json.write "dst" m.Destination
    }


// Incoming messages

type MoveMsg = {
  User: string
  Move: Move
  Card: Option<string>
  Suit: Option<string>
  Position: Map<string,string>
  SourcePosition: Map<string,string>
} with
    static member FromJson (_ :MoveMsg) = json {
        let! u = Json.read "user"
        let! m = Json.read "move"
        let! crd = Json.tryRead "card" 
        let! suit = Json.tryRead "suit"
        let! pos = Json.read "position"
        let! spos = Json.read "source_position"
        
        return { 
            MoveMsg.User = u
            Move = m
            Card = crd
            Suit = suit
            Position = pos 
            SourcePosition = spos }
    }


type CrtGameMsg = {
    WhiteToken:string
    BlackToken:string
} with
    static member FromJson (_ :CrtGameMsg) = json {
        let! w = Json.read "white_token"
        let! b = Json.read "black_token"

        return { CrtGameMsg.WhiteToken = w; BlackToken = b}
    }

type SwapMsg = {
    User: string
    Card: string 
} with 
    static member FromJson (_ :SwapMsg) = json {
        let! u = Json.read "user"
        let! c = Json.read "card"
        return { SwapMsg.User = u; Card = c}
    }


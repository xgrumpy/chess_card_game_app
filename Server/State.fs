module rec State
open Chiron
open FsToolkit.ErrorHandling
open Messages
open Microsoft.Extensions.Logging
open Db

type CardsRank = A | K | Q | J | Ten | Nine with 
    override x.ToString() = 
        match x with 
        | A -> "A"
        | K -> "K"
        | Q -> "Q"
        | J -> "J"
        | Ten -> "10"
        | Nine -> "9"
    
    static member FromString(x:string) = 
        match x with 
        | "A" -> Some A
        | "K" -> Some K
        | "Q" -> Some Q
        | "J" -> Some J
        | "10" -> Some Ten
        | "9" -> Some Nine
        | _ -> None
        

    static member All() = [A;K;Q;J;Ten;Nine]

type CardSuit = Spades | Clubs | Hearts | Diams with
    override x.ToString() =
        match x with
        | Spades -> "♠"
        | Clubs -> "♣"
        | Hearts -> "♥"
        | Diams -> "♦"

    static member FromString(x:string) =
        match x with
        | "♠" -> Some Spades
        | "♣" -> Some Clubs
        | "♥" -> Some Hearts
        | "♦" -> Some Diams
        | _ -> None

    static member All() = [Spades; Clubs; Hearts; Diams]

type CompositeCard = { Rank:CardsRank; Suit:CardSuit } with
    override x.ToString() = x.Rank.ToString() + x.Suit.ToString()
    static member FromString(s:string) =
        if s.Length = 2 || s.Length = 3 then
            let last = s.Length - 1          
            //printfn "Converting %A and %A" s[0..last-1] s[last..last]
            let rank = CardsRank.FromString <| s[0..last-1]
            let suit = CardSuit.FromString <| s[last..last]
            let map f = Option.map2 f rank suit
            map <| fun r s -> {Rank=r;Suit=s}
        else 
            //printfn "%A is not 2 or 3 chars" s
            None


    static member FullDeck() = [|
        for x in CardsRank.All() do
            for y in CardSuit.All() do
                yield {Rank=x;Suit=y}
    |]

    static member RandomDeck() =
        let org = CompositeCard.FullDeck()
        let rng = new System.Random()
        let arr = Array.copy org
        let max = (arr.Length - 1)
        let randomSwap (arr:_[]) i =
            let pos = rng.Next(max)
            let tmp = arr.[pos]
            arr.[pos] <- arr.[i]
            arr.[i] <- tmp
            arr
    
        [|0..max|] |> Array.fold randomSwap arr


let squareToCoords (s:string) =
    if s.Length <> 2 then None
    else 
        let s = s.ToLower() 
        let a = int 'a'
        let h = int 'h'
        let col = int s[0]
        let row = int s[1]
        Some (col - a, row - (int '1'))

let coordsToSquare (col:int,row:int) = 
    let c = col + (int 'a')
    let r = row + (int '1')
    $"{char c}{char r}"


// computes trump suit given the coords 
let coordsToSuit (col, row) =
    let rowEven = (row + 1) % 2 = 0
    let colEven = (col + 1) % 2 = 0

    match rowEven, colEven with 
    | true, true -> Spades
    | true, false -> Hearts
    | false, true -> Diams
    | false, false -> Clubs

    

type TurnColor = White | Black with
    member x.Counterpart = 
        match x with | White -> Black | Black -> White
    member x.ToPieceColor() =
        match x with | White -> "w" | Black -> "b"


type Turn = SideToMove of TurnColor | RespondTo of TurnColor * ValidMove * CompositeCard * proposed: Map<string,string> with
    static member ToJson(t:Turn) = json {
            match t with
            | SideToMove White -> do! Json.write "turn" "white"
            | SideToMove Black -> do! Json.write "turn" "black"
            | RespondTo (White, m,c, _) -> 
                do! Json.write "turn" "black"
                do! Json.write "card" (c.ToString())
                do! Json.write "move" m
            | RespondTo (Black,m,c, _ ) -> 
                do! Json.write "turn" "white"
                do! Json.write "card" (c.ToString())
                do! Json.write "move" m
        }


type User = UserOfToken of string with 
    static member ToJson(u:User) = 
        let (UserOfToken uu) = u
        ToJsonDefaults.ToJson uu


type Pairing = {White:User; Black:User} with
    static member ToJson(p:Pairing) = json {
        do! Json.write "white" p.White
        do! Json.write "black" p.Black
    }

type CardDistribution = {
    WhiteHand: array<CompositeCard> * array<CompositeCard> // At most 10 cards
    BlackHand: array<CompositeCard> * array<CompositeCard> // At most 10 cards
    Reserve: array<CompositeCard> // 4 cards to choose from
    WhiteUsageOfReserve: bool * bool
    BlackUsageOfReserve: bool * bool
} with 
    member x.ByExchangingReserve(c:CompositeCard, userIsWhite:bool) = 
        let getHand() = if userIsWhite then x.WhiteHand else x.BlackHand
        let getUsageOfReserve() = if userIsWhite then x.WhiteUsageOfReserve else x.BlackUsageOfReserve

        try 
            let head, tail = x.Reserve |> Array.splitAt 1
            let h = head[0]

            //printfn "tail: %A" tail

            let firstHand, secondHand = getHand()
            let idx1 = Array.tryFindIndex (fun e -> e = c) firstHand
            let idx2 = Array.tryFindIndex (fun e -> e = c) secondHand

            let usage, reserve' = 
                match idx1, idx2, getUsageOfReserve() with 
                | Some i, _, (false, uu) -> firstHand[i] <- h; (true, uu), tail
                | _, Some i, (uu, false) -> secondHand[i] <- h; (uu, true), tail
                | _, _, uu -> uu, x.Reserve
            
            if userIsWhite then
                {x with WhiteUsageOfReserve = usage; Reserve = reserve' }
            else 
                {x with BlackUsageOfReserve = usage; Reserve = reserve' }
        with 
            | _ -> x // this happens when reserves are depleted


    member x.ByRemovingCard(card:CompositeCard, userIsWhite:bool) = 
        let dealWithoutCard (c:CompositeCard) =    
            let getHand() = if userIsWhite then x.WhiteHand else x.BlackHand
            let setDeal(d:CompositeCard array * CompositeCard array) = if userIsWhite then {x with WhiteHand = d} else {x with BlackHand = d} 
            
            let a, b = getHand()
            let idx1 = Array.tryFindIndex (fun e -> e = c) a
            let idx2 = Array.tryFindIndex (fun e -> e = c) b

            match idx1, idx2 with 
            | Some i, _ -> setDeal (Array.removeAt i a, b)
            | _, Some i -> setDeal (a, Array.removeAt i b)
            | None, None -> x
        
        let d = dealWithoutCard card
        if d.IsEmpty() then CardDistribution.RandomDeal() else d

    member x.IsEmpty() =
        let empty = Array.empty, Array.empty
        x.WhiteHand = empty && x.BlackHand = empty

    static member RandomDeal() =
        let deck = CompositeCard.RandomDeck() // 24 cards

        // tamper with the deal so that each side has a red Jack
        // this is used for testing purposes
        let tamperWithDeal() =
            let aa = { CompositeCard.Rank=J; CompositeCard.Suit=Hearts}
            let bb = { CompositeCard.Rank=J; CompositeCard.Suit=Diams}

            let aaidx = deck |> Array.findIndex (fun x -> x = aa)
            let bbidx = deck |> Array.findIndex (fun x -> x = bb)

            let tmp = deck[0]
            deck[0] <- deck[aaidx]
            deck[aaidx] <- tmp

            let tmp = deck[11]
            deck[11] <- deck[bbidx]
            deck[bbidx] <- tmp

        // When we tamper with the deal we make the first hand has red jacks on both sides
        // tamperWithDeal()
                 
        let (white,rest) = Array.splitAt 10 deck
        let (black,rest) = Array.splitAt 10 rest

        let a, b = Array.splitAt 5 white
        let c, d = Array.splitAt 5 black

        { WhiteHand = a, b; BlackHand = c,d; Reserve = rest; WhiteUsageOfReserve = (false, false); BlackUsageOfReserve = (false,false) }

    static member ToJson(t:CardDistribution) =
        let tostr x = x.ToString()
        let map = Array.map
        let isEmpty = Array.isEmpty

        let w1, w2 = t.WhiteHand
        let b1, b2 = t.BlackHand

        let white = if isEmpty w1 then w2 else w1
        let black = if isEmpty b1 then b2 else b1   

        let res = t.Reserve |> Array.map tostr   
        json {
            do! Json.write "white_hand" (white |> map tostr)
            do! Json.write "black_hand" (black |> map tostr)
            do! Json.write "reserve" res
            do! Json.write "white_usage" t.WhiteUsageOfReserve
            do! Json.write "black_usage" t.BlackUsageOfReserve 
        }

type GameResult = Undefined | Wins of TurnColor with
    override x.ToString() =
        match x with 
        | Undefined -> "*"
        | Wins White -> "1-0"
        | Wins Black -> "0-1"

     

type GameState = {
    Turn:Turn
    Position:Map<string,string>
    DefendingCard:Option<CompositeCard>
    WhiteCanCastle:bool
    BlackCanCastle:bool
    EnpassantSquare:Option<string>
    Pairing:Pairing
    Deal:CardDistribution
    Result:GameResult
} with 
    static member ToJson(t:GameState) = json {
        do! Json.write "turn" t.Turn
        do! Json.write "position" t.Position
        do! Json.write "pairing" t.Pairing
       // do! Json.write "prev_position" t.ProposedPosition
        do! Json.write "white_can_castle" t.WhiteCanCastle
        do! Json.write "black_can_castle" t.BlackCanCastle
        do! Json.write "enpassant_square" t.EnpassantSquare
        do! Json.write "card_distribution" t.Deal
        do! Json.write "defending_card" (t.DefendingCard |> Option.map (fun x->x.ToString()))
        do! Json.write "result" (t.Result.ToString())
    }

type GameStateAndIdentifier = {
    Identifier:string
    Game:GameState
    UserIsWhite:bool
} with 
    static member ToJson(s:GameStateAndIdentifier) = json {
        do! Json.write "id" s.Identifier
        do! Json.write "game" s.Game
        do! Json.write "user_is_white" s.UserIsWhite
    }
        

let freshGame (p:Pairing) = 
    let files = ["a";"b";"c";"d";"e";"f";"g";"h"]
    let wK = ["e1" , "wK"]
    let bK = ["e8" , "bK"]
    let wQ = ["d1" , "wQ"]
    let bQ = ["d8" , "bQ"]
    let wR = ["a1" , "wR"; "h1", "wR"]
    let bR = ["a8" , "bR"; "h8", "bR"]
    let wN = ["b1" , "wN"; "g1", "wN"]
    let bN = ["b8" , "bN"; "g8", "bN"]
    let wB = ["c1", "wB"; "f1", "wB"]
    let bB = ["c8", "bB"; "f8", "bB"]

    let wP = files |> List.map (fun fl -> $"{fl}2", "wP")        
    let bP = files |> List.map (fun fl -> $"{fl}7", "bP")        

    let ww = [wK; wQ; wR; wB; wN; bK; bQ; bR; bN; bB] @ [wP; bP;]
    let ww = ww |> List.collect id // flatten

    {   GameState.Turn = SideToMove White
        Position = Map.ofList(ww)
        EnpassantSquare = None
        Pairing = p
        Deal = CardDistribution.RandomDeal()
        WhiteCanCastle = true
        BlackCanCastle = true
        Result = Undefined
        DefendingCard = None
    }

type GamesArchive() =
    let mutable games = Map.empty<string, GameState> 
    let mutable gamesByUser = Map.empty<User, Set<string>>

    let userGames (user:User) = gamesByUser |> Map.tryFind user |> Option.defaultValue (Set.empty)
    let userGamesWithData (user:User) =
        userGames user |> Set.map (fun id -> id, games[id])

    let upsert (user:User, gameId:string) =
        gamesByUser <- gamesByUser |> Map.add user ((userGames user).Add gameId)

    // if all user's games are decided then can add new game
    member _.TryAddPairing(p:Pairing) =
        let white = userGames p.White
        let black = userGames p.Black

        // if user isn't playing herself
        let canAdd = p.White <> p.Black
        // can add if all the users games are decided
        let canAdd = canAdd && Set.union white black |> Set.forall (fun s -> games[s].Result <> Undefined)

        if canAdd then
            // remove all completed games between the two users
            let partitionIntoKeepAndKill = Set.partition (
                fun s ->
                    let g = games[s] in g.Pairing <> p && g.Pairing <> { White = p.Black; Black = p.White})


            let (keepW,killW) = partitionIntoKeepAndKill white
            let (keepB,killB) = partitionIntoKeepAndKill black

            gamesByUser <- gamesByUser |> Map.add p.White keepW
            gamesByUser <- gamesByUser |> Map.add p.Black keepB

            let killSet = Set.union killW killB
            for e in killSet do
                games <- games |> Map.remove e
        
            // add new stuff
            let guid = Utils.encodeSpecial <| System.Guid.NewGuid()
            games <- games |> Map.add guid (freshGame p)
            upsert (p.White, guid)
            upsert (p.Black, guid)
            Some (guid)
        else 
            None

    member _.CurrentOrFinishedGameForUser(user:User) = 
        let ug = userGamesWithData user
        let ongoing, completed = ug |> Set.partition (fun (id, game) -> game.Result = Undefined) 

        match ongoing.Count, completed.Count with 
        | 0, 0 -> None
        | 0, _ -> completed |> Set.toSeq |> Seq.head |> Some
        | _ -> ongoing |> Set.toSeq |> Seq.head |> Some
   
    member _.TryUpdateGame (id:string) (upFunc:GameState->GameState) =
        option {
            let! g = games |> Map.tryFind id
            let res = upFunc g
            games <- games |> Map.add id res
            return res
        }


type Chnl<'T> = AsyncReplyChannel<'T>


// translated by GPT from Typescript, this is currently unused but will be used when we gen FEN in the logs
let squeezeFenEmptySquares (fen: string) = 
    fen .Replace("11111111", "8")
        .Replace("1111111", "7")
        .Replace("111111", "6")
        .Replace("11111", "5")
        .Replace("1111", "4")
        .Replace("111", "3")
        .Replace("11", "2")




    

type AgenentMsgData = {
    User:User
    Move:ValidMove
    MaybeCard:Option<CompositeCard>
    MaybeSuit:Option<CardSuit>
    SourcePosition:Map<string,string>
    ProposedPosition:Map<string,string>    
} with
    member x.ToLogDescription() = 
        let (UserOfToken u) = x.User
        let mv = $"{x.Move.Source} - {x.Move.Destination}"
        //let s = board_to_fen x.SourcePosition
        $"User {u} made a move {mv}\n" +
        $"Source position: ..."
        


type AgentMsg = 
    | CreateGame of white:string * black:string * Chnl<Option<string * Pairing>> 
    | MakeSimpleMove of AgenentMsgData * ILogger * Chnl<Option<GameStateAndIdentifier>>
    | GetState of User * Chnl<Option<GameStateAndIdentifier>>
    | Resign of User * Option<TurnColor>
    | SwapCard of User * CompositeCard * Chnl<Option<GameStateAndIdentifier>> 

// given an opening card, a response card, and a trump suit 
// returns true if opening card beats response card
let euchreComparator (trumpSuit:CardSuit) (opening:CompositeCard) (response:CompositeCard) =
    //printfn "Comparing opening: %A to: %A" opening response

    let cc r s = {CompositeCard.Rank = r; Suit=s}
    let tt r = cc r trumpSuit
    let oo r = cc r opening.Suit

    let counterSuit = function
        | Spades -> Clubs
        | Clubs -> Spades
        | Diams -> Hearts
        | Hearts -> Diams

    let otherJ = cc J (counterSuit trumpSuit)
    let trupRun = [tt J; tt A; tt K; tt Q; tt Ten; tt Nine ]
    let openingRun = [oo A; oo K; oo Q; oo J; oo Ten; oo Nine ]

    let run = if trumpSuit = opening.Suit then trupRun else trupRun @ openingRun

    // remove otherJ from the run 
    let run' = run |> List.collect (fun c -> if c = otherJ then [] else [c] )
    let run'' = run' |> List.insertAt 1 otherJ

    // opening card must exist in the list.. this should never throw
    let opnIndex = run'' |> List.findIndex (fun e -> e = opening)
    let respIndex = run'' |> List.tryFindIndex (fun e -> e = response)

    match respIndex with 
    | None -> 
        // opening beats response false
        //printfn "Response looses"
        false
    | Some idx ->
        //printfn "Responce beats opening: %A" (opnIndex > idx)
        opnIndex >= idx 

type PieceCode = 
    | King of TurnColor 
    | Queen of TurnColor
    | Bishop of TurnColor
    | Knight of TurnColor
    | Rook of TurnColor
    | Pawn of TurnColor
    with 
    static member fromString(s:string):Option<PieceCode> = 
       // let errStr = sprintf "%A: has format error" s
        if s.Length <> 2 then
            None
        else
            option {
                let! clr = if s[0] = 'w' then Some White else if s[0] = 'b' then Some Black else None

                match s[1] with 
                | 'K' -> return King clr
                | 'Q' -> return Queen clr
                | 'N' -> return Knight clr
                | 'B' -> return Bishop clr
                | 'P' -> return Pawn clr
                | 'R' -> return Rook clr
                | _ -> return! None
            }

    member x.toString() =
        match x with
        | King c -> c.ToPieceColor() + "K"
        | Queen c -> c.ToPieceColor() + "Q"
        | Bishop c -> c.ToPieceColor() + "B"
        | Knight c -> c.ToPieceColor() + "N"
        | Rook c -> c.ToPieceColor() + "R"
        | Pawn c -> c.ToPieceColor() + "P"




let makeMove (sourcePiece:PieceCode, moveData:AgenentMsgData, data:GameStateAndIdentifier):GameState =
    //printfn "Making a move: %A" moveData
    let move = moveData.Move
    let state = data.Game
    let { Position = position; Deal = deal; Turn = currentTurn } = state

    let dstPiece = position |> Map.tryFind move.Destination |> Option.bind PieceCode.fromString

    // comparator with trump suit
    let trumSuit = move.ParsedDestination |> coordsToSuit
    let comparator = euchreComparator trumSuit

    let nextDeal c = deal.ByRemovingCard (c, data.UserIsWhite)

    // side effects wil change these two variables
    let mutable ep = None
    let mutable defendingCard = None
    let mutable result = state.Result
    //let mutable proposed = None:Option<Map<string,string>>

    let computeCaptureMove (crd:CompositeCard) (color:TurnColor) =
        let suit = moveData.MaybeSuit |> Option.defaultValue crd.Suit
        let crd' = {crd with Suit = suit}

        // proposed <- Some moveData.ProposedPosition        
        // in most cases crd' is same as crd, but is suit is present we sub
        position, RespondTo (color, move, crd', moveData.ProposedPosition), (nextDeal crd)

    let computeResponseToMove (crd:CompositeCard) (color:TurnColor) (currentMove:ValidMove) (currentCard:CompositeCard) (proposedPos:Map<string,string>) =
        // standard chess capture when the attacking piece eats the attacked
        let standardCapture () = 
            let killSquare (clr:TurnColor) =
                let (c,r) = currentMove.ParsedDestination
                let offset = if clr = White then -1 else +1
                coordsToSquare (c,r + offset)

            let position = 
                match sourcePiece, state.EnpassantSquare with 
                | Pawn (clr), Some ep  -> 
                    //printfn $"Computing enpassant capture on {killSquare clr}"
                    //position |> Map.remove (killSquare clr)
                    proposedPos |> Map.remove (killSquare clr)
                | _ -> proposedPos

            //position |> Map.add move.Destination (sourcePiece.toString()) |> Map.remove move.Source
            position
            

           


        // an outcome where the attacker fails
        let failedCapture = position |> Map.remove move.Source 

        let outcome = comparator currentCard crd
        defendingCard <- Some crd

        let pos =
            if outcome then
                match sourcePiece with
                | King (clr) -> 
                    // keep the position as is because the change of turn yields checkmate
                    result <- Wins clr.Counterpart 
                    position
                | _ -> 
                    // nothing special to do for position
                    //printfn "Failed capture"
                    failedCapture
            else 
                //printfn "Standard capture"
                standardCapture ()

        pos, SideToMove(color.Counterpart), (nextDeal crd)

    let skip = position, currentTurn, deal
    let position', nextTurn, deal'  = 
        match dstPiece, moveData.MaybeCard, currentTurn  with
        | None, None, SideToMove color -> 
            // making a simple move
            
            // let us see if needs to be an enpassant move
            let files = ["a";"b";"c";"d";"e";"f";"g";"h"]
            let vecToEpsquare () = 
                if color = White then 
                    files |> List.map (fun a -> (a+"2", a+"4"), a+"3")
                else 
                    files |> List.map (fun a -> (a+"7", a+"5"), a+"6")
            
            // establishing ep square
            ep <-
                match sourcePiece with
                | Pawn c when c = color -> 
                    Map.ofList (vecToEpsquare()) |>
                    Map.tryFind (move.Source, move.Destination)
                | _ -> None


            moveData.ProposedPosition, SideToMove(color.Counterpart), deal
        | None, Some crd, SideToMove color ->
            if state.EnpassantSquare.IsSome then
                // propagating ep square to next state
                ep <- state.EnpassantSquare
                //printfn "Making enpassant capture"
         
            computeCaptureMove crd color
        | Some _, Some crd, SideToMove color ->            
            computeCaptureMove crd color

        | Some _, Some crd, RespondTo (color, currentMove, currentCard, ppos) when currentMove = move ->      
            computeResponseToMove crd color currentMove currentCard ppos
        | None, Some crd, RespondTo (color, currentMove, currentCard, ppos) when currentMove = move ->   
            // the en-passant case
            if state.EnpassantSquare.IsSome then
                computeResponseToMove crd color currentMove currentCard ppos
            else
                skip
                
        | _ ->  skip

    let whiteCan, blackCan = 
        match sourcePiece with 
        | King White -> false, state.BlackCanCastle
        | King Black -> state.WhiteCanCastle, false
        | Rook White when move.Source = "a1" || move.Source = "h1" -> false, state.BlackCanCastle 
        | Rook Black when move.Source = "a8" || move.Source = "h8" ->  state.WhiteCanCastle, false
        | _ -> state.WhiteCanCastle, state.BlackCanCastle

    { state with 
        Position = position'
        Turn = nextTurn
        Deal = deal'
        WhiteCanCastle = whiteCan 
        BlackCanCastle = blackCan 
        Result = result 
        DefendingCard = defendingCard
        EnpassantSquare = ep } 

    


let mainAgentFunc (inbox:MailboxProcessor<AgentMsg>) = async {
    let archive = GamesArchive()

    let make a b c = {Identifier = a; Game = b; UserIsWhite = c}
    let dataForUser usr =
        let mapf x = Option.bind x (archive.CurrentOrFinishedGameForUser(usr))
        mapf <| fun (gameid, game) ->
            if usr = game.Pairing.White then 
                make gameid game true |> Some
            else if usr = game.Pairing.Black then 
                make gameid game false |> Some
            else
                None 

    while true do 
        match! inbox.Receive() with
        | CreateGame (w, b, chnl) ->
            let p = {White = UserOfToken w; Black = UserOfToken b}  
            lobbyAgent.Post (Lobby.LobbyMessage.Remove p.White)
            lobbyAgent.Post (Lobby.LobbyMessage.Remove p.Black)

            archive.TryAddPairing p
                |> Option.map (fun gid -> gid, p) |> chnl.Reply

        | SwapCard (user, card, chnl) ->
            option {
                let! {Identifier = id; UserIsWhite = isWhite} = dataForUser (user)
                let! game = archive.TryUpdateGame id <| 
                            fun g -> {g with Deal = g.Deal.ByExchangingReserve(card, isWhite)}
                return (make id game isWhite) 
            } |> 
            chnl.Reply 

        | MakeSimpleMove (moveData, logger, chnl) -> 
            option {
                let! data = dataForUser (moveData.User)
                sprintf "in: %A" (moveData.ToLogDescription()) |> logger.LogTrace
                sprintf "data: %A" data |> logger.LogTrace
                if data.Game.Position <> moveData.SourcePosition then 
                    return! None

                let! src = data.Game.Position |> Map.tryFind moveData.Move.Source
                let! code = PieceCode.fromString src
                let nextState = makeMove (code, moveData, data)

                let! _ = 
                    archive.TryUpdateGame data.Identifier <| 
                        fun _ -> nextState

                return! dataForUser moveData.User 
            } |> chnl.Reply
        | Resign (usr, sideToResign) ->
            match dataForUser usr with
            | Some data ->
                if (data.Game.Result = Undefined) then
                    let (UserOfToken w) = data.Game.Pairing.White
                    let (UserOfToken b) = data.Game.Pairing.Black
                    let lw = userById w
                    let lb = userById b

                    let r = 
                        match sideToResign with
                        | None -> if data.UserIsWhite then Wins Black else Wins White
                        | Some sideToResign -> if sideToResign = White then Wins Black else Wins White
                    
                    let proceed (rw:int, rb:int) = 
                        archive.TryUpdateGame (data.Identifier) (fun g -> {g with Result = r}) |> ignore
                        let wstat = updateRating (w,rw)
                        let bstat = updateRating (b,rb)
                        printfn "Updated rating: %A and %A" (w,wstat,rw) (b,bstat,rb)

                    if lw <> [] && lb <> [] then
                        let hw = lw.Head
                        let hb = lb.Head
                        match r with 
                        | Wins White -> 
                            (hw.Rating + 10, max (hb.Rating - 10) 0) |> proceed
                        | Wins Black -> 
                            (max (hw.Rating - 10) 0, hb.Rating + 10) |> proceed
                        | Undefined -> raise (System.Diagnostics.UnreachableException())
            | None -> ()
            
            
        | GetState (usr, chnl) ->
            dataForUser usr |> chnl.Reply
    }

let mainAgent = mainAgentFunc |> MailboxProcessor.Start 



module Lobby =
    type LobbyDatum = {User:string;Rating:int;Timestamp:int64}
    type LobbyMessage = 
        | Add of User
        | Remove of User 
        | GetRecent of limit:int * Chnl<LobbyDatum list> 
        | RemoveExpired

    // Data structure encapsulating a registration order index on users
    type RegistrationOrderIndex() =
        let mutable counter:int64 = 0
         // order users by registration order
        let mutable forward = Map.empty<int64,User>
        let mutable inverse = Map.empty<User,int64>
    with
        member _.Snapshot = forward
        member _.Take n = Map.toSeq forward |> Seq.truncate n

        member _.Register u =
            if not (inverse.ContainsKey u) then
                forward <- forward |> Map.add counter u
                inverse <- inverse |> Map.add u counter
                counter <- counter + 1L

        member _.Remove u = 
            try 
                let i = inverse[u]
                forward <- forward |> Map.remove i
                inverse <- inverse |> Map.remove u
                true
            with _ -> false

    let rec lobbyAgentFunc (inbox:MailboxProcessor<LobbyMessage>) = async {
        let now() = System.DateTimeOffset.Now.ToUnixTimeSeconds()
        let regIndex = RegistrationOrderIndex()

        let mutable lobby = Map.empty<User, {|Rating:int; Timestamp:int64|}>

        let deregisterUser u = 
            lobby <- lobby |> Map.remove u
            regIndex.Remove u |> ignore

        while true do 
            match! inbox.Receive() with
            | Add (u) ->
                let (UserOfToken uid) = u
                match userById(uid:string) with 
                | [] -> ()
                | head::_ ->
                    let datum = {|Rating = head.Rating; Timestamp = now() |} 
                    lobby <- lobby |> Map.add u datum
                    regIndex.Register u
            | Remove u ->
                deregisterUser u
            | GetRecent (n, cnl) ->
                let tm = now()
                [ for (_,user) in regIndex.Take n do
                    let datum = lobby.TryFind user
                    let (UserOfToken u) = user
                    if datum.IsSome then
                        let datum = Option.get datum
                        yield {LobbyDatum.User=u;Rating=datum.Rating;Timestamp=tm - datum.Timestamp}
                ] |> cnl.Reply
            | RemoveExpired -> 
                // this will be called every some interval...
                let (threshold, tm) = (600 (* seconds *), now() (* seconds *))
                for KeyValue(user,datum) in lobby do
                    if tm - datum.Timestamp >= threshold then
                        deregisterUser user
    } 

    and timerTrigger (inbox:MailboxProcessor<LobbyMessage>):Async<unit> = async {
        let! _ = Async.Sleep(5000)
        inbox.Post RemoveExpired
        return! timerTrigger (inbox) 
    }

    and buildLobbyAgent() =
        let lobbyAgent = lobbyAgentFunc |> MailboxProcessor.Start
        timerTrigger(lobbyAgent) |> Async.Start
        lobbyAgent

let lobbyAgent: MailboxProcessor<Lobby.LobbyMessage> = Lobby.buildLobbyAgent()


open System
open System.IO
open System.Text.Json
open Microsoft
open Microsoft.AspNetCore.Builder
open Microsoft.AspNetCore.Cors.Infrastructure
open Microsoft.AspNetCore.Hosting
open Microsoft.Extensions.Hosting
open Microsoft.Extensions.Logging
open Microsoft.Extensions.DependencyInjection
open FsToolkit.ErrorHandling


open Giraffe
open System.Threading.Tasks
open State

open Microsoft.AspNetCore.SignalR
open Microsoft.FSharpLu

// For some reason things don't work wel if Ply nuget is not included
open FSharp.Control.Tasks

open System.Text
open Chiron
open Utils
open Messages
open Experiments

open Thoth.Json.Net
open Microsoft.FSharp.Core
open Db
open State.Lobby

open System.Net
open System.Net.Mail

open MailKit.Net.Smtp
open MailKit.Security
open MimeKit

open SendGrid
open SendGrid.Helpers.Mail

// SignalR connection id -> uid
let connections = new Collections.CacheMap<string,User>()


type IClientApi = 
  abstract member AuthStatus: string -> Task
  abstract member RespondToChallenge: string -> Task
  abstract member GoToGame: string -> Task

let groupNameForActiveFeed = "UF"
let groupNameForLobbyFeed = "LF"
let groupNameForUser uid = $"U: {uid}"

type GameHub () =
    inherit Hub<IClientApi>()

    let whenAuthenticated (hub:GameHub) (run:string->Task):Task = task {
        let cid = hub.Context.ConnectionId
        match connections.TryGetValue cid with 
        | None -> 
            return ()
        | Some (UserOfToken uid) -> 
            let! _ = run(uid)
            return ()
    }

    let whenAuthenticatedString (hub: GameHub) (run: string -> Task<string>): Task<string> = task {
        let cid = hub.Context.ConnectionId
        match connections.TryGetValue(cid) with 
        | None ->  
            return ""
        | Some (UserOfToken uid) -> 
            return! run(uid)
    }

    override _.OnConnectedAsync():Task = 
        Console.WriteLine("Connecting...")
        Task.CompletedTask

    override x.OnDisconnectedAsync (e:exn):Task = 
        whenAuthenticated (x) <| fun _ -> task {
            let cid = x.Context.ConnectionId
            match connections.TryGetValue cid with 
            | None ->
                return ()
            | Some (UserOfToken uid) -> 
                let! _ = x.Groups.RemoveFromGroupAsync(cid, groupNameForUser uid)
                let! _ = x.Groups.RemoveFromGroupAsync(cid, groupNameForActiveFeed)
                let! _ = x.Groups.RemoveFromGroupAsync(cid, groupNameForLobbyFeed) 
                connections.Remove cid |> ignore
        
            Console.WriteLine(sprintf "SignalrR disconnecting: %A" e)
        }

    member x.SubscribeToActiveUsersFeed() = 
        whenAuthenticated (x) <| fun _ ->        
            x.Groups.AddToGroupAsync(x.Context.ConnectionId,groupNameForActiveFeed)

    member x.UnSubscribeFromActiveUsersFeed() =
        whenAuthenticated (x) <| fun _ ->
            x.Groups.RemoveFromGroupAsync(x.Context.ConnectionId,groupNameForActiveFeed)

    member x.SubscribeToLobbyFeed() = 
        printfn "Subscribing to lobby"
        whenAuthenticated (x) <| fun _ ->
            x.Groups.AddToGroupAsync(x.Context.ConnectionId,groupNameForLobbyFeed)

    member x.UnSubscribeFromLobbyFeed() =
        printfn "Unsub from lobby"
        whenAuthenticated (x) <| fun _ ->
            x.Groups.RemoveFromGroupAsync(x.Context.ConnectionId,groupNameForLobbyFeed)
    
    member x.Login(session:string) = task {
        let cid = x.Context.ConnectionId
        match sessionById session with
        | [] -> 
            x.Clients.Clients(cid).AuthStatus "LoginFailed" |> ignore    
        | head::_ -> 
            connections.Add(cid, UserOfToken head.Uid)
            let! _ = x.Groups.AddToGroupAsync(cid, groupNameForUser head.Uid)
            x.Clients.Clients(cid).AuthStatus "LoginOk" |> ignore
    }

    member x.ProposeGame method  = 
        whenAuthenticated (x) <| fun uid -> task {
            lobbyAgent.Post <| Lobby.LobbyMessage.Add (UserOfToken uid, method)
        }

    member x.ResignCurrentGame() = 
        whenAuthenticated (x) <| fun uid -> task {
            mainAgent.Post (AgentMsg.Resign (UserOfToken uid, None))
        }
    
    member x.ConcludeCurrentGame(whiteCheckmated:bool) =
        whenAuthenticated (x) <| fun uid -> task {
            let color = (if whiteCheckmated then TurnColor.White else Black) |> Some
            mainAgent.Post (AgentMsg.Resign (UserOfToken uid, color))
        }
    

    member x.Challenge(uidToChallenge:string) =
        whenAuthenticated (x) <| fun senderUid -> task {
            x.Clients.Group(groupNameForUser uidToChallenge).RespondToChallenge(senderUid) |> ignore            
        }

    member x.AcceptGameProposal(player:string option, btime:int, wtime:int) =
        whenAuthenticated (x) <| fun senderUid -> task {
            let player = Option.get player
            let now = int(DateTimeOffset.Now.ToUnixTimeSeconds())
            let (u,v) = if now % 2 = 0 then (senderUid,player) else (player, senderUid)
            let messageBuilder r = CreateGame (u, v, r, btime, wtime)
            let reply = mainAgent.PostAndReply messageBuilder

            match reply with
            | Some (gid, _ ) ->
                x.Clients.Group(groupNameForUser player).GoToGame(gid) |> ignore
                x.Clients.Group(groupNameForUser senderUid).GoToGame(gid) |> ignore
            | None -> ()
        }

    member x.SendPairing(): Task<string> = 
        whenAuthenticatedString (x) <| fun uid -> task {
            let messageBuilder ch = GetState (UserOfToken uid, ch )            
            let reply = mainAgent.PostAndReply (messageBuilder)
            let res =
                match reply with
                | Some sid -> (Json.serialize >> Json.format) sid
                | None -> Json.Null() |> Json.format         
            return res
        }

    member x.UpdatePairing(player:string option, btime:int, wtime:int) = 
        Console.WriteLine("ddddddddddddddd");
        whenAuthenticated (x) <| fun senderUid -> task {
            let player = Option.get player
            let now = int(DateTimeOffset.Now.ToUnixTimeSeconds())
            let (u,v) = if now % 2 = 0 then (senderUid,player) else (player, senderUid)
            let messageBuilder r = UpdatePairingData (u, v, btime, wtime)
            let reply = mainAgent.PostAndReply messageBuilder
            return ()
        }

    member this.SendMessage(message:string, blha:string):Task<string> =
        // System.Console.WriteLine(sprintf "%s, %s" message blha)
        task {
            return message + " and " + blha
        }
        //Task.CompletedTask

    
let inline encode x = (Json.serialize >> Json.format) x
let inline decode x = (Json.parse >> Json.deserialize) x

let handlerWrapper(compute:string->ILogger->string option) (category:string) : HttpHandler =
    let badStatus = AspNetCore.Http.StatusCodes.Status400BadRequest in 
    fun (next : HttpFunc) (ctx : AspNetCore.Http.HttpContext) ->
        let logger = ctx.GetLogger(category)
        task {
            let! body = bodyString ctx
            try
                match compute body logger with 
                | None -> 
                    return! (setStatusCode badStatus) next ctx
                | Some reply -> 
                    let handler = setContentType "application/json" >=> setBodyFromString reply
                    return! handler next ctx
            with ex -> 
                logger.LogCritical ex.Message
                return! (setStatusCode badStatus) next ctx
        }


type ApiArg = { Body:string; Logger:ILogger; Uid:string; Session:string }

let handlerWrapper2 (compute:ApiArg->string option) (category:string) (session:string) : HttpHandler =
    let badStatus = AspNetCore.Http.StatusCodes.Status400BadRequest in
    fun (next : HttpFunc) (ctx : AspNetCore.Http.HttpContext) ->
        //Look into this: https://learn.microsoft.com/en-us/aspnet/core/signalr/hubcontext?view=aspnetcore-7.0
        // let hub = ctx.RequestServices.GetRequiredService<IHubContext<GameHub>>()
        // let blah = hub.Clients.Client("")

        let logger = ctx.GetLogger(category)
        task {
            match sessionById session with
            | [] -> 
                return! (setStatusCode badStatus) next ctx
            | head::_ ->
                let! body = bodyString ctx
                let args = { Body = body; Logger = logger; Uid=head.Uid; Session=session } 
                try
                    match compute args with 
                    | None -> 
                        return! (setStatusCode badStatus) next ctx
                    | Some reply -> 
                        let handler = setContentType "application/json" >=> setBodyFromString reply
                        return! handler next ctx
                with ex -> 
                    logger.LogCritical ex.Message
                    return! (setStatusCode badStatus) next ctx
        }


let simpleMove (body:string) (logger:ILogger): string option =

    // System.Console.WriteLine(sprintf "addddddddddddddddddddddddd")

    let msg:MoveMsg = decode body
    let compositeCard = msg.Card |> Option.bind (CompositeCard.FromString)
    let suit = msg.Suit |> Option.bind (CardSuit.FromString)
    
    option {
        let! src = squareToCoords msg.Move.Source
        let! dst = squareToCoords msg.Move.Destination
        let agentMessage:AgenentMsgData = 
            { User = UserOfToken msg.User
              Move = {
                Source = msg.Move.Source 
                Destination = msg.Move.Destination
                ParsedSource = src
                ParsedDestination = dst }
              MaybeCard = compositeCard
              MaybeSuit = suit
              ProposedPosition = msg.Position
              SourcePosition = msg.SourcePosition }
        // sprintf "%A" agentMessage |> logger.LogTrace
        
        let messageBuilder r = MakeSimpleMove (agentMessage, logger, r)
        let! reply = mainAgent.PostAndReply messageBuilder
        return encode reply
    }

let simpleMove2 (arg:ApiArg): string option = simpleMove arg.Body arg.Logger

let runSwap body logger = 
    let msg:SwapMsg = decode body
    option {
        let! crd = msg.Card |> CompositeCard.FromString
        let messageBuilder r = SwapCard (UserOfToken msg.User, crd, r)
        let! reply = mainAgent.PostAndReply (messageBuilder) 
        return encode reply
    }


let makeNewGame (body:string) (logger:ILogger) =
    let msg:CrtGameMsg = decode body
    option {
        let messageBuilder r = CreateGame (msg.WhiteToken, msg.BlackToken, r, msg.BTime, msg.WTime)
        let! reply =  mainAgent.PostAndReply messageBuilder
        return encode reply
    }


type SignUpMsg = 
    { Uid:string; Password:string; Birthday:string; Gender:string; Email:string }

let signUpUser (body:string) (logger:ILogger) =
    let body' = Decode.Auto.fromString<SignUpMsg>(body,SnakeCase)
    match body' with
    | Ok r ->
        log_activity("signup",r.Uid,"request","") |> ignore
        let (hash,salt) = hashPassword r.Password
        let success = createUser(r.Uid,hash,salt, r.Birthday,r.Gender,r.Email)
        // return JSON object
        let out = {| Result = if success > 0 then "new" else "exists" |} 
        Encode.Auto.toString(out, SnakeCase) |> Some
    | Error e ->
        log_activity("signup","","error",e) |> ignore 
        logger.LogCritical (e)
        None

type InboxMsg = 
    { Uid:string; Name:string; Message:string; Reply:string }
let inbox (body:string) (logger:ILogger) =
    let body' = Decode.Auto.fromString<InboxMsg>(body,SnakeCase)
    match body' with
    | Ok r ->
        log_activity("inbox",r.Uid,"request","") |> ignore
        try
            let success = createInbox(r.Uid, r.Name, r.Message, r.Reply)
            let out = {| Result = if success > 0 then "new" else "exists" |} 
            Encode.Auto.toString(out, SnakeCase) |> Some
        with
        | :? System.InvalidCastException as ex ->
            log_activity("inbox", r.Uid, "error", ex.Message) |> ignore
            logger.LogCritical (ex, "Invalid cast during getInboxs execution.")
            None
        | ex ->
            log_activity("inbox", r.Uid, "error", ex.Message) |> ignore
            logger.LogCritical (ex, "An unexpected error occurred.")
            None
    | Error e ->
        log_activity("inbox","","error",e) |> ignore 
        logger.LogCritical (e)
        None

let getInbox (body:string) (logger:ILogger) =
    let body' = Decode.Auto.fromString<{| Uid:string |}>(body,SnakeCase)
    match body' with
    | Ok r ->
        log_activity("inbox", r.Uid, "request", "") |> ignore
        try
            let success = getInboxs r.Uid
            Encode.Auto.toString(success, SnakeCase) |> Some
        with
        | :? System.InvalidCastException as ex ->
            log_activity("inbox", r.Uid, "error", ex.Message) |> ignore
            logger.LogCritical (ex, "Invalid cast during getInboxs execution.")
            None
        | ex ->
            log_activity("inbox", r.Uid, "error", ex.Message) |> ignore
            logger.LogCritical (ex, "An unexpected error occurred.")
            None
    | Error e ->
        log_activity("getInbox","","error",e) |> ignore 
        logger.LogCritical (e)
        None

type updateInboxrMsg = 
    { Id:int32; Message:string;}
let updateInbox (body:string) (logger:ILogger) =
    let body' = Decode.Auto.fromString<updateInboxrMsg>(body,SnakeCase)
    match body' with
    | Ok r ->
        let success = updateInboxs(r.Id,r.Message)
        // return JSON object
        let out = {| Result = if success > 0 then "new" else "exists" |} 
        Encode.Auto.toString(out, SnakeCase) |> Some
    | Error e ->
        // Log a detailed error message
        logger.LogCritical($"Error decoding JSON: {e}")
        // Log additional information such as the problematic JSON string
        logger.LogDebug($"JSON string causing the error: {body}")
        // Continue with the existing error handling logic
        log_activity("updateUser", "", "error", e) |> ignore
        None

type updateUserMsg = 
    { Uid:string; Birthday:string; Gender:string; Email:string; current_uid:string }
let updateUser (body:string) (logger:ILogger) =
    let body' = Decode.Auto.fromString<updateUserMsg>(body,SnakeCase)
    match body' with
    | Ok r ->
        let success = updateUser(r.Uid,r.Birthday,r.Gender,r.Email,r.current_uid)
        // return JSON object
        let out = {| Result = if success > 0 then "success" else "fail" |} 
        Encode.Auto.toString(out, SnakeCase) |> Some
    | Error e ->
        // Log a detailed error message
        logger.LogCritical($"Error decoding JSON: {e}")
        // Log additional information such as the problematic JSON string
        logger.LogDebug($"JSON string causing the error: {body}")
        // Continue with the existing error handling logic
        log_activity("updateUser", "", "error", e) |> ignore
        None

let signInUser (body:string) (logger:ILogger) =
    let body' = Decode.Auto.fromString< {| Uid:string; Password:string |}>(body,SnakeCase)
    match body' with
    | Ok r ->
        log_activity("signin", r.Uid, "request","") |> ignore
        let info = userById r.Uid
        let encode x = Encode.Auto.toString(value = x, caseStrategy = SnakeCase) |> Some
        match info with 
        | [] ->
            encode {| Error = "no_uid" |}
        | head::_ -> 
            if verifyPassword (r.Password, head.Hash, head.Salt) then 
                match createSession r.Uid with
                | Some session -> 
                    let messageBuilder ch = GetState (UserOfToken r.Uid, ch )
                    let reply = mainAgent.PostAndReply (messageBuilder)
                    encode {| Session = session; GameState = reply|} 
                | None ->
                    log_activity("signin",r.Uid,"error","failed to create session") |> ignore 
                    logger.LogCritical ($"failed to create session for {r.Uid}") 
                    encode {| Error = "unreachable" |}
            else
                encode {| Error = "no_auth" |}         
    | Error e ->
        log_activity("signin","","error",e) |> ignore 
        logger.LogCritical (e)
        None

let subscribeHandler (session:string, token:string): HttpHandler =
    match sessionById session with
    | [] -> 
        setStatusCode AspNetCore.Http.StatusCodes.Status400BadRequest
    | head::_ ->     
        //printfn "Got user: %A" head
        let messageBuilder r = GetState (UserOfToken token, r)
        let reply = mainAgent.PostAndReply (messageBuilder)  
        let res =
                match reply with
                | Some sid -> (Json.serialize >> Json.format) sid
                | None -> Json.Null() |> Json.format         
        setContentType "application/json" >=> setBodyFromString res

let sendEmailWithSendGrid (username: string, apiKey: string, fromAddress: string, toAddress: string, subject: string, body: string) =
    async {
        try
            // Create a SendGrid client using the API key
            let client = SendGridClient(apiKey)

            // Create a new email message
            let message = SendGridMessage()
            let fromEmail = EmailAddress(fromAddress, "Sender Name")
            let toEmail = EmailAddress(toAddress, "Recipient Name")
            message.SetFrom(fromEmail)
            message.AddTo(toEmail)
            message.SetSubject(subject)
            message.AddContent(MimeType.Text, body)

            // Send the email asynchronously
            let! response = client.SendEmailAsync(message) |> Async.AwaitTask

            // // Check the response status
            if response.StatusCode = System.Net.HttpStatusCode.Accepted then
                printfn "Email sent successfully!"
            else
                let temp = response.StatusCode.ToString();
                printfn "Failed to send email: %s" temp
        with
        | ex ->
            printfn "Failed to send email: %s" ex.Message
    }
    |> Async.RunSynchronously

type SendEmailMsg = 
    { Uid:string; Title:string; Message:string}

let sendEmail (body:string) (logger:ILogger) =
    let body' = Decode.Auto.fromString<SendEmailMsg>(body,SnakeCase)
    match body' with
    | Ok r ->
        let subject = r.Title // Email subject
        let username = "Jamie.light22@gmail.com" // Your Gmail email address
        let password = "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" // Your Gmail password or app password
        let fromAddress  = "Jamie.light22@gmail.com" // Sender's email address
        let toAddress= "irontiger121@gmail.com";
        let content = "You have been contacted from " + r.Uid + " \n " + r.Message
        // match getEmailById r.Uid with
        //     | Some email -> 
        //         toAddress <- email 
        //     | None ->
        //         toAddress <- "";
        sendEmailWithSendGrid(username,password,fromAddress,toAddress,subject,content)
        Encode.Auto.toString(toAddress, SnakeCase) |> Some
    | Error e ->
        log_activity("sendEmail","","error",e) |> ignore 
        logger.LogCritical (e)
        None

// nice link on Chiron
// https://neoeinstein.github.io/blog/2015/12-13-chiron-json-ducks-monads/index.html
//logger.LogCritical "Email sent successfully"
// nice link on Giraffe
// https://carpenoctem.dev/blog/anatomy-of-giraffe-httphandler/
//
let webApp =
    choose [
        GET >=>
            choose [
                route "/" >=> redirectTo true "index.html" //indexHandler "world"
                routef "/hello/%s" indexHandler
                routef "/subscribe/%s/%s" subscribeHandler
            ]
        POST >=>
            choose [
                route "/signup" >=> (handlerWrapper signUpUser "new")
                route "/updateUser" >=> (handlerWrapper updateUser "new")
                route "/signin" >=> (handlerWrapper signInUser "new")
                route "/inbox" >=> (handlerWrapper inbox "new")
                route "/getInbox" >=> (handlerWrapper getInbox "new")
                route "/updateInbox" >=> (handlerWrapper updateInbox "new")
                route "/sendEmail" >=> (handlerWrapper sendEmail "new")
                routef "/move2/%s" (handlerWrapper2 simpleMove2 "move")
                route "/new" >=> (handlerWrapper makeNewGame "new")
                route "/swap" >=> (handlerWrapper runSwap "swap")
            ] 
        setStatusCode 404 >=> text "Not Found" ]

let errorHandler (ex : Exception) (logger : ILogger) =
    logger.LogError(ex, "An unhandled exception has occurred while executing the request.")
    clearResponse >=> setStatusCode 500 >=> text ex.Message


let configureCors (builder : CorsPolicyBuilder) =
    builder
        // .AllowAnyOrigin()
        .AllowCredentials()
        .SetIsOriginAllowed(fun x -> true)
        // .WithOrigins(
        //     "http://localhost:5173",
        //     "https://localhost:5001",
        //     "http://localhost:3000")
       .AllowAnyMethod()
       .AllowAnyHeader()
       
       |> ignore

let configureApp (app : IApplicationBuilder) =
    let env: IWebHostEnvironment = app.ApplicationServices.GetService<IWebHostEnvironment>()
    (match env.IsDevelopment() with
    | true  ->
        app.UseDeveloperExceptionPage().UseRouting()
    | false ->
        app .UseRouting()
            .UseGiraffeErrorHandler(errorHandler)
            .UseHttpsRedirection())
        
        .UseCors(configureCors)
        .UseStaticFiles()
        .UseEndpoints(fun ep -> ep.MapHub<GameHub>("/gameHub") |> ignore)
        .UseGiraffe(webApp)

let configureServices (services : IServiceCollection) =
    services.AddCors()    |> ignore
    services.AddSignalR() |> ignore
    services.AddGiraffe() |> ignore

let configureLogging (builder : ILoggingBuilder) =
    let levels = [
        LogLevel.Critical
        LogLevel.Information
        LogLevel.Debug
        LogLevel.Trace]

    let cats = ["move"; "new"; "swap"]

    let filter (s:string) (l : LogLevel) = levels |> List.exists (fun lvl -> l = lvl) && cats |> List.exists (fun c -> c = s)

    builder .AddFilter(filter)
            .AddConsole()
            .AddDebug() |> ignore

let runCycle(hub:IHubContext<GameHub>) =
    let rec cycle () = async {
        let! _ = Async.Sleep(1000)
        let snap = connections.Snapshot
       // let values = Set.ofSeq (snap.Values) |> Set.map (fun (UserOfToken u) -> {| Uid = u; Rating = 100 |})

        // for KeyValue(cid,UserOfToken uid) in cnn do
        //     //let out = Encode.Auto.toString(values, SnakeCase) 
        //     let out = values
        //     hub.Clients.Client(cid).SendCoreAsync("ActiveUsers", [|out|]) |> ignore

       // hub.Clients.Group(groupNameForActiveFeed).SendCoreAsync("ActiveUsers", [|values|]) |> ignore

        

        let reply =  lobbyAgent.PostAndReply (fun r ->  GetRecent (200,r))
        hub.Clients.Group(groupNameForLobbyFeed).SendCoreAsync("Lobby", [|reply|]) |> ignore

       // printfn "Active: %A" values
       // printfn "Lobby: %A" reply

        // 

        return! cycle()
    } 

    cycle() |> Async.Start

let main args =
    let contentRoot = Directory.GetCurrentDirectory()
    let parent = Directory.GetParent(contentRoot).FullName
    let webRoot     = Path.Combine(parent, "ts_board/build")
    printfn "webroot: %A" webRoot

    let host = 
        Host.CreateDefaultBuilder(args)
            .ConfigureWebHostDefaults(
                fun webHostBuilder ->
                    webHostBuilder
                        .UseContentRoot(contentRoot)
                        .UseWebRoot(webRoot)
                        .Configure(Action<IApplicationBuilder> configureApp)
                        .ConfigureServices(configureServices)
                        .ConfigureLogging(configureLogging)
                        .UseUrls([|"http://0.0.0.0:9090"|])
                        |> ignore)
            .Build()

    let hubContext = host.Services.GetService(typeof<IHubContext<GameHub>>) :?> IHubContext<GameHub>
    runCycle(hubContext)
    
    host.Run()
    0


[<EntryPoint>]
let go argv =
    main argv
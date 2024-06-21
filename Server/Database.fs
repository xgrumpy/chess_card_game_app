module Db

open System.Data.SQLite

open System
open System.Security.Cryptography
open System.Text

#if DEBUG
let strCon = "Data Source=chewker_store.sqlite"
#else
let strCon = "Data Source=/data/chewker_store.sqlite"
#endif

let createAndOpenConnection () = 
    let connection = new SQLiteConnection(strCon)
    connection.Open()
    connection

let createCommand (conn:SQLiteConnection) (text:string) = 
    let cmd: SQLiteCommand = conn.CreateCommand()
    cmd.CommandText <- text
    cmd

let activity_log() =
    use conn = createAndOpenConnection ()     
    let sql = 
        """
        SELECT timestamp_eph, category, uid, event, data 
        FROM activity_log
        ORDER BY timestamp_eph 
        LIMIT 100 
        """
    use reader = (createCommand conn sql).ExecuteReader()
    let mutable out = []:{| ms:float; ts:string; cat:string; uid:string; event:string; data:string|} list

    while reader.Read() do
        let ts2 = reader.GetDecimal 0
        let ss = DateTimeOffset.FromUnixTimeMilliseconds (int64 (ts2 * decimal(1000)))
        let ts = sprintf "%s.%d" (ss.ToString("u").TrimEnd('Z')) ss.Millisecond 

        let cat = reader.GetString 1
        let uid = reader.GetString 2
        let event = reader.GetString 3
        let data = reader.GetString 4

        let record = {| ms=float(ts2); ts=ts; cat=cat; uid=uid; event=event; data=data|}
        out <- record :: out
    out

let log_activity (cat:string, uid:string, event:string,data:string) = 
    use conn = createAndOpenConnection()
    let sql = 
        """
        INSERT INTO activity_log (timestamp_eph, category, uid, event, data)
        VALUES ($timestamp_eph, $category, $uid, $event, $data) 
        """
    let cmd = createCommand conn sql

    let ts = decimal(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) / 1000M
    cmd.Parameters.AddWithValue("$timestamp_eph",ts) |> ignore
    cmd.Parameters.AddWithValue("$category",cat) |> ignore
    cmd.Parameters.AddWithValue("$uid",uid) |> ignore
    cmd.Parameters.AddWithValue("$event", event) |> ignore
    cmd.Parameters.AddWithValue("$data", data) |> ignore

    cmd.ExecuteNonQuery()

let createUser (uid:string, passHash:string,  salt:string, birthday:string, gender:string, email:string) = 
    use conn = createAndOpenConnection()
    let sql = 
        """
        INSERT INTO users (uid, pwd, birthday, gender, email, salt )
        VALUES ($uid, $pwd, $birthday, $gender, $email, $salt ) 
        """
    let cmd = createCommand conn sql


    cmd.Parameters.AddWithValue("$uid", uid) |> ignore
    cmd.Parameters.AddWithValue("$pwd", passHash) |> ignore
    cmd.Parameters.AddWithValue("$birthday", birthday) |> ignore
    cmd.Parameters.AddWithValue("$gender", gender) |> ignore
    cmd.Parameters.AddWithValue("$email", email) |> ignore
    cmd.Parameters.AddWithValue("$salt", salt) |> ignore

    try cmd.ExecuteNonQuery() with _ -> 0

let createInbox (uid:string, name:string,  message:string, reply:string) = 
    use conn = createAndOpenConnection()
    let sql = 
        """
        INSERT INTO inbox (uid, name, message, reply)
        VALUES ($uid, $name, $message, $reply) 
        """
    let cmd = createCommand conn sql
    cmd.Parameters.AddWithValue("$uid", uid) |> ignore
    cmd.Parameters.AddWithValue("$name", name) |> ignore
    cmd.Parameters.AddWithValue("$message", message) |> ignore
    cmd.Parameters.AddWithValue("$reply", reply) |> ignore
    try cmd.ExecuteNonQuery() with _ -> 0

let getInboxs(uid:string) =
    use conn = createAndOpenConnection ()     
    let sql = 
        """
        SELECT id, uid, name, message, reply 
        FROM inbox
        WHERE name = $name  or uid=$name
        """
    let cmd = createCommand conn sql
    cmd.Parameters.AddWithValue("$name", uid) |> ignore

    use reader = cmd.ExecuteReader()
    let mutable out = []
    while reader.Read() do
        try
            let id = if not (reader.IsDBNull(0)) then reader.GetInt32(0) else 0
            let uid = if not (reader.IsDBNull(1)) then reader.GetString(1) else ""
            let name = if not (reader.IsDBNull(2)) then reader.GetString(2) else ""
            let messages = if not (reader.IsDBNull(3)) then reader.GetString(3) else ""
            let reply = if not (reader.IsDBNull(4)) then reader.GetString(4) else ""
            let record = {| Id = id; Uid = uid; Name = name; Message = messages; Reply = reply |}
            out <- record :: out
        with
        | :? System.InvalidCastException as ex ->
            // Log and handle the specific invalid cast exception
            printfn "Invalid cast during database read: %s" ex.Message
            // Optionally log more details here
        | ex ->
            // Log and handle any other exception
            printfn "Unexpected error during database read: %s" ex.Message
            // Optionally log more details here
    out

let updateInboxs (id:int32,  message:string) = 
    use conn = createAndOpenConnection()
    let sql = 
        """
        UPDATE inbox 
        SET reply = $message
        WHERE id=$id
        """
    let cmd = createCommand conn sql

    cmd.Parameters.AddWithValue("$id", id) |> ignore
    cmd.Parameters.AddWithValue("$message", message) |> ignore

    try cmd.ExecuteNonQuery() with _ -> 0

let updateUser (uid:string,  birthday:string, gender:string, email:string, currentUid:string) = 
    use conn = createAndOpenConnection()
    let sql = 
        """
        UPDATE users 
        SET uid = $uid, birthday= $birthday, gender = $gender, email = $email
        WHERE uid=$currentUid
        """
    let cmd = createCommand conn sql

    cmd.Parameters.AddWithValue("$uid", uid) |> ignore
    cmd.Parameters.AddWithValue("$birthday", birthday) |> ignore
    cmd.Parameters.AddWithValue("$gender", gender) |> ignore
    cmd.Parameters.AddWithValue("$email", email) |> ignore
    cmd.Parameters.AddWithValue("$currentUid", currentUid) |> ignore

    try cmd.ExecuteNonQuery() with _ -> 0

let removeUser (currentUid:string) = 
    use conn = createAndOpenConnection()
    let sql = 
        """
        DELETE From users 
        WHERE uid=$currentUid
        """
    let cmd = createCommand conn sql

    cmd.Parameters.AddWithValue("$currentUid", currentUid) |> ignore

    try cmd.ExecuteNonQuery() with _ -> 0

let updateRating (uid:string, newRating:int) = 
    use conn = createAndOpenConnection()
    let sql = 
        """
        UPDATE users
        SET rating=$rating
        WHERE uid=$uid
        """
    let cmd = createCommand conn sql
    cmd.Parameters.AddWithValue("$uid", uid) |> ignore
    cmd.Parameters.AddWithValue("$rating", newRating) |> ignore
    try cmd.ExecuteNonQuery() with _ -> 0


let createSession (uid:string) = 
    use conn = createAndOpenConnection()
    let sql = 
        """
        INSERT INTO sessions (uid, session, timestamp_eph) 
        VALUES ($uid, $session, $timestamp_eph ) 
        """
    let cmd = createCommand conn sql
    let add = cmd.Parameters.AddWithValue : string * obj -> SQLiteParameter
    let ts = decimal(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) / 1000M
    let session = Utils.encodeSpecial(Guid.NewGuid()) // .ToString()
    add("$uid", uid) |> ignore
    add("$timestamp_eph", ts) |> ignore
    add("$session", session ) |> ignore

    try 
        if cmd.ExecuteNonQuery() > 0 then Some session
        else None
    with _ ->
        None

let loadSessions(uid:string) =
    use conn = createAndOpenConnection ()     
    let sql = 
        """
        SELECT session, timestamp_eph
        FROM sessions
        WHERE uid = $uid
        """
    let cmd = createCommand conn sql
    cmd.Parameters.AddWithValue("$uid", uid) |> ignore

    use reader = cmd.ExecuteReader()
    let mutable out = []
    while reader.Read() do 
        let session = reader.GetString 0
        let timestamp = reader.GetDecimal 1
        out <- {| Session = session; Timestamp = timestamp |} :: out
    out

let loadUserActivity() =
    use conn = createAndOpenConnection ()     
    let sql = 
        """
        SELECT uid, session, delta
        FROM user_activity
        """
    let cmd = createCommand conn sql
    use reader = cmd.ExecuteReader()

    let mutable out = []
    while reader.Read() do 
        let uid = reader.GetString 0
        let session = reader.GetString 1
        let timestamp = float(reader.GetDecimal 2)

        out <- {| Uid=uid; Session = session; Delta=timestamp |} :: out
    out

let getEmailById(uid:string) =
    use conn = createAndOpenConnection ()     
    let sql = 
        """
        SELECT email
        FROM users
        WHERE uid = $uid
        """
    let cmd = createCommand conn sql
    cmd.Parameters.AddWithValue("$uid", uid) |> ignore
    use reader = cmd.ExecuteReader()
    if reader.Read() then
        let email = reader.GetString 0
        Some email // Return Some email if found
    else
        None // Return None if not found

let userById(uid:string) =
    use conn = createAndOpenConnection ()     
    let sql = 
        """
        SELECT pwd, salt, rating 
        FROM users
        WHERE uid = $uid
        """
    let cmd = createCommand conn sql
    cmd.Parameters.AddWithValue("$uid", uid) |> ignore

    use reader = cmd.ExecuteReader()
    let mutable out = []//:{| pwd:string; salt:string |} 

    while reader.Read() do
        let pwd = reader.GetString 0
        let salt = reader.GetString 1
        let rating = reader.GetInt32 2
        let record = {| Hash=pwd;Salt=salt; Rating=rating |} 
        out <- record :: out
    out

let sessionById(session:string) =
    use conn = createAndOpenConnection ()     
    let sql = 
        """
        SELECT uid, timestamp_eph 
        FROM sessions
        WHERE session = $session
        """
    let cmd = createCommand conn sql
    cmd.Parameters.AddWithValue("$session", session) |> ignore

    use reader = cmd.ExecuteReader()
    let mutable out = []
    while reader.Read() do
        let uid = reader.GetString 0
        let ts = reader.GetDecimal 1
        let record = {| Uid=uid;Timestamp=ts |} 
        out <- record :: out
    out

/// . --------

let keySize = 64
let iterations = 350000
let hashAlgorithm = HashAlgorithmName.SHA512


// pepper is effectively random salt that is unique to the entire application
// whereas solt is unique to each password
let pepper =
    let arr:byte[] = Array.zeroCreate keySize
    for i in 0..(keySize-1) do
        arr[i] <- byte (i) 
    arr

let saltWithPepper (salt:byte[]) =
    [| for i in 0..(keySize-1) -> salt[i] + pepper[i] |]
    
    

let hashPassword(password:string):string * string =  
    let salt = RandomNumberGenerator.GetBytes(keySize)
    let salt' = saltWithPepper salt
    let hash = Rfc2898DeriveBytes.Pbkdf2(
        Encoding.UTF8.GetBytes(password),
        salt',
        iterations,
        hashAlgorithm,
        keySize)

    Convert.ToHexString(hash), Convert.ToHexString(salt)

let verifyPassword(password:string, hash:string, salt:string) =
    let salt = Convert.FromHexString(salt)
    let salt' = saltWithPepper salt
    let hashToCompare = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(password), salt', iterations, hashAlgorithm, keySize)
    let bytesOfHash = Convert.FromHexString(hash)
    CryptographicOperations.FixedTimeEquals(hashToCompare, bytesOfHash)


let testHashing () =
    let instr = "clear_password"
    let (pwdHash, salt) = hashPassword(instr)
    //let ss = Convert.ToHexString(salt)
    printfn "password: %A" pwdHash
    printfn "salt: %A" salt
    verifyPassword(instr, pwdHash, salt ) |> printfn "verified: %A"
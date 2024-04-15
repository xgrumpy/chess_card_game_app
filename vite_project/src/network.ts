import * as signalR from '@microsoft/signalr'

export const httpScheme = import.meta.env.DEV ? `http` : `https`
export const host = import.meta.env.DEV ? `${window.location.hostname}:9090` : `${window.location.hostname}/api`

// Setting up SignalR

export let connectionR: signalR.HubConnection | null = null
export let createConnectionR = async () => {
  const result = new signalR.HubConnectionBuilder()
    .withUrl(`${httpScheme}://${host}/gameHub`)
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Debug)
    .build()

  await result.start()
  console.log("SignalR connected... checking connection...")
  let s = await result.invoke<string>("SendMessage", "apples", "oranges")
  console.log("SignalR connection test passed: ", s)
  connectionR = result
}

export let discardConnectionR = async () => {
  if (connectionR) {
    await connectionR.stop()
    connectionR = null
  }
}


// export const connection = new signalR.HubConnectionBuilder()
//   .withUrl(`${httpScheme}://${host}/gameHub`)
//   .configureLogging(signalR.LogLevel.Debug)
//   .build()

// async function start() {
//   try {
//     await connection.start()
//     console.log("SignalR Connected.")
//     connection.invoke("SendMessage", "apples", "oranges").then((res: string) => {
//       console.log("@@@@@@@@@@@@returned string is", res)
//     })
//   } catch (err) {
//     console.log(err)
//     setTimeout(start, 5000)
//   }
// };

// connection.on("TestMethod", (message) => {
//   let textContent = `${message}`
//   console.log("hello", textContent)
// })

// connection.onclose(async () => {
//   console.log('signalR closing... will restart')
//   await start()
// })

// // Start the connection.
// start()


type DispatchF = React.Dispatch<any>

export async function subscribe(dispatch: DispatchF, session: string, token: string, cancellation: { valid: boolean }) {
  const reconnectDelay = 1000 // milisec
  const pollingDelay = 500

  try {

    let response = await fetch(`${httpScheme}://${host}/subscribe/${session}/${token}`)

    if (response.status == 502) {
      // Status 502 is a connection timeout error,
      // may happen when t;he connection was pending for too long,
      // and the remote server or a proxy closed it
      if (cancellation.valid)
        await subscribe(dispatch, session, token, cancellation)
    } else if (response.status != 200) {
      // An error - let's show it
      console.error(response.statusText)
      // Reconnect in one second
      await new Promise(resolve => setTimeout(resolve, reconnectDelay))
      if (cancellation.valid)
        await subscribe(dispatch, session, token, cancellation)
    } else {
      // Get and show the message
      let message = await response.text()
      let obj = JSON.parse(message)
      let game = obj.game
      let position = game.position
      let is_white = obj.user_is_white as boolean
      let dist = obj.game.card_distribution
      let hand = is_white ? dist.white_hand : dist.black_hand
      let white_can_castle = game.white_can_castle
      let black_can_castle = game.black_can_castle
      let result = game.result
      let ep_square = game.enpassant_square
      let defending_card = game.defending_card

      dispatch({ type: 'subscribe', position, turn: game.turn, hand, white_can_castle, black_can_castle, result, ep_square, defending_card })
      console.log(obj)
      // Call subscribe() again to get the next message
      await new Promise(resolve => setTimeout(resolve, pollingDelay))
      if (cancellation.valid)
        await subscribe(dispatch, session, token, cancellation)
    }
  } catch (error) {
    console.error(error)
    await new Promise(resolve => setTimeout(resolve, reconnectDelay))
    if (cancellation.valid)
      await subscribe(dispatch, session, token, cancellation)
  }
}

// export async function login(dispatch: DispatchF, token: string, retryCount: number) {
//   const reconnectDelay = 1000 // milisec
//
// try {
//   let response = await fetch(`${httpScheme}://${host}/subscribe/${token}`)
//
//     if (response.status == 502) {
//       // Status 502 is a connection timeout error,
//       // may happen when the connection was pending for too long,
//       // and the remote server or a proxy closed it
//       if (retryCount >= 0)
//         await login(dispatch, token, retryCount - 1)
//     } else if (response.status != 200) {
//       // An error - let's show it
//       console.error(response.statusText)
//       // Reconnect in one second
//       await new Promise(resolve => setTimeout(resolve, reconnectDelay))
//       if (retryCount >= 0)
//         await login(dispatch, token, retryCount - 1)
//     } else {
//       // Get and show the message
//       let message = await response.text()
//       let obj = JSON.parse(message)
//       if (obj !== null)
//         dispatch({ type: 'login', user_is_white: obj.user_is_white, token })

//       console.log('login with: ', obj)
//     }
//   } catch (error) {
//     console.error(error)
//     await new Promise(resolve => setTimeout(resolve, reconnectDelay))
//     if (retryCount >= 0)
//       await login(dispatch, token, retryCount - 1)
//   }
// }

export async function createGame(dispatch: DispatchF, white_token: string, black_token: string, retryCount: number, onSuccess: () => void, onFail: () => void) {
  const reconnectDelay = 1000 // milisec

  try {
    let payload = { white_token, black_token }
    let response = await fetch(`${httpScheme}://${host}/new`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })

    if (response.status == 502) {
      // Status 502 is a connection timeout error, may happen when the connection was pending for too long,
      if (retryCount >= 0)
        await createGame(dispatch, white_token, black_token, retryCount - 1, onSuccess, onFail)
    } else if (response.status != 200) {
      console.error(response.statusText)
      // this means creation failed and we should notify the user accordingly
      onFail()
    } else {
      // All is well we created a game
      let message = await response.text()
      let obj = JSON.parse(message)
      onSuccess()
      console.log('created new: ', obj)
    }
  } catch (error) {
    console.error(error)
    await new Promise(resolve => setTimeout(resolve, reconnectDelay))
    if (retryCount >= 0)
      await createGame(dispatch, white_token, black_token, retryCount - 1, onSuccess, onFail)
    // else 
    //   onFail()
  }
}
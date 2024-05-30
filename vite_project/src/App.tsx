import React, { useEffect, useReducer, useState } from 'react'
import _, { min } from "lodash"
import './App.css'
import { Button, Col, ConfigProvider, Divider, Form, Input, List, Radio, Row, Typography, theme, RadioChangeEvent } from 'antd'
import { ClubSuit, DiamondSuit, HeartSuit, PieceProps, PiecesEnum, SpadeSuit, pieceComponent } from './Pieces'
import { START_POSITION_MAP, sleep } from './Utils'
import { MoveEnum, MoveError, MoveMakerArg, MoveSet, Vec, allMovesAtSquareWrapper, coordsToSquare, findKing, isInCheck, isInCheckMate, isKing, isWhite, moveMaker, squareToCoords, tupleCoorsToSquare as tupleCoordsToSquare } from './state'
//import type { NotificationPlacement } from 'antd/es/notification/interface'
import chroma from 'chroma-js'
import { subscribe, httpScheme, host, connectionR } from './network'
import * as Immutable from 'immutable'
import { LeftCircleOutlined, FrownOutlined, InteractionOutlined } from '@ant-design/icons'

import { HashRouter, Routes, Route } from "react-router-dom"
import { Outlet, useNavigate } from "react-router-dom"
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { Signin } from './Authentication'
import { CardChooser } from './CardChooser'
import { Lobby } from './Lobby'


const DebugMenu = () => {
  return (
    <>
      {/* <nav>
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/old">Old Home</Link>
          </li>
          <li>
            <Link to="/blogs/22">Blogs</Link>
          </li>
          <li>
            <Link to="/contact">Contact</Link>
          </li>
        </ul>
      </nav> */}

      <Outlet />

      {/* <Mine /> */}
    </>
  )
}


// const Blogs = () => {
//   let { userId } = useParams();

//   useEffect(() => {
//     console.log("userId:", userId)
//   })
//   return <h1>Blog Articles</h1>;
// }


const NoPage = () => {
  return <h1>404</h1>;
}


const darkColor = 'seagreen'
const lightColor = 'mediumseagreen'
const strokeColor = 'greenyellow'
export const cardBackgroundColor = 'slateblue'


const side = min([window.innerHeight, window.innerWidth]) as number - 110
const adjusted = min([500, side]) as number
const w = adjusted
const h = adjusted
const sqw = w / 8
const sqh = h / 8
const pieceScaleFactor = 0.8

let timerId: any
let btime = 9999
let wtime = 9999

enum CheckMateState {
  NotInCheckmate = 'Not in checkmate',
  WhiteIsCheckmated = 'White is checkmated',
  BlackIsCheckmated = 'Black is checkmated'
}

export interface State {
  userInfo: { uid: string, session: string } | null
  result: string
  hoverSquare: Vec | null
  sourceSquare: Vec | null
  destSquare: Vec | null
  position: Map<string, string>
  boardFlipped: boolean
  boardDisabled: boolean
  offer: string | null // offered card
  login: { user_is_white: boolean, uid: string, opponent: string, btime: number, wtime: number } | null
  turn: 'white' | 'black'
  hand: string[]
  white_can_castle: boolean
  black_can_castle: boolean
  inCheckmate: CheckMateState
  card: string
  suit: string | null
  ep_square: string | null
  moveCount: number
  swapReqCount: number
  defendingCard: string | null

  activeUsers: any[],
  lobby: any[]
}

const initialState: State = {
  userInfo: null,
  result: '*',
  turn: 'black',
  login: null,
  hoverSquare: null,
  sourceSquare: null,
  destSquare: null,
  position: START_POSITION_MAP,
  boardFlipped: false,
  boardDisabled: false,
  offer: null,
  hand: [],
  white_can_castle: true,
  black_can_castle: true,
  inCheckmate: CheckMateState.NotInCheckmate,
  card: "",
  suit: null,
  ep_square: null,
  moveCount: 0,
  swapReqCount: 0,
  defendingCard: null,
  activeUsers: [],
  lobby: []
}

export interface VecBoardProps {
  dispatch: React.Dispatch<any>
  state: State
}
export interface VecBoardProps1 {
  dispatch: React.Dispatch<any>
  state: State
  toggleTheme: any
}

// iterator all pairs of number from 0..7 range e.g. [1,1], [1,2]... [7,7]
const allPairs = {
  *[Symbol.iterator]() {
    for (var i = 0; i < 8; i++)
      for (var j = 0; j < 8; j++)
        yield { col: i, row: j }
  },
}

// Wrapper displays turn indicators
export const VecBoardWrapper = ({ state, dispatch }: VecBoardProps) => {
  let offset = 50
  let neutral = '#555555'
  let ww = state.turn === 'white' ? { fill: 'white', stroke: 'crimson' } : { fill: 'white', stroke: neutral }
  let bb = state.turn === 'black' ? { fill: 'black', stroke: 'crimson' } : { fill: 'black', stroke: neutral }

  let colors = state.boardFlipped ? [ww, bb] : [bb, ww]

  return (
    <svg width={w + offset} height={w}>
      <rect width={w + offset} height={w} fill='transparent' />
      <circle cx={w + offset / 2} cy={offset / 2} r={offset / 2 - 10} {...colors[0]} strokeWidth={4} />
      <circle cx={w + offset / 2} cy={w - offset / 2} r={offset / 2 - 10} {...colors[1]} strokeWidth={4} />
      <VecBoard state={state} dispatch={dispatch} />
    </svg>
  )
}

const inCompletedGameState = (state: State) => {
  return state.inCheckmate !== CheckMateState.NotInCheckmate || state.result !== "*"
}

export const VecBoard = ({ state, dispatch }: VecBoardProps) => {

  let cmtColor = 'red'
  let mixRatio = 0.6

  let inCompleted = inCompletedGameState(state)
  let computeDark = () => {
    if (!inCompleted)
      return state.boardDisabled ? chroma(darkColor).desaturate(2).hex() : darkColor
    else
      return chroma.mix(darkColor, cmtColor, mixRatio, 'lab').hex()
  }

  let computeLight = () => {
    if (!inCompleted)
      return state.boardDisabled ? chroma(lightColor).desaturate(2).hex() : lightColor
    else
      return chroma.mix(lightColor, cmtColor, mixRatio, 'lab').hex()
  }

  let localDark = computeDark()
  let localLight = computeLight()

  let sqcolor = (row: number, col: number) => (row + col) % 2 ? localDark : localLight
  let computeGeometry = (col: number, row: number) => {
    let rem = 1 - pieceScaleFactor
    return {
      xx: sqw * col + sqw * rem / 2,
      yy: sqh * row + sqh * rem / 2,
      size: sqw * pieceScaleFactor
    }
  }

  // raw grid to what it means for the chessboard mapping from say 0,0 to 'a1'
  let rawToLogicalMapping = (col: number, row: number) => {
    let rr = state.boardFlipped ? row + 1 : 7 - row + 1
    let cc = state.boardFlipped ? 7 - col + 1 : col + 1
    return [cc, rr] as [number, number]
  }

  // selection ring around square
  let selectionRing = ({ col, row }: { col: number, row: number }) => {
    let tt = rawToLogicalMapping(col, row)
    //console.log("sourceSquare: ", state.sourceSquare)
    let makeRing = _.isEqual(state.sourceSquare, tt)
    if (makeRing)
      return <rect
        fill='transparent'
        opacity="0.5"
        strokeWidth='10'
        stroke='red'
        rx='100'
        key={`${col}${row} ring`}
        x={col * sqw}
        y={row * sqh} width={sqw} height={sqh} fillOpacity={1} id={`${col},${row}`}
      />
    else

      return null
  }

  // selection ring around square
  let selectionRing2 = ({ col, row }: { col: number, row: number }) => {
    let tt = rawToLogicalMapping(col, row)
    //console.log("sourceSquare: ", state.sourceSquare)
    let makeDestRing = _.isEqual(state.destSquare, tt)
    if (makeDestRing)
      return <rect
        fill='transparent'
        opacity="0.5"
        strokeWidth='10'
        stroke='blue'
        rx='100'
        key={`${col}${row} ring`}
        x={col * sqw}
        y={row * sqh} width={sqw} height={sqh} fillOpacity={1} id={`${col},${row}`}
      />
    else
      return null
  }

  let computeHighlighted = () => {
    if (state.sourceSquare === null)
      return Immutable.Set() as MoveSet
    else {
      let sq = coordsToSquare(state.sourceSquare[0], state.sourceSquare[1])
      return allMovesAtSquareWrapper(state.position, sq, state.login!.user_is_white, state.ep_square)
    }
  }


  let possibilities = computeHighlighted()

  // overlay for mouse detection
  let mouseDetector = ({ col, row }: { col: number, row: number }) => {
    //let hovering = (!state.boardDisabled) ? _.isEqual(state.hoverSquare, [col, row]) : false
    let logicalSq = rawToLogicalMapping(col, row)
    let sq = tupleCoordsToSquare(logicalSq)
    let highlighted = false

    if (state.sourceSquare !== null) {
      let src = tupleCoordsToSquare(state.sourceSquare)
      // let a = normalMove(src, sq)
      // let b = epCapture(src, sq)



      //highlighted = possibilities.has(a) || possibilities.has(b)
      highlighted = possibilities.find((a) => { return a.get('source') === src && a.get('target') === sq }) !== undefined
    }

    return <rect
      onMouseEnter={() => { dispatch({ type: 'entered', square: [col, row], logicalSq }) }}
      onMouseLeave={() => { dispatch({ type: 'leaving', square: [col, row], logicalSq }) }}
      onClick={(e) => { if (!state.boardDisabled) dispatch({ type: 'clicked', square: [col, row], logicalSq, clickCount: e.detail }) }}
      //onDoubleClick={() => { if (!state.boardDisabled) dispatch({ type: 'clicked', square: [col, row], logicalSq, clickCount:2 }) }}

      fill={(highlighted) ? 'yellow' : 'transparent'}
      opacity={highlighted ? 0.2 : 1}
      key={`${col}${row} overlay`}
      x={col * sqw}
      y={row * sqh} width={sqw} height={sqh} fillOpacity={1} id={`${col},${row}`} />
  }


  let element = ({ col, row }: { col: number, row: number }) => {


    let logicalSq = rawToLogicalMapping(col, row)
    let sq = coordsToSquare(logicalSq[0], logicalSq[1])

    let piece = (props: PieceProps) => {
      let code = state.position.get(sq)
      if (code !== undefined) {
        return pieceComponent(PiecesEnum[code as keyof typeof PiecesEnum], props)
      } else {
        return <></>
      }
    }

    // @ts-ignore ... we can dedect if we are hovering here, but not using it for now
    let hovering = _.isEqual(state.hoverSquare, [col, row])
    let props = computeGeometry(col, row)

    // background component that is under a piece and over a square
    let BgCompoent = () => {
      let cc = sqcolor(row + 1, col) // row+1 because want to get the opposite color 
      let c = chroma(cc).saturate(1).hex() // could allow a user to vary saturation deltan in future

      let reddish = chroma.mix(c, 'maroon', 0.15, 'lab').hex()
      //let blueish = chroma.mix(c, 'blue', 0.2, 'lab').hex()


      switch (suitForLogicalSq(logicalSq as [number, number])) {
        case "♠": return <SpadeSuit {...props} color={c} />
        case "♣": return <ClubSuit {...props} color={c} />
        case "♦": return <DiamondSuit {...props} color={reddish} />
        case "♥": return <HeartSuit {...props} color={reddish} />
      }
    }

    return <g key={`${col}, ${row}`}>
      <rect stroke={state.boardDisabled ? chroma(strokeColor).desaturate(3).hex() : strokeColor}
        fill={sqcolor(row, col)}
        strokeWidth="1"
        key={col}
        x={col * sqw} y={row * sqh} width={sqw} height={sqh} fillOpacity={1} id={sq} />

      {true ?
        <>
          <BgCompoent />
          {piece(props)}
        </> :
        piece(props)
      }

    </g>
  }

  const handler = (e: React.MouseEvent<SVGElement, MouseEvent>) => {
    let xx = e.target as HTMLElement
    console.log(e.clientX, e.clientY, " - ", e.nativeEvent.offsetX, e.nativeEvent.offsetY, ", ", xx.id)
    // console.log(e)

  }

  return <svg width={w} height={w} onClick={handler}>

    {[...allPairs].map(element)}
    {[...allPairs].map(selectionRing)}
    {[...allPairs].map(selectionRing2)}
    {[...allPairs].map(mouseDetector)}
  </svg>
}

function reducer(state: State, action: any): State {
  switch (action.type) {
    case 'active_users':
      return { ...state, activeUsers: action.users }
    case 'lobby':
      return { ...state, lobby: action.users }
    case 'make_move':
      return { ...state, moveCount: state.moveCount + 1 }
    case 'swap':
      return { ...state, swapReqCount: state.swapReqCount + 1 }
    case 'update_card':
      return { ...state, card: action.card }
    case 'update_suite':
      return { ...state, suit: action.suit }
    case 'login':
      return { ...state, boardFlipped: !action.user_is_white, login: { user_is_white: action.user_is_white, uid: action.token, opponent: action.opponent, btime: action.btime, wtime: action.wtime } }
    case 'register_user':
      return { ...state, userInfo: { session: action.session, uid: action.uid } }
    case 'clear_marked':
      return { ...state, sourceSquare: null, destSquare: null }
    case 'flip':
      return { ...state, boardFlipped: !state.boardFlipped }
    case 'entered':
      //let ls = action.logicalSq
      //let txt = coordsToSquare(ls[0], ls[1])
      //console.log(`entered: ${txt}`)
      return { ...state, hoverSquare: action.square }
    case 'leaving':
      //console.log(`leaving: ${action.logicalSq}`)
      return { ...state, hoverSquare: null }
    case 'clicked':

      let logicalSq = action.logicalSq
      let c = tupleCoordsToSquare(logicalSq)

      if (inCompletedGameState(state))
        return { ...state, card: "" }

      if (_.isEqual(state.sourceSquare, logicalSq))
        return { ...state, sourceSquare: null, destSquare: null, card: "" }


      if (state.position.has(c)) {
        let myColorPiece = state.login!.user_is_white == isWhite(state.position.get(c)!)
        if (state.sourceSquare === null && myColorPiece)
          return { ...state, sourceSquare: logicalSq, card: "" }
      }

      if (state.sourceSquare !== null) {
        if (_.isEqual(state.destSquare, logicalSq)) {
          if (!unableToMakeMoves(state)) {
            return { ...state, destSquare: logicalSq, moveCount: state.moveCount + 1, card: "" }
          }
        }
        return { ...state, destSquare: logicalSq, card: "" }
      }

      return { ...state, sourceSquare: null, destSquare: null, card: "" }

    case 'subscribe':
      let position = new Map(Object.entries(action.position)) as Map<string, string>
      let turn = action.turn
      let m = turn.move
      let hand = action.hand
      let white_can_castle = action.white_can_castle
      let black_can_castle = action.black_can_castle
      let result = action.result
      let defendingCard = action.defending_card

      let markedSquares = (shouldClear: boolean) => {
        let markedSquares = {
          sourceSquare: shouldClear ? null : squareToCoords(turn.move.src),
          destSquare: shouldClear ? null : squareToCoords(turn.move.dst)
        }
        return markedSquares
      }

      let boardDisabled = !_.isNil(m) // nil or undefined
      let offer = boardDisabled ? turn.card as string : null
      let ep_square = action.ep_square

      let t = turn.turn

      if (t == 'white' || t == 'black') {
        let wK_sq = findKing(state.position, true)
        let bK_sq = findKing(state.position, false)

        let checkmateStatus = () => {
          if (wK_sq !== null && bK_sq !== null) {
            if (isInCheckMate(wK_sq, position, ep_square))
              return CheckMateState.WhiteIsCheckmated

            if (isInCheckMate(bK_sq, position, ep_square))
              return CheckMateState.BlackIsCheckmated

            if (turn.turn === 'white' && turn.card === undefined && isInCheck(bK_sq, position))
              return CheckMateState.BlackIsCheckmated

            if (turn.turn === 'black' && turn.card === undefined && isInCheck(wK_sq, position))
              return CheckMateState.WhiteIsCheckmated
          }
          return CheckMateState.NotInCheckmate
        }

        let inCheckmate = checkmateStatus()

        let moveCount = state.moveCount
        // we want to trigger resignation if status has changed
        // to that end we need to increment a counter
        if (inCheckmate !== state.inCheckmate)
          moveCount = moveCount + 1

        let marked = () => {
          let shouldClear = state.turn !== turn.turn || boardDisabled != state.boardDisabled
          let markedSquares = {
            sourceSquare: shouldClear ? null : state.sourceSquare,
            destSquare: shouldClear ? null : state.destSquare
          }
          return markedSquares
        }

        // conditional spread (true && obj) will only splat if condition is true
        return {
          ...state,
          position,
          turn: turn.turn,
          boardDisabled,
          offer,
          hand,
          white_can_castle,
          black_can_castle,
          inCheckmate: checkmateStatus(),
          result,
          ep_square,
          defendingCard,
          moveCount,

          ...(!boardDisabled && marked()),
          ...(boardDisabled && markedSquares(inCompletedGameState(state)))
        }
      }
      else
        return { ...state, position, hand }
  }

  return state
}

function counterSuitF(s: string) {
  switch (s) {
    case "♠": return "♣"
    case "♣": return "♠"
    case "♥": return "♦"
    case "♦": return "♥"
    default: return s
  }
}

function Deal({ state, dispatch }: { state: State, dispatch: React.Dispatch<any> }) {

  let dealDisabledOnOffer = (x: string) => {

    let offer = state.offer!

    if (state.destSquare === null)
      return false

    let trumpSuit = suitForLogicalSq(state.destSquare)
    // let trumpSuit = offer.slice(-1)
    let counterSuit = counterSuitF(trumpSuit)
    let otherJ = "J" + counterSuit
    let trumpJ = "J" + trumpSuit

    let offeredSuit = offer.slice(-1)

    if (otherJ === offer) {
      offeredSuit = trumpSuit
    }

    let matchingSuitCount = 0
    // let handHasTrumpJ = false
    let handHasOtherJ = false

    for (var i = 0; i < state.hand.length; i++) {
      let a = state.hand[i]

      if (offeredSuit == a.slice(-1)) ++matchingSuitCount
      // if (a.slice(0, 1) == "J") handHasOtherJ = true

      if (a == otherJ) handHasOtherJ = true
      // if (a == trumpJ) handHasTrumpJ = true
    }

    let canFollowSuit = matchingSuitCount > 0

    let canFollowSuitNotCountingLeftBower = () => {
      if (offeredSuit == counterSuit) {
        for (var i = 0; i < state.hand.length; i++) {
          let a = state.hand[i]
          // if we run into non-bower matching suit, we can follow
          if (offeredSuit == a.slice(-1)) {
            return true
          }
        }
        return false
      } else {
        return canFollowSuit
      }
    }

    if (offeredSuit == trumpSuit) {
      if (canFollowSuit || handHasOtherJ) {
        return offeredSuit !== x.slice(-1) && x !== otherJ && x !== trumpJ// disable those that aren't the suit  
      } else {
        // if (handHasOtherJ)
        //   return x !== otherJ
        // else
        return false // can play anything
      }
    } else {
      // console.log(canFollowSuitNotCountingLeftBower());
      if (canFollowSuitNotCountingLeftBower()) {
        return offeredSuit !== x.slice(-1)// disable those that aren't the suit && x !== otherJ && x !== trumpJ
      } else {
        return false // can play anything
      }
    }
    return false
  }

  let dealDisabled = (state.offer == null) ? (_: string) => false : dealDisabledOnOffer

  //let buttons = state.hand.map(x => <Radio.Button key={x} checked={state.card === x} disabled={dealDisabled(x)} value={x}>{x}</Radio.Button>)
  //let onChange = (e: RadioChangeEvent) => dispatch({ type: 'update_card', card: e.target.value })

  return (
    <>
      {/* <Radio.Group onChange={onChange}> {buttons}</Radio.Group> */}
      <CardChooser
        selected={state.card}
        symbols={state.hand}
        disabled={dealDisabled}
        onSelectionChanged={(s) => dispatch({ type: 'update_card', card: s })} />
    </>)
}

function Suits({ state, dispatch }: { state: State, dispatch: React.Dispatch<any> }) {
  let suits = ["♠", "♣", "♥", "♦"]

  let isChecked = (x: string) => {
    //console.log(`checked ${x}:${state.suit}:${x === state.suit}`)
    return x === state.suit
  }

  // TODO: need to add checked property as in deal!!
  let buttons = suits.map(x => <Radio.Button defaultChecked={isChecked(x)} key={x} value={x}>{x}</Radio.Button>)
  let onChange = (e: RadioChangeEvent) => dispatch({ type: 'update_suite', suit: e.target.value })
  return <Radio.Group onChange={onChange}> {buttons}</Radio.Group>
}

function suitForLogicalSq(sq: [number, number]) {
  let rowEven = sq[1] % 2 == 0
  let colEven = sq[0] % 2 == 0

  if (rowEven && colEven) return '♠'
  if (rowEven && !colEven) return '♥'
  if (!rowEven && colEven) return '♦'
  // else (!rowEven && !colEven) 
  return '♣'
}

function makeMove(state: State, dispatch: React.Dispatch<any>) {
  if (state.userInfo === null)
    return

  const session = state.userInfo.session

  if (state.login === null || state.sourceSquare == null || state.destSquare == null)
    return

  let src = tupleCoordsToSquare(state.sourceSquare)
  let dst = tupleCoordsToSquare(state.destSquare)

  // let srcPiece = state.position.get(src)
  let dstPiece = state.position.get(dst)


  const run = async (resultingPosition: Map<string, string>, kind: MoveEnum | null, suit: string | null) => {
    if (state.login === null) return

    let includeCard =
      dstPiece !== undefined || kind === null || kind === MoveEnum.Enpassant

    if (includeCard) {
      console.log('including card: ', state.card)
    }

    let payload = {
      user: state.login.uid,
      move: { src, dst },
      card: includeCard ? state.card : null,
      suit: suit,
      source_position: Object.fromEntries(state.position),
      position: Object.fromEntries(resultingPosition)
    }
    console.log('move2: ', payload)
    let data = await fetch(`${httpScheme}://${host}/move2/${session}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })

    // clear source and dest squares on success
    dispatch({ type: 'clear_marked' })
    dispatch({ type: 'update_card', card: "" })
    console.log('move2: ', data)
  }


  if (!state.boardDisabled) {
    // we are attacking or simply moving to a blank square
    let arg: MoveMakerArg = {
      position: state.position,
      sourceSquare: src,
      destSquare: dst,
      user_is_white: state.login.user_is_white,
      white_can_castle: state.white_can_castle,
      black_can_castle: state.black_can_castle,
      epSq: state.ep_square
    }

    let res = moveMaker(arg)
    if (res == MoveError.Error) {
      // do nothing... don't make a move
    } else {
      if (shouldChooseSuit(state)) {
        if (state.suit === null) {
          console.log('Forgetting to choose a suite!!')
        } else
          run(res[0], res[1], state.suit).catch(console.error)
      } else {
        run(res[0], res[1], null).catch(console.error)
      }
    }
  } else {
    // we are responding
    run(state.position, null, null).catch(console.error)
  }
}

function shouldChooseSuit(state: State) {
  if (state.login === null || state.sourceSquare == null || state.destSquare == null)
    return false

  let src = tupleCoordsToSquare(state.sourceSquare)
  let dst = tupleCoordsToSquare(state.destSquare)

  let srcPiece = state.position.get(src)
  let dstPiece = state.position.get(dst)


  if (!state.boardDisabled && srcPiece !== undefined && dstPiece !== undefined) {
    // we are attacking or simply moving to a blank square
    let arg: MoveMakerArg = {
      position: state.position,
      sourceSquare: src,
      destSquare: dst,
      user_is_white: state.login.user_is_white,
      white_can_castle: state.white_can_castle,
      black_can_castle: state.black_can_castle,
      epSq: state.ep_square
    }

    let res = moveMaker(arg)

    if (res === MoveError.Error) {
      return false
    } else {
      return isKing(srcPiece)
    }
  }

  return false
}

let lastMove = (state: State) => {
  if (state.sourceSquare !== null && state.destSquare !== null) {
    let src = tupleCoordsToSquare(state.sourceSquare)
    let dst = tupleCoordsToSquare(state.destSquare)

    let whiteStatus = state.login!.user_is_white

    var arg: MoveMakerArg = {
      position: state.position,
      sourceSquare: src,
      destSquare: dst,
      user_is_white: whiteStatus,
      white_can_castle: state.white_can_castle,
      black_can_castle: state.black_can_castle,
      epSq: state.ep_square
    }
    let res = moveMaker(arg)
    if (res === MoveError.Error) {
      return res
    } else {
      let [pos, kind] = res
      let sq = findKing(pos, whiteStatus)
      if (sq === null || isInCheck(sq, pos))
        return MoveError.Error

      return kind
    }
  }
  return MoveError.Error
}

let unableToMakeMoves = (state: State) => {
  if (state.login == null)
    return true

  if (inCompletedGameState(state))
    return true

  let notMyTurn =
    (state.turn == 'black' && state.login.user_is_white) ||
    (state.turn == 'white' && !state.login.user_is_white)

  if (!state.boardDisabled) {
    let res = lastMove(state)
    let captureWithoutCard = (res === MoveEnum.Capture || res === MoveEnum.Enpassant) && state.card.length == 0
    let unmarkedSquares = state.sourceSquare === null || state.destSquare === null
    return notMyTurn || unmarkedSquares || captureWithoutCard || res === MoveError.Error
  }
  else
    return notMyTurn || state.card == "" // when responding only turn matters
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function MainPage({ state, dispatch }: VecBoardProps) {
  const navigate = useNavigate()
  // useEffect(() => {
  //   // const fetchData = async () => {
  //   //   if (connectionR && state.login) {
  //   //     if ((state.turn == "white" && state.login.user_is_white == false) || (state.turn == "black" && state.login.user_is_white == true)) {
  //   //       if (connectionR && state.login) {
  //   //         connectionR.invoke("UpdatePairing", state.login.opponent, btime, wtime)
  //   //       }
  //   //     } else {
  //   //       await connectionR.invoke("SendPairing").then(result => {
  //   //         try {
  //   //           let json = JSON.parse(result);
  //   //           console.log(json.game.pairing.btime)
  //   //           btime = json.game.pairing.btime
  //   //           wtime = json.game.pairing.wtime
  //   //         } catch (err) {
  //   //           console.error("Failed to parse JSON: ", err);
  //   //         }
  //   //       }).catch(err => {
  //   //         console.error("Error invoking SendPairing: ", err.toString());
  //   //       });
  //   //     }
  //   //   }
  //   // }
  //   // fetchData();
  //   clearInterval(timerId)
  //   const onTimeout = () => {
  //     if (connectionR && state.login) {
  //       if (state.turn == "black") {
  //         if (btime > 0)
  //           btime = btime - 1
  //         if (btime == 0) {
  //           clearInterval(timerId)
  //           if (state.login.user_is_white == false)
  //             connectionR?.invoke('ResignCurrentGame')
  //         }
  //       } else {
  //         if (wtime > 0)
  //           wtime = wtime - 1
  //         if (wtime == 0) {
  //           clearInterval(timerId)
  //           if (state.login.user_is_white == true)
  //             connectionR?.invoke('ResignCurrentGame')
  //         }
  //       }
  //     }
  //   }
  //   if (btime !== 9999 && wtime !== 9999)
  //     timerId = setInterval(onTimeout, 1000);
  // }, [state.turn])


  // this effect will be mounted unmounted twice in dev by design
  useEffect(() => {
    console.log('Mounting game page')
    if (!connectionR || !state.login || !state.userInfo) {
      navigate("/")
      return
    }
    var cancellation = { valid: true }
    if (state.login) {
      btime = state.login.btime
      wtime = state.login.wtime
      subscribe(dispatch, session, state.login.uid, cancellation)
    }

    return () => {
      cancellation.valid = false
      console.log('Unmounting game page')
    }
  }, [])

  if (!state.login)
    return (<><Typography.Text>No Game</Typography.Text></>)

  if (!state.userInfo)
    return (<><Typography.Text>No Session</Typography.Text></>)

  const session = state.userInfo.session

  // confirms checkmate if one is visible
  const confirmCheckmateMutation = useMutation({
    mutationFn: async () => {
      if (!connectionR)
        throw new Error('No SignalR connection')

      if (state.result == '*' && state.inCheckmate != CheckMateState.NotInCheckmate) {

        if (state.inCheckmate === CheckMateState.WhiteIsCheckmated)
          await connectionR.invoke('ConcludeCurrentGame', true)
        else
          // must be black who is in checkmate
          await connectionR.invoke('ConcludeCurrentGame', false)

        // sleep for half a sec, so we don't inundate the server
        await sleep(500)
      }

      //dispatch({ type: 'login' })
      //navigate("/main")

      return true
    },
    retry: 5
  })


  useEffect(() => {
    // moveCount > 0 means that use effect is not running for the first time (a.la componentDidMount)
    if (state.moveCount > 0) {
      makeMove(state, dispatch)
    }
    confirmCheckmateMutation.mutate()

  }, [state.moveCount])

  useEffect(() => {
    if (state.swapReqCount > 0) {
      const run = async () => {
        if (state.login === null) return

        var payload = {
          user: state.login.uid,
          card: state.card
        }

        let data = await fetch(`${httpScheme}://${host}/swap`, {
          method: 'POST',
          body: JSON.stringify(payload)
        })

        // clear source and dest squares on success
        //dispatch({ type: 'clear_marked' })
        dispatch({ type: 'update_card', card: "" })
        // let str = await data.text()
        console.log('swap: ', data)
      }
      if (state.card.length > 0)
        run().catch(console.error)
    }
  }, [state.swapReqCount])
  function formatNumberToTwoDigits(num: number): string {
    return num.toString().padStart(2, '0');
  }
  const style: React.CSSProperties = { margin: 'auto', display: 'block' }
  let dWTime = "99:99"
  let dBTime = "99:99"
  if (wtime !== 9999) {
    dWTime = Math.floor(wtime / 60) + ":" + formatNumberToTwoDigits(wtime % 60);
  }
  if (btime !== 9999) {
    dBTime = Math.floor(btime / 60) + ":" + formatNumberToTwoDigits(btime % 60);
  }
  const isWhite = state.login.user_is_white
  const login = state.login
  const data = [
    ['WHITE: ', isWhite ? login.uid : login.opponent],
    ['BLACK: ', isWhite ? login.opponent : login.uid]
  ]

  return (
    <>
      <Divider orientation="center"></Divider>
      <Row justify="center" align="middle">
        <Col span={3}>
          <Button style={style} onClick={() => {
            navigate("/lobby")
          }} >
            <LeftCircleOutlined twoToneColor='blue' />
          </Button>
          <br />
          <Button style={style} onClick={() => {
            connectionR?.invoke('ResignCurrentGame')
          }} >
            <FrownOutlined twoToneColor='red' />
          </Button>
        </Col>
        <Col span={12}>
          <List
            size="small"
            header={<div> <Typography.Text type="success">Player Tokens</Typography.Text></div>}
            bordered
            dataSource={data}
            renderItem={(item) => (
              <List.Item>
                <Typography.Text >
                  {item[0]}
                </Typography.Text>
                <Typography.Text strong={login.uid == item[1]}>{item[1]}</Typography.Text>
                {/* <Typography.Text >
                  {item[2]}
                </Typography.Text> */}
              </List.Item>
            )}
          />
        </Col>
        <Col span={3}>
          {/* <Button style={style}>Resign</Button> <br /> */}
          <Button style={style} onClick={() => dispatch({ type: 'flip' })}>
            <InteractionOutlined twoToneColor='red' />
          </Button>
        </Col>
      </Row>


      <Divider orientation="center">Chewker Board</Divider>

      <div className="container">
        <VecBoardWrapper dispatch={dispatch} state={state} />
      </div>

      <Divider orientation="center">Moves</Divider>
      <div className='container'>
        <Form style={{ maxWidth: 500 }}>
          <Form.Item label="Result">
            {/* <Input placeholder="please make a move" value={lastMove()} disabled /> */}
            {/* <Input placeholder="please make a move" value={checkmateStr()} disabled /> */}
            <Input placeholder="please make a move" value={`${state.result}, ${state.inCheckmate}`} disabled />

          </Form.Item>
          {state.offer !== null && <Form.Item label="Offer">
            <Typography>{state.offer === null ? '' : state.offer}</Typography>

          </Form.Item>}

          {state.defendingCard !== null && <Form.Item label="Defense">
            <Typography>{state.defendingCard === null ? '' : state.defendingCard}</Typography>

          </Form.Item>}

          <Form.Item label="My Card">
            <Input placeholder="please use a card" disabled value={state.card} onChange={(e) => { dispatch({ type: 'update_card', card: e.target.value }) }} />
          </Form.Item>

          {/* <Form.Item label="Hand" name="card"> */}
          <Deal state={state} dispatch={dispatch} />
          <br />
          {/* </Form.Item> */}

          <div hidden={!shouldChooseSuit(state)}>
            <Form.Item label="Suits">
              <Suits state={state} dispatch={dispatch} />
            </Form.Item>
          </div>

          <Form.Item>
            <Button type="primary" disabled={unableToMakeMoves(state)} onClick={() => dispatch({ type: 'make_move' })}>Make</Button>
            &nbsp;&nbsp;&nbsp;
            <Button type="dashed" disabled={state.boardDisabled} onClick={() => dispatch({ type: 'swap' })}>Swap</Button>
          </Form.Item>
        </Form>
      </div>
    </>
  )

}

// Create a query client
const queryClient = new QueryClient()



function App() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const [currentTheme, setCurrentTheme] = useState('dark'); // Default to light theme

  // Function to toggle the theme
  const toggleTheme = () => {
    setCurrentTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Determine the Ant Design theme algorithm based on the current theme
  const themeAlgorithm = currentTheme === 'light' ? theme.defaultAlgorithm : theme.darkAlgorithm;

  return (
    <>
      <ConfigProvider theme={{ algorithm: themeAlgorithm }}>
        <QueryClientProvider client={queryClient}>
          <HashRouter>
            <Routes>
              <Route path="/" element={<DebugMenu />}>
                <Route index element={<Signin state={state} dispatch={dispatch} />} />
                {/* <Route path="old" element={<InitialPage state={state} dispatch={dispatch} />} /> */}
                {/* <Route path="arena" element={<Arena state={state} dispatch={dispatch} />} /> */}
                <Route path="lobby" element={<Lobby toggleTheme={toggleTheme} state={state} dispatch={dispatch} />} />
                {/* <Route path="blogs/:userId" element={<Blogs />} /> */}
                <Route path="main" element={<MainPage state={state} dispatch={dispatch} />} />
                <Route path="*" element={<NoPage />} />
              </Route>
            </Routes>
          </HashRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </>)
}

export default App



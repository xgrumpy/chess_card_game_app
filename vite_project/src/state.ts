import { takeWhile } from './Utils'
import { PiecesEnum } from './Pieces'
import * as Immutable from 'immutable';


export let squareToCoords = (square: string): [number, number] => [square.charCodeAt(0) - 96, square.charCodeAt(1) - 48]
export let coordsToSquare = (a: number, b: number) => `${String.fromCharCode(96 + a)}${b}`
export let tupleCoorsToSquare = (tuple: [number, number]) => coordsToSquare(tuple[0], tuple[1])


export let isWhite = (piece: string) => piece.startsWith('w')
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let isBlack = (piece: string) => piece.startsWith('b')
export let isKing = (piece: string) => piece === PiecesEnum.wK || piece === PiecesEnum.bK
let isKnight = (p: string) => p === PiecesEnum.wN || p === PiecesEnum.bN
let isBishop = (p: string) => p === PiecesEnum.wB || p === PiecesEnum.bB
let isRook = (p: string) => p === PiecesEnum.wR || p === PiecesEnum.bR
let isQueen = (p: string) => p === PiecesEnum.wQ || p === PiecesEnum.bQ
let isPawn = (p: string) => p === PiecesEnum.wP || p === PiecesEnum.bP

function quazilegalKnightMoves(square: string) {
    let result = new Set<string>();

    const [file, rank] = squareToCoords(square)
    const delta = [[1, 2], [2, 1], [-1, 2], [2, -1], [1, -2], [-2, 1], [-1, -2], [-2, -1]]

    for (const e of delta) {
        const a = file + e[0]
        const b = rank + e[1]

        if (a >= 1 && a <= 8 && b >= 1 && b <= 8)
            result.add(coordsToSquare(a, b))
    }

    return result;
}

function quazilegalKingMoves(square: string) {
    let result = new Set<string>();

    const [file, rank] = squareToCoords(square)
    const delta = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]

    for (const e of delta) {
        const a = file + e[0]
        const b = rank + e[1]

        if (a >= 1 && a <= 8 && b >= 1 && b <= 8)
            result.add(coordsToSquare(a, b))
    }

    return result;
}

function pawnAttacks(square: string, isWhite: boolean) {
    let result = new Set<string>();

    const [file, rank] = squareToCoords(square)
    const yDir = isWhite ? 1 : -1
    const delta = [[-1, yDir], [1, yDir]]

    for (const e of delta) {
        const a = file + e[0]
        const b = rank + e[1]

        if (a >= 1 && a <= 8 && b >= 1 && b <= 8)
            result.add(coordsToSquare(a, b))
    }

    return result
}


export type Vec = [number, number]
// vector add operation
let addVec = (a: Vec, b: Vec) => {
    let [aa, aaa] = a
    let [bb, bbb] = b
    return [aa + bb, aaa + bbb] as Vec
}

let inRange = (vec: Vec) => {
    let [a, b] = vec
    return (a >= 1 && a <= 8 && b >= 1 && b <= 8)
}

export function pawnMoves(position: Map<string, string>, square: string, epSq: string | null): MoveSet {
    let moves = Immutable.Set() as MoveSet
    let piece = position.get(square)
    if (piece === undefined || !isPawn(piece))
        return moves

    let whiteStatus = isWhite(piece)
    let vertical = whiteStatus ? 1 : -1

    const [file, rank] = squareToCoords(square)
    let coords = [file, rank] as Vec

    // compute non-capture moves
    let up = [0, vertical] as Vec
    let frontSq = addVec(up, coords)
    let frontSqName = tupleCoorsToSquare(frontSq)
    let hasObstacleA = inRange(frontSq) ? position.has(frontSqName) : true

    if (whiteStatus && rank == 2 || !whiteStatus && rank == 7) {
        let up_up = [0, 2 * vertical] as Vec
        let superFront = addVec(up_up, coords)
        let superFrontSqName = tupleCoorsToSquare(superFront)
        let hasObstacleB = inRange(superFront) ? position.has(superFrontSqName) : true

        if (!hasObstacleA) {
            moves = moves.add(pawnNormalMove(square, frontSqName, whiteStatus))
            if (!hasObstacleB)
                moves = moves.add(pawnNormalMove(square, superFrontSqName, whiteStatus))
        }
    }
    else {
        if (!hasObstacleA)
            moves = moves.add(pawnNormalMove(square, frontSqName, whiteStatus))
    }

    // add possible captures
    let attacks = pawnAttacks(square, whiteStatus)

    for (const dest of attacks) {
        let target = position.get(dest)

        if (epSq != null && dest === epSq && target === undefined) {
            moves = moves.add(epCapture(square, dest))
        } else if (target !== undefined && isWhite(target) != whiteStatus && !isKing(target)) {
            moves = moves.add(pawnNormalMove(square, dest, whiteStatus))
        }
    }

    return moves
}

function quazilegalRayedMoves(square: string, delta: [number, number][]) {
    let result = [];

    const [file, rank] = squareToCoords(square)

    for (const e of delta) {
        let [fst, snd] = e
        let ray = []
        for (var j = 1; j < 8; j++) {
            const a = file + j * fst
            const b = rank + j * snd

            if (a >= 1 && a <= 8 && b >= 1 && b <= 8)
                ray.push(coordsToSquare(a, b))
        }
        result.push(ray)
    }

    return result;
}

function quazilegalBishopMoves(square: string) {
    return quazilegalRayedMoves(square, [[1, 1], [1, -1], [-1, 1], [-1, -1]])
}

function quazilegalRookMoves(square: string) {
    return quazilegalRayedMoves(square, [[1, 0], [-1, 0], [0, 1], [0, -1]])
}



function isLegalKnightMove(position: Map<string, string>, fromSq: string, toSq: string) {
    const piece = position.get(fromSq);
    const destPiece = position.get(toSq);

    if (piece === undefined) return false;
    if (destPiece === undefined) return quazilegalKnightMoves(fromSq).has(toSq)
    if (isKing(destPiece)) return false;

    return isWhite(piece) !== isWhite(destPiece)
}

function isLegalKingMove(position: Map<string, string>, fromSq: string, toSq: string) {
    const piece = position.get(fromSq);
    const destPiece = position.get(toSq);

    if (piece === undefined) return false;
    if (destPiece === undefined) return quazilegalKingMoves(fromSq).has(toSq)
    if (isKing(destPiece)) return false;

    return isWhite(piece) !== isWhite(destPiece)
}

function pieceMoves(position: Map<string, string>, fromSq: string, raysFunction: (_: string) => string[][]) {
    const piece = position.get(fromSq);
    // const destPiece = position.get(toSq);

    if (piece === undefined) return new Set<string>()
    // if (destPiece !== undefined && isKing(destPiece)) return false;

    let clear = (square: string) => position.get(square) === undefined
    let enemy = (square: string) => {
        let p = position.get(square)
        return (p === undefined) || isWhite(p) !== isWhite(piece)
    }

    let rays = raysFunction(fromSq)
    // accept clear squares and possibly one enemy piece
    let newRays = rays.map(r => takeWhile(clear, enemy, r))

    return new Set([...newRays.flat()])
}

function bishopMoves(position: Map<string, string>, fromSq: string) {
    return pieceMoves(position, fromSq, quazilegalBishopMoves)
}

function rookMoves(position: Map<string, string>, fromSq: string) {
    return pieceMoves(position, fromSq, quazilegalRookMoves)
}

export let computeAttacks = (position: Map<string, string>, trackingWhite: boolean) => {

    let attackedSquares = new Set<string>()

    for (const [k, v] of position) {
        if (isWhite(v) !== trackingWhite)
            continue

        if (isQueen(v)) {
            let moves1 = rookMoves(position, k)
            let moves2 = bishopMoves(position, k)

            for (const square of moves1) {
                attackedSquares.add(square)
            }
            for (const square of moves2) {
                attackedSquares.add(square)
            }
        }

        if (isRook(v)) {
            let moves = rookMoves(position, k)
            for (const square of moves) {
                attackedSquares.add(square)
            }
        }

        if (isBishop(v)) {
            let moves = bishopMoves(position, k)
            for (const square of moves) {
                attackedSquares.add(square)
            }
        }

        if (isKnight(v)) {
            let kmoves = quazilegalKnightMoves(k);
            for (const square of kmoves) {
                attackedSquares.add(square)
            }
        }

        if (isKing(v)) {
            let kmoves = quazilegalKingMoves(k);
            for (const square of kmoves) {
                attackedSquares.add(square)
            }
        }

        if (isPawn(v)) {
            let kmoves = pawnAttacks(k, trackingWhite);
            for (const square of kmoves) {
                attackedSquares.add(square)
            }
        }
    }

    return attackedSquares
}


export enum MoveEnum {
    Simple = 'simple',
    Capture = 'capture',
    Enpassant = 'ep capture'
}

export enum MoveError {
    Error = 'general error'
}

type MoveResult = [Map<string, string>, MoveEnum] | MoveError

export interface MoveMakerArg {
    position: Map<string, string>
    sourceSquare: string
    destSquare: string
    user_is_white: boolean
    white_can_castle: boolean
    black_can_castle: boolean
    epSq: string | null
}

export function findKing(position: Map<string, string>, forWhite: boolean) {
    for (const [k, v] of position) {
        if (isKing(v) && isWhite(v) == forWhite)
            return k
    }
    return null
}


// all king moves that are not self-captures
export function kingMoves(position: Map<string, string>, square: string) {
    let possible = quazilegalKingMoves(square)
    let impossible = new Set<string>()

    // filter out impossible moves
    for (const s of possible) {
        if (!isLegalKingMove(position, square, s)) impossible.add(s)
    }

    for (const s of impossible) possible.delete(s)

    return possible
}

// all knight moves that are not self-captures
export function knightMoves(position: Map<string, string>, square: string) {
    let possible = quazilegalKnightMoves(square)
    let impossible = new Set<string>()

    // filter out impossible moves
    for (const s of possible) {
        if (!isLegalKnightMove(position, square, s)) impossible.add(s)
    }

    for (const s of impossible) possible.delete(s)

    return possible
}


export enum MoveKind {
    Normal,
    Enpassant,
}

// An object representing a tagged union of the different types of moves
export type MoveMap = Immutable.MapOf<{
    kind: MoveKind
    source: string
    target: string
    promotion: string | null
}>

export type MoveSet = Immutable.Set<MoveMap>

export let normalMove = (src: string, dst: string): MoveMap => { return Immutable.Map({ kind: MoveKind.Normal, source: src, target: dst, promotion: null }) }
export let pawnNormalMove = (src: string, dst: string, whiteStatus:boolean): MoveMap => { 
    // @ts-ignore
    let [c, r] = squareToCoords(dst)

    let promotion:null | string = null
    if (whiteStatus && r == 8) {
        promotion = PiecesEnum.wQ
    } 

    if (!whiteStatus && r == 1) {
        promotion = PiecesEnum.bQ
    }

    return Immutable.Map({ kind: MoveKind.Normal, source: src, target: dst, promotion: promotion }) 
}

export let epCapture = (src: string, dst: string): MoveMap => { return Immutable.Map({ kind: MoveKind.Enpassant, source: src, target: dst, promotion: null }) }

export function makeNormalMove(position: Map<string, string>, src: string, dst: string) {
    let result = new Map(position)
    let v = result.get(src)
    if (v !== undefined) {
        result.set(dst, v)
        result.delete(src)
    }
    return result
}

export function makePawnMove(position: Map<string, string>, src: string, dst: string, promotion: null | string) {
    let result = new Map(position)
    let v = result.get(src)
    if (v !== undefined) {
        if (promotion) {
            result.set(dst, promotion)
        } else {
            result.set(dst, v)
        }
        result.delete(src)
    }
    return result
}


export function makeEpCapture(position: Map<string, string>, src: string, dst: string) {
    // @ts-ignore
    let [srcFile, srcRank] = squareToCoords(src)

    // @ts-ignore
    let [dstFile, dstRank] = squareToCoords(dst)

    let result = makeNormalMove(position, src, dst)
    result.delete(coordsToSquare(dstFile, srcRank))

    return result
}

export function allMovesAtSquare(position: Map<string, string>, square: string, trackingWhite: boolean, epSq: string | null): MoveSet {
    let v = position.get(square)

    if (v === undefined || isWhite(v) !== trackingWhite)
        return Immutable.Set()

    let normalize = (dst: string) => normalMove(square, dst)
    let nn = (s: Set<string>) => Immutable.Set([...s].map(normalize))


    if (isKing(v))
        return nn(kingMoves(position, square))
    if (isKnight(v))
        return nn(knightMoves(position, square))
    if (isBishop(v))
        return nn(bishopMoves(position, square))
    if (isRook(v))
        return nn(rookMoves(position, square))
    if (isQueen(v))
        return Immutable.Set([...rookMoves(position, square), ...bishopMoves(position, square)].map(normalize))
    if (isPawn(v))
        return pawnMoves(position, square, epSq)

    return Immutable.Set()
}

export function allMovesAtSquareWrapper(position: Map<string, string>, square: string, trackingWhite: boolean, epSq: string | null): MoveSet {
    let v = position.get(square)

    if (v === undefined || isWhite(v) !== trackingWhite)
        return Immutable.Set()

    let kingSq = findKing(position, trackingWhite)
    if (kingSq == null)
        return Immutable.Set()

    let moves = allMovesAtSquare(position, square, trackingWhite, epSq)


    let result = Immutable.Set() as MoveSet
    for (const mv of moves) {
        let computePosition = () => {
            switch (mv.get('kind')) {
                case MoveKind.Normal:
                    return makeNormalMove(position, square, mv.get('target'))
                case MoveKind.Enpassant:
                    return makeEpCapture(position, square, mv.get('target'))
            }
        }

        let p = computePosition()
        let kingSq = findKing(p, trackingWhite)
        if (kingSq !== null) {
            let newAttacks = computeAttacks(p, !trackingWhite)
            if (!newAttacks.has(kingSq)) {
                result = result.add(mv)
            }
        }
    }

    return result
}







// all moves that are not self captures 
export function allMoves(position: Map<string, string>, trackingWhite: boolean, epSq: string | null) {
    let m = Immutable.Map<string, MoveSet>()

    for (const [k, v] of position) {
        let normalize = (dst: string) => normalMove(k, dst)
        let nn = (s: Set<string>) => Immutable.Set([...s].map(normalize))

        if (isWhite(v) !== trackingWhite)
            continue

        if (isKing(v))
            m = m.set(k, nn(kingMoves(position, k)))

        if (isKnight(v))
            m = m.set(k, nn(knightMoves(position, k)))

        if (isBishop(v))
            m = m.set(k, nn(bishopMoves(position, k)))

        if (isRook(v))
            m = m.set(k, nn(rookMoves(position, k)))

        if (isQueen(v))
            m = m.set(k, Immutable.Set([...rookMoves(position, k), ...bishopMoves(position, k)].map(normalize)))

        if (isPawn(v))
            m = m.set(k, pawnMoves(position, k, epSq))
    }
    return m
}



export function isInCheck(square: string, position: Map<string, string>) {
    let piece = position.get(square) // this  is my king
    if (piece == undefined) {
        console.log('something went very wrong!!!')
        return false
    }

    let sideIsWhite = isWhite(piece)
    let attacks = computeAttacks(position, !sideIsWhite)
    return attacks.has(square)
}

export function isInCheckMate(square: string, position: Map<string, string>, epSq: string | null) {
    let piece = position.get(square) // this  is my king

    if (piece === undefined) {
        console.log('something went very wrong!!!')
        return false
    }

    let sideIsWhite = isWhite(piece)
    let attacks = computeAttacks(position, !sideIsWhite)

    // if am not in check then no checkmate
    if (!attacks.has(square))
        return false

    // all moves for the side we are tracking
    let moves = allMoves(position, isWhite(piece), epSq)

    function alwayInCheck() {
        for (const [src, dests] of moves) {
            for (const dest of dests) {
                let computePosition = () => {
                    switch (dest.get('kind')) {
                        case MoveKind.Normal:
                            return makeNormalMove(position, src, dest.get('target'))
                        case MoveKind.Enpassant:
                            return makeEpCapture(position, src, dest.get('target'))
                    }
                }

                let p = computePosition()
                let kingSq = findKing(p, sideIsWhite)!
                let newAttacks = computeAttacks(p, !sideIsWhite)
                if (!newAttacks.has(kingSq)) {
                    return false
                }
            }
        }
        return true
    }

    return alwayInCheck()
}




export function moveMaker(arg: MoveMakerArg): MoveResult {
    let { position, sourceSquare, destSquare, user_is_white } = arg
    let { white_can_castle, black_can_castle, epSq } = arg

    if (sourceSquare === destSquare || !position.has(sourceSquare))
        return MoveError.Error

    const piece = position.get(sourceSquare)

    if (piece === undefined) return MoveError.Error

    if (isWhite(piece) && !user_is_white) return MoveError.Error
    if (isBlack(piece) && user_is_white) return MoveError.Error

    const pos = new Map(position);

    let castlingLogic = () => {
        interface Arg {
            emptySquares: string[]
            rookSquare: string
            rookDestination: string
            attacks: Set<string>
        }

        type Sideffect = (() => void) | null

        let rookMovingSideEffect = (arg: Arg): Sideffect => {
            let empty = true
            let unassaulted = true
            for (let e of arg.emptySquares) {
                empty = empty && !pos.has(e)
                unassaulted = unassaulted && !arg.attacks.has(e)
            }

            if (empty && unassaulted) {
                const maybeRook = pos.get(arg.rookSquare)
                if (maybeRook !== undefined && isRook(maybeRook) && isWhite(maybeRook) === isWhite(piece as string)) {
                    let sideEffect = () => {
                        console.log("Moving rook around")
                        pos.set(arg.rookDestination, maybeRook)
                        pos.delete(arg.rookSquare)
                    }

                    return sideEffect
                }
            }

            return null
        }

        if (isKing(piece))
            if (isWhite(piece) && white_can_castle) {
                let attacks = computeAttacks(position, false)
                // if king on e1 and not in check
                if (sourceSquare === 'e1' && !attacks.has('e1'))
                    if (destSquare === 'g1')
                        return rookMovingSideEffect({
                            emptySquares: ['f1', 'g1'],
                            rookSquare: 'h1',
                            rookDestination: 'f1',
                            attacks
                        })
                    else if (destSquare === 'c1')
                        return rookMovingSideEffect({
                            emptySquares: ['b1', 'c1', 'd1'],
                            rookSquare: 'a1',
                            rookDestination: 'd1',
                            attacks
                        })
            } else if (isBlack(piece) && black_can_castle) {
                let attacks = computeAttacks(position, true)
                if (sourceSquare === 'e8' && !attacks.has('e8'))
                    if (destSquare === 'g8')
                        return rookMovingSideEffect({
                            emptySquares: ['f8', 'g8'],
                            rookSquare: 'h8',
                            rookDestination: 'f8',
                            attacks
                        })
                    else if (destSquare === 'c8')
                        return rookMovingSideEffect({
                            emptySquares: ['b8', 'c8', 'd8'],
                            rookSquare: 'a8',
                            rookDestination: 'd8',
                            attacks
                        })
            }

        return null
    }

    // the sideeffect will move the rook around and 
    // its presence testifies to the castling intent
    const maybeSideEffect = castlingLogic()

    if (maybeSideEffect !== null) {
        // we know we are intending to castle
        maybeSideEffect()

        pos.set(destSquare, piece);
        pos.delete(sourceSquare);

        return [pos, MoveEnum.Simple]
    } else {
        let moves = allMovesAtSquareWrapper(position, sourceSquare, user_is_white, epSq)

        let a = normalMove(sourceSquare, destSquare)
        let b = epCapture(sourceSquare, destSquare)
        let c = pawnNormalMove(sourceSquare, destSquare, isWhite(piece) )

        if (moves.has(a)) {
            let out =   pos.has(destSquare) ? MoveEnum.Capture : MoveEnum.Simple
            return [makeNormalMove(position, sourceSquare, destSquare), out]
        }


        if (moves.has(c)) {
            let out =   pos.has(destSquare) ? MoveEnum.Capture : MoveEnum.Simple
            return [makePawnMove(position, sourceSquare, destSquare, c.get('promotion')), out]

        }

        if (moves.has(b)) {
            return [makeEpCapture(position, sourceSquare, destSquare), MoveEnum.Enpassant]
        }

        return MoveError.Error
    }

}





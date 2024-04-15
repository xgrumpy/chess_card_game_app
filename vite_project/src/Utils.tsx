import { useRef, useEffect, useState } from "react"

// Copying code from chessboard.js

const COLUMNS = "abcdefgh".split("");

// convert FEN piece code to bP, wK, etc
function fenToPieceCode(piece:string) {
  // black piece
  if (piece.toLowerCase() === piece) {
    return "b" + piece.toUpperCase();
  }

  // white piece
  return "w" + piece.toUpperCase();
}

// convert bP, wK, etc code to FEN structure
function pieceCodeToFen(piece:string) {
  var pieceCodeLetters = piece.split("");

  // white piece
  if (pieceCodeLetters[0] === "w") {
    return pieceCodeLetters[1].toUpperCase();
  }

  // black piece
  return pieceCodeLetters[1].toLowerCase();
}

function expandFenEmptySquares(fen:string) {
  return fen
    .replace(/8/g, "11111111")
    .replace(/7/g, "1111111")
    .replace(/6/g, "111111")
    .replace(/5/g, "11111")
    .replace(/4/g, "1111")
    .replace(/3/g, "111")
    .replace(/2/g, "11");
}

function validFen(fen:string) {
  //if (!(typeof fen === "string")) return false;

  // cut off any move, castling, etc info from the end
  // we're only interested in position information
  fen = fen.replace(/ .+$/, "");

  // expand the empty square numbers to just 1s
  fen = expandFenEmptySquares(fen);

  // FEN should be 8 sections separated by slashes
  var chunks = fen.split("/");
  if (chunks.length !== 8) return false;

  // check each section
  for (var i = 0; i < 8; i++) {
    if (chunks[i].length !== 8 || chunks[i].search(/[^kqrnbpKQRNBP1]/) !== -1) {
      return false;
    }
  }

  return true;
}

// convert FEN string to position object
// returns false if the FEN string is invalid
export function fenToObj(fen:string) {
  if (!validFen(fen)) return false;

  // cut off any move, castling, etc info from the end
  // we're only interested in position information
  fen = fen.replace(/ .+$/, "");

  var rows = fen.split("/");
  var position:{ [index: string]: string } = {};

  var currentRow = 8;
  for (var i = 0; i < 8; i++) {
    var row = rows[i].split("");
    var colIdx = 0;

    // loop through each character in the FEN section
    for (var j = 0; j < row.length; j++) {
      // number / empty squares
      if (row[j].search(/[1-8]/) !== -1) {
        var numEmptySquares = parseInt(row[j], 10);
        colIdx = colIdx + numEmptySquares;
      } else {
        // piece
        var square = COLUMNS[colIdx] + currentRow;
        position[square] = fenToPieceCode(row[j]);
        colIdx = colIdx + 1;
      }
    }

    currentRow = currentRow - 1;
  }

  return position;
}

// position Map to FEN string
// returns false if the obj is not a valid position object
export function objToFen(obj:Map<string,string>) {
  //if (!validPositionObject(obj)) return false;

  var fen = "";

  var currentRow = 8;
  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      var square = COLUMNS[j] + currentRow;

      // piece exists
      let sq = obj.get(square)
      if (sq !== undefined) {
        fen = fen + pieceCodeToFen(sq);
      } else {
        // empty space
        fen = fen + "1";
      }
    }

    if (i !== 7) {
      fen = fen + "/";
    }

    currentRow = currentRow - 1;
  }

  // squeeze the empty numbers together
  fen = squeezeFenEmptySquares(fen);

  return fen;
}

function squeezeFenEmptySquares(fen:string) {
  return fen
    .replace(/11111111/g, "8")
    .replace(/1111111/g, "7")
    .replace(/111111/g, "6")
    .replace(/11111/g, "5")
    .replace(/1111/g, "4")
    .replace(/111/g, "3")
    .replace(/11/g, "2");
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
const START_POSITION = fenToObj(START_FEN);
export const START_POSITION_MAP:Map<string,string> = new Map(Object.entries(START_POSITION));
// export function convertMapToFen(someMap) {
//   const obj = {};
//   for (let [key, value] of someMap) {
//     obj[key] = value;
//   }

//   return objToFen(obj)
// }
////



// Mechanism described here:
//   https://usehooks.com/useEventListener/
// Hook
export function useEventListener(eventName:any, handler:any, element = window) {
  // Create a ref that stores handler
  const savedHandler = useRef(handler);

  // Update ref.current value if handler changes.
  // This allows our effect below to always get latest handler ...
  // ... without us needing to pass it in effect deps array ...
  // ... and potentially cause effect to re-run every render.
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(
    () => {
      // Make sure element supports addEventListener
      // On
      const isSupported = element && element.addEventListener;
      if (!isSupported) return;

      // Create event listener that calls handler function stored in ref
      const eventListener = (event:any) => savedHandler.current(event);

      // Add event listener
      element.addEventListener(eventName, eventListener);

      // Remove event listener on cleanup
      return () => {
        element.removeEventListener(eventName, eventListener);
      };
    },
    [eventName, element] // Re-run if eventName or element changes
  );
}



// Compares two Map objects for shallow equality
export function compareMaps(map1:Map<any,any>, map2:Map<any,any>) {
  var testVal;
  if (map1.size !== map2.size) {
      return false;
  }
  for (const [key, val] of map1) {
      testVal = map2.get(key);
      // in cases of an undefined value, make sure the key
      // actually exists on the object so there are no false positives
      if (testVal !== val || (testVal === undefined && !map2.has(key))) {
          return false;
      }
  }
  return true;
}

////
type FilterF<T> = (_:T)=>boolean

export function takeWhile<T>(f:FilterF<T>, g:FilterF<T>, xs:T[]) { 
  return xs.length ? takeWhileNotEmpty(f, g, xs) : [] 
}

function takeWhileNotEmpty<T>(f:FilterF<T>, g:FilterF<T>, [x, ...xs]:T[]):T[] { 
  return f(x) ? [x, ...takeWhile(f, g, xs)] : takeAtMostOnce (g, [x, ...xs]); 
}

function takeAtMostOnce<T>(g:FilterF<T>, xs:T[]) {
  if (xs.length > 0) {
    let x = xs[0]
    return g(x) ? [x] : []
  }
  return []
}
//takeWhile(odd,zero, [1,2,3,4,0,10])
  
// export let takeWhile = (f, xs) => xs.length ? takeWhileNotEmpty(f, xs) : [];
// let takeWhileNotEmpty = (f, [x, ...xs]) =>  f(x) ? [x, ...takeWhile(f, xs)] : [];


export function getWindowDimensions() {
  const { innerWidth: width, innerHeight: height } = window;
  return {
      width,
      height
  };
}

export function useWindowDimensions() {
  const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions());

  useEffect(() => {
      function handleResize() {
          setWindowDimensions(getWindowDimensions());
      }

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowDimensions;
}

export type FEN = string
export type PGN = string
export type GameModel = {
  finalFen: FEN,
  deltas: Array<[{}, FEN]>
}

export const sleep = (delay:number) => new Promise<void>((resolve) => setTimeout(resolve, delay))
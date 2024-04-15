
import TC from './assets/Cards-10-Club.svg'
import TS from './assets/Cards-10-Spade.svg'
import TH from './assets/Cards-10-Heart.svg'
import TD from './assets/Cards-10-Diamond.svg'

import NH from './assets/Cards-9-Heart.svg'
import NC from './assets/Cards-9-Club.svg'
import NS from './assets/Cards-9-Spade.svg'
import ND from './assets/Cards-9-Diamond.svg'

import AD from './assets/Cards-A-Diamond.svg'
import AH from './assets/Cards-A-Heart.svg'
import AC from './assets/Cards-A-Club.svg'
import AS from './assets/Cards-A-Spade.svg'

import JC from './assets/Cards-J-Club.svg'
import JS from './assets/Cards-J-Spade.svg'
import JD from './assets/Cards-J-Diamond.svg'
import JH from './assets/Cards-J-Heart.svg'

import KH from './assets/Cards-K-Heart.svg'
import KC from './assets/Cards-K-Club.svg'
import KS from './assets/Cards-K-Spade.svg'
import KD from './assets/Cards-K-Diamond.svg'

import QD from './assets/Cards-Q-Diamond.svg'
import QH from './assets/Cards-Q-Heart.svg'
import QC from './assets/Cards-Q-Club.svg'
import QS from './assets/Cards-Q-Spade.svg'
import { Card, Col, Row } from "antd"
import { cardBackgroundColor } from './App'


function cardImageFromSymbol(sym: string) {
  const S = "♠"
  const C = "♣"
  const H = "♥"
  const D = "♦"

  switch (sym) {
    case 'J' + S: return JS
    case 'J' + H: return JH
    case 'J' + C: return JC
    case 'J' + D: return JD
    case '10' + S: return TS
    case '10' + H: return TH
    case '10' + C: return TC
    case '10' + D: return TD
    case '9' + S: return NS
    case '9' + H: return NH
    case '9' + C: return NC
    case '9' + D: return ND
    case 'K' + S: return KS
    case 'K' + H: return KH
    case 'K' + C: return KC
    case 'K' + D: return KD
    case 'Q' + S: return QS
    case 'Q' + H: return QH
    case 'Q' + C: return QC
    case 'Q' + D: return QD
    case 'A' + S: return AS
    case 'A' + H: return AH
    case 'A' + C: return AC
    case 'A' + D: return AD
  }

  return null
}

type CardChooserProps = {
    symbols: string[],
    selected: string,
    disabled: (arg0: string) => boolean
    onSelectionChanged: (arg: string) => void
  }
  
  export function CardChooser(props: CardChooserProps) {
    let disabledBg = 'gray'//'#DDBBBB55'
  
    const ww = 80
    const hh = ww * (1.42)
  
    const arr = props.symbols.map((s) => {
      let image = cardImageFromSymbol(s) ?? ""
      let isDisabled = props.disabled(s)
  
      let bg = isDisabled ? disabledBg : cardBackgroundColor //'#93c572' // '#C1E1C1'
      let p: React.CSSProperties = { width: ww, height: hh, backgroundColor: bg }
      if (props.selected == s && !isDisabled) {
        p['borderColor'] = 'white'
        p['borderWidth'] = 3
      }
  
      let q: React.CSSProperties = isDisabled ? { filter: 'brightness(30%)' } : {}
  
      return (
        <Col>
          <Card
            hoverable
            style={p}
            cover={<img alt="" src={image} style={q} onClick={() => { if (!isDisabled) props.onSelectionChanged(s) }} />}
          >
          </Card>
        </Col>)
    })
  
    return (
      <div className="container">
        <Row gutter={6}>
          {...arr}
  
        </Row>
      </div>
    )
  }
  
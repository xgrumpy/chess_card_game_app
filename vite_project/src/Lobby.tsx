import { Button, Divider } from "antd"
import { VecBoardProps } from "./App"
import { useEffect } from 'react'
import { Space, Table } from 'antd'
import './App.css'
import { useNavigate } from "react-router-dom"
//import { filter } from "lodash"
// import { notification } from 'antd'
import { connectionR, host, httpScheme } from "./network"
import { useMutation } from "@tanstack/react-query"

const { Column } = Table

interface ArenaProps extends VecBoardProps {
}

export function Lobby({ state, dispatch }: ArenaProps) {
  const navigate = useNavigate()
  let myUid = state.userInfo?.uid
  
  const loginMutation = useMutation({
    mutationFn: async (uid: string) => {
      if (!state.userInfo) 
        throw new Error('Bad state')
      
      const session = state.userInfo.session
      const response = await fetch(`${httpScheme}://${host}/subscribe/${session}/${uid}`)
      if (!response.ok) 
        throw new Error('Network response was not ok')

      let json = await response.json()
      if (json != null) {
        let isWhite = json.user_is_white as boolean
        let opponent = isWhite ? json.game.pairing.black : json.game.pairing.white
        dispatch({ type: 'login', user_is_white: isWhite , token: uid, opponent })
        navigate("/main")
      }

      return json
    },
  })

  useEffect(() => {
    console.log('Mounting lobby page')
    // go back to index if we do not have 
    if (myUid == undefined || connectionR == null) {
      navigate("/")
      return
    }

    connectionR.invoke("SubscribeToLobbyFeed")
    connectionR.on("Lobby", (arr: object[]) => {
      dispatch({ type: 'lobby', users: arr })
      console.log("updating lobby", arr)
    })

    // @ts-ignore
    connectionR.on("GoToGame", (gid: string) => {
      // at the moment 'gid' isn't used because the subscribe call should just find it
      // however we should ideally make use of the 'gid' argument here
      if (!myUid) return
      loginMutation.mutate(myUid)
    })

    return () => {
      // Anything in here is fired on component unmount.
      console.log('Unmounting lobby page')
      if (!connectionR) return

      connectionR.invoke('UnSubscribeFromLobbyFeed')
      connectionR.off("Lobby")
      connectionR.off("GoToGame")
    }
  }, [])


  let myData = state.lobby.filter((v) => v.uid !== myUid).map((v, index) => { v.key = `${index}`; return v })

  let acceptProposal = (uid: string) => {
    connectionR?.invoke("AcceptGameProposal", uid)
  }

  // const [api, contextHolder] = notification.useNotification({ stack: true, maxCount: 5 })

  // const openSuccessNotification = (uid: string) => {
  //   const key = `open${Date.now()}`;
  //   const btn = (
  //     <Space>
  //       <Button type="link" size="small" onClick={() => api.destroy()}>
  //         Close all notifications
  //       </Button>
  //       <Button type="primary" size="small" onClick={() => api.destroy(key)}>
  //         Close
  //       </Button>
  //       <Button type="primary" size="small" onClick={() => api.destroy(key)}>
  //         Accept
  //       </Button>
  //     </Space>
  //   )

  //   const close = () => {
  //     console.log(
  //       'Notification was closed. Either the close button was clicked or duration time elapsed.',
  //     )
  //   }

  //   api.info({
  //     placement: 'topRight',
  //     duration: 0, // never expires
  //     message: `Created new game`,
  //     description:
  //       `You were challenged to a game by  ${uid}`,
  //     btn,
  //     key,
  //     onClose: close,
  //   });
  // }




  return (
    <>
      {/* {contextHolder} */}
      <Divider orientation="center">Lobby: {myUid ?? "?????"} </Divider>
      <div className="center">
        <Table dataSource={myData} pagination={{ pageSize: 50 }} scroll={{ y: 240 }} size="middle">
          <Column title="User" dataIndex="user" key="user" />
          <Column title="Rating" dataIndex="rating" key="rating" />
          <Column
            title="Action"
            key="action"
            render={(_: any, record: any) => (
              <Space size="middle">
                {/* <Button onClick={() => doChallenge(record.uid)} loading={true}>Challenge</Button> */}
                <Button onClick={() =>
                   acceptProposal(record.user)
                  }>Accept {record.user}</Button>
                {/* <a>Delete</a> */}
              </Space>
            )}
          />
        </Table>
        <br/>
        <Button onClick={()=>{ connectionR?.invoke('ProposeGame')  }}> Propose </Button>
      </div>
    </>)
}





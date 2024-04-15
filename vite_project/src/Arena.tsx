import { Button, Divider } from "antd"
import { VecBoardProps } from "./App"
import { useEffect } from 'react'
import { Space, Table } from 'antd'
import './App.css'
import { useNavigate } from "react-router-dom"
//import { filter } from "lodash"
import { notification } from 'antd'
import { connectionR } from "./network"

const { Column } = Table

// interface DataType {
//   key: React.Key;
//   uid: string;
//   rating: string;
// }

// //const data: DataType[]
// const data: any[] = [
//   {
//     key: '1',
//     uid: 'John',
//     rating: 'N/A',
//   },
//   {
//     key: '2',
//     uid: 'Mary',
//     rating: 'N/A',

//   },
//   {
//     key: '3',
//     uid: 'Pete',
//     rating: 'N/A',

//   },
// ];


interface ArenaProps extends VecBoardProps {
}

export function Arena({ state, dispatch }: ArenaProps) {
  const navigate = useNavigate()
  let myUid = state.userInfo?.uid

  useEffect(() => {
    console.log('Mounting arena page')
    // go back to index if we do not have 
    if (myUid == undefined || connectionR == null) {
      navigate("/")
      return
    }

    connectionR.invoke("SubscribeToActiveUsersFeed")
    connectionR.on("ActiveUsers", (arr: object[]) => {
      dispatch({ type: 'active_users', users: arr })
      console.log("updating active users", arr)
    })

    connectionR.on("RespondToChallenge", (uid: string) => {
      openSuccessNotification(uid)
    })


    return () => {
      // Anything in here is fired on component unmount.
      console.log('Unmounting arena page')
      if (!connectionR) return

      connectionR.invoke('UnSubscribeFromActiveUsersFeed')
      connectionR.off("ActiveUsers")
      connectionR.off("RespondToChallenge")
    }
  }, [])


  let myData = state.activeUsers.filter((v) => v.uid !== myUid).map((v, index) => { v.key = `${index}`; return v })

  let doChallenge = (uid: string) => {
    //if (!connectionR) return
    connectionR?.invoke("Challenge", uid)
  }

  const [api, contextHolder] = notification.useNotification({ stack: true, maxCount: 5 })

  const openSuccessNotification = (uid: string) => {
    const key = `open${Date.now()}`;
    const btn = (
      <Space>
        <Button type="link" size="small" onClick={() => api.destroy()}>
          Close all notifications
        </Button>
        <Button type="primary" size="small" onClick={() => api.destroy(key)}>
          Close
        </Button>
        <Button type="primary" size="small" onClick={() => api.destroy(key)}>
          Accept
        </Button>
      </Space>
    )

    const close = () => {
      console.log(
        'Notification was closed. Either the close button was clicked or duration time elapsed.',
      )
    }

    api.info({
      placement: 'topRight',
      duration: 0, // never expires
      message: `Created new game`,
      description:
        `You were challenged to a game by  ${uid}`,
      btn,
      key,
      onClose: close,
    });
  }




  return (
    <>
      {contextHolder}
      <Divider orientation="center">Arena: {myUid ?? "?????"} </Divider>
      <div className="center">
        <Table dataSource={myData} pagination={{ pageSize: 50 }} scroll={{ y: 240 }} size="middle">
          <Column title="User" dataIndex="uid" key="uid" />
          <Column title="Rating" dataIndex="rating" key="rating" />
          <Column
            title="Action"
            key="action"
            render={(_: any, record: any) => (
              <Space size="middle">
                <Button onClick={() => doChallenge(record.uid)} loading={true}>Challenge</Button>
                <Button onClick={() => doChallenge(record.uid)}>Challenge {record.uid}</Button>
                {/* <a>Delete</a> */}
              </Space>
            )}
          />
        </Table>
      </div>
    </>)
}





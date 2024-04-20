import { Button, Divider, Form, Input, Collapse, Select, DatePicker, Tag } from "antd"
import { VecBoardProps } from "./App"
import { useEffect } from 'react'
import { Space, Table, Tabs } from 'antd'
import './App.css'
import { useNavigate } from "react-router-dom"
//import { filter } from "lodash"
// import { notification } from 'antd'
import { connectionR, host, httpScheme } from "./network"
import { useMutation } from "@tanstack/react-query"

const { Column } = Table
const { TabPane } = Tabs;
const { Option } = Select
const { Panel } = Collapse;
const { TextArea } = Input;

interface ArenaProps extends VecBoardProps {
}

export function MessageBoard() {

  const tagStyle = {
    border: 'none',
    background: 'none',
    fontSize: '14px'
  };

  type MessageType = {
    name?: string
    message?: string
    replay?: string
  }

  const messagesArray: MessageType[] = [
    { name: "Archie", message: "Hello World", replay: "" },
    { name: "Kumar", message: "Nice to meet you", replay: "" },
    { name: "anonymous-user", message: "This board isn't very feature rich.", replay: "deadfa" }
  ];
  console.log(messagesArray)
  return (
    <div className="message-board">
      <Table dataSource={messagesArray} pagination={{ pageSize: 50 }} scroll={{ y: 240 }} size="middle">
        <Column title="name" dataIndex="name" width="20%" key="user" />
        <Column title="message" dataIndex="message" key="rating" />
        <Column title="replay" dataIndex="replay" key="rating"
          render={(_: any, record: any) => (
            <Space size="middle">
              {record.replay ? (
                <Tag style={tagStyle}>
                  {record.replay}
                </Tag>
              ) : (
                <Button onClick={() => acceptProposal(record.replay)}>
                  replay
                </Button>
              )}
            </Space>
          )} />
      </Table>
    </div>
  );
}

export function SettingForm() {
  const accordionStyles = {
    width: '80%', // Set the desired width
  };

  const textCenter = {
    textAlign: 'center'
  };

  const signupMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await fetch(`${httpScheme}://${host}/signup`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      return response.json()
    }
  })

  type FieldType = {
    uid?: string
    password?: string
    gender?: string
    birthday?: string
    email?: string
    // acceptTerms?: string
  }

  const onSignupFinish = (values: any) => {
    console.log('Success:', values);
    let d = values.birthday.$d as Date
    let dd = d.toJSON()
    console.log(dd)

    values.birthday = dd
    signupMutation.mutate(values)
  }

  const onFinishFailed = (errorInfo: any) => {
    console.log('Failed:', errorInfo);
  }

  return (
    <>
      <div className='container'>

      </div>
      <br />
      <div className='container'>
        <Collapse accordion style={accordionStyles} defaultActiveKey={['1']}>
          <Panel header="Personal Account " key="1">
            <Form
              name="signup"
              labelCol={{ span: 8 }}
              wrapperCol={{ span: 16 }}
              style={{ width: '70%', maxWidth: 600 }}
              initialValues={{ remember: true }}
              onFinish={onSignupFinish}
              onFinishFailed={onFinishFailed}
              autoComplete="off"
            >
              <Form.Item<FieldType>
                label="Username"
                name="uid"
                rules={[{ message: 'Please input your username!' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item<FieldType>
                label="Email"
                name="email"
                rules={[{ type: 'email', message: 'What is your email?' }]}
              >
                <Input />
              </Form.Item>

              <Form.Item<FieldType>
                label="Gender"
                name="gender"
                rules={[{ message: 'Please provide your gender!' }]}
              >
                <Select
                  placeholder="Select a option and change input text above"
                  onChange={() => { }}
                  allowClear
                >
                  <Option value="male">male</Option>
                  <Option value="female">female</Option>
                  <Option value="other">other</Option>
                </Select>
              </Form.Item>
              <Form.Item<FieldType>
                label="Birthday"
                name="birthday"
                rules={[{ message: 'Please provide your gender!' }]}
              >
                <DatePicker />
              </Form.Item>
              <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
                <Button type="primary" htmlType="submit">
                  Update
                </Button>
              </Form.Item>
            </Form>
          </Panel>
          <Panel header="Theme" key="2">
            <p>This is panel content 3</p>
          </Panel>
          <Panel header="Contact US" key="3">
            <Form style={textCenter}>
              <TextArea rows={6} />
              <br/><br/>
              <Button type="primary" htmlType="submit">
                Send
              </Button>
            </Form>
          </Panel>
        </Collapse>
      </div>
    </>
  )
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
        dispatch({ type: 'login', user_is_white: isWhite, token: uid, opponent })
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

  function callback(key) {
    console.log(key);
  }
  console.log(myData)
  return (
    <>
      {/* {contextHolder} */}
      <Divider orientation="center">Lobby: {myUid ?? "?????"} </Divider>
      <div className="center">
        <Tabs defaultActiveKey="1" onChange={callback}>
          <TabPane tab="List" key="list">
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
            <br />
            <Button onClick={() => { connectionR?.invoke('ProposeGame') }}> Propose </Button>
          </TabPane>
          <TabPane tab="Inbox" key="inboxs">
            <MessageBoard />
          </TabPane>
          <TabPane tab="Setting" key="settings">
            <SettingForm />
          </TabPane>
        </Tabs>
      </div>
    </>)
}





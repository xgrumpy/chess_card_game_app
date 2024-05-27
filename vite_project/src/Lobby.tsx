import { Button, Divider, Form, Input, Collapse, Select, DatePicker, Tag, Switch } from "antd"
import { message } from 'antd';
import { VecBoardProps1 } from "./App"
import { useEffect, useState, CSSProperties  } from 'react'
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

interface ArenaProps extends VecBoardProps1 {
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
  return (
    <div className="message-board">
      <Table dataSource={messagesArray} pagination={{ pageSize: 50 }} scroll={{ y: 240 }} size="middle">
        <Column title="name" dataIndex="name" width="20%" key="user" />
        <Column title="message" dataIndex="message" />
        <Column title="replay" dataIndex="replay"
          render={(_: any, record: any) => (
            <Space size="middle">
              {record.replay ? (
                <Tag style={tagStyle}>
                  {record.replay}
                </Tag>
              ) : (
                <Button onClick={() => {}}>
                  replay
                </Button>
              )}
            </Space>
          )} />
      </Table>
    </div>
  );
}

export function SettingForm({ toggleTheme = () => {}}) {
  const emailMutation = useMutation({
    mutationFn: async (payload: any) => {
      console.log(payload);
      const response = await fetch(`${httpScheme}://${host}/sendEmail`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      console.log(response.json());
      return response.json()
    }
  })
  const getCookie = (name: string): any => {
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith(name + '='));

    if (cookieValue) {
      return cookieValue.split('=')[1];
    }
    return undefined;
  };

  // Get the value of a cookie named 'cookieName'
  const data = JSON.parse(getCookie('payload'));

  const accordionStyles = {
    width: '80%', // Set the desired width
  };

  const textCenter: CSSProperties = {
    textAlign: 'center'
  };

  const updateAccountMutation = useMutation({
    mutationFn: async (payload: any) => {
      console.log(payload);
      const response = await fetch(`${httpScheme}://${host}/updateUser`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      console.log(response.json());
      return response.json()
    }
  })

  type FieldType = {
    uid?: string
    gender?: string
    birthday?: string
    email?: string
    current_uid?: string
    title?: string
    contactUS?:string
  }

  const onUpdateAccountFinish = (values: any) => {
    let d = values.birthday.$d as Date
    let dd = d.toJSON()
    values.birthday = dd
    values.current_uid = data.uid;
    updateAccountMutation.mutate(values)
  }

  const onUpdateAccountFinishFailed = (errorInfo: any) => {
    console.log('Failed:', errorInfo);
  }
  const onContactFinish = (values: any) => {
    if (values.contactUS && values.title) {
      var sendData = {
        uid: data.uid,
        title: values.title,
        message: values.contactUS
      };
      emailMutation.mutate(sendData)
    } else {
      message.error('Please enter your message.');
    }
  }
  const onContactFailed = (errorInfo: any) => {
    console.log('Failed:', errorInfo);
  }


  const [isChecked, setIsChecked] = useState(false);
  const [themeSwitchName, setThemeSwitchName] = useState('Initial Header');

  // Event handler to toggle the switch's state
  const handleSwitchChange = () => {
    // Update the state based on the switch's new value
    setIsChecked(!isChecked);
    // Optionally, you can handle other logic here when the switch changes
    if (!isChecked) {
      setThemeSwitchName("Light theme");
      document.body.classList.remove("dark_body");
      document.body.classList.add("light_body");
      toggleTheme();
    } else {
      setThemeSwitchName("Dark theme");
      document.body.classList.remove("light_body");
      document.body.classList.add("dark_body");
      toggleTheme();
    }
  };

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
              onFinish={onUpdateAccountFinish}
              onFinishFailed={onUpdateAccountFinishFailed}
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
            <div className="switchj_div">
              <h3>{themeSwitchName}</h3>&nbsp;&nbsp;&nbsp;
              {/* Render the Switch component */}
              <Switch
                checked={isChecked} // Bind the switch's state to the component's state
                onChange={handleSwitchChange} // Handle switch change events
                checkedChildren="On" // Optional: Label for the "on" state
                unCheckedChildren="Off" // Optional: Label for the "off" state
              />
            </div>
          </Panel>
          <Panel header="Contact US" key="3">
            <Form
              name="contactUS"
              style={textCenter}
              onFinish={onContactFinish}
              onFinishFailed={onContactFailed}
              autoComplete="off">
              <Form.Item<FieldType>
                label="Title"
                name="title"
                rules={[{ message: 'Please input Title!' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item<FieldType>
                name="contactUS"
                rules={[{ message: 'Please input your Message!' }]}
              >
                <TextArea rows={6} />
              </Form.Item>

              <br /><br />
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

export function Lobby({ toggleTheme = () => {} , state, dispatch }: ArenaProps) {
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
      // console.log("updating lobby", arr)
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

  function callback(key: string): void {
    console.log(key);
  }
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
              <Column title="Method" dataIndex="method" key="method" />
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
            <Button onClick={() => { connectionR?.invoke('ProposeGame', '5minute') }}> 5-minute </Button> &nbsp;&nbsp;
            <Button onClick={() => { connectionR?.invoke('ProposeGame', 'unlimited') }}> unlimited </Button>
          </TabPane>
          <TabPane tab="Inbox" key="inboxs">
            <MessageBoard />
          </TabPane>
          <TabPane tab="Setting" key="settings">
            <SettingForm toggleTheme={toggleTheme} />
          </TabPane>
        </Tabs>
      </div>
    </>)
}





import './App.css'
import { Button, Divider, Form, Input, Checkbox, Alert, Select, DatePicker } from 'antd';
//import type { NotificationPlacement } from 'antd/es/notification/interface'
import { httpScheme, host, connectionR, createConnectionR, discardConnectionR } from './network'

import { useMutation } from '@tanstack/react-query'
import { useNavigate } from "react-router-dom"
import { VecBoardProps } from './App'
import _ from "lodash"
import { useEffect } from 'react';

const { Option } = Select

// @ts-ignore 
export function SignupForm({ state, dispatch }: VecBoardProps) {
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
        {signupMutation.status == 'error' && <Alert message={'Network error. Please retry later.'/*mutation.error?.message*/} type='error' />}
        {signupMutation.status == 'success' && signupMutation.data.result == 'new' && <Alert message="Created new user" type='success' />}
        {signupMutation.status == 'success' && signupMutation.data.result == 'exists' && <Alert message="Pick a different user name" type='warning' />}
      </div>
      <br />
      <div className='container'>
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
            rules={[{ required: true, message: 'Please input your username!' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item<FieldType>
            label="Email"
            name="email"
            rules={[{ required: true, type: 'email', message: 'What is your email?' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item<FieldType>
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password />
          </Form.Item>

          {/* <Form.Item<FieldType>
          label="Confirm password"
          name="password"
          rules={[{ required: true, message: 'Please input your password!' }]}
        >
          <Input.Password />
        </Form.Item> */}

          <Form.Item<FieldType>
            label="Gender"
            name="gender"
            rules={[{ required: true, message: 'Please provide your gender!' }]}
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
            rules={[{ required: true, message: 'Please provide your gender!' }]}
          >
            <DatePicker />
          </Form.Item>




          {/* <Form.Item<FieldType>
        name="remember"
        valuePropName="checked"
        wrapperCol={{ offset: 8, span: 16 }}
      >
        <Checkbox>Accept terms</Checkbox>
      </Form.Item> */}

          <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
            <Button type="primary" htmlType="submit">
              Sign Up
            </Button>
          </Form.Item>
        </Form>
      </div>
    </>
  )

}

export function Signin(props: VecBoardProps) {
  let { dispatch } = props

  type FieldType = {
    uid?: string
    password?: string
    remember?: string
  }

  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: async (payload: FieldType) => {
      const response = await fetch(`${httpScheme}://${host}/signin`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      let obj = await response.json()
      let session = obj.session

      //console.log("signin obj", obj)

      if (!_.isUndefined(session)) {
        await discardConnectionR()
        await createConnectionR()
        if (!connectionR)
          throw new Error('SignalR connection failed to establish')

        await connectionR.invoke("Login", session)
        console.log('SignalR authenticated')
        dispatch({ type: 'register_user', uid: payload.uid, session })

        if (obj.game_state == undefined) {
          navigate("/lobby")
        } else {
          let isWhite = obj.game_state.user_is_white as boolean
          let pairing = obj.game_state.game.pairing
          let opponent = isWhite ? pairing.black[1] : pairing.white[1]
          dispatch({ type: 'login', user_is_white: obj.game_state.user_is_white, token:payload.uid, opponent:opponent })
          navigate("/main")
        }
      }
      return obj
    },
  })

  const onLoginFinish = (values: FieldType) => {
    console.log('Success:', values)
    mutation.mutate({ uid: values.uid, password: values.password })
  }

  const onFinishFailed = (errorInfo: any) => {
    console.log('Failed:', errorInfo);
  }


  // if (mutation.isSuccess) {
  //   // let s = JSON.stringify(mutation.data)
  //   // console.log("mutation result: ", s)
  //   // navigate("/old")
  // }

  useEffect(() => {
    console.log('Mounting signin page')
    // go back to index if we do not have 
    discardConnectionR()

    return () => {
      // Anything in here is fired on component unmount.
      console.log('Unmounting signin page')
    }
  }, [])

  return (
    <>

      {/* <div><Typography.Text> Status: {mutation.error?.message } </Typography.Text> </div> */}

      <Divider orientation="center">Sign in</Divider>
      <div className='container'>
        {mutation.status == 'error' && <Alert message={'Network error. Please retry later.'/*mutation.error?.message*/} type='error' />}
      </div>
      <br />
      <div className='container'>
        <Form
          name="basic"
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
          style={{ width: '70%', maxWidth: 600 }}
          initialValues={{ remember: true }}
          onFinish={onLoginFinish}
          onFinishFailed={onFinishFailed}
          autoComplete="off"
        >
          <Form.Item<FieldType>
            label="Username"
            name="uid"
            rules={[{ required: true, message: 'Please input your username!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item<FieldType>
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item<FieldType>
            name="remember"
            valuePropName="checked"
            wrapperCol={{ offset: 8, span: 16 }}
          >
            <Checkbox>Remember me</Checkbox>
          </Form.Item>

          <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
            <Button type="primary" htmlType="submit">
              Sign In
            </Button>
          </Form.Item>
        </Form>
      </div>
      <Divider orientation="center">Or... Sign up</Divider>
      <SignupForm {...props} />
    </>)
}
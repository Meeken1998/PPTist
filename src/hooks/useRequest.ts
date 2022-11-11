import { message } from 'ant-design-vue'
import { Axios, Method } from 'axios'
export interface SuccessResponse<T> {
  code?: 200
  message?: string
  data: T
}

type RequestFn = <T = any>(
  url: string,
  data?: any,
  headers?: Record<string, string>,
  returnOrigin?: boolean
) => Promise<T>

export const HTTP_SERVICE_ENDPOINT =
  process.env.NODE_ENV !== 'development' ? 'https://shot-api.infmonkeys.com' : 'http://localhost:3000'
export const WS_SERVICE_ENDPOINT =
  process.env.NODE_ENV !== 'development' ? 'wss://shot-api.infmonkeys.com' : 'ws://localhost:3000'

export default () => {
  const axios = new Axios({
    baseURL: process.env.NODE_ENV !== 'development' ? 'https://shot-api.infmonkeys.com' : '',
  })

  async function request<T>(method: Method, url: string, data = {}, headers?: Record<string, string>): Promise<T> {
    const clientHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    const token = localStorage.getItem('token')
    if (token) clientHeaders['authentication'] = `Bearer ${token}`

    const teamId = localStorage.getItem('team')
    if (teamId) clientHeaders['team'] = teamId

    const res = await axios.request({
      method,
      url,
      data: data ? JSON.stringify(data) : {},
      headers: {
        ...clientHeaders,
        ...headers,
      },
    })
    res.data = JSON.parse(res.data)
    if (res?.data?.code) {
      if (res.data.code !== 200) {
        message.warning(res?.data?.message || '网络错误')
        return res.data || null
      }
      return res?.data
    }
    message.warning(res?.data?.message || '网络错误')
    return null as unknown as T
  }

  const post: RequestFn = async (url, data, headers, returnOrigin) => {
    const res = (await request('POST', url, data, headers)) as any
    return returnOrigin ? res : res?.data
  }
  const get: RequestFn = async (url, data, headers, returnOrigin) => {
    const res = (await request('GET', url, data, headers)) as any
    return returnOrigin ? res : res?.data
  }

  return { client: axios, post, get }
}

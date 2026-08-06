import axios from 'axios'
import { useCookie, watch, useRuntimeConfig } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const token = useCookie<string | null>('auth_token')

  const instance = axios.create({
    baseURL: config.public.BASE_URL,
    timeout: 10000,
    withCredentials: false,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
  })

  // The useCookie ref can transiently read back null during a client-side
  // navigation in SPA mode. Falling back to the localStorage mirror written by
  // the auth store stops requests going out with no Authorization header —
  // which the backend answered with 401 and surfaced as "undefined token".
  const readToken = (): string | null => {
    if (token.value) return token.value
    if (import.meta.client) {
      try {
        return localStorage.getItem('_auth_token')
      } catch {
        return null
      }
    }
    return null
  }

  const initial = readToken()
  if (initial) instance.defaults.headers.common['Authorization'] = `Bearer ${initial}`

  instance.interceptors.request.use((req) => {
    const t = readToken()
    if (t) {
      req.headers = req.headers || {}
      req.headers['Authorization'] = `Bearer ${t}`
      instance.defaults.headers.common['Authorization'] = `Bearer ${t}`
    } else {
      delete req.headers?.['Authorization']
      delete instance.defaults.headers.common['Authorization']
    }
    return req
  })

  instance.interceptors.response.use(res => res, (error) => {
    if (import.meta.dev) {
      console.error('[axios] response error', {
        status: error?.response?.status,
        url: error?.config?.url,
        resp: error?.response?.data,
      })
    }
    return Promise.reject(error)
  })

  watch(token, (val) => {
    const t = val ?? readToken()
    if (t) instance.defaults.headers.common['Authorization'] = `Bearer ${t}`
    else delete instance.defaults.headers.common['Authorization']
  }, { immediate: true })

  return { provide: { axios: instance } }
})

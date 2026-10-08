import { afterEach, describe, expect, it } from 'vitest'
import { errMsg } from './errors'
import { setLangValue } from '../i18n/core'

afterEach(() => setLangValue('zh'))

describe('errMsg', () => {
  it('maps database error codes to friendly text', () => {
    expect(errMsg(new Error('name_claimed'))).toBe('这个名字已被注册员工使用，请登录后填写，或换一个名字')
    expect(errMsg(new Error('shop_not_found'))).toBe('找不到这家店铺，请检查店铺码')
    expect(errMsg(new Error('not_authenticated'))).toBe('请先登录')
  })

  it('maps Supabase auth messages, even when wrapped in other text', () => {
    expect(errMsg(new Error('Invalid login credentials'))).toBe('邮箱或密码不正确')
    expect(errMsg(new Error('AuthApiError: User already registered'))).toBe('该邮箱已注册，请直接登录')
    expect(errMsg(new Error('New password should be different from the old password.'))).toBe('新密码不能和旧密码相同')
    expect(errMsg(new Error('Password should be at least 6 characters.'))).toBe('密码至少 6 位')
    expect(errMsg(new Error('email rate limit exceeded'))).toBe('操作太频繁，请过几分钟再试')
  })

  it('follows the selected language', () => {
    setLangValue('en')
    expect(errMsg(new Error('name_required'))).toBe('Please enter your name')
    expect(errMsg(new Error('Invalid login credentials'))).toBe('Incorrect email or password')
  })

  it('passes unknown messages through unchanged', () => {
    expect(errMsg(new Error('something unexpected'))).toBe('something unexpected')
  })

  it('translates app-level messages that are thrown with Chinese text', () => {
    setLangValue('en')
    expect(errMsg(new Error('这个名字已经存在'))).toBe('This name already exists')
  })

  it('handles non-Error values and empty messages', () => {
    expect(errMsg('name_required')).toBe('请填写你的名字')
    expect(errMsg(new Error(''))).toBe('出错了，请重试')
    setLangValue('en')
    expect(errMsg(new Error(''))).toBe('Something went wrong, please try again')
  })
})

import { beforeEach } from 'vitest'
import { setLangValue } from '../i18n/core'

// 应用的默认语言跟随运行环境的浏览器语言：开发者的中文系统是中文，GitHub 的 CI 服务器是英文。
// 测试不能依赖这一点，否则会出现"我电脑上通过、CI 上失败"。
// 所以每个测试开始前都固定成中文；需要测英文的测试自己调用 setLangValue('en')。
beforeEach(() => setLangValue('zh'))

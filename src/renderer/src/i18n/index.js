import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import enUS from './en-US'
import esES from './es-ES'
import frFR from './fr-FR'
import deDE from './de-DE'
import jaJP from './ja-JP'
import ruRU from './ru-RU'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
    'es-ES': esES,
    'fr-FR': frFR,
    'de-DE': deDE,
    'ja-JP': jaJP,
    'ru-RU': ruRU
  }
})

export default i18n

import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import en from './locales/en'
import ar from './locales/ar'
import de from './locales/de'
import es from './locales/es'
import fr from './locales/fr'
import ja from './locales/ja'
import ko from './locales/ko'
import pt from './locales/pt'
import ru from './locales/ru'
import zhTW from './locales/zh-TW'

const messages = {
  'zh-CN': zhCN,
  'en': en,
  'ar': ar,
  'de': de,
  'es': es,
  'fr': fr,
  'ja': ja,
  'ko': ko,
  'pt': pt,
  'ru': ru,
  'zh-TW': zhTW
}

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en',
  messages
})

export default i18n

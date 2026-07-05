// 早期应用主题，避免页面闪烁
;(function () {
  try {
    var saved = localStorage.getItem('imodel-theme')
    if (saved !== 'light') document.documentElement.classList.add('dark')
  } catch (e) {
    document.documentElement.classList.add('dark')
  }
})()

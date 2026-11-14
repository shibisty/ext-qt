/* UI strings. `en` is the reference; every other language must define the same keys (checked by tsc). */

const en = {
  tabGen: 'Generate', tabScan: 'Scan', viewPopup: 'Popup', viewSidebar: 'Sidebar', viewPage: 'Full page',
  theme_auto: 'Theme: auto', theme_light: 'Theme: light', theme_dark: 'Theme: dark', lang: 'Language',
  content: 'Content', contentPh: 'Text, link, Wi-Fi, anything…', useTab: 'Current tab URL', noTabUrl: 'Could not read the tab URL',
  presets: 'Style presets', secDots: 'Dots', secCorners: 'Corners', secLogo: 'Logo', secBg: 'Background', secFrame: 'Border & frame', secAdv: 'Advanced',
  pattern: 'Dot shape', spacing: 'Dot spacing', dotsFill: 'Dots fill (small)', cornerOuter: 'Corner frame shape', cornerInner: 'Corner center shape',
  cOuterFill: 'Corner frame fill (large)', cInnerFill: 'Corner center fill (large)', bgFill: 'Fill behind dots', bgRadius: 'Corner radius',
  quiet: 'Margin (modules)', ecl: 'Error correction', eclHint: 'With a logo, level H is used automatically.', outSize: 'Export size',
  dlPng: 'PNG', dlSvg: 'SVG', copyImg: 'Copy', copied: 'Copied', saved: 'Saved',
  fill_solid: 'Solid color', fill_gradient: 'Gradient', fill_image: 'Image', fill_inherit: 'Same as dots', fill_none: 'Transparent',
  linear: 'Linear', radial: 'Radial', angle: 'Angle', upload: 'Upload…',
  logoUpload: 'Choose logo', logoRemove: 'Remove', logoSize: 'Logo size', logoMargin: 'Padding', logoShape: 'Logo shape', logoBack: 'Plate behind logo', logoBackColor: 'Plate color', logoClear: 'Clear dots under logo',
  shape_square: 'Square', shape_rounded: 'Rounded', shape_circle: 'Circle',
  frame_none: 'None', frame_border: 'Border', frame_rounded: 'Rounded border', frame_bottom: 'Label below', frame_top: 'Label above', frame_bubble: 'Speech bubble',
  frameColor: 'Frame color', frameText: 'Label text', frameTextColor: 'Text color', frameWidth: 'Frame width', customFrame: 'Custom frame / background image', customPad: 'Space around code',
  empty: 'Enter some content to build a QR code', tooLong: 'Content is too long for a QR code', logoWarn: 'Large logo may hurt scanning — test it',
  scanCamera: 'Camera', scanStop: 'Stop', scanImage: 'Image', scanTab: 'Screenshot of tab', scanDrop: 'Drop, paste (Ctrl+V) or choose an image with a QR code',
  scanning: 'Looking for a QR code…', notFound: 'No QR code found in this image', result: 'Result', copyText: 'Copy', openLink: 'Open link', toGen: 'To generator',
  history: 'History', clear: 'Clear', noHistory: 'Nothing scanned yet',
  camDenied: 'Camera access was blocked. Popups and side panels often cannot ask for it — grant it once on the full page.', camErr: 'Could not start the camera', openInPage: 'Open full page', camSelect: 'Camera',
  tabShotFail: 'Could not capture the tab. Click the extension icon on that tab first.', switchFail: 'Could not switch the view here',
  type_url: 'Link', type_wifi: 'Wi-Fi', type_mailto: 'Email', type_tel: 'Phone', type_sms: 'SMS', type_geo: 'Location', type_vcard: 'Contact', type_email: 'Email', type_text: 'Text',
  lowContrast: 'Low contrast — may not scan', checkScan: 'Image fill — test scanning', ssid: 'Network', password: 'Password', security: 'Security', remove: 'Remove', multi: 'codes found'
};

export type I18nKey = keyof typeof en;

const ru: Record<I18nKey, string> = {
  tabGen: 'Генерация', tabScan: 'Скан', viewPopup: 'Попап', viewSidebar: 'Сайдбар', viewPage: 'Страница',
  theme_auto: 'Тема: авто', theme_light: 'Тема: светлая', theme_dark: 'Тема: тёмная', lang: 'Язык',
  content: 'Содержимое', contentPh: 'Текст, ссылка, Wi-Fi, что угодно…', useTab: 'URL текущей вкладки', noTabUrl: 'Не удалось получить URL вкладки',
  presets: 'Готовые стили', secDots: 'Точки', secCorners: 'Углы', secLogo: 'Логотип', secBg: 'Фон', secFrame: 'Бордер и рамка', secAdv: 'Дополнительно',
  pattern: 'Форма точек', spacing: 'Расстояние между точками', dotsFill: 'Заливка точек (маленькие)', cornerOuter: 'Форма рамки угла', cornerInner: 'Форма центра угла',
  cOuterFill: 'Заливка рамки угла (большие)', cInnerFill: 'Заливка центра угла (большие)', bgFill: 'Заливка за точками', bgRadius: 'Скругление',
  quiet: 'Поля (модули)', ecl: 'Коррекция ошибок', eclHint: 'С логотипом автоматически включается уровень H.', outSize: 'Размер экспорта',
  dlPng: 'PNG', dlSvg: 'SVG', copyImg: 'Копировать', copied: 'Скопировано', saved: 'Сохранено',
  fill_solid: 'Цвет', fill_gradient: 'Градиент', fill_image: 'Картинка', fill_inherit: 'Как у точек', fill_none: 'Прозрачный',
  linear: 'Линейный', radial: 'Радиальный', angle: 'Угол', upload: 'Загрузить…',
  logoUpload: 'Выбрать логотип', logoRemove: 'Убрать', logoSize: 'Размер логотипа', logoMargin: 'Отступ', logoShape: 'Форма логотипа', logoBack: 'Подложка под логотипом', logoBackColor: 'Цвет подложки', logoClear: 'Убрать точки под логотипом',
  shape_square: 'Квадрат', shape_rounded: 'Скруглённый', shape_circle: 'Круг',
  frame_none: 'Нет', frame_border: 'Бордер', frame_rounded: 'Скруглённый бордер', frame_bottom: 'Подпись снизу', frame_top: 'Подпись сверху', frame_bubble: 'Выноска',
  frameColor: 'Цвет рамки', frameText: 'Текст подписи', frameTextColor: 'Цвет текста', frameWidth: 'Толщина рамки', customFrame: 'Своя рамка / фон (картинка)', customPad: 'Отступ вокруг кода',
  empty: 'Введите содержимое, чтобы построить QR-код', tooLong: 'Слишком много данных для QR-кода', logoWarn: 'Большой логотип может мешать сканированию — проверьте',
  scanCamera: 'Камера', scanStop: 'Стоп', scanImage: 'Картинка', scanTab: 'Скриншот вкладки', scanDrop: 'Перетащите, вставьте (Ctrl+V) или выберите картинку с QR-кодом',
  scanning: 'Ищу QR-код…', notFound: 'На картинке QR-код не найден', result: 'Результат', copyText: 'Копировать', openLink: 'Открыть ссылку', toGen: 'В генератор',
  history: 'История', clear: 'Очистить', noHistory: 'Пока ничего не сканировали',
  camDenied: 'Доступ к камере заблокирован. В попапе и сайдбаре его часто нельзя запросить — разрешите один раз на полной странице.', camErr: 'Не удалось запустить камеру', openInPage: 'Открыть страницу', camSelect: 'Камера',
  tabShotFail: 'Не удалось сделать скриншот. Сначала нажмите на иконку расширения на нужной вкладке.', switchFail: 'Здесь не удалось переключить вид',
  type_url: 'Ссылка', type_wifi: 'Wi-Fi', type_mailto: 'Почта', type_tel: 'Телефон', type_sms: 'SMS', type_geo: 'Место', type_vcard: 'Контакт', type_email: 'Почта', type_text: 'Текст',
  lowContrast: 'Низкий контраст — может не сканироваться', checkScan: 'Картинка в заливке — проверьте скан', ssid: 'Сеть', password: 'Пароль', security: 'Защита', remove: 'Удалить', multi: 'кодов найдено'
};

export const I18N = { en, ru } satisfies Record<string, Record<I18nKey, string>>;
export type Lang = keyof typeof I18N;
export const LANGS = Object.keys(I18N) as Lang[];

export const isLang = (x: unknown): x is Lang => typeof x === 'string' && x in I18N;

/** Translate with fallback to English, then to the key itself. */
export function translate(lang: string, key: string): string {
  const table: Partial<Record<string, string>> = isLang(lang) ? I18N[lang] : I18N.en;
  return table[key] ?? (I18N.en as Partial<Record<string, string>>)[key] ?? key;
}

/** Pick a supported UI language from a BCP-47 tag such as navigator.language. */
export const detectLang = (tag: string | undefined): Lang => ((tag || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en');

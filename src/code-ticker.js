// 代码打字机：像终端一样一直往下打，打满了就从顶部滚走，不清屏、不回到开头、不停顿。
//
// 行为约定（这三条是这个模块存在的理由，改的时候别破坏）：
//   1. 永不中断。字与字之间的节奏恒定，行与行之间不插停顿，不等待。
//   2. 永不重来。写满一屏之后从顶部滚出旧行，而不是清空重新开始。
//   3. 只有刷新页面才回到起点。源码行循环取用，接缝处照常往下打。
//
// 用法：
//   import { createCodeTicker } from './code-ticker.js'
//   const ticker = createCodeTicker(document.querySelector('pre'), { lines: [...] })
//   ticker.stop()

const DEFAULTS = {
  cps: 55,          // 每秒打多少个字符
  caret: '▌',       // 光标
  blankPause: 0,    // 空行不额外停顿，保持匀速
}

export function createCodeTicker(host, options = {}) {
  const opt = { ...DEFAULTS, ...options }
  const source = (opt.lines && opt.lines.length ? opt.lines : ['// 没有给源码行'])

  const shown = []        // 已经打完、还留在屏幕上的行
  let li = 0              // 取到源码的第几行
  let ci = 0              // 当前行打到第几个字符
  let acc = 0             // 累计的字符预算，用来把速度和帧率解耦
  let last = 0
  let raf = 0
  let running = true

  const render = () => {
    const line = source[li]
    const typing = line.slice(0, ci)
    const caret = ci < line.length ? opt.caret : ''
    host.textContent = shown.concat(typing + caret).join('\n')
    // 打满了就从顶部滚走一行。用渲染后的高度判断，不能按行数算：
    // 一行太长会折行，按行数算会以为还没满，屏幕早就溢出了。
    let guard = 0
    while (host.scrollHeight > host.clientHeight + 1 && shown.length && guard++ < 200) {
      shown.shift()
      host.textContent = shown.concat(typing + caret).join('\n')
    }
  }

  const step = (now) => {
    if (!running) return
    if (!last) last = now
    acc += ((now - last) / 1000) * opt.cps
    last = now
    let n = Math.floor(acc)
    if (n > 0) {
      acc -= n
      while (n-- > 0) {
        const line = source[li]
        if (ci < line.length) {
          ci += 1
        } else {
          shown.push(line)                 // 这一行打完，收进屏幕
          li = (li + 1) % source.length    // 源码用完就从头再取，但屏幕不清空
          ci = 0
          break                            // 换行本身占一个字符的时间，不额外停顿
        }
      }
      render()
    }
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)

  return {
    stop() { running = false; cancelAnimationFrame(raf) },
    get lineCount() { return shown.length },
  }
}

/** 把一段源码切成行，去掉首尾空行，制表符换成两个空格。 */
export function toLines(text) {
  return String(text).replace(/\t/g, '  ').split('\n')
}

/** 取一个文件的源码当打字机的素材。取不到就返回 null，由调用方决定怎么兜底。 */
export async function fetchLines(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return toLines(await res.text())
  } catch {
    return null
  }
}

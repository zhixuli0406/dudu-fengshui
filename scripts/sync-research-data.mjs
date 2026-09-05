// Copies the research JSON artifacts (docs/research/*.json, generated from the markdown tables by the
// research agents) into src/data with the shape the app expects. Run: node scripts/sync-research-data.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const R = (f) => JSON.parse(readFileSync(resolve('docs/research', f), 'utf8'))
const W = (f, d) => writeFileSync(resolve('src/data', f), JSON.stringify(d, null, 1) + '\n')

const rules = R('rules-internal.json').map((r) => ({
  id: r.id, category: r.category ?? r.section ?? '', name: r.name ?? '', condition: r.condition ?? '',
  algorithm: Array.isArray(r.suggested_algorithms) ? r.suggested_algorithms.join(' + ') : (r.algorithm ?? ''),
  severity: r.severity ?? '', affects: Array.isArray(r.affects) ? r.affects.join('・') : (r.affects ?? ''),
  explanation: r.explanation ?? '', remedy: Array.isArray(r.remedy) ? r.remedy.join('；') : (r.remedy ?? ''),
}))
W('formRulesCatalog.json', rules)

const questions = R('exterior-questionnaire.json')
  .filter((q) => q.question && !q.question.startsWith('（'))
  .map((q) => {
    const opts = Array.isArray(q.options) ? q.options.filter((o) => o && o !== '—') : []
    return { ...q, options: opts.length >= 2 ? opts : ['無', '有', '不確定'] }
  })
  .map((q) => ({
    id: q.id, group: q.group ?? '問卷題組', question: q.question, options: q.options, severity: q.severity ?? '',
    affects: Array.isArray(q.affects) ? q.affects.join('・') : (q.affects ?? ''), explanation: q.explanation ?? '',
    remedy: Array.isArray(q.remedy) ? q.remedy.join('；') : (q.remedy ?? ''), source: Array.isArray(q.sources) ? q.sources.join(' ・ ') : (q.source ?? ''),
  }))
W('environmentQuestions.json', questions)

const luban = R('luban-ruler.json')
W('lubanRuler.json', { wenGongChi: luban.wen_gong_chi, dingLanChi: luban.ding_lan_chi })

console.log(`rules ${rules.length}, questions ${questions.length}, luban words ${luban.wen_gong_chi.words.length}`)

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const isOn = atom({ plugin: 'image-inspect', key: 'isOn' } as const, false)

// The turn that answers an inspected image runs on this model and effort.
const MODEL = 'opus'
const EFFORT = 'medium'

// Typed text shorter than this counts as no context.
const MIN_TEXT = 3

const CLARITY = `Clarity rule, for every line you write: simple, clear, objective and tied to this conversation. Use plain words anyone understands. Explain any technical term in a few words. Use no abbreviations. One idea per sentence.`

const LIST = `"What is in the image": a list of everything you see, exactly as shown: text, screens, buttons, messages, errors, numbers, people, objects. Quote visible text word for word. Never invent anything; when a part is blurry or unreadable, say so.`

const withContext = (language: string) => `Image Inspect is on. The user attached an image. Before anything else, answer in ${language} with these three short sections, in this order:
1. ${LIST}
2. "How it connects to the conversation": each link between what the image shows and what the user wrote or was discussed earlier in this conversation. When something in the image does not match the conversation, say so.
3. "Verdict": one or two sentences with your conclusion and the next step.
Then go on with what the user asked.
${CLARITY}`

const withoutContext = (language: string) => `Image Inspect is on. The user attached an image with no text. Answer in ${language}:
1. ${LIST}
2. Then ask how to continue with one multiple-choice question (the AskUserQuestion tool), with 2 to 4 options based on what the image shows and this conversation. Mark one option as "(Recommended)" and say why in one short sentence.
Do nothing else until the user answers.
${CLARITY}`

// The turn the next turn.start opens is an inspection; then its id.
let isPending = false
let inspectedTurn: string | undefined

async function toggle($: EngineInterface) {
  await update($, isOn, v => !v)
  const active = await read($, isOn)
  await $.store.set('isOn', active)
  $.ui.toast(`Image Inspect: ${active ? 'on' : 'off'}`)
  return active
}

// The Language set in /config; when unset, the user's own language.
async function outputLanguage($: EngineInterface) {
  const language = await $.settings.read({ key: 'language' })
  return typeof language === 'string' && language.trim()
    ? `the language "${language.trim()}", with every accent and special character`
    : "the user's own language"
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    const hasImage = e.attachments?.some(a => a.type === 'image')
    if (!hasImage || e.command || e.isMeta || e.origin.kind !== 'composer' || !(await read($, isOn))) {
      return next(e)
    }

    const language = await outputLanguage($)
    const rules = e.text.trim().length < MIN_TEXT ? withoutContext(language) : withContext(language)
    isPending = true
    return next({ ...e, context: [...(e.context ?? []), rules] })
  }).catch(($, e, next) => next(e))

  on('turn.start', ($, e, next) => {
    if (isPending && !e.agentId) {
      isPending = false
      inspectedTurn = e.turnId
      $.ui.status('🔍 Image Inspect: analyzing…')
    }
    return next(e)
  })

  // Only the main loop's steps of the inspected turn change model and effort.
  on('turn.step', async function* ($, e, next) {
    const isInspected = e.turnId === inspectedTurn && !e.agentId
    return yield* next(isInspected ? { ...e, model: MODEL, effort: EFFORT } : e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.turnId === inspectedTurn) {
      inspectedTurn = undefined
      $.ui.status(undefined)
    }
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    const saved = await $.store.get('isOn')
    if (typeof saved === 'boolean') {
      await update($, isOn, () => saved)
    }
    await $.command.register({ name: 'image-inspect', description: 'Turn image inspection on or off' })
    return next(e)
  })

  on('command.run', { command: 'image-inspect' }, async $ => ({
    text: `Image Inspect: ${(await toggle($)) ? 'on' : 'off'}`,
  }))

  // Footer row: what the engine and other mods draw there, then the toggle.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const { Box, Button } = $.ui.resolve(e)
    const active = await read($, isOn)

    return (
      <Box>
        {await next(e)}
        <Button
          key="toggle"
          label={active ? '🔍 Image Inspect: on' : '🔍 Image Inspect: off'}
          variant={active ? 'primary' : 'secondary'}
          onPress={() => toggle($)}
        />
      </Box>
    )
  })
}

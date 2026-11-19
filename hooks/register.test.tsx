import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { Args, On } from 'claude-code'

const IMAGE = [{ type: 'image', mediaType: 'image/png', id: 'img-1' }] as const

const PROMPT = {
  text: 'why does the login fail?',
  wait: false,
  origin: { kind: 'composer' },
  attachments: IMAGE,
} as const satisfies Args<'prompt.submit'>

const FOOTER = { plugin: 'image-inspect', component: 'SessionMode', props: { modes: [] } } as const

const STEP = { turnId: 't1', index: 0, model: 'claude-sonnet-5-5', effort: 'high', messageCount: 1 } as const

const START = { cwd: '/', surface: 'terminal', isInteractive: true } as const

// Stands for the engine: records the context sent and the model and effort of each step.
function engine(on: On, settings: Record<string, unknown> = {}, stored: Record<string, unknown> | null = {}) {
  if (stored) mock.store(on, stored)
  const contexts: (readonly string[] | undefined)[] = []
  const steps: { model: string; effort?: unknown }[] = []
  on('settings.read', () => ({ value: settings }))
  on('prompt.submit', (_, e) => (contexts.push(e.context), { text: e.text }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '', reason: 'end_turn' }) as never)
  on('turn.step', async function* (_, e) {
    steps.push({ model: e.model, effort: e.effort })
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  return { contexts, steps }
}

// Drains a step's stream so its result is reached.
async function step($: Engine, input: Args<'turn.step'>) {
  for await (const _ of $.turn.step(input)) {
  }
}

async function turnOn($: Engine) {
  await $.command.run({ command: 'image-inspect', args: '' } as Args<'command.run'>)
}

test('off by default: an image prompt passes with no added context', async ($, on) => {
  const { contexts } = engine(on)

  await $.prompt.submit(PROMPT)

  expect(contexts).toEqual([undefined])
})

test('on, with an image and text: three sections and the clarity rule', async ($, on) => {
  const { contexts } = engine(on)
  await turnOn($)

  await $.prompt.submit(PROMPT)

  const rules = contexts[0]?.[0] ?? ''
  expect(rules).toContain('"What is in the image"')
  expect(rules).toContain('"How it connects to the conversation"')
  expect(rules).toContain('"Verdict"')
  expect(rules).toContain('Clarity rule')
})

test('on, with an image and no text: the list and one multiple-choice question', async ($, on) => {
  const { contexts } = engine(on)
  await turnOn($)

  await $.prompt.submit({ ...PROMPT, text: '' })

  const rules = contexts[0]?.[0] ?? ''
  expect(rules).toContain('"What is in the image"')
  expect(rules).toContain('AskUserQuestion')
  expect(rules).toContain('(Recommended)')
  expect(rules).not.toContain('"Verdict"')
})

test('on, with text and no image: untouched', async ($, on) => {
  const { contexts } = engine(on)
  await turnOn($)

  await $.prompt.submit({ text: PROMPT.text, wait: false, origin: { kind: 'composer' } })

  expect(contexts).toEqual([undefined])
})

test('the inspected turn runs on opus at medium effort, and only that turn', async ($, on) => {
  const { steps } = engine(on)
  await turnOn($)

  await $.prompt.submit(PROMPT)
  await $.turn.start({ text: PROMPT.text, turnId: 't1' } as Args<'turn.start'>)
  await step($, STEP)
  await step($, { ...STEP, index: 1, agentId: 'sub-1' })
  await $.turn.complete({ turnId: 't1' } as Args<'turn.complete'>)
  await $.turn.start({ text: 'next', turnId: 't2' } as Args<'turn.start'>)
  await step($, { ...STEP, turnId: 't2' })

  expect(steps).toEqual([
    { model: 'opus', effort: 'medium' },
    { model: STEP.model, effort: STEP.effort },
    { model: STEP.model, effort: STEP.effort },
  ])
})

test('the reply language comes from /config', async ($, on) => {
  const { contexts } = engine(on, { language: 'pt-BR' })
  await turnOn($)

  await $.prompt.submit(PROMPT)

  expect(contexts[0]?.[0]).toContain('the language "pt-BR"')
})

test('the toggle is stored for the next session', async ($, on) => {
  const stored: unknown[] = []
  on('store.set', (_, e) => (stored.push(e.value), { value: undefined }))
  engine(on, {}, null)

  await turnOn($)
  await turnOn($)

  expect(stored).toEqual([true, false])
})

test('a stored on is restored at session start', async ($, on) => {
  const { contexts } = engine(on, {}, { isOn: true })

  await $.session.start(START)
  await $.prompt.submit(PROMPT)

  expect(contexts[0]?.[0]).toContain('Image Inspect is on')
})

test('the footer keeps what is drawn beneath and toggles the button', async ($, on) => {
  mock.store(on, {})
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...FOOTER, surface })
    const label = async () => (await ui.find({ type: 'Button', key: 'toggle' }))?.props.label

    expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
    const before = await label()
    await ui.press({ key: 'toggle' })
    const after = await label()
    expect([before, after].sort()).toEqual(['🔍 Image Inspect: off', '🔍 Image Inspect: on'])
    await ui.unmount()
  }
})

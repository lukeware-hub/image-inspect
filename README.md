# Image Inspect

Looks closely at each image you attach to Claude Code, lists everything in it, links it to your conversation and gives a verdict.

When you attach an image with some text, the answer starts with three short parts:

1. **What is in the image**: a list of everything seen, such as text, screens, buttons, errors, numbers and objects. Visible text is quoted word for word, and nothing is invented. A blurry part is reported as unreadable.
2. **How it connects to the conversation**: each link between the image and what you wrote or discussed before, and anything that does not match.
3. **Verdict**: one or two sentences with the conclusion and the next step.

When you attach an image with no text, the answer lists what is in the image and then asks how to continue, with one multiple-choice question. One option is marked as recommended, with the reason.

Every line follows one rule: simple, clear, direct and tied to your conversation, in plain words anyone understands, with no abbreviations.

The answer is written in the Language set in `/config` (for example `pt-BR`), with correct accents, or in your own language when none is set.

That answer runs on the Opus model at medium effort, only for that turn. The next turn goes back to your usual model and effort. If your session runs on another model, that one turn reads the conversation without the cache, so it costs a little more.

## Use

- A `🔍 Image Inspect` button sits in the prompt footer in the terminal, and in a row above the prompt on Claude Code Desktop. Click it to turn the inspection on or off.
- The command `/image-inspect` does the same.
- It starts off. Your on or off choice is saved and stays the same in new sessions.
- Prompts with no image are never changed.
- While an image is being inspected, the status line shows `🔍 Image Inspect: analyzing…`.

## Install

You need Claude Code installed.

**In the Claude Code terminal**, type at the prompt:

```
/plugin install image-inspect --marketplace lukeware-hub/image-inspect
```

1. Answer `y` to add the marketplace.
2. Press Enter to install for your user (all your projects).
3. Done: the `🔍 Image Inspect` button appears in the prompt footer (terminal) or above the prompt (Desktop).

**From a shell**, the same in one line:

```
claude plugin install image-inspect --marketplace lukeware-hub/image-inspect
```

**In the Claude desktop app**: click **+** next to the prompt box, then **Plugins**, **Add marketplace**, type `lukeware-hub/image-inspect`, then **Add plugin**.

## Uninstall

```
/plugin uninstall image-inspect
```

## Develop

Run the tests and the checks from the repository folder:

```
claude plugin test .
claude plugin validate .
```

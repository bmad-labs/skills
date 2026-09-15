---
name: ultrathink-protocol
description: >
  A structured root-cause investigation protocol for complex, ambiguous, or
  multi-layer technical problems. Activate this skill whenever: a problem has
  resisted two or more fix attempts; the root cause is unknown or assumed; you are
  tempted to try a variation of something that already failed; a system has multiple
  interacting layers (hardware, OS, runtime, middleware, config, network); the user
  says "ultrathink", "think deeper", "figure out why", "stop guessing", "find the
  root cause", or "it's still broken after your fix". Also activate proactively
  when you catch yourself about to write a fix before you have verified the cause —
  that instinct is the signal the protocol is needed. The protocol enforces three
  disciplines that distinguish root-cause investigation from trial-and-error:
  (1) explicit THOUGHT/ACTION/OBSERVATION cycles, (2) a hard gate that blocks
  implementation until the cause is verified by direct evidence, and (3) structured
  escalation when in-process diagnostic tools are exhausted.
---

# Ultrathink Protocol

## What this protocol is for

Complex technical problems fail in a specific pattern: pattern-match to a plausible
fix, apply it, observe it didn't work, apply a variation, repeat. Each iteration
feels productive. None produce understanding. The loop can run for hours.

The protocol breaks the loop by separating two modes that must not be mixed:

- **Diagnosis mode** — building a verified model of what is actually happening
- **Implementation mode** — applying a fix once the cause is known

You cannot enter implementation mode until diagnosis mode has produced a *verified*
cause — meaning you hold direct evidence (a log line, a port number, a source
function, a network trace, a config value read from the running process) that
explains the symptom. "It might be X" is a hypothesis, not verified evidence.
"The running process reads config from path Y, not path Z, because the startup
script overwrites the env var before exec" is verified.

---

## The execution cycle

Every step in a complex investigation follows this three-part structure.
Write it out explicitly — do not compress it into a single paragraph.

```
THOUGHT:      What hypothesis am I testing? What do I expect to find?
              What would this result mean for my current model of the problem?

ACTION:       The single most informative thing I can do right now —
              a command, a source read, a log grep, a process inspection.
              One action per cycle. Pick the action that would most change
              your model if the result is unexpected.

OBSERVATION:  What actually happened. Quote the relevant output directly.
              Does this confirm or refute the hypothesis?
              How does it change the model?
```

The OBSERVATION step is where understanding is built. An observation that says
"that confirms my theory" without explaining *why* is a red flag — it means you
may be fitting evidence to a pre-formed conclusion rather than updating your model.

---

## The diagnosis ladder

Work top to bottom. Stop at the level where you find verified evidence. Going
further than necessary wastes time; stopping too early produces wrong diagnoses.

### Level 1 — State the symptom precisely

Before any action, restate the symptom in the most concrete observable terms:

- Weak: "it's not working"
- Strong: "process A writes output at 1 Hz according to its own logs, but
  consumer B receives nothing after 30 seconds, even though both claim to be
  connected on the same channel"

The gap between what is observed and what is expected defines the shape of the
problem. Every diagnostic action should be aimed at explaining that gap
specifically — not at exploring adjacent possibilities.

### Level 2 — Eliminate the obvious

Check what is free to check and would explain everything if wrong:

- Is the process actually running?
- Does the running process actually see the config/env vars you think it does?
  (**critical:** check the process's own environment, not the shell or config file —
  they are frequently different)
- Is the correct version of the code/binary deployed?
- Is the process connected to the right endpoint, interface, or address?

**The process environment trap.** A very common failure mode across all stacks:
you configure a variable in a launcher, compose file, or wrapper script, but the
process overwrites it at startup before it matters. Always verify what the *running
process* sees, not what you told the launcher to pass. On Linux: `/proc/<pid>/environ`.
On other platforms: equivalent process inspection tools.

### Level 3 — Trace the actual data path

Identify the intended flow and then verify each step in the actual running system:

- At what point does the actual behaviour diverge from the intended behaviour?
- Which component in the chain is the last one behaving correctly?
- Which is the first one where the behaviour is wrong?

The root cause is almost always at exactly one point of divergence — a layer
boundary, a config value that was silently overridden, an interface that the code
bound to differently than expected. The gap between "last correct" and "first
wrong" is where to look.

Concretely: rather than theorising about what *could* go wrong, inspect running
state — open file descriptors, bound addresses, active connections, actual values
being processed — and compare them to what you expect.

### Level 4 — Read the source

When a component does not behave as documented or configured, read the code that
processes the config or handles the relevant path. This sounds slow. It is reliably
fast compared to guessing at configuration variations.

Source access priority:
1. Grep installed headers or bundled scripts — often present in installed packages
   and reveals function signatures, constant values, env var names
2. Grep the binary for string literals — finds env var names, config keys, magic
   values that the code actually reads at runtime
3. Read the upstream source (GitHub, package registry) — definitive; a single
   function's implementation resolves hours of config iteration
4. Search documentation and issue trackers for the exact behaviour you're seeing

The pattern that makes source reading so valuable: a function that reads
`CONFIG_VAR_B` instead of the `CONFIG_VAR_A` you've been setting terminates the
investigation immediately. No configuration change to `CONFIG_VAR_A` would ever
work, regardless of how many variations you tried.

### Level 5 — Controlled experiment

When source is unavailable or the code path is too complex to trace statically,
run a controlled experiment that isolates exactly one variable:

- Reduce the system to the minimal case that still reproduces the failure
- Change one thing and observe the effect
- Design the experiment to *falsify* your current hypothesis, not to confirm it

A good experiment is one that could prove you wrong. If it can only confirm what
you already believe, it is not diagnostic — it is confirmation bias with extra steps.

---

## The stuck gate

You are stuck when any of these is true:

1. You have applied the same *class* of fix more than twice (different config
   values, different versions of the same patch, different restart sequences)
   without new verified evidence that the root cause has changed
2. Your last three OBSERVATION steps have not changed your model of the problem
3. You are considering a more complex version of something that already failed
4. The word "maybe" appears in your reasoning without a plan to test it

**When stuck: stop. Do not apply another fix variant.**

Instead:

1. State the situation explicitly:
   > "I am stuck. My current model of the problem is [X]. The evidence I have is
   > [Y]. The part I cannot explain is [Z]."

2. Descend the diagnosis ladder — you have not gone far enough. The most common
   reason for being stuck is that the actual behaviour at some layer has not been
   inspected directly; there is an assumption standing in for observation.

3. If all available diagnostic tools have been exhausted, escalate to external
   research (see below).

The phrase "stop doing trial and error without knowing the root cause" is a hard
stop signal from the user. It means the protocol was violated — return immediately
to diagnosis mode, regardless of how close the current fix attempt feels.

---

## Escalation: when and how to research

Escalate to web search, documentation, or source code research when:

- The root cause requires understanding a system you cannot directly inspect
  (closed-source binary, third-party middleware, undocumented protocol behaviour)
- You have arrived at a clear, specific, answerable question
- Continued diagnosis without more information would be speculation

A researchable question is specific enough that a search could answer it directly:
> "What environment variable does [library X]'s [function Y] actually read at
> runtime?"

A non-researchable question is what you write when stuck and hoping research will
rescue you:
> "How does [technology A] work with [technology B]?"

If you cannot write a specific question, you have not diagnosed far enough. More
diagnosis, not more research, is the right move.

---

## Communication during investigation

### What to say

- Before each ACTION, state the hypothesis being tested in one sentence
- After each OBSERVATION, state what changed in your model — even if the answer
  is "nothing changed, which itself narrows the possibilities"
- When the root cause is confirmed, state it completely and precisely before
  proposing any fix:
  > "Root cause confirmed: [component A] uses [value X] because [mechanism Y]
  > overrides the configured [value Z] at startup. Evidence: [direct quote from
  > log/source/process state]."

### What not to say

- Do not narrate tool calls as progress ("Let me check the logs..." is not a
  finding — report the finding, not the intent)
- Do not announce fixes before the cause is verified
- Do not say "I think the issue might be X" and immediately apply a fix for X —
  "might be" is a hypothesis; test it first
- Do not compress THOUGHT/ACTION/OBSERVATION into a single paragraph — the
  explicit structure is precisely what prevents skipping the verification step

---

## Multi-layer decomposition

When a system has multiple layers (any stack: hardware → driver → OS → runtime →
middleware → application → config), failures almost always occur at exactly one
layer boundary. The strategy for finding it:

1. **Find the last layer that works correctly.** Where in the chain does behaviour
   match expectation? Start from the input end and work forward.

2. **Find the first layer that fails.** Where does behaviour first diverge from
   expectation?

3. **The root cause is at that boundary.** You now have a precise, one-layer
   question instead of a whole-system question. Investigate only that boundary.

This decomposition converts "nothing works end-to-end" into a single-layer
question that can be answered with one or two diagnostic actions.

**Avoid investigating layers you have not checked.** It is tempting to hypothesise
about a deep layer when the surface layers have not been fully inspected. The actual
divergence point is almost always shallower than expected.

---

## Anti-patterns this protocol prevents

| Anti-pattern | Signal | Correct response |
|---|---|---|
| **Config iteration** | Trying the third variation of the same config change | Stop. Read what config the running process actually loads. |
| **Restart loop** | Rebuild → restart → check, without new diagnostic information | Stop. The code did not change. Inspect state before restarting again. |
| **Assumption drift** | Fix is written for cause X before X has been verified | Treat X as a hypothesis. Find direct evidence before writing a fix. |
| **Complexity escalation** | Each failed fix attempt adds more layers or indirection | Apply Occam's razor. The simpler explanation is right more often. A 3-line change to the right place beats a 50-line workaround around the wrong place. |
| **Confirmation reading** | Reading diagnostic output to confirm existing belief rather than test it | Ask: what would I see if my hypothesis is *wrong*? Look for that specifically. |
| **Shell ≠ process env** | Assuming the process sees what the launcher was told to pass | Verify the process's own environment at runtime, not the launch config. |
| **Layer skipping** | Theorising about a deep layer without inspecting the surface layers first | Walk the chain from input to output. The first divergence is the root cause. |

---

## Diagnostic toolkit (generic)

```bash
# What environment does the running process actually see?
# Linux:
cat /proc/<pid>/environ | tr '\0' '\n'
# Or filter for a specific variable:
cat /proc/<pid>/environ | tr '\0' '\n' | grep VAR_NAME

# Which network sockets does a process own? (Linux)
# Map process file descriptors to UDP/TCP ports:
python3 -c "
import os, re
pid = <pid>
inodes = {}
for fd in os.listdir(f'/proc/{pid}/fd'):
    try:
        m = re.match(r'socket:\[(\d+)\]', os.readlink(f'/proc/{pid}/fd/{fd}'))
        if m: inodes[int(m.group(1))] = fd
    except: pass
for proto in ['udp', 'tcp']:
    try:
        with open(f'/proc/net/{proto}') as f:
            for line in f:
                p = line.split()
                if len(p) >= 10:
                    try:
                        i = int(p[9])
                        if i in inodes:
                            port = int(p[1].split(':')[1], 16)
                            print(f'{proto.upper()} fd{inodes[i]} port={port}')
                    except: pass
    except: pass
"

# What string literals (env var names, config keys) does a binary contain?
grep -oa '[A-Z_][A-Z0-9_]\{3,\}' /path/to/binary | sort -u | head -50

# Read source from a public GitHub repo without cloning:
gh api repos/<org>/<repo>/contents/<path/to/file> --jq '.content' | base64 -d

# Which file is a process actually reading? (Linux, requires strace)
strace -p <pid> -e trace=openat 2>&1 | grep -v ENOENT

# What is the process's working directory and open files?
ls -la /proc/<pid>/fd
readlink /proc/<pid>/cwd
```

---

## Completion checklist

Do not declare a fix done until every item is checked:

- [ ] The root cause is stated in one sentence with a direct evidence citation
- [ ] The fix targets the root cause, not a downstream symptom
- [ ] No complexity was added to work around unexplained behaviour
- [ ] The fix is the simplest change that addresses the verified cause
- [ ] Before applying, a specific prediction was made: "after this fix, I expect to observe [X]"
- [ ] After applying, the prediction was verified by observation
- [ ] The system is tested at the layer where the failure occurred, not just end-to-end

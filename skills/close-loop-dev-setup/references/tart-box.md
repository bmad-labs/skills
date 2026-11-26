# tart-box: macOS in a Tart VM, with cua-driver

`tart-box` is macOS running in a Tart VM, with `cua-driver` installed. One VM per project, kept for the life of the project. The agent installs `cua-driver`, the app and its runtime in the guest, and drives the app there. The host gets only Tart, an SSH key, the `tart-box` wrapper and the MCP cache proxy. Apple Silicon is required.

Use it for macOS desktop apps, or when a test needs a clean macOS state. For web UI and Linux apps, [cua-box.md](cua-box.md) is lighter.

## Host prerequisites

| Need | Check | If absent |
| --- | --- | --- |
| Tart | `tart --version` | Show `brew install cirruslabs/cli/tart`; run it after the user says yes |
| `uv`, for the MCP cache proxy | `uv --version` | Show `brew install uv`; run it after the user says yes |
| Wrapper | `command -v tart-box` | Copy [templates/tart-box/tart-box](../templates/tart-box/tart-box) to `~/bin/` or the repo, set `TART_BOX_VM` |

## Build once per project

Pin the image by digest or tag; never `:latest`. Record it in `tests/close-loop/README.md`.

```bash
VM=<project>-mac
tart clone ghcr.io/cirruslabs/macos-sequoia-base@sha256:<digest> "$VM"
ssh-keygen -t ed25519 -N '' -f ~/.ssh/"$VM"
TART_BOX_VM="$VM" tart-box start
ssh-copy-id -i ~/.ssh/"$VM".pub admin@"$(TART_BOX_VM="$VM" tart-box ip)"
```

The `-base` images ship Homebrew, Node, passwordless `sudo`, SSH and auto-login as `admin` (password `admin`). `ssh-copy-id` asks for that password once; in Claude Code, ask the user to run it with the `!` prefix. After that the key logs in.

## Install in the guest

Every command runs in the guest through `tart-box ssh` or `ssh -i ~/.ssh/$VM admin@<ip>`, never on the host.

1. App runtime and project tools with `brew`, `npm` or `uv`, pinned.
2. `cua-driver`, into `~/.local/bin/`. The vendor ships an install script. Download it to a file in the guest, read it, then run it in the guest:

   ```bash
   curl -fsSL https://cua.ai/driver/install.sh -o /tmp/cua-driver-install.sh
   shasum -a 256 /tmp/cua-driver-install.sh
   cat /tmp/cua-driver-install.sh
   bash /tmp/cua-driver-install.sh
   ```

   Stop and tell the user if the script does more than install `cua-driver`. Never pipe it into a shell. Record `cua-driver --version`.
3. The MCP bridge: `uv tool install mcp-proxy==<version>`, then copy [templates/tart-box/guest/dev.tart-box.mcp-bridge.plist](../templates/tart-box/guest/dev.tart-box.mcp-bridge.plist) to `~/Library/LaunchAgents/` in the guest, fill `<guest-ip>`, and load it with `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/dev.tart-box.mcp-bridge.plist`.
4. Permissions. Boot with `tart-box vnc`, run `cua-driver permissions grant` in the guest, and ask the user to click Allow for Accessibility and Screen Recording in Screen Sharing. Confirm with `cua-driver permissions status`. Grants persist in the VM, so this is once per project.
5. `cua-driver doctor` must be clean before the first run.

Never edit `TCC.db` on the host. To fix a stale grant in the guest, run `cua-driver doctor --fix`, then grant again.

## Why the bridge is a LaunchAgent

`cua-driver` must run in the guest's logged-in GUI session. A process started only from SSH sees no windows and holds no grants. The LaunchAgent runs in the `gui/<uid>` domain, and `mcp-proxy` turns the stdio `cua-driver mcp` into streamable HTTP on port 8011. `tart-box start` kicks it after each boot. It has no `RunAtLoad` and no `KeepAlive`.

## Connect the agent

The host reaches `http://<guest-ip>:8011/mcp` through the cache proxy, which finds the guest with `tart ip <vm> --resolver arp` on every call, so a changed address needs no config edit. The tools stay listed while the VM is off, and a call then answers with `tart-box start`. See [mcp-proxy.md](mcp-proxy.md).

## Lifecycle

| Command | When |
| --- | --- |
| `tart-box start` | Before a run, headless. `cua-driver` then sees no window |
| `tart-box gui` | A run that needs a visible screen. Say which mode the run used |
| `tart-box vnc` | A macOS permission dialog the user must click |
| `tart-box status` | First and last. A VM started another way has no pid file; trust the `tart list` line |
| `tart-box stop` | After the run, pass or fail. Write the result only after it reports the VM off |
| `tart-box delete` | Only when the user asks |

## Rules

- Secrets stay on the host. Give the guest its own key; never copy the user's key, token or PEM into the guest.
- Sync code in with `rsync -a --delete --exclude .git`; copy evidence out with `scp` or `rsync` into `tests/close-loop/evidence/`. Do not report a result you did not copy.
- Restore what you changed in the guest before `tart-box stop`, and say so in the summary.
- A VM has no battery, and sleep comes back as a cold boot. Mark battery and sleep cases `NOT RUN`, missing a physical machine.
- GPU and font rendering differ from the host. Compare baselines only against the same guest image.

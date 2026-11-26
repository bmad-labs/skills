# cua-box: Linux desktop in Docker, with cua-driver

`cua-box` is a Linux desktop running in Docker, with `cua-driver` installed. The build lives in the repo, so every clone rebuilds the same box. One container per project, kept for the life of the project. The agent installs and drives everything inside it. The host gets only Docker and the files in `tests/close-loop/docker/`.

Use it for web UI and Linux desktop apps. For a macOS app, use [tart-box.md](tart-box.md).

## Host prerequisites

| Need | Check | If absent |
| --- | --- | --- |
| Docker runtime (OrbStack or Docker Desktop) | `docker info` | Show `brew install --cask orbstack`; run it after the user says yes |
| `uv`, for the MCP cache proxy | `uv --version` | Show `brew install uv`; run it after the user says yes |

## Files

Copy [templates/cua-box/](../templates/cua-box/) to `tests/close-loop/docker/`, then fill every `<placeholder>`:

| File | Does |
| --- | --- |
| `Dockerfile` | Base `trycua/cua-xfce` pinned by digest; `at-spi2-core` and `socat`; the app under test; `cua-driver` from the pinned release binary, checked with SHA-256 |
| `compose.yaml` | Container `<project>-box`; noVNC on `127.0.0.1:6901`; repo read-only at `/repo`; evidence folder writable |
| `bin/box-session-env` | Prints `DISPLAY` and the session D-Bus address. A `docker exec` shell starts outside the XFCE session and cannot see the accessibility bus without them |
| `bin/box-cua-mcp` | `cua-driver mcp` over stdio, inside the session. Waits for the session, and refuses to start without it |
| `bin/box-cua-serve` | The `cua-driver serve` daemon for `cua-driver call` |
| `supervisor/box-cua-serve.conf` | supervisord keeps the daemon up; a commented `socat` relay for an app port |

Pin every version:

- Base image: `docker buildx imagetools inspect trycua/cua-xfce:<tag>` gives the digest.
- `cua-driver`: take the version and its SHA-256 from the release's `checksums.txt` on `github.com/trycua/cua/releases`. The image's bundled Python `cua-driver` in `/opt/venv` is older; call `/usr/local/bin/cua-driver`.
- The app: its release asset and the vendor's SHA-256, checked with `sha256sum -c`.

## Build and run

From the repo root:

```bash
docker compose -f tests/close-loop/docker/compose.yaml up -d --build   # build once, start
docker compose -f tests/close-loop/docker/compose.yaml stop            # after a run; keeps the container
docker compose -f tests/close-loop/docker/compose.yaml start           # next run
```

Rebuild (`up -d --build`) only after a change to the Dockerfile or the app build. `down` removes the container; use it only when the user asks.

Check it before a run:

```bash
docker exec -u cua <project>-box sh -c 'eval "$(box-session-env)" && /usr/local/bin/cua-driver doctor'
```

`doctor` must report the accessibility bus reachable. Without the session environment it reports `AT-SPI: accessibility bus not reachable`.

## Connect the agent

`cua-driver` serves MCP over stdio, so `docker exec -i` is the transport and no port opens:

```bash
docker exec -i -u cua <project>-box box-cua-mcp
```

Do not put that command in `.mcp.json` directly. A client connects once, at session start, and does not retry: a stopped container leaves the server missing for the whole session. Run it through the cache proxy; see [mcp-proxy.md](mcp-proxy.md).

An app that serves its own MCP or HTTP endpoint on `127.0.0.1` inside the container needs a `socat` relay (supervisord) and a port published on `127.0.0.1` in `compose.yaml`.

## Drive it

| Target | Route |
| --- | --- |
| Desktop app: windows, menus, dialogs | `cua-driver` element tree, then act by `element_token` |
| Visual check | `cua-driver` screenshot into the evidence folder |
| App state | The app's own API or CLI, through `docker exec` |

- Start narrow: `list_windows` for the app's `pid` and `window_id`, then `get_window_state`.
- Paths in tool arguments are container paths: inputs under `/repo/`, outputs under `/repo/tests/close-loop/evidence/`.
- An app built with a toolkit that lacks the AT-SPI bridge shows no element tree. Check the element count before relying on it; fall back to screenshots and coordinates, and record the gap.
- The container renders with software OpenGL and Linux fonts. Its screenshots are not comparable with host baselines.

## Keep it clean

- Use synthetic data. No real account, key or token in the container.
- The evidence folder is the only writable path to the host. Put no secrets there.
- No restart policy and no login item. The container runs only when a run needs it.

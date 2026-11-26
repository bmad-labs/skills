# MCP cache proxy

A sandbox is off most of the time. An MCP client such as Claude Code connects each server once, at session start, and does not retry a failed stdio server. A server that points straight into a stopped container or VM stays missing for the whole session. Switching it on and off mid-session also changes the tool list and drops the prompt cache.

[templates/mcp-proxy/mcp_cache_proxy.py](../templates/mcp-proxy/mcp_cache_proxy.py) fixes both. It is a stdio MCP server that:

- starts in under a second, with the sandbox up or down;
- answers `initialize` and `tools/list` from a cache file, `.cache/mcp-proxy/<server>.json`, filled from the real server the last time it was up;
- forwards `tools/call` unchanged when the real server answers its probe;
- with the sandbox down, returns an error that names the start command; it never starts the sandbox;
- after a lost connection, says the outcome is unknown and does not resend, because the tool may have run;
- resends once only when the server said the session ended before the call ran;
- refreshes the cache in the background and sends `notifications/tools/list_changed` when the list changes.

Its only dependency, `mcp`, is pinned in the script header, so `uv run --script` installs it.

## Install in a project

1. Copy `mcp_cache_proxy.py` and `proxy.example.json` to `tests/close-loop/mcp/`. Rename the config to `proxy.json` and keep only the servers the project uses.
2. Add `tests/close-loop/mcp/.cache/` to `.gitignore`.
3. Add one entry per server to `.mcp.json`, with `<repo>` as the absolute repo path:

```json
{
  "mcpServers": {
    "cua-driver-box": {
      "type": "stdio",
      "command": "uv",
      "args": ["run", "--script", "<repo>/tests/close-loop/mcp/mcp_cache_proxy.py",
               "--config", "<repo>/tests/close-loop/mcp/proxy.json",
               "--server", "cua-driver-box"]
    }
  }
}
```

Ask before editing `.mcp.json`. Keep the server in project scope; never edit the user's global client config for a sandbox. If the repo should not carry it, register it in Claude Code's local scope instead: `claude mcp add -s local cua-driver-box -- uv run --script <repo>/tests/close-loop/mcp/mcp_cache_proxy.py --config <repo>/tests/close-loop/mcp/proxy.json --server cua-driver-box`.

On a fresh clone the cache is empty, so the tool list is empty until the sandbox has been up once. Start the sandbox, wait one refresh, then restart the client session.

## Config

Each key under `servers` is one upstream:

| Field | Value |
| --- | --- |
| `transport` | `stdio` (with `command`, `args`) or `http` (with `url`, `{host}` allowed) |
| `host` | Fixed address for `{host}` and probes; default `127.0.0.1` |
| `host_command` | Command that prints the address, for example `["tart", "ip", "<vm>", "--resolver", "arp"]`; runs on every probe |
| `probe` | `{"type": "tcp", "port": N}`, `{"type": "http-json", "url": ..., "ready_field": ..., "identity_field": ...}`, or `{"type": "none"}` |
| `start_hint` | The command the error message tells the agent to run |

Probe choice:

| Upstream | Probe |
| --- | --- |
| `cua-box`, stdio through `docker exec` | `tcp` on 6901: noVNC is up when the desktop is |
| `tart-box` guest bridge | `tcp` on 8011, with `host_command` |
| App server whose port opens before the app is ready | `http-json` on its health URL; `identity_field` changes on restart, so the proxy drops the dead session |

## Check it

```bash
uv run --script tests/close-loop/mcp/mcp_cache_proxy.py --config tests/close-loop/mcp/proxy.json --server <name> </dev/null
```

It must start and log either `tool list changed` (sandbox up) or nothing worse than `upstream not ready` (sandbox down). In the client, the server must be listed with the sandbox off, and a call must name the start command.

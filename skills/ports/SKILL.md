---
name: ports
description: >-
  macOS open-port investigator using lsof, ps, netstat, docker, and launchctl. Use this skill
  whenever the user wants to see what is listening on their Mac, find out what is using a specific
  port, produce a report of open ports, or free/close a port. Also use when the user says things
  like "what's running on port 3000", "port already in use", "address already in use", "EADDRINUSE",
  "what ports are open", "who's listening on", "kill whatever is on port X", "free up port 8080",
  "is anything exposed to the network", or any local port/listener inspection or cleanup task.
  Closing a port means stopping a process — this skill ALWAYS identifies the owner and confirms with
  the user before stopping anything, and never touches system-critical processes.
---

# Ports — macOS Open Port Investigator

This skill inspects and manages TCP/UDP listeners on macOS. It does three things: **survey** what is
listening, **investigate** who owns a given port and why, and **close** a port by stopping its owner
the correct way. Each capability stands alone; the natural chain is survey → investigate → report →
close.

## ⚠️ SAFETY CONTRACT — read first, applies to everything

Investigating is always safe and needs no confirmation. **Closing a port is not "closing a port" —
it is killing a running process.** That process may hold unsaved state, be mid-write, or be a system
service other things depend on.

**Never stop anything without this protocol:**

1. **Identify first.** Always resolve the port to a PID, its full command line, its owner, and its
   origin (Docker container / launchd service / plain process). Never kill a PID you have not
   identified.
2. **Confirm with the user.** State what will be stopped: process name, full command, PID, port, and
   what it appears to be. Ask them to confirm. Do not run the stop command yet.
3. **Stop it the right way** (see the closing capability below) — the correct method depends on the
   origin. `kill` is often the *wrong* tool.
4. **Verify and report.** Re-check the port afterward and tell the user whether it is actually free.

**Never stop these, under any circumstance — refuse and explain:**

- PID 1 (`launchd`) or any process with a PID below ~100
- Anything owned by `root` or `_`-prefixed system users, unless the user explicitly names it and
  confirms twice
- Apple system services: `ControlCenter`, `rapportd`, `sharingd`, `mDNSResponder`, `netbiosd`,
  `remoted`, `AirPlay`/`ControlCe*` listeners on ports 5000/7000, `kernel_task`
- `sshd` — killing it can lock the user out of a remote machine

**Never use `kill -9` as a first attempt.** Always `TERM` first and give the process a moment to shut
down cleanly. `-9` is a last resort, and only after telling the user the graceful stop failed.

**Never run a broad kill.** No `killall <name>`, no piping a whole `lsof` result into `kill`, no
"clean up all the ports" sweeps. One identified port, one confirmed process, at a time.

The default answer to "just kill whatever is on that port" is: identify it, show the user, and ask.

## Setup

Everything here uses tools built into macOS — `lsof`, `ps`, `netstat`, `launchctl` — plus `docker`
when Docker Desktop is involved. Nothing needs installing.

**Permissions matter.** Without `sudo`, `lsof` only shows processes owned by the current user. This
is usually enough for development ports, and it is the safer default. If a port shows as in use but
no owner appears, it belongs to another user (often `root`) — re-run that one query with `sudo` and
tell the user why it is needed.

**Critical `lsof` gotchas:**

| Gotcha | Handling |
|--------|----------|
| `COMMAND` is truncated to 9 characters (`com.docke`, `Code\x20H`) | Always pass `+c 0` for full names; spaces then appear escaped as `\x20` |
| Names are resolved to DNS/service names by default, which is slow and misleading | Always pass `-nP` (numeric addresses, numeric ports) |
| Each port appears twice when bound on both IPv4 and IPv6 | Deduplicate by PID + port when reporting |
| Docker-published ports are all owned by one `com.docker.backend` PID | Map to the real container via `docker ps` — never kill that PID |

## Capability: Survey all listening ports (always safe)

The baseline command — every listening TCP socket with its owner:

```bash
lsof -nP +c 0 -iTCP -sTCP:LISTEN
```

For a clean, parseable list (dedupe IPv4/IPv6 duplicates, sort by port):

```bash
lsof -nP +c 0 -iTCP -sTCP:LISTEN | \
  awk 'NR>1 {n=split($(NF-1),a,":"); print a[n]"\t"a[n-1]"\t"$1"\t"$2"\t"$3}' | sort -k1,1n -u
```

That prints `port | bind address | command | pid | user`, one row per port. The address is the
second-to-last field (`$(NF-1)`) — the last field is the literal `(LISTEN)` state, which is a common
mistake when parsing this output.

Include UDP only when relevant (it is noisy — most UDP rows are outbound connections, not listeners):

```bash
lsof -nP +c 0 -iUDP -sUDP:^Idle
```

`netstat -anv -p tcp | grep -i LISTEN` is a fallback if `lsof` is unavailable, but its process column
is truncated and it is harder to parse — prefer `lsof`.

**Reading the bind address is the most important part of a survey:**

| Bind address | Meaning |
|--------------|---------|
| `127.0.0.1:PORT` / `[::1]:PORT` | Loopback only — reachable only from this Mac. Normal for dev servers. |
| `*:PORT` / `0.0.0.0:PORT` | **Bound to all interfaces — reachable from the local network.** Worth flagging. |
| `192.168.x.x:PORT` | Bound to one specific interface. |

Always call out `*:PORT` listeners in a survey. Combine with the firewall state for context:

```bash
/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
```

If the firewall is disabled, `*:PORT` listeners really are exposed to anyone on the same network —
say so plainly, without alarmism.

## Capability: Investigate one port (always safe)

When the user names a port, or hits `EADDRINUSE` / "address already in use", resolve it fully.

**Who is on the port:**

```bash
lsof -nP +c 0 -iTCP:<port> -sTCP:LISTEN
```

**Full details for the PID it returns** — full command, parent PID, user, start time:

```bash
ps -o pid=,ppid=,user=,lstart=,command= -p <pid>
```

**Then determine the origin, because it decides how to close it:**

1. **Docker?** If the command is `com.docker.backend`, `docker-proxy`, or similar, the real owner is
   a container:

   ```bash
   docker ps --format '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Ports}}' | grep '<port>'
   ```

2. **launchd service?** Walk the parent chain — if the PPID is 1, it was likely launched by launchd:

   ```bash
   launchctl list | grep -i '<pid or name>'
   ```

3. **Plain process?** Anything else — a dev server, an app, a script. The `ps` output tells the whole
   story; the working directory can confirm which project it belongs to:

   ```bash
   lsof -a -p <pid> -d cwd -Fn
   ```

Report the finding as: **port → process → full command → origin → exposure**. That is enough for the
user to decide whether it should be stopped.

## Capability: Report

When the user asks for a report (rather than a single lookup), produce a compact Markdown table
sorted by port, with the exposure column called out:

| Port | Bind | Process | PID | User | Origin | Exposure |
|------|------|---------|-----|------|--------|----------|
| 3000 | 127.0.0.1 | node | 41233 | ghostmind | project dev server | loopback |
| 80 | `*` | com.docker.backend | 45091 | ghostmind | Docker → `traefik` | **network** |

Then add short sections:

- **Exposed to the network** — every `*`/`0.0.0.0` listener, plus the firewall state. This is the part
  worth reading.
- **Docker-published ports** — grouped by container, since one PID fronts them all.
- **Unrecognized listeners** — anything whose command does not obviously map to a known app or
  project. Do not accuse; just list them as worth a look.
- **System services** — collapse Apple/system listeners into a one-line summary (`AirPlay on 5000/7000,
  Handoff on 51216`). They are expected and should not clutter the report.

Keep it factual. Do not label a listener "suspicious" or "malware" — describe what it is and let the
user judge. If asked to save the report, write it to a file the user names, or offer to publish it as
an artifact if they want something shareable.

## Capability: Close a port (guarded — confirmation required)

**Only after the Safety Contract protocol.** The right method depends on the origin — using `kill` on
a Docker or launchd port is wrong and will either fail, take down more than intended, or let the
service restart immediately.

**Docker container** — stop the container, never the Docker PID:

```bash
docker stop <container_name_or_id>
```

If it was started by Compose, prefer stopping the service in its project so the state stays coherent:

```bash
docker compose -f <compose file> stop <service>
```

**launchd service** — `kill` will not work; launchd restarts it. Unload it instead, and tell the user
whether this is for this boot only or permanent:

```bash
launchctl bootout gui/$(id -u)/<label>     # user agent, until next login
sudo launchctl bootout system/<label>      # system daemon — requires sudo, explain why
```

**Plain process** — graceful first, always:

```bash
kill -TERM <pid>
```

Wait a moment, then re-check. Only if it is still listening, and only after telling the user the
graceful stop failed, escalate:

```bash
kill -9 <pid>
```

**Always verify afterward** and report the real outcome:

```bash
lsof -nP +c 0 -iTCP:<port> -sTCP:LISTEN
```

Empty output means the port is free. If something is still there, check whether it is a *different*
PID — a supervisor (launchd, Docker, `nodemon`, a process manager) may have restarted it. Say so
rather than killing repeatedly; the fix is to stop the supervisor, not to fight it.

## Workflow guidance

- **Investigate before acting, always.** The user asking to "kill port 3000" is asking for the port to
  be free — the useful first response is telling them what is on it, since it is often something they
  want to keep.
- **Chain naturally:** survey → investigate the interesting one → confirm → close → verify.
- **Prefer the gentlest fix.** If a dev server is running in the user's own terminal or a herdr/tmux
  pane, stopping it there (Ctrl-C) is better than killing it — suggest that first.
- **Report what ran.** Show the command and its relevant output so the user can see the current state
  for themselves.
- **One port at a time.** Never batch closures, even if the user asks for a sweep — walk through them
  individually with confirmation for each.

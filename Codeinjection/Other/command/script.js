// VULNERABLE BY DESIGN — Educational purposes only
// Simulates OS command injection: user input is concatenated into a shell command string.

// ── Simulated file system (for cat/ls payloads) ───────────────────────────────
const FAKE_FS = {
  "/etc/passwd":  "root:x:0:0:root:/root:/bin/bash\nalice:x:1001:1001::/home/alice:/bin/sh\nbob:x:1002:1002::/home/bob:/bin/sh",
  "/etc/shadow":  "root:$6$rounds=5000$salt$hash:18000:0:99999:7:::\nalice:$6$rounds=5000$salt$hash2:18000:0:99999:7:::",
  "/etc/hostname": "securecorp-prod-01",
  "/var/log/auth.log": "Mar 31 10:01:22 sshd: Accepted password for alice\nMar 31 10:05:11 sshd: Failed password for root",
  ".env":         "DB_PASSWORD=supersecret123\nAPI_KEY=sk-prod-abc999\nSECRET_KEY=fl4g{cmd_injection}",
};

// ── Simulated command executor ────────────────────────────────────────────────
// Mimics: exec("ping -c 4 " + userInput)   on a Linux server
function simulateCommand(host) {
  const cmd = `ping -c 4 ${host}`;

  // Parse chained commands (;  &&  ||  |  backtick  $())
  const chainSep = /;|&&|\|\||`|\$\(|\|/;
  const parts    = cmd.split(chainSep).map(s => s.trim()).filter(Boolean);

  const outputs = [];
  let injected  = false;

  for (const part of parts) {
    outputs.push(`$ ${part}`);

    // ping (the intended command)
    if (/^ping\b/.test(part)) {
      const target = part.replace(/^ping\s+(-c\s+\d+\s+)?/, "").trim();
      if (/^[\w.\-]+$/.test(target)) {
        outputs.push(
          `PING ${target}: 56 data bytes`,
          `64 bytes from ${target}: icmp_seq=0 ttl=56 time=12.4 ms`,
          `64 bytes from ${target}: icmp_seq=1 ttl=56 time=11.9 ms`,
          `64 bytes from ${target}: icmp_seq=2 ttl=56 time=12.1 ms`,
          `64 bytes from ${target}: icmp_seq=3 ttl=56 time=12.2 ms`,
          `--- ${target} ping statistics ---`,
          `4 packets transmitted, 4 received, 0% packet loss`,
        );
      } else {
        outputs.push(`ping: unknown host ${target}`);
      }
      continue;
    }

    injected = true;

    // whoami
    if (/^whoami$/.test(part)) { outputs.push("www-data"); continue; }

    // id
    if (/^id$/.test(part)) { outputs.push("uid=33(www-data) gid=33(www-data) groups=33(www-data)"); continue; }

    // hostname
    if (/^hostname$/.test(part)) { outputs.push("securecorp-prod-01"); continue; }

    // uname
    if (/^uname(\s+-a)?$/.test(part)) { outputs.push("Linux securecorp-prod-01 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux"); continue; }

    // ls
    if (/^ls(\s+.*)?$/.test(part)) {
      const path = part.replace(/^ls\s*/, "").trim() || ".";
      if (path === "." || path === "./") {
        outputs.push("app.py  requirements.txt  templates/  static/  .env  users.db");
      } else {
        outputs.push("ls: cannot access '" + path + "': No such file or directory");
      }
      continue;
    }

    // cat
    if (/^cat\s+/.test(part)) {
      const path = part.replace(/^cat\s+/, "").trim();
      if (FAKE_FS[path]) {
        outputs.push(FAKE_FS[path]);
      } else {
        outputs.push(`cat: ${path}: No such file or directory`);
      }
      continue;
    }

    // pwd
    if (/^pwd$/.test(part)) { outputs.push("/var/www/html"); continue; }

    // ps
    if (/^ps(\s+.*)?$/.test(part)) {
      outputs.push("  PID TTY          TIME CMD", "    1 ?        00:00:01 python3", "   42 ?        00:00:00 gunicorn", "   99 ?        00:00:00 ps");
      continue;
    }

    // env / printenv
    if (/^(env|printenv)$/.test(part)) {
      outputs.push(Object.entries(FAKE_FS[".env"].split("\n").reduce((a, l) => {
        const [k, v] = l.split("="); a[k] = v; return a;
      }, {})).map(([k, v]) => `${k}=${v}`).join("\n"));
      continue;
    }

    // rm / mkfs / dd — destructive (simulate)
    if (/^(rm|mkfs|dd|format)\b/.test(part)) {
      outputs.push("[SIMULATED] Destructive command blocked — would have wiped data.");
      continue;
    }

    // unknown
    outputs.push(`bash: ${part.split(" ")[0]}: command not found`);
  }

  return { cmd, outputs: outputs.join("\n"), injected };
}

// ── DOM wiring ────────────────────────────────────────────────────────────────
document.getElementById("pingForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const host       = document.getElementById("hostInput").value;
  const cmdDisplay = document.getElementById("cmdDisplay");
  const terminal   = document.getElementById("terminal");
  const termOut    = document.getElementById("terminalOutput");
  const explanation = document.getElementById("explanationBox");

  const outcome = simulateCommand(host);

  cmdDisplay.textContent = outcome.cmd;
  termOut.textContent    = outcome.outputs;
  terminal.classList.remove("hidden");
  explanation.classList.remove("hidden");

  if (outcome.injected) {
    explanation.innerHTML = `
      <h3>What happened?</h3>
      <p>Your input contained shell metacharacters that chained additional OS commands onto the intended <code>ping</code>.</p>
      <ul>
        <li>The server built the shell command by concatenating your input directly: <code>ping -c 4 ${escapeHtml(host)}</code>.</li>
        <li>Characters like <code>;</code> <code>&&</code> <code>||</code> <code>|</code> are interpreted by the shell as command separators.</li>
        <li>Every command after the separator runs with the same privileges as the web server process.</li>
        <li>The fix: never pass user input to a shell. Use language-level APIs (e.g. Python's <code>subprocess</code> list form) that don't invoke a shell at all.</li>
      </ul>`;
  } else {
    explanation.innerHTML = `
      <h3>Normal input — no injection detected.</h3>
      <p>Try these payloads in the hostname field:</p>
      <ul>
        <li><code>example.com; whoami</code> — runs whoami after ping</li>
        <li><code>example.com && id</code> — runs id if ping succeeds</li>
        <li><code>example.com; cat /etc/passwd</code> — reads system users file</li>
        <li><code>example.com; cat .env</code> — leaks environment secrets</li>
        <li><code>example.com; ls</code> — lists app files</li>
        <li><code>example.com | cat /etc/shadow</code> — pipes output, reads shadow passwords</li>
      </ul>`;
  }
});

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

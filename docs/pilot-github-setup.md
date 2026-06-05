# GitHub Secrets и branch protection для pilot-деплоя

## Secrets (Settings → Secrets and variables → Actions)

| Secret | Значение |
|--------|----------|
| `PILOT_SERVER_HOST` | `77.91.93.156` |
| `PILOT_SERVER_USER` | `deploy` |
| `PILOT_SERVER_SSH_KEY` | приватный ключ ed25519 (см. ниже) |
| `PILOT_DOMAIN` | `teamzachet.ru` |

### SSH-ключ для CI (на сервере под root или deploy)

```bash
ssh-keygen -t ed25519 -f /home/deploy/.ssh/github_actions -N ""
cat /home/deploy/.ssh/github_actions.pub >> /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys /home/deploy/.ssh/github_actions
chmod 644 /home/deploy/.ssh/github_actions.pub
```

Содержимое `/home/deploy/.ssh/github_actions` (приватный ключ) → secret `PILOT_SERVER_SSH_KEY`.

### Deploy key для git pull на сервере

GitHub → Repository → Settings → Deploy keys → Add deploy key (read-only):

```bash
ssh-keygen -t ed25519 -f /home/deploy/.ssh/github_deploy -N ""
cat /home/deploy/.ssh/github_deploy.pub   # → в GitHub Deploy keys
```

`~deploy/.ssh/config`:

```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
```

## Branch protection (Settings → Branches → Add rule → `master`)

| Правило | Значение |
|---------|----------|
| Require a pull request before merging | ✓ |
| Required status checks | `Build Docker images`, `Run backend pytest` |
| Require branches to be up to date | ✓ (рекомендуется) |
| Include administrators | по желанию |

Deploy job (`Deploy pilot to server`) **не** добавлять в required checks — он выполняется только после merge в master, не на PR.

## Проверка пайплайна

1. Merge изменений в `master`
2. Actions → CI → все jobs green, включая `Deploy pilot to server`
3. `curl -I https://teamzachet.ru/` → 200
4. `curl -I https://www.teamzachet.ru/` → 301 → teamzachet.ru

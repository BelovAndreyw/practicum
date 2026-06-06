# Bootstrap pilot-сервера (ручной запуск)

Выполнить в **интерактивной SSH-сессии** на `root@77.91.93.156`.

## 0. Предусловия

- DNS: `teamzachet.ru` и `www.teamzachet.ru` → `77.91.93.156` (проверено)
- Docker установлен
- UFW: `ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable`

## 1. Скопировать скрипт с локальной машины

Из PowerShell на Windows (в каталоге репозитория):

```powershell
scp infra/scripts/bootstrap-pilot-server.sh root@77.91.93.156:/root/
scp infra/scripts/setup-ci-ssh-key.sh root@77.91.93.156:/root/
```

**На сервере** убрать Windows-переводы строк (CRLF), иначе bash выдаст `$'\r': command not found`:

```bash
sed -i 's/\r$//' /root/bootstrap-pilot-server.sh /root/setup-ci-ssh-key.sh
```

## 2. Запустить bootstrap на сервере

```bash
bash /root/bootstrap-pilot-server.sh
```

Скрипт попросит добавить **Deploy Key** в GitHub (Settings → Deploy keys) — read-only.

Если pilot-инфра ещё не в `master`, указать ветку:

```bash
GIT_BRANCH=devops bash /root/bootstrap-pilot-server.sh
```

## 3. SSH-ключ для GitHub Actions

```bash
cp /opt/teamzachet/infra/scripts/setup-ci-ssh-key.sh /root/ 2>/dev/null || true
bash /root/setup-ci-ssh-key.sh
```

Скопировать вывод `PILOT_SERVER_SSH_KEY` в GitHub Secrets (см. `docs/pilot-github-setup.md`).

## 4. Smoke-проверки

```bash
curl -I http://teamzachet.ru/
curl -I https://teamzachet.ru/
curl -I https://www.teamzachet.ru/
curl -s https://teamzachet.ru/api/
```

## 5. Merge в master + CI deploy

После merge изменений (ci.yml, nginx, compose) в `master` — push триггерит автодеплой.

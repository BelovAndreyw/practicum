# API Contract — Командный зачёт

Этот документ описывает все эндпоинты, которые ожидает фронтенд.
Все пути относительны `VITE_API_BASE` (по умолчанию `/api`).

> **Авторизация:** JWT-токен в куке `session` (credentials: 'include') или в заголовке `Authorization: Bearer <token>`.
> Ролевая модель: `student` | `captain` | `organizer`.

---

## Auth

### POST `/auth/login`
```json
// request
{ "email": "student@urfu.ru", "password": "..." }

// response 200
{ "user": User, "token": "jwt-string" }
```

### POST `/auth/logout`
Response: `204 No Content`

### GET `/auth/me`
Response: `User`

---

## Users

### GET `/users/:id` → `User`

### PATCH `/users/:id`
```json
// request (partial)
{ "firstName": "...", "lastName": "...", "middleName": "...", "avatarUrl": "..." }
// response: User
```

---

## Teams

### GET `/teams` → `Team[]`
### GET `/teams/:id` → `Team`

### POST `/teams`
```json
// request
{ "name": "Байты Знаний" }
// response: Team
```

### POST `/teams/join`
```json
// request
{ "inviteCode": "BYTE2026" }
// response: Team
```

### GET `/teams/:id/krk` → `KrkBreakdown`
```json
{
  "baseRating": 47.0,      // 60% от КРК
  "cohesionCoeff": 23.5,   // 30% от КРК
  "bonusCoeff": 7.8,       // 10% от КРК
  "total": 78.4
}
```

### POST `/teams/:id/invite-code` → `{ "inviteCode": "NEWCODE" }`

---

## Rating

### GET `/rating/teams` → `TeamRatingEntry[]`
```json
[{ "rank": 1, "team": { "id": "t1", "name": "...", "league": "Профи", "krk": 78.4 } }]
```

### GET `/rating/users?teamId=&stream=` → `UserRatingEntry[]`

---

## Activity

### GET `/activity?limit=20` → `ActivityEvent[]`

---

## Challenges

### GET `/challenges` → `Challenge[]`
### POST `/challenges` (organizer) → `Challenge`
### POST `/challenges/reports`
```json
{
  "challengeId": "ch1",
  "teamId": "t1",
  "comment": "Провели воркшоп...",
  "fileUrls": []
}
// response: 204
```

---

## Events

### GET `/events` → `CalendarEvent[]`
### GET `/events/:id` → `CalendarEvent`
### POST `/events`
```json
{
  "title": "Воркшоп по Java",
  "description": "...",
  "format": "online",          // "online" | "offline"
  "date": "2026-04-27T14:00:00Z",
  "location": "ауд. 310",      // optional
  "invitedTeamIds": []
}
// response: CalendarEvent
```

---

## News

### GET `/news` → `NewsItem[]` (desc по publishedAt)
### POST `/news` (organizer)
```json
{ "title": "...", "body": "..." }
// response: NewsItem
```

---

## Knowledge Exchange

### GET `/knowledge?type=need&resolved=false` → `KnowledgeRequest[]`
### POST `/knowledge`
```json
{ "type": "need", "title": "...", "description": "...", "tags": ["Java"] }
// response: KnowledgeRequest
```
### PATCH `/knowledge/:id/resolve` → `204`

---

## Check-in

### GET `/checkins?teamId=t1` → `CheckIn[]`
### GET `/checkins` (organizer, все команды) → `CheckIn[]`
### POST `/checkins`
```json
{
  "teamId": "t1",
  "weekLabel": "Неделя 3",
  "summary": "...",
  "achievements": "...",
  "blockers": "..."            // optional
}
// response: CheckIn
```

---

## Rescue

### GET `/rescues` → `RescueRequest[]`
### POST `/rescues`
```json
{ "topic": "Java — дженерики", "description": "..." }
// response: RescueRequest
```
### PATCH `/rescues/:id`
```json
{ "status": "accepted" }   // accepted | confirmed | rejected
// response: RescueRequest
```

---

## Voting

### GET `/voting/active?teamId=t1` → `VoteRound | null`
### POST `/voting/ballots`
```json
{ "roundId": "vr1", "targetUserId": "u2", "score": 4 }
// response: 204
```

---

## Типы DTO

Полные TypeScript-определения: [`src/types/index.ts`](../src/types/index.ts).

---

## Ошибки

Все ошибки возвращаются в формате:
```json
{
  "status": 400,
  "message": "Описание ошибки",
  "details": { "field": "Что не так" }   // optional
}
```

HTTP-коды: `400` (валидация), `401` (не авторизован), `403` (нет прав), `404` (не найдено), `500` (сервер).

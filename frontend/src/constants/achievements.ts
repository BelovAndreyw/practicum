/** Каталог достижений — синхронизирован с backend/app/modules/achievement/catalog.py */
export const ACHIEVEMENT_CATALOG = [
  { id: 'ach_x1', title: 'Первый check-in', description: 'Отправьте первый еженедельный отчёт', icon: '✅' },
  { id: 'ach_x2', title: 'Спаситель', description: 'Помогите другой команде в спасении', icon: '🆘' },
  { id: 'ach_x3', title: 'Знаток биржи', description: 'Разместите предложение на бирже знаний', icon: '💡' },
  { id: 'ach_notes', title: 'Создание лучших конспектов', description: 'Ваши конспекты признаны лучшими в потоке', icon: '📝' },
  { id: 'ach_first_aid', title: 'Первая помощь', description: 'Первыми откликнулись на запрос о помощи', icon: '🚑' },
  { id: 'ach_workshop', title: 'Мастер воркшопов', description: 'Провели совместный воркшоп для других команд', icon: '🎤' },
  { id: 'ach_checklist', title: 'Чек-лист мастер', description: 'Создали полезный чек-лист по теме', icon: '✔️' },
  { id: 'ach_streak', title: 'На волне', description: 'Три еженедельных check-in подряд', icon: '🔥' },
  { id: 'ach_team_player', title: 'Командный игрок', description: 'Активно участвуете в жизни команды', icon: '🤝' },
] as const;

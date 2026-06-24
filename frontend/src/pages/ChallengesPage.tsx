import { ChangeEvent, useEffect, useState } from 'react';
import { challengesApi } from '@/api';
import { useAuth } from '@/features/auth/AuthContext';
import type { Challenge } from '@/types';
import { Badge, Button, Card, Empty, Modal, PageHeader, Spinner, Textarea } from '@/components/ui';
import styles from './ChallengesPage.module.css';

const MIN_REPORT_LENGTH = 40;

export function ChallengesPage() {
  const { user } = useAuth();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Challenge | null>(null);

  const [reportBody, setReportBody] = useState('');
  const [reportComment, setReportComment] = useState('');
  const [reportFiles, setReportFiles] = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const currentTeamId = user?.teamId ?? '';

  const loadChallenges = () => {
    setLoading(true);
    setLoadError(null);
    const loader = currentTeamId
      ? challengesApi.listForTeam(currentTeamId)
      : challengesApi.list();
    loader
      .then(setChallenges)
      .catch(() => setLoadError('Не удалось загрузить челленджи'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadChallenges();
  }, [currentTeamId]);

  const reportTextValid = reportBody.trim().length >= MIN_REPORT_LENGTH;
  const filesValid = reportFiles.length > 0;
  const canSubmit = reportTextValid && filesValid;
  const showRequiredError = attemptedSubmit && !canSubmit;

  const openReportModal = (challenge: Challenge) => {
    setSelected(challenge);
    setReportBody('');
    setReportComment('');
    setReportFiles([]);
    setAttemptedSubmit(false);
  };

  const closeReportModal = () => {
    setSelected(null);
    setReportBody('');
    setReportComment('');
    setReportFiles([]);
    setAttemptedSubmit(false);
  };

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setReportFiles(files);
  };

  const handleSubmit = async () => {
    if (!selected || !currentTeamId) return;

    setAttemptedSubmit(true);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const comment = [
        `Описание результата:\n${reportBody.trim()}`,
        reportComment.trim() ? `Комментарий:\n${reportComment.trim()}` : '',
      ].filter(Boolean).join('\n\n');

      await challengesApi.submitReport({
        challengeId: selected.id,
        teamId: currentTeamId,
        comment,
        fileUrls: reportFiles.map((file) => file.name),
      }, reportFiles);

      loadChallenges();
      closeReportModal();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className={styles.center}><Spinner size="lg" /></div>;

  const active = challenges.filter((challenge) => challenge.status === 'active');
  const done = challenges.filter((challenge) => challenge.status !== 'active');

  return (
    <div>
      <PageHeader
        eyebrow="Активности"
        title="Челленджи"
        subtitle="Выполняйте задания организаторов и получайте дополнительные баллы к КРК."
      />

      {loadError && challenges.length === 0 && <Empty message={loadError} />}

      <h3 className={styles.section}>Активные</h3>
      {active.length === 0 && !loadError && <Empty message="Нет активных челленджей" />}

      <div className={styles.grid}>
        {active.map((challenge) => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            done={challenge.teamStatus === 'completed' || (currentTeamId ? challenge.completedByTeamIds.includes(currentTeamId) : false)}
            pending={challenge.teamStatus === 'pending'}
            onReport={() => openReportModal(challenge)}
          />
        ))}
      </div>

      {done.length > 0 && (
        <>
          <h3 className={[styles.section, styles.sectionMuted].join(' ')}>Завершённые</h3>
          <div className={styles.grid}>
            {done.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} done />
            ))}
          </div>
        </>
      )}

      <Modal
        title={`Сдать отчёт: ${selected?.title ?? ''}`}
        open={!!selected}
        onClose={closeReportModal}
        footer={(
          <>
            <Button variant="secondary" onClick={closeReportModal}>Отмена</Button>
            <Button onClick={handleSubmit} loading={submitting} disabled={submitting || !currentTeamId}>
              Отправить
            </Button>
          </>
        )}
      >
        <p className={styles.modalDesc}>{selected?.description}</p>

        <div className={styles.requirements}>
          <p className={styles.requirementsTitle}>Для зачёта нужны оба пункта:</p>
          <p className={styles.requirementItem}>1. Короткий отчёт с описанием результата (минимум 40 символов).</p>
          <p className={styles.requirementItem}>2. Файлы-подтверждения: фото/скрин/документ.</p>
        </div>

        {!currentTeamId && (
          <p className={styles.errorText}>Сначала нужно вступить в команду, чтобы сдавать отчёты.</p>
        )}

        <div className={styles.reportForm}>
          {showRequiredError && (
            <p className={styles.formError}>Заполните все обязательные поля.</p>
          )}

          <Textarea
            label="Описание результата (обязательно)"
            placeholder="Что сделали, кто участвовал, какой результат получили..."
            value={reportBody}
            onChange={(event) => setReportBody(event.target.value)}
            error={attemptedSubmit && !reportTextValid ? 'Добавьте описание результата минимум на 40 символов.' : undefined}
          />
          <p className={styles.fieldHint}>Символов: {reportBody.trim().length} / {MIN_REPORT_LENGTH}</p>

          <Textarea
            label="Комментарий для организатора (необязательно)"
            placeholder="Дополнительные детали, ссылки, пояснения..."
            value={reportComment}
            onChange={(event) => setReportComment(event.target.value)}
          />

          <div className={styles.fileBlock}>
            <label className={styles.fileLabel} htmlFor="challenge-report-files">Файлы (обязательно)</label>
            <input
              id="challenge-report-files"
              type="file"
              multiple
              className={[styles.fileInput, attemptedSubmit && !filesValid ? styles.fileInputError : ''].join(' ')}
              accept="image/*,.pdf,.doc,.docx,.ppt,.pptx"
              onChange={handleFilesChange}
            />
            <p className={styles.fileHint}>Прикрепите минимум один файл, чтобы подтвердить выполнение.</p>

            {reportFiles.length > 0 && (
              <div className={styles.fileList}>
                {reportFiles.map((file) => (
                  <span key={`${file.name}-${file.size}`} className={styles.fileItem}>{file.name}</span>
                ))}
              </div>
            )}

            {attemptedSubmit && !filesValid && (
              <p className={styles.errorText}>Добавьте хотя бы один подтверждающий файл.</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface ChallengeCardProps {
  challenge: Challenge;
  done?: boolean;
  pending?: boolean;
  onReport?: () => void;
}

function ChallengeCard({ challenge, done, pending, onReport }: ChallengeCardProps) {
  return (
    <Card padding="md" className={styles.card}>
      <div className={styles.cardHead}>
        <Badge variant={done ? 'success' : pending ? 'warning' : challenge.status === 'expired' ? 'default' : 'accent'}>
          {done ? '✅ Выполнен' : pending ? 'На проверке' : challenge.status === 'expired' ? 'Истёк' : 'Активен'}
        </Badge>
        <Badge variant="violet">+{challenge.points} очков</Badge>
      </div>

      <h3 className={styles.title}>{challenge.title}</h3>
      <p className={styles.desc}>{challenge.description}</p>

      {challenge.deadline && (
        <p className={styles.deadline}>До: {new Date(challenge.deadline).toLocaleDateString('ru-RU')}</p>
      )}

      {!done && !pending && challenge.status === 'active' && onReport && (
        <Button size="sm" onClick={onReport} style={{ marginTop: 12 }}>Сдать отчёт</Button>
      )}
    </Card>
  );
}

import { supabase } from '@/lib/supabase';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';

export type ReportKind = 'weekly' | 'growth' | 'event';

const REPORT_TYPE_LABELS: Record<ReportKind, string> = {
  weekly: '주간 보고서',
  growth: '성장 기록',
  event: '행사 보고서',
};

const REPORT_TITLE_BUILDERS: Record<ReportKind, (club: ClubType | null | undefined, title?: string) => string> = {
  weekly: (club) => `${club ? CLUB_LABELS[club] : ''} 주간 보고서`.trim(),
  growth: (club, title) => `${title ? `${title} 학생 ` : ''}성장 기록`,
  event: (_club, title) => title || '행사 보고서',
};

interface NotifyReportSubmittedParams {
  /** 보고서 종류 */
  reportType: ReportKind;
  /** 보고서 ID (링크 이동용) */
  reportId: string;
  /** 작성 동아리 */
  club: ClubType | null | undefined;
  /** 학생 이름(성장 기록) 또는 행사명(행사 보고서) 등, 보기 좋은 제목에 쓰일 값 */
  itemTitle?: string;
  /** true면 반려 후 재제출 알림 문구를 사용 */
  isResubmit?: boolean;
}

/**
 * 보고서가 '제출' 상태로 저장될 때, 1차 검토자인 회장(president) 전원에게 알림을 보낸다.
 * 알림 발송 실패는 보고서 저장 자체를 막지 않도록 항상 조용히 실패 처리한다.
 */
export async function notifyReportSubmitted({
  reportType,
  reportId,
  club,
  itemTitle,
  isResubmit,
}: NotifyReportSubmittedParams): Promise<void> {
  try {
    const { data: presidents, error: fetchError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'president');

    if (fetchError) {
      console.error('[notifyReportSubmitted] 회장 목록 조회 실패:', fetchError.message);
      return;
    }

    if (!presidents || presidents.length === 0) return;

    const reportTypeLabel = REPORT_TYPE_LABELS[reportType];
    const displayTitle = REPORT_TITLE_BUILDERS[reportType](club, itemTitle);
    const clubLabel = club ? CLUB_LABELS[club] : '';

    const title = isResubmit ? `${reportTypeLabel} 재제출` : `새 ${reportTypeLabel} 제출`;
    const message = isResubmit
      ? `${clubLabel ? `${clubLabel} · ` : ''}${displayTitle}가 수정되어 다시 제출되었습니다. 검토해주세요.`
      : `${clubLabel ? `${clubLabel} · ` : ''}${displayTitle}가 제출되었습니다. 검토해주세요.`;

    const notifications = presidents.map((p: { user_id: string }) => ({
      user_id: p.user_id,
      type: 'report_submitted',
      title,
      message,
      is_read: false,
      link_url: '/reports/review',
    }));

    const { error: notiError } = await supabase.from('notifications').insert(notifications);
    if (notiError) {
      console.error('[notifyReportSubmitted] 알림 발송 실패:', {
        message: notiError.message,
        code: notiError.code,
        details: notiError.details,
        hint: notiError.hint,
      });
    }
  } catch (err) {
    console.error('[notifyReportSubmitted] 알림 발송 예외:', err);
    // 알림 실패는 무시하고 보고서 저장 흐름은 계속 진행
  }
}
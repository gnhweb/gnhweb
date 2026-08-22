import type { RouteObject } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
const WolvesAndSheep = lazy(() => import("@/pages/wolvesAndSheep/page"));
const GameHub = lazy(() => import("@/pages/gameHub/page"));
// import 추가 (WolvesAndSheep import 아래)
const Pharisee = lazy(() => import("@/games/pharisee/page"));
const GalileePhone = lazy(() => import("@/games/galilee-phone/page"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Home = lazy(() => import("@/pages/home/page"));
const BiblePick = lazy(() => import("@/pages/biblePick/page"));
const BiblePickHistory = lazy(() => import("@/pages/biblePick/history/page"));
const Clubs = lazy(() => import("@/pages/clubs/page"));
const ClubDetail = lazy(() => import("@/pages/clubs/detail/page"));
const ClubCommunity = lazy(() => import("@/pages/clubs/community/page"));
const Notices = lazy(() => import("@/pages/notices/page"));
const NoticeWrite = lazy(() => import("@/pages/notices/write/page"));
const NoticeDetail = lazy(() => import("@/pages/notices/detail/page"));
const NoticeEdit = lazy(() => import("@/pages/notices/edit/page"));
const Schedule = lazy(() => import("@/pages/schedule/page"));
const ScheduleWrite = lazy(() => import("@/pages/schedule/write/page"));
const ScheduleEdit = lazy(() => import("@/pages/schedule/edit/page"));
const Login = lazy(() => import("@/pages/login/page"));
const Setup = lazy(() => import("@/pages/setup/page"));
const Dashboard = lazy(() => import("@/pages/dashboard/page"));
const WeeklyReports = lazy(() => import("@/pages/reports/weekly/page"));
const WeeklyReportWrite = lazy(() => import("@/pages/reports/weekly/write/page"));
const WeeklyReportDetail = lazy(() => import("@/pages/reports/weekly/detail/page"));
const WeeklyReportEdit = lazy(() => import("@/pages/reports/weekly/edit/page"));
const GrowthReports = lazy(() => import("@/pages/reports/growth/page"));
const GrowthReportWrite = lazy(() => import("@/pages/reports/growth/write/page"));
const GrowthRecordDetail = lazy(() => import("@/pages/reports/growth/detail/page"));
const GrowthReportEdit = lazy(() => import("@/pages/reports/growth/edit/page"));
const EventReports = lazy(() => import("@/pages/reports/events/page"));
const EventReportWrite = lazy(() => import("@/pages/reports/events/write/page"));
const EventReportDetail = lazy(() => import("@/pages/reports/events/detail/page"));
const EventReportEdit = lazy(() => import("@/pages/reports/events/edit/page"));
const ReviewPage = lazy(() => import("@/pages/reports/review/page"));
const AdminRolesPage = lazy(() => import("@/pages/admin/roles/page"));
const StrategyDashboard = lazy(() => import("@/pages/admin/strategy/page"));
const AdminApprovals = lazy(() => import("@/pages/admin/approvals/page"));
const ResetPassword = lazy(() => import("@/pages/reset-password/page"));
import Layout from "@/components/feature/Layout";
import AuthGuard from "@/components/base/AuthGuard";
const BibleMbti = lazy(() => import("@/pages/bibleMbti/page"));
const BibleQuiz = lazy(() => import("@/pages/bibleQuiz/page"));
const BibleStreak = lazy(() => import("@/pages/bibleStreak/page"));
const BibleByAge = lazy(() => import("@/pages/bibleByAge/page"));
const FaithStorybook = lazy(() => import("@/pages/faithStorybook/page"));
const RepentanceJournal = lazy(() => import("@/pages/repentanceJournal/page"));
const FaithJournal = lazy(() => import("@/pages/faithJournal/page"));
const QandABoard = lazy(() => import("@/pages/qnaBoard/page"));
const MemoryBoard = lazy(() => import("@/pages/memoryBoard/page"));
const SongVoteBoard = lazy(() => import("@/pages/songVote/page"));
const PersonalSchedule = lazy(() => import("@/pages/personalSchedule/page"));
const PrayerPartner = lazy(() => import("@/pages/prayerPartner/page"));
const EventIdeas = lazy(() => import("@/pages/eventIdeas/page"));
const BibleMarathon = lazy(() => import("@/pages/bibleMarathon/page"));
const YearEndSummary = lazy(() => import("@/pages/yearEndSummary/page"));
const BucketListBoard = lazy(() => import("@/pages/bucketList/page"));
const PrayerRelay = lazy(() => import("@/pages/prayerRelay/page"));
const PdsPlanner = lazy(() => import("@/pages/pdsPlanner/page"));
const LeadershipDiary = lazy(() => import("@/pages/leadershipDiary/page"));
const AttendanceDashboard = lazy(() => import("@/pages/dashboard/attendance/page"));
const ToolsPage = lazy(() => import("@/pages/tools/page"));
const AttendanceAnalyticsPage = lazy(() => import("@/pages/dashboard/attendance/analytics/page"));
const AbsenceReasonsPage = lazy(() => import("@/pages/settings/absence-reasons/page"));
const AttendanceLocationPage = lazy(() => import("@/pages/settings/attendance-location/page"));
const ProfilePage = lazy(() => import("@/pages/profile/page"));
const TeacherDashboard = lazy(() => import("@/pages/teacherDashboard/page"));
const GanghakNewsList = lazy(() => import("@/pages/ganghakNews/page"));
const GanghakNewsDetail = lazy(() => import("@/pages/ganghakNews/detail/page"));
const GanghakNewsWrite = lazy(() => import("@/pages/ganghakNews/write/page"));
const GanghakNewsEdit = lazy(() => import("@/pages/ganghakNews/edit/page"));
const QuizManagePage = lazy(() => import("@/pages/teacherDashboard/quizManage/page"));
const QuoteManagePage = lazy(() => import("@/pages/teacherDashboard/quoteManage/page"));
const StorageCleanupPage = lazy(() => import("@/pages/admin/storageCleanup/page"));
const SuggestionsPage = lazy(() => import("@/pages/suggestions/page"));
const VisitationsPage = lazy(() => import("@/pages/visitations/page"));
const VisitationWrite = lazy(() => import("@/pages/visitations/write/page"));
const VisitationDetail = lazy(() => import("@/pages/visitations/detail/page"));
const MeetingsPage = lazy(() => import("@/pages/meetings/page"));
const MeetingWritePage = lazy(() => import("@/pages/meetings/write/page"));
const MeetingDetailPage = lazy(() => import("@/pages/meetings/detail/page"));
const MeetingEditPage = lazy(() => import("@/pages/meetings/edit/page"));
const MeetingCopilotPage = lazy(() => import("@/pages/meetingCopilot/page"));
const StudentCouncilCenter = lazy(() => import("@/pages/studentCouncilCenter/page"));
const MissionsPage = lazy(() => import("@/pages/missions/page"));
const MissionBoardPage = lazy(() => import("@/pages/missions/board/page"));
const MissionLeaderboardPage = lazy(() => import("@/pages/missions/leaderboard/page"));
const MissionWallPage = lazy(() => import("@/pages/missions/wall/page"));
const AttendanceBoard = lazy(() => import("@/pages/attendanceBoard/page"));

const pageFallback = (label = "로딩 중…") => (
  <div className="min-h-[40vh] flex items-center justify-center p-6 text-sm text-muted-foreground">
    {label}
  </div>
);

const withSuspense = (element: ReactNode) => (
  <Suspense fallback={pageFallback()}>{element}</Suspense>
);

const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      {
        path: "/",
        element: (
          <AuthGuard minRole="member">
            {withSuspense(<Home />)}
          </AuthGuard>
        ),
      },
      {
        path: "/tools",
        element: withSuspense(<ToolsPage />),
      },
      {
        path: "/bible-pick",
        element: withSuspense(<BiblePick />),
      },
      {
        path: "/bible-pick/history",
        element: withSuspense(<BiblePickHistory />),
      },
      {
        path: "/bible-mbti",
        element: withSuspense(<BibleMbti />),
      },
      {
        path: "/bible-quiz",
        element: withSuspense(<BibleQuiz />),
      },
      {
        path: "/games",
        element: withSuspense(<GameHub />),
      },
      {
        path: "/wolves-and-sheep",
        element: withSuspense(<WolvesAndSheep />),
      },
            // routes 배열에 추가 (wolves-and-sheep 라우트 아래)
      {
        path: "/pharisee",
        element: withSuspense(<Pharisee />),
      },
      {
        path: "/galilee-phone",
        element: withSuspense(<GalileePhone />),
      },
      {
        path: "/bible-streak",
        element: withSuspense(<BibleStreak />),
      },
      {
        path: "/bible-by-age",
        element: withSuspense(<BibleByAge />),
      },
      {
        path: "/prayer-relay",
        element: withSuspense(<PrayerRelay />),
      },
      {
        path: "/faith-storybook",
        element: withSuspense(<FaithStorybook />),
      },
      {
        path: "/repentance-journal",
        element: withSuspense(<RepentanceJournal />),
      },
      {
        path: "/faith-journal",
        element: withSuspense(<FaithJournal />),
      },
      {
        path: "/qna-board",
        element: withSuspense(<QandABoard />),
      },
      {
        path: "/memory-board",
        element: withSuspense(<MemoryBoard />),
      },
      {
        path: "/song-vote",
        element: withSuspense(<SongVoteBoard />),
      },
      {
        path: "/personal-schedule",
        element: withSuspense(<PersonalSchedule />),
      },
      {
        path: "/prayer-partner",
        element: withSuspense(<PrayerPartner />),
      },
      {
        path: "/event-ideas",
        element: withSuspense(<EventIdeas />),
      },
      {
        path: "/bible-marathon",
        element: withSuspense(<BibleMarathon />),
      },
      {
        path: "/year-end-summary",
        element: withSuspense(<YearEndSummary />),
      },
      {
        path: "/bucket-list",
        element: withSuspense(<BucketListBoard />),
      },
      {
        path: "/clubs",
        element: withSuspense(<Clubs />),
      },
      {
        path: "/clubs/:id",
        element: withSuspense(<ClubDetail />),
      },
      {
        path: "/clubs/:id/community",
        element: withSuspense(<ClubCommunity />),
      },
      {
        path: "/notices",
        element: withSuspense(<Notices />),
      },
      {
        path: "/notices/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<NoticeWrite />)}
          </AuthGuard>
        ),
      },
      {
        path: "/notices/:id/edit",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<NoticeEdit />)}
          </AuthGuard>
        ),
      },
      {
        path: "/notices/:id",
        element: withSuspense(<NoticeDetail />),
      },
      {
        path: "/schedule",
        element: withSuspense(<Schedule />),
      },
      {
        path: "/schedule/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<ScheduleWrite />)}
          </AuthGuard>
        ),
      },
      {
        path: "/schedule/:id/edit",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<ScheduleEdit />)}
          </AuthGuard>
        ),
      },
      {
        path: "/student-council-center",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<StudentCouncilCenter />)}
          </AuthGuard>
        ),
      },
      {
        path: "/dashboard",
        element: (
          <AuthGuard minRole="member">
            {withSuspense(<Dashboard />)}
          </AuthGuard>
        ),
      },
      {
        path: "/dashboard/attendance",
        element: (
          <AuthGuard minRole="member">
            {withSuspense(<AttendanceDashboard />)}
          </AuthGuard>
        ),
      },
      {
        path: "/dashboard/attendance/analytics",
        element: (
          <AuthGuard minRole="member">
            {withSuspense(<AttendanceAnalyticsPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/teacher-dashboard/quiz-manage",
        element: (
          <AuthGuard minRole="teacher">
            {withSuspense(<QuizManagePage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/teacher-dashboard/quote-manage",
        element: (
          <AuthGuard minRole="teacher">
            {withSuspense(<QuoteManagePage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/teacher-dashboard",
        element: (
          <AuthGuard minRole="teacher">
            {withSuspense(<TeacherDashboard />)}
          </AuthGuard>
        ),
      },
      {
        path: "/profile",
        element: (
          <AuthGuard minRole="member">
            {withSuspense(<ProfilePage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/settings/absence-reasons",
        element: (
          <AuthGuard minRole="chief">
            {withSuspense(<AbsenceReasonsPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/settings/attendance-location",
        element: (
          <AuthGuard minRole="teacher">
            {withSuspense(<AttendanceLocationPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/pds-planner",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<PdsPlanner />)}
          </AuthGuard>
        ),
      },
      {
        path: "/leadership-diary",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<LeadershipDiary />)}
          </AuthGuard>
        ),
      },
      {
        path: "/reports/weekly",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<WeeklyReports />)}
          </AuthGuard>
        ),
      },
      {
        path: "/reports/weekly/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<WeeklyReportWrite />)}
          </AuthGuard>
        ),
      },
      {
        path: "/reports/weekly/:id/edit",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<WeeklyReportEdit />)}
          </AuthGuard>
        ),
      },
      {
        path: "/reports/weekly/:id",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<WeeklyReportDetail />)}
          </AuthGuard>
        ),
      },
      {
        path: "/reports/growth",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<GrowthReports />)}
          </AuthGuard>
        ),
      },
      {
        path: "/reports/growth/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<GrowthReportWrite />)}
          </AuthGuard>
        ),
      },
      {
        path: "/reports/growth/:id/edit",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<GrowthReportEdit />)}
          </AuthGuard>
        ),
      },
      {
        path: "/reports/growth/:id",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<GrowthRecordDetail />)}
          </AuthGuard>
        ),
      },
      {
        path: "/reports/events",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<EventReports />)}
          </AuthGuard>
        ),
      },
      {
        path: "/reports/events/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<EventReportWrite />)}
          </AuthGuard>
        ),
      },
      {
        path: "/reports/events/:id/edit",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<EventReportEdit />)}
          </AuthGuard>
        ),
      },
      {
        path: "/reports/events/:id",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<EventReportDetail />)}
          </AuthGuard>
        ),
      },
      {
        path: "/reports/review",
        element: (
          <AuthGuard minRole="president">
            {withSuspense(<ReviewPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/admin/roles",
        element: (
          <AuthGuard minRole="chief">
            {withSuspense(<AdminRolesPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/admin/strategy",
        element: (
          <AuthGuard minRole="chief">
            {withSuspense(<StrategyDashboard />)}
          </AuthGuard>
        ),
      },
      {
        path: "/admin/approvals",
        element: (
          <AuthGuard minRole="teacher">
            {withSuspense(<AdminApprovals />)}
          </AuthGuard>
        ),
      },
      {
        path: "/admin/storage-cleanup",
        element: (
          <AuthGuard minRole="teacher">
            {withSuspense(<StorageCleanupPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/ganghak-news",
        element: withSuspense(<GanghakNewsList />),
      },
      {
        path: "/ganghak-news/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<GanghakNewsWrite />)}
          </AuthGuard>
        ),
      },
      {
        path: "/ganghak-news/:id/edit",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<GanghakNewsEdit />)}
          </AuthGuard>
        ),
      },
      {
        path: "/ganghak-news/:id",
        element: withSuspense(<GanghakNewsDetail />),
      },
      {
        path: "/suggestions",
        element: (
          <AuthGuard minRole="member">
            {withSuspense(<SuggestionsPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/visitations",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<VisitationsPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/visitations/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<VisitationWrite />)}
          </AuthGuard>
        ),
      },
      {
        path: "/visitations/:id",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<VisitationDetail />)}
          </AuthGuard>
        ),
      },
      {
        path: "/meetings",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<MeetingsPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/meeting-copilot",
        element: (
          <AuthGuard minRole="member">
            {withSuspense(<MeetingCopilotPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/meetings/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<MeetingWritePage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/meetings/:id",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<MeetingDetailPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/meetings/:id/edit",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<MeetingEditPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/missions",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            {withSuspense(<MissionsPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/missions/leaderboard",
        element: (
          <AuthGuard minRole="member">
            {withSuspense(<MissionLeaderboardPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/missions/board",
        element: (
          <AuthGuard minRole="member">
            {withSuspense(<MissionBoardPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/missions/wall",
        element: (
          <AuthGuard minRole="member">
            {withSuspense(<MissionWallPage />)}
          </AuthGuard>
        ),
      },
      {
        path: "/attendance-board",
        element: (
          <AuthGuard minRole="member">
            {withSuspense(<AttendanceBoard />)}
          </AuthGuard>
        ),
      },
      {
        path: "*",
        element: withSuspense(<NotFound />),
      },
    ],
  },
  {
    path: "/login",
    element: withSuspense(<Login />),
  },
  {
    path: "/setup",
    element: withSuspense(<Setup />),
  },
  {
    path: "/reset-password",
    element: withSuspense(<ResetPassword />),
  },
];

export default routes;

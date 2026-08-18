import type { RouteObject } from "react-router-dom";
import WolvesAndSheep from "@/pages/wolvesAndSheep/page";
import GameHub from "@/pages/gameHub/page";
// import 추가 (WolvesAndSheep import 아래)
import Pharisee from "@/games/pharisee/page";
import GalileePhone from "@/games/galilee-phone/page";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/home/page";
import BiblePick from "@/pages/biblePick/page";
import BiblePickHistory from "@/pages/biblePick/history/page";
import Clubs from "@/pages/clubs/page";
import ClubDetail from "@/pages/clubs/detail/page";
import ClubCommunity from "@/pages/clubs/community/page";
import Notices from "@/pages/notices/page";
import NoticeWrite from "@/pages/notices/write/page";
import NoticeDetail from "@/pages/notices/detail/page";
import NoticeEdit from "@/pages/notices/edit/page";
import Schedule from "@/pages/schedule/page";
import ScheduleWrite from "@/pages/schedule/write/page";
import ScheduleEdit from "@/pages/schedule/edit/page";
import Login from "@/pages/login/page";
import Setup from "@/pages/setup/page";
import Dashboard from "@/pages/dashboard/page";
import WeeklyReports from "@/pages/reports/weekly/page";
import WeeklyReportWrite from "@/pages/reports/weekly/write/page";
import WeeklyReportDetail from "@/pages/reports/weekly/detail/page";
import WeeklyReportEdit from "@/pages/reports/weekly/edit/page";
import GrowthReports from "@/pages/reports/growth/page";
import GrowthReportWrite from "@/pages/reports/growth/write/page";
import GrowthRecordDetail from "@/pages/reports/growth/detail/page";
import GrowthReportEdit from "@/pages/reports/growth/edit/page";
import EventReports from "@/pages/reports/events/page";
import EventReportWrite from "@/pages/reports/events/write/page";
import EventReportDetail from "@/pages/reports/events/detail/page";
import EventReportEdit from "@/pages/reports/events/edit/page";
import ReviewPage from "@/pages/reports/review/page";
import AdminRolesPage from "@/pages/admin/roles/page";
import StrategyDashboard from "@/pages/admin/strategy/page";
import AdminApprovals from "@/pages/admin/approvals/page";
import ResetPassword from "@/pages/reset-password/page";
import Layout from "@/components/feature/Layout";
import AuthGuard from "@/components/base/AuthGuard";
import BibleMbti from "@/pages/bibleMbti/page";
import BibleQuiz from "@/pages/bibleQuiz/page";
import BibleStreak from "@/pages/bibleStreak/page";
import BibleByAge from "@/pages/bibleByAge/page";
import FaithStorybook from "@/pages/faithStorybook/page";
import RepentanceJournal from "@/pages/repentanceJournal/page";
import FaithJournal from "@/pages/faithJournal/page";
import QandABoard from "@/pages/qnaBoard/page";
import MemoryBoard from "@/pages/memoryBoard/page";
import SongVoteBoard from "@/pages/songVote/page";
import SermonHighlight from "@/pages/sermonHighlight/page";
import PersonalSchedule from "@/pages/personalSchedule/page";
import PrayerPartner from "@/pages/prayerPartner/page";
import EventIdeas from "@/pages/eventIdeas/page";
import BibleMarathon from "@/pages/bibleMarathon/page";
import YearEndSummary from "@/pages/yearEndSummary/page";
import BucketListBoard from "@/pages/bucketList/page";
import PrayerRelay from "@/pages/prayerRelay/page";
import PdsPlanner from "@/pages/pdsPlanner/page";
import LeadershipDiary from "@/pages/leadershipDiary/page";
import PastoralLetter from "@/pages/pastoralLetter/page";
import AttendanceDashboard from "@/pages/dashboard/attendance/page";
import ToolsPage from "@/pages/tools/page";
import AttendanceAnalyticsPage from "@/pages/dashboard/attendance/analytics/page";
import AbsenceReasonsPage from "@/pages/settings/absence-reasons/page";
import AttendanceLocationPage from "@/pages/settings/attendance-location/page";
import ProfilePage from "@/pages/profile/page";
import TeacherDashboard from "@/pages/teacherDashboard/page";
import GanghakNewsList from "@/pages/ganghakNews/page";
import GanghakNewsDetail from "@/pages/ganghakNews/detail/page";
import GanghakNewsWrite from "@/pages/ganghakNews/write/page";
import GanghakNewsEdit from "@/pages/ganghakNews/edit/page";
import QuizManagePage from "@/pages/teacherDashboard/quizManage/page";
import QuoteManagePage from "@/pages/teacherDashboard/quoteManage/page";
import StorageCleanupPage from "@/pages/admin/storageCleanup/page";
import SuggestionsPage from "@/pages/suggestions/page";
import VisitationsPage from "@/pages/visitations/page";
import VisitationWrite from "@/pages/visitations/write/page";
import VisitationDetail from "@/pages/visitations/detail/page";
import MeetingsPage from "@/pages/meetings/page";
import MeetingWritePage from "@/pages/meetings/write/page";
import MeetingDetailPage from "@/pages/meetings/detail/page";
import MeetingEditPage from "@/pages/meetings/edit/page";
import MeetingCopilotPage from "@/pages/meetingCopilot/page";
import MissionsPage from "@/pages/missions/page";
import MissionBoardPage from "@/pages/missions/board/page";
import MissionLeaderboardPage from "@/pages/missions/leaderboard/page";
import MissionWallPage from "@/pages/missions/wall/page";
import AttendanceBoard from "@/pages/attendanceBoard/page";

const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      {
        path: "/",
        element: (
          <AuthGuard minRole="member">
            <Home />
          </AuthGuard>
        ),
      },
      {
        path: "/tools",
        element: <ToolsPage />,
      },
      {
        path: "/bible-pick",
        element: <BiblePick />,
      },
      {
        path: "/bible-pick/history",
        element: <BiblePickHistory />,
      },
      {
        path: "/bible-mbti",
        element: <BibleMbti />,
      },
      {
        path: "/bible-quiz",
        element: <BibleQuiz />,
      },
      {
        path: "/games",
        element: <GameHub />,
      },
      {
        path: "/wolves-and-sheep",
        element: <WolvesAndSheep />,
      },
            // routes 배열에 추가 (wolves-and-sheep 라우트 아래)
      {
        path: "/pharisee",
        element: <Pharisee />,
      },
      {
        path: "/galilee-phone",
        element: <GalileePhone />,
      },
      {
        path: "/bible-streak",
        element: <BibleStreak />,
      },
      {
        path: "/bible-by-age",
        element: <BibleByAge />,
      },
      {
        path: "/prayer-relay",
        element: <PrayerRelay />,
      },
      {
        path: "/faith-storybook",
        element: <FaithStorybook />,
      },
      {
        path: "/repentance-journal",
        element: <RepentanceJournal />,
      },
      {
        path: "/faith-journal",
        element: <FaithJournal />,
      },
      {
        path: "/qna-board",
        element: <QandABoard />,
      },
      {
        path: "/memory-board",
        element: <MemoryBoard />,
      },
      {
        path: "/song-vote",
        element: <SongVoteBoard />,
      },
      {
        path: "/sermon-highlight",
        element: <SermonHighlight />,
      },
      {
        path: "/personal-schedule",
        element: <PersonalSchedule />,
      },
      {
        path: "/prayer-partner",
        element: <PrayerPartner />,
      },
      {
        path: "/event-ideas",
        element: <EventIdeas />,
      },
      {
        path: "/bible-marathon",
        element: <BibleMarathon />,
      },
      {
        path: "/year-end-summary",
        element: <YearEndSummary />,
      },
      {
        path: "/bucket-list",
        element: <BucketListBoard />,
      },
      {
        path: "/clubs",
        element: <Clubs />,
      },
      {
        path: "/clubs/:id",
        element: <ClubDetail />,
      },
      {
        path: "/clubs/:id/community",
        element: <ClubCommunity />,
      },
      {
        path: "/notices",
        element: <Notices />,
      },
      {
        path: "/notices/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <NoticeWrite />
          </AuthGuard>
        ),
      },
      {
        path: "/notices/:id/edit",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <NoticeEdit />
          </AuthGuard>
        ),
      },
      {
        path: "/notices/:id",
        element: <NoticeDetail />,
      },
      {
        path: "/schedule",
        element: <Schedule />,
      },
      {
        path: "/schedule/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <ScheduleWrite />
          </AuthGuard>
        ),
      },
      {
        path: "/schedule/:id/edit",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <ScheduleEdit />
          </AuthGuard>
        ),
      },
      {
        path: "/dashboard",
        element: (
          <AuthGuard minRole="member">
            <Dashboard />
          </AuthGuard>
        ),
      },
      {
        path: "/dashboard/attendance",
        element: (
          <AuthGuard minRole="member">
            <AttendanceDashboard />
          </AuthGuard>
        ),
      },
      {
        path: "/dashboard/attendance/analytics",
        element: (
          <AuthGuard minRole="member">
            <AttendanceAnalyticsPage />
          </AuthGuard>
        ),
      },
      {
        path: "/teacher-dashboard/quiz-manage",
        element: (
          <AuthGuard minRole="teacher">
            <QuizManagePage />
          </AuthGuard>
        ),
      },
      {
        path: "/teacher-dashboard/quote-manage",
        element: (
          <AuthGuard minRole="teacher">
            <QuoteManagePage />
          </AuthGuard>
        ),
      },
      {
        path: "/teacher-dashboard",
        element: (
          <AuthGuard minRole="teacher">
            <TeacherDashboard />
          </AuthGuard>
        ),
      },
      {
        path: "/profile",
        element: (
          <AuthGuard minRole="member">
            <ProfilePage />
          </AuthGuard>
        ),
      },
      {
        path: "/settings/absence-reasons",
        element: (
          <AuthGuard minRole="chief">
            <AbsenceReasonsPage />
          </AuthGuard>
        ),
      },
      {
        path: "/settings/attendance-location",
        element: (
          <AuthGuard minRole="teacher">
            <AttendanceLocationPage />
          </AuthGuard>
        ),
      },
      {
        path: "/pds-planner",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <PdsPlanner />
          </AuthGuard>
        ),
      },
      {
        path: "/leadership-diary",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <LeadershipDiary />
          </AuthGuard>
        ),
      },
      {
        path: "/pastoral-letter",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <PastoralLetter />
          </AuthGuard>
        ),
      },
      {
        path: "/reports/weekly",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <WeeklyReports />
          </AuthGuard>
        ),
      },
      {
        path: "/reports/weekly/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <WeeklyReportWrite />
          </AuthGuard>
        ),
      },
      {
        path: "/reports/weekly/:id/edit",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <WeeklyReportEdit />
          </AuthGuard>
        ),
      },
      {
        path: "/reports/weekly/:id",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <WeeklyReportDetail />
          </AuthGuard>
        ),
      },
      {
        path: "/reports/growth",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <GrowthReports />
          </AuthGuard>
        ),
      },
      {
        path: "/reports/growth/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <GrowthReportWrite />
          </AuthGuard>
        ),
      },
      {
        path: "/reports/growth/:id/edit",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <GrowthReportEdit />
          </AuthGuard>
        ),
      },
      {
        path: "/reports/growth/:id",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <GrowthRecordDetail />
          </AuthGuard>
        ),
      },
      {
        path: "/reports/events",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <EventReports />
          </AuthGuard>
        ),
      },
      {
        path: "/reports/events/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <EventReportWrite />
          </AuthGuard>
        ),
      },
      {
        path: "/reports/events/:id/edit",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <EventReportEdit />
          </AuthGuard>
        ),
      },
      {
        path: "/reports/events/:id",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <EventReportDetail />
          </AuthGuard>
        ),
      },
      {
        path: "/reports/review",
        element: (
          <AuthGuard minRole="president">
            <ReviewPage />
          </AuthGuard>
        ),
      },
      {
        path: "/admin/roles",
        element: (
          <AuthGuard minRole="chief">
            <AdminRolesPage />
          </AuthGuard>
        ),
      },
      {
        path: "/admin/strategy",
        element: (
          <AuthGuard minRole="chief">
            <StrategyDashboard />
          </AuthGuard>
        ),
      },
      {
        path: "/admin/approvals",
        element: (
          <AuthGuard minRole="teacher">
            <AdminApprovals />
          </AuthGuard>
        ),
      },
      {
        path: "/admin/storage-cleanup",
        element: (
          <AuthGuard minRole="teacher">
            <StorageCleanupPage />
          </AuthGuard>
        ),
      },
      {
        path: "/ganghak-news",
        element: <GanghakNewsList />,
      },
      {
        path: "/ganghak-news/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <GanghakNewsWrite />
          </AuthGuard>
        ),
      },
      {
        path: "/ganghak-news/:id/edit",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <GanghakNewsEdit />
          </AuthGuard>
        ),
      },
      {
        path: "/ganghak-news/:id",
        element: <GanghakNewsDetail />,
      },
      {
        path: "/suggestions",
        element: (
          <AuthGuard minRole="member">
            <SuggestionsPage />
          </AuthGuard>
        ),
      },
      {
        path: "/visitations",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <VisitationsPage />
          </AuthGuard>
        ),
      },
      {
        path: "/visitations/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <VisitationWrite />
          </AuthGuard>
        ),
      },
      {
        path: "/visitations/:id",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <VisitationDetail />
          </AuthGuard>
        ),
      },
      {
        path: "/meetings",
        element: (
          <AuthGuard minRole="member">
            <MeetingsPage />
          </AuthGuard>
        ),
      },
      {
        path: "/meeting-copilot",
        element: (
          <AuthGuard minRole="member">
            <MeetingCopilotPage />
          </AuthGuard>
        ),
      },
      {
        path: "/meetings/write",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <MeetingWritePage />
          </AuthGuard>
        ),
      },
      {
        path: "/meetings/:id",
        element: (
          <AuthGuard minRole="member">
            <MeetingDetailPage />
          </AuthGuard>
        ),
      },
      {
        path: "/meetings/:id/edit",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <MeetingEditPage />
          </AuthGuard>
        ),
      },
      {
        path: "/missions",
        element: (
          <AuthGuard minRole="assistant_zone_leader">
            <MissionsPage />
          </AuthGuard>
        ),
      },
      {
        path: "/missions/leaderboard",
        element: (
          <AuthGuard minRole="member">
            <MissionLeaderboardPage />
          </AuthGuard>
        ),
      },
      {
        path: "/missions/board",
        element: (
          <AuthGuard minRole="member">
            <MissionBoardPage />
          </AuthGuard>
        ),
      },
      {
        path: "/missions/wall",
        element: (
          <AuthGuard minRole="member">
            <MissionWallPage />
          </AuthGuard>
        ),
      },
      {
        path: "/attendance-board",
        element: (
          <AuthGuard minRole="member">
            <AttendanceBoard />
          </AuthGuard>
        ),
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/setup",
    element: <Setup />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
  },
];

export default routes;
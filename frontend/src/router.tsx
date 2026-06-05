import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { LoginPage }      from '@/features/auth/LoginPage';
import { DashboardPage }  from '@/pages/DashboardPage';
import { ProfilePage }    from '@/pages/ProfilePage';
import { TeamPage }       from '@/pages/TeamPage';
import { TeamsListPage }  from '@/pages/TeamsListPage';
import { RatingPage }     from '@/pages/RatingPage';
import { ChallengesPage } from '@/pages/ChallengesPage';
import { EventsPage }     from '@/pages/EventsPage';
import { ToolsPage }      from '@/pages/ToolsPage';
import { AdminPage }      from '@/pages/AdminPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/',            element: <DashboardPage /> },
          { path: '/profile',     element: <ProfilePage /> },
          { path: '/team',        element: <TeamPage /> },
          { path: '/teams',       element: <TeamsListPage /> },
          { path: '/rating',      element: <RatingPage /> },
          { path: '/challenges',  element: <ChallengesPage /> },
          { path: '/events',      element: <EventsPage /> },
          { path: '/community',   element: <Navigate to="/" replace /> },
          { path: '/tools',       element: <ToolsPage /> },
          {
            path: '/admin',
            element: <ProtectedRoute allowedRoles={['organizer']} />,
            children: [{ index: true, element: <AdminPage /> }],
          },
        ],
      },
    ],
  },
]);

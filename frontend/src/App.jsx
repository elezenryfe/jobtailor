import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProfilePage from './pages/ProfilePage';
import BoardPage from './pages/BoardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import GapAnalyzerPage from './pages/GapAnalyzerPage';
import InterviewPrepPage from './pages/InterviewPrepPage';
import JobSearchPage from './pages/JobSearchPage';
import RequireAuth from './components/RequireAuth';
import Layout from './components/Layout';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/board" element={<BoardPage />} />
        <Route path="/job-search" element={<JobSearchPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/gap-analyzer" element={<GapAnalyzerPage />} />
        <Route path="/interview-prep" element={<InterviewPrepPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
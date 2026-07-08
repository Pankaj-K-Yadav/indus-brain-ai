import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Application root. Routes the enterprise dashboard: an analytics overview,
 * document management, and the AI feature pages. Page modules are code-split
 * (React.lazy) so each route is fetched on demand, keeping the initial bundle small.
 */
const AnalyticsDashboardPage = lazy(() =>
  import('@/pages/AnalyticsDashboardPage').then((m) => ({ default: m.AnalyticsDashboardPage })),
);
const DocumentsPage = lazy(() =>
  import('@/pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
);
const KnowledgeAssistantPage = lazy(() =>
  import('@/pages/KnowledgeAssistantPage').then((m) => ({ default: m.KnowledgeAssistantPage })),
);
const RootCauseAnalysisPage = lazy(() =>
  import('@/pages/RootCauseAnalysisPage').then((m) => ({ default: m.RootCauseAnalysisPage })),
);
const CompliancePage = lazy(() =>
  import('@/pages/CompliancePage').then((m) => ({ default: m.CompliancePage })),
);
const LessonsLearnedPage = lazy(() =>
  import('@/pages/LessonsLearnedPage').then((m) => ({ default: m.LessonsLearnedPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

function RouteFallback() {
  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<AnalyticsDashboardPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/knowledge" element={<KnowledgeAssistantPage />} />
          <Route path="/rca" element={<RootCauseAnalysisPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/lessons" element={<LessonsLearnedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

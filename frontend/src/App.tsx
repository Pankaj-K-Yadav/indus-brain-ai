import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnalyticsDashboardPage } from '@/pages/AnalyticsDashboardPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { KnowledgeAssistantPage } from '@/pages/KnowledgeAssistantPage';

/**
 * Application root. Routes the enterprise dashboard: an analytics overview,
 * document management, and the AI knowledge assistant.
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AnalyticsDashboardPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/knowledge" element={<KnowledgeAssistantPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

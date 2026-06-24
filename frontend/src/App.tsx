import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DocumentsPage } from '@/pages/DocumentsPage';

/**
 * Application root. Routes the enterprise dashboard. Documents is the first
 * business feature; additional routes are added as features land.
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/documents" replace />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="*" element={<Navigate to="/documents" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthGate from "@/components/AuthGate";
import PageViewTracker from "@/components/PageViewTracker";
import RequireAuth from "@/components/RequireAuth";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorPage from "@/pages/ErrorPage";
import HomePage from "@/pages/HomePage";
import ProcessingPage from "@/pages/ProcessingPage";
import ResultPage from "@/pages/ResultPage";
import SharePage from "@/pages/SharePage";
import UploadPage from "@/pages/UploadPage";

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <PageViewTracker />
        <AuthGate>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/upload"
            element={
              <RequireAuth>
                <UploadPage />
              </RequireAuth>
            }
          />
          <Route
            path="/processing/:jobId"
            element={
              <RequireAuth>
                <ProcessingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/result"
            element={
              <RequireAuth>
                <ResultPage />
              </RequireAuth>
            }
          />
          <Route
            path="/share"
            element={
              <RequireAuth>
                <SharePage />
              </RequireAuth>
            }
          />
          <Route path="/error" element={<ErrorPage />} />
          <Route path="*" element={<Navigate to="/error" replace />} />
        </Routes>
        </AuthGate>
      </AuthProvider>
    </BrowserRouter>
  );
}

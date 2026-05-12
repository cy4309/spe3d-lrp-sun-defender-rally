import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorPage from "@/pages/ErrorPage";
import HomePage from "@/pages/HomePage";
import ProcessingPage from "@/pages/ProcessingPage";
import ResultPage from "@/pages/ResultPage";
import UploadPage from "@/pages/UploadPage";

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/processing/:jobId" element={<ProcessingPage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/error" element={<ErrorPage />} />
          <Route path="*" element={<Navigate to="/error" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

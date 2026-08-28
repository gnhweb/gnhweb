import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import ErrorBoundary from "@/components/base/ErrorBoundary";
import ScrollToTop from "@/components/base/ScrollToTop";
import PrayerRelayAuthorDeleteBridge from "@/components/base/PrayerRelayAuthorDeleteBridge";

function App() {
  return (
    <ThemeProvider>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <ErrorBoundary>
            <BrowserRouter basename={__BASE_PATH__}>
              <ScrollToTop />
              <PrayerRelayAuthorDeleteBridge />
              <AppRoutes />
            </BrowserRouter>
          </ErrorBoundary>
        </AuthProvider>
      </I18nextProvider>
    </ThemeProvider>
  );
}

export default App;

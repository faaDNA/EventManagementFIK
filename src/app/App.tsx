import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./components/auth-context";
import { ThemeProvider } from "./components/theme-context";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}

import { Moon, Sun } from "lucide-react";
import { useThemeContext } from "@/shared/context/ThemeProvider";
import Button from "./Button";

type ThemeToggleProps = {
  className?: string;
};

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeContext();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={isDark ? "라이트 모드" : "다크 모드"}
      onClick={toggleTheme}
      className={className}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

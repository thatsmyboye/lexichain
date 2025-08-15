import { useNavigate, useSearchParams } from "react-router-dom";
import AuthForm from "@/components/auth/AuthForm";

const AuthPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const mode = searchParams.get("mode") as "login" | "signup" | null;

  const handleBackToTitle = () => {
    navigate("/");
  };

  return <AuthForm onBackToTitle={handleBackToTitle} initialMode={mode || "signup"} />;
};

export default AuthPage;
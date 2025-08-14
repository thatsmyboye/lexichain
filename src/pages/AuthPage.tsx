import { useNavigate } from "react-router-dom";
import AuthForm from "@/components/auth/AuthForm";

const AuthPage = () => {
  const navigate = useNavigate();

  const handleBackToTitle = () => {
    navigate("/");
  };

  return <AuthForm onBackToTitle={handleBackToTitle} />;
};

export default AuthPage;
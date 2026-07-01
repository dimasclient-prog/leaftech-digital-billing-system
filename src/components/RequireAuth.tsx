import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated } from "@/lib/auth";

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
};

export default RequireAuth;
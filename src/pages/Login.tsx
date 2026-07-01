import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Lock, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { verifyCredentials, signIn } from "@/lib/auth";

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate a tiny delay so bcrypt compare feels responsive
    await new Promise((r) => setTimeout(r, 150));
    if (verifyCredentials(username, password)) {
      signIn(username);
      toast.success("Login berhasil");
      navigate("/", { replace: true });
    } else {
      toast.error("Username atau password salah");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid place-items-center bg-gradient-to-br from-background via-background to-accent/30 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold leading-tight">Leaftech Billing System</p>
            <p className="text-xs text-muted-foreground">Sign in to continue</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="dimas"
                className="pl-9"
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Sign in
          </Button>
        </form>

        <p className="text-[11px] text-muted-foreground text-center mt-6">
          Protected area — akses hanya untuk owner agency.
        </p>
      </div>
    </div>
  );
};

export default Login;
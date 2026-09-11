import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Lock, Mail, Phone, User } from "lucide-react";
import Logo from "@/assets/betnexa official logo .jpeg";
import { useUserManagement } from "@/context/UserManagementContext";
import { useUser } from "@/context/UserContext";
import { useBets } from "@/context/BetContext";
import { isCanonicalKenyanPhone } from "@/lib/phone";

export default function Signup() {
  const navigate = useNavigate();
  const { users, addUser } = useUserManagement();
  const { login, signupWithSupabase } = useUser();
  const { syncBalance } = useBets();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    } else if (users.some((u) => u.email === formData.email)) {
      newErrors.email = "Email already registered";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!isCanonicalKenyanPhone(formData.phone)) {
      newErrors.phone = "Use exactly 10 digits starting with 07 or 01";
    } else if (users.some((u) => u.phone === formData.phone)) {
      newErrors.phone = "Phone number already registered";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (!/^\d{4}$/.test(formData.password)) {
      newErrors.password = "Password must be exactly 4 digits";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // First try to save to Supabase database
      const newUser = await signupWithSupabase({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });

      if (newUser) {
        // Successfully registered in database with session created
        // Also add to local context for immediate use
        const localUser = {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          password: newUser.password,
          username: newUser.username,
          verified: newUser.verified,
          level: newUser.level,
          joinDate: newUser.joinDate,
          totalBets: newUser.totalBets,
          totalWinnings: newUser.totalWinnings,
          accountBalance: newUser.accountBalance,
          withdrawalActivated: newUser.withdrawalActivated,
          withdrawalActivationDate: newUser.withdrawalActivationDate,
        };
        addUser(localUser);
        syncBalance(newUser.accountBalance);

        setSuccess(true);
        setIsSubmitting(false);

        setTimeout(() => {
          // Restore pending picks from URL if they exist
          try {
            const pendingPicks = sessionStorage.getItem("pendingPicks");
            if (pendingPicks) {
              navigate(`/?picks=${pendingPicks}`);
              sessionStorage.removeItem("pendingPicks");
            } else {
              navigate("/");
            }
          } catch (error) {
            navigate("/");
          }
        }, 2000);
      } else {
        // Fallback to local registration if database fails
        console.warn('Database signup failed, using local registration');
        const localUser = {
          id: `user${users.length + 1}`,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          username: formData.name
            .toLowerCase()
            .replace(/\s+/g, "_")
            .substring(0, 20),
          verified: false,
          level: "Bronze Member",
          joinDate: new Date().toISOString().split("T")[0],
          totalBets: 0,
          totalWinnings: 0,
          accountBalance: 0,
          withdrawalActivated: false,
          withdrawalActivationDate: null,
        };

        addUser(localUser);
        login(localUser);
        syncBalance(0);

        setSuccess(true);
        setIsSubmitting(false);

        setTimeout(() => {
          // Restore pending picks from URL if they exist
          try {
            const pendingPicks = sessionStorage.getItem("pendingPicks");
            if (pendingPicks) {
              navigate(`/?picks=${pendingPicks}`);
              sessionStorage.removeItem("pendingPicks");
            } else {
              navigate("/");
            }
          } catch (error) {
            navigate("/");
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Signup error:', error);
      setErrors({
        form: 'Signup failed. Please try again.',
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2 w-fit cursor-pointer">
            <img src={Logo} alt="BETNEXA Logo" className="h-10 w-10 rounded-lg app-logo" />
            <span className="font-display text-lg font-bold tracking-wider text-foreground">
              BET<span className="text-primary">NEXA</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md border-primary/30 bg-card p-8 neon-border">
          <div className="mb-8 text-center">
            <h1 className="font-display text-2xl font-bold text-foreground">Create Account</h1>
            <p className="mt-2 text-sm text-muted-foreground">Join BETNEXA and start betting today</p>
          </div>

          {success ? (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
              <p className="font-medium text-green-600">Account Created Successfully!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Redirecting to login page...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10"
                  />
                </div>
                {errors.name && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    {errors.name}
                  </div>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-medium text-foreground">Email Address</label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10"
                  />
                </div>
                {errors.email && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email}
                  </div>
                )}
              </div>

              {/* Phone Number */}
              <div>
                <label className="text-sm font-medium text-foreground">Phone Number</label>
                <div className="relative mt-1.5">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="e.g., 254712345678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="pl-10"
                  />
                </div>
                {errors.phone && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    {errors.phone}
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="text-sm font-medium text-foreground">Password (4 Digits)</label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Enter 4-digit password"
                    inputMode="numeric"
                    maxLength={4}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value.replace(/\D/g, "") })}
                    className="pl-10"
                  />
                </div>
                {errors.password && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    {errors.password}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-sm font-medium text-foreground">Confirm Password</label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Re-enter your password"
                    inputMode="numeric"
                    maxLength={4}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value.replace(/\D/g, "") })}
                    className="pl-10"
                  />
                </div>
                {errors.confirmPassword && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />
                    {errors.confirmPassword}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="hero"
                className="w-full mt-6"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
          )}

          {/* Login Link */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Login here
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

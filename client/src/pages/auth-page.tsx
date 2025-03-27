import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/components/auth/AuthContext";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  const handleSendCode = async () => {
    // Validate email
    if (!email.trim()) {
      toast({
        title: "Error",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    // For now, only allow owner's email
    if (email.toLowerCase() !== "al_razvan@yahoo.com") {
      toast({
        title: "Access Denied",
        description: "This application is restricted to authorized users only.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    
    // Simulate sending verification code
    setTimeout(() => {
      setIsSending(false);
      setIsCodeSent(true);
      toast({
        title: "Verification Code Sent",
        description: "A verification code has been sent to your email.",
      });
    }, 1500);
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter the verification code.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);

    // Simulate verification (accept any code for now)
    setTimeout(() => {
      setIsVerifying(false);
      login();
      toast({
        title: "Success",
        description: "You have been logged in successfully.",
      });
      setLocation("/");
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full">
        {/* Login Form */}
        <Card className="w-full shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">DLZZ.pro - Link Tracker</CardTitle>
            <CardDescription>
              {isCodeSent 
                ? "Enter the verification code sent to your email" 
                : "Sign in to access your link tracking dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isCodeSent ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="Enter code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                  />
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <div className="w-full">
              {!isCodeSent ? (
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                  onClick={handleSendCode}
                  disabled={isSending}
                >
                  {isSending ? "Sending..." : "Send Verification Code"}
                </Button>
              ) : (
                <div className="space-y-2 w-full">
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                    onClick={handleVerifyCode}
                    disabled={isVerifying}
                  >
                    {isVerifying ? "Verifying..." : "Verify Code"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full" 
                    onClick={() => setIsCodeSent(false)}
                    disabled={isVerifying}
                  >
                    Back to Email
                  </Button>
                </div>
              )}
            </div>
          </CardFooter>
        </Card>

        {/* Hero Section */}
        <div className="hidden md:flex flex-col justify-center p-6 bg-blue-600 text-white rounded-xl shadow-lg">
          <h1 className="text-3xl font-bold mb-6">Link Tracking Made Simple</h1>
          <ul className="space-y-4">
            <li className="flex items-start">
              <svg className="h-6 w-6 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Generate short, professional tracking links in seconds</span>
            </li>
            <li className="flex items-start">
              <svg className="h-6 w-6 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Track product popularity, clicks, and geography</span>
            </li>
            <li className="flex items-start">
              <svg className="h-6 w-6 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Bulk link conversion with automatic platform detection</span>
            </li>
            <li className="flex items-start">
              <svg className="h-6 w-6 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Rich social media preview cards</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
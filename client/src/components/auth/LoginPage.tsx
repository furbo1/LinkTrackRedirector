import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Fixed admin email (in a real app, this would be server-side)
const ADMIN_EMAIL = "al_razvan@yahoo.com";

export default function LoginPage({ onSuccessfulLogin }: { onSuccessfulLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const { toast } = useToast();

  const handleSubmitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Check if email is the admin email
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      // Generate a random 6-digit verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(code);
      
      // Simulate sending email
      setTimeout(() => {
        setVerificationCodeSent(true);
        setIsLoading(false);
        toast({
          title: "Verification code sent",
          description: `The code has been sent to ${email}. In a real implementation, you would receive an email with code: ${code}`,
        });
      }, 1500);
    } else {
      setTimeout(() => {
        setIsLoading(false);
        toast({
          title: "Invalid email",
          description: "Sorry, this email is not authorized to access the dashboard.",
          variant: "destructive",
        });
      }, 1000);
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Check if the verification code matches
    setTimeout(() => {
      if (verificationCode === generatedCode) {
        toast({
          title: "Login successful",
          description: "You have been successfully logged in.",
        });
        onSuccessfulLogin();
      } else {
        setIsLoading(false);
        toast({
          title: "Invalid code",
          description: "The verification code is incorrect. Please try again.",
          variant: "destructive",
        });
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Dashboard Login</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please enter your email to access the link tracking dashboard
          </p>
          <div className="mt-4 flex justify-center">
            <img 
              src="/logo.svg" 
              alt="dlzz.pro" 
              className="h-12 w-auto"
              onError={(e) => e.currentTarget.style.display = 'none'}
            />
          </div>
        </div>

        {!verificationCodeSent ? (
          <form className="mt-8 space-y-6" onSubmit={handleSubmitEmail}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <Label htmlFor="email-address" className="sr-only">
                  Email address
                </Label>
                <Input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <Button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                disabled={isLoading}
              >
                {isLoading ? "Sending code..." : "Continue"}
              </Button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyCode}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <Label htmlFor="verification-code" className="sr-only">
                  Verification Code
                </Label>
                <Input
                  id="verification-code"
                  name="code"
                  type="text"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => setVerificationCodeSent(false)}
                  className="font-medium text-primary-600 hover:text-primary-500"
                >
                  Use a different email
                </button>
              </div>
              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => {
                    // Generate a new code and simulate resending
                    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
                    setGeneratedCode(newCode);
                    toast({
                      title: "New code sent",
                      description: `A new verification code has been sent to your email. For demo purposes: ${newCode}`,
                    });
                  }}
                  className="font-medium text-primary-600 hover:text-primary-500"
                >
                  Resend code
                </button>
              </div>
            </div>

            <div>
              <Button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                disabled={isLoading}
              >
                {isLoading ? "Verifying..." : "Login"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
import { Package, ShoppingBag } from "lucide-react";

type PlatformIconProps = {
  platform: string;
  size?: "small" | "medium" | "large";
  className?: string;
};

export function PlatformIcon({ platform, size = "medium", className = "" }: PlatformIconProps) {
  const sizeClasses = {
    small: "h-6 w-6 flex-shrink-0 rounded-full flex items-center justify-center",
    medium: "h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center",
    large: "h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center",
  };

  const textSizeClasses = {
    small: "text-xs font-medium",
    medium: "text-sm font-medium",
    large: "text-base font-medium",
  };

  if (platform === "temu") {
    return (
      <div className={`${sizeClasses[size]} bg-orange-100 ${className}`}>
        <span className={`${textSizeClasses[size]} text-orange-800`}>T</span>
      </div>
    );
  }

  if (platform === "amazon") {
    return (
      <div className={`${sizeClasses[size]} bg-yellow-100 ${className}`}>
        <span className={`${textSizeClasses[size]} text-yellow-800`}>A</span>
      </div>
    );
  }

  // Default icon for other platforms
  return (
    <div className={`${sizeClasses[size]} bg-gray-100 ${className}`}>
      <span className={`${textSizeClasses[size]} text-gray-800`}>O</span>
    </div>
  );
}

export function getPlatformIcon(platform: string, size: number = 24) {
  switch (platform.toLowerCase()) {
    case "temu":
      return <ShoppingBag size={size} />;
    case "amazon":
      return <Package size={size} />;
    default:
      return <ShoppingBag size={size} />;
  }
}

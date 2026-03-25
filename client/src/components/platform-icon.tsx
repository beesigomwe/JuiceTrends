import { SiFacebook, SiInstagram, SiLinkedin, SiTiktok, SiPinterest, SiYoutube } from "react-icons/si";
import { Twitter } from "lucide-react";
import type { PlatformType } from "@shared/schema";

interface PlatformIconProps {
  platform: PlatformType;
  className?: string;
}

const platformColors: Record<PlatformType, string> = {
  facebook: "text-[#1877F2]",
  instagram: "text-[#E4405F]",
  twitter: "text-foreground",
  linkedin: "text-[#0A66C2]",
  tiktok: "text-foreground",
  pinterest: "text-[#E60023]",
  youtube: "text-[#FF0000]",
};

export function PlatformIcon({ platform, className = "h-4 w-4" }: PlatformIconProps) {
  const colorClass = platformColors[platform];
  
  switch (platform) {
    case "facebook":
      return <SiFacebook className={`${className} ${colorClass}`} />;
    case "instagram":
      return <SiInstagram className={`${className} ${colorClass}`} />;
    case "twitter":
      return <Twitter className={`${className} ${colorClass}`} />;
    case "linkedin":
      return <SiLinkedin className={`${className} ${colorClass}`} />;
    case "tiktok":
      return <SiTiktok className={`${className} ${colorClass}`} />;
    case "pinterest":
      return <SiPinterest className={`${className} ${colorClass}`} />;
    case "youtube":
      return <SiYoutube className={`${className} ${colorClass}`} />;
    default:
      return null;
  }
}

export function getPlatformName(platform: PlatformType): string {
  const names: Record<PlatformType, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    twitter: "X (Twitter)",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
    pinterest: "Pinterest",
    youtube: "YouTube",
  };
  return names[platform];
}

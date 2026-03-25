import axios from "axios";
import type { SocialAccount } from "@shared/schema";

export async function fetchAccountStats(
  account: SocialAccount,
): Promise<{ followers: number; engagement: string }> {
  const token = account.accessToken;
  if (!token) {
    throw new Error("No access token");
  }

  switch (account.platform) {
    case "twitter": {
      const res = await axios.get("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${token}` },
        params: { "user.fields": "public_metrics" },
      });
      const metrics = res.data?.data?.public_metrics;
      const followers = metrics?.followers_count ?? account.followers ?? 0;
      return { followers, engagement: account.engagement ?? "0%" };
    }
    case "facebook": {
      const res = await axios.get(
        `https://graph.facebook.com/v21.0/${account.platformUserId}`,
        {
          params: {
            fields: "fan_count",
            access_token: token,
          },
        },
      );
      const followers = Number(res.data?.fan_count ?? account.followers ?? 0);

      let engagement = account.engagement ?? "0%";
      try {
        const insightsRes = await axios.get(
          `https://graph.facebook.com/v21.0/${account.platformUserId}/insights`,
          {
            params: {
              metric: "page_engaged_users,page_impressions",
              period: "days_28",
              access_token: token,
            },
          },
        );

        const insights = insightsRes.data?.data ?? [];
        const engaged = insights.find((m: any) => m.name === "page_engaged_users");
        const impressions = insights.find((m: any) => m.name === "page_impressions");

        const engagedValue = engaged?.values?.[0]?.value ?? 0;
        const impressionsValue = impressions?.values?.[0]?.value ?? 0;

        if (impressionsValue && impressionsValue > 0) {
          const rate = (engagedValue / impressionsValue) * 100;
          engagement = `${rate.toFixed(1)}%`;
        }
      } catch {
        // ignore engagement fetch failure; fall back to stored value
      }

      return { followers, engagement };
    }
    case "instagram": {
      const res = await axios.get(
        `https://graph.facebook.com/v21.0/${account.platformUserId}`,
        {
          params: {
            fields: "followers_count",
            access_token: token,
          },
        },
      );
      const followers = res.data?.followers_count ?? account.followers ?? 0;
      return { followers: Number(followers), engagement: account.engagement ?? "0%" };
    }
    case "linkedin": {
      try {
        const res = await axios.get(
          `https://api.linkedin.com/v2/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${account.platformUserId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const followers =
          res.data?.elements?.[0]?.followerCounts?.organicFollowerCount ??
          account.followers ??
          0;
        return { followers: Number(followers), engagement: account.engagement ?? "0%" };
      } catch {
        return { followers: account.followers ?? 0, engagement: account.engagement ?? "0%" };
      }
    }
    case "tiktok": {
      const res = await axios.get("https://open.tiktokapis.com/v2/user/info/", {
        headers: { Authorization: `Bearer ${token}` },
        params: { fields: "follower_count" },
      });
      const followers =
        res.data?.data?.user?.follower_count ?? account.followers ?? 0;
      return { followers: Number(followers), engagement: account.engagement ?? "0%" };
    }
    case "youtube": {
      const res = await axios.get(
        "https://www.googleapis.com/youtube/v3/channels",
        {
          params: {
            part: "statistics",
            id: account.platformUserId,
          },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const stats = res.data?.items?.[0]?.statistics;
      const followers = parseInt(stats?.subscriberCount ?? "0", 10) || (account.followers ?? 0);
      return { followers, engagement: account.engagement ?? "0%" };
    }
    case "pinterest": {
      try {
        const res = await axios.get("https://api.pinterest.com/v5/user_account", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const followers = res.data?.follower_count ?? account.followers ?? 0;
        return { followers: Number(followers), engagement: account.engagement ?? "0%" };
      } catch {
        return { followers: account.followers ?? 0, engagement: account.engagement ?? "0%" };
      }
    }
    default:
      return {
        followers: account.followers ?? 0,
        engagement: account.engagement ?? "0%",
      };
  }
}

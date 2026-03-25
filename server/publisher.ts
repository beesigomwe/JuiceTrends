/**
 * publisher.ts
 *
 * Per-platform publishing dispatcher.  Each function receives a post record and
 * the relevant connected social account (with decrypted access token) and makes
 * the actual API call to publish the content.
 *
 * Every publisher returns:
 *   { success: boolean, platformPostId?: string, error?: string }
 *
 * This result is stored in posts.publishResults so the UI can show per-platform
 * status even when only some platforms succeeded.
 */

import type { Post, SocialAccount } from "@shared/schema";

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}

const META_GRAPH_VERSION = "v21.0";

// ---------------------------------------------------------------------------
// Facebook Pages
// ---------------------------------------------------------------------------
export async function publishToFacebook(
  post: Post,
  account: SocialAccount
): Promise<PublishResult> {
  try {
    const token = account.accessToken;
    if (!token) return { success: false, error: "No access token available" };

    const pageId = account.platformUserId;
    const body: Record<string, string> = { message: post.content, access_token: token };

    // Attach first media URL as a link if present
    const mediaUrls = post.mediaUrls ?? [];
    if (mediaUrls.length > 0) {
      body.link = mediaUrls[0];
    }

    const res = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = (await res.json()) as { id?: string; error?: { message: string } };
    if (!res.ok || data.error) {
      return { success: false, error: data.error?.message ?? `HTTP ${res.status}` };
    }
    return { success: true, platformPostId: data.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Instagram (Graph API two-step container flow)
// ---------------------------------------------------------------------------
export async function publishToInstagram(
  post: Post,
  account: SocialAccount
): Promise<PublishResult> {
  try {
    const token = account.accessToken;
    if (!token) return { success: false, error: "No access token available" };

    const mediaUrls = post.mediaUrls ?? [];
    if (mediaUrls.length === 0) {
      return {
        success: false,
        error: "Instagram requires at least one image or video — text-only posts are not supported.",
      };
    }

    const igUserId = account.platformUserId;
    const mediaUrl = mediaUrls[0];
    const isVideo = /\.(mp4|mov|avi)$/i.test(mediaUrl);

    // Step 1: create media container
    const containerPayload: Record<string, string> = {
      access_token: token,
      caption: post.content,
    };
    if (isVideo) {
      containerPayload.media_type = "REELS";
      containerPayload.video_url = mediaUrl;
    } else {
      containerPayload.image_url = mediaUrl;
    }

    const containerRes = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${igUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(containerPayload),
      }
    );
    const containerData = (await containerRes.json()) as {
      id?: string;
      error?: { message: string };
    };
    if (!containerRes.ok || containerData.error) {
      return {
        success: false,
        error: containerData.error?.message ?? `Container creation failed: HTTP ${containerRes.status}`,
      };
    }

    const containerId = containerData.id!;

    // Step 2: publish the container
    const publishRes = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: containerId, access_token: token }),
      }
    );
    const publishData = (await publishRes.json()) as {
      id?: string;
      error?: { message: string };
    };
    if (!publishRes.ok || publishData.error) {
      return {
        success: false,
        error: publishData.error?.message ?? `Publish failed: HTTP ${publishRes.status}`,
      };
    }

    return { success: true, platformPostId: publishData.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Twitter / X
// ---------------------------------------------------------------------------
export async function publishToTwitter(
  post: Post,
  account: SocialAccount
): Promise<PublishResult> {
  try {
    const token = account.accessToken;
    if (!token) return { success: false, error: "No access token available" };

    const tweetBody: Record<string, unknown> = { text: post.content };

    // If media URLs are present, upload them first via v1.1 media/upload
    const mediaUrls = post.mediaUrls ?? [];
    if (mediaUrls.length > 0) {
      const mediaIds: string[] = [];
      for (const url of mediaUrls.slice(0, 4)) {
        // Download media and upload to Twitter
        const mediaRes = await fetch(url);
        const buffer = await mediaRes.arrayBuffer();
        const contentType = mediaRes.headers.get("content-type") ?? "image/jpeg";

        const formData = new FormData();
        formData.append("media", new Blob([buffer], { type: contentType }));

        const uploadRes = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const uploadData = (await uploadRes.json()) as {
          media_id_string?: string;
          error?: string;
        };
        if (uploadData.media_id_string) {
          mediaIds.push(uploadData.media_id_string);
        }
      }
      if (mediaIds.length > 0) {
        tweetBody.media = { media_ids: mediaIds };
      }
    }

    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tweetBody),
    });

    const data = (await res.json()) as {
      data?: { id: string };
      errors?: Array<{ message: string }>;
    };
    if (!res.ok || data.errors) {
      return {
        success: false,
        error: data.errors?.[0]?.message ?? `HTTP ${res.status}`,
      };
    }
    return { success: true, platformPostId: data.data?.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// LinkedIn
// ---------------------------------------------------------------------------
export async function publishToLinkedIn(
  post: Post,
  account: SocialAccount
): Promise<PublishResult> {
  try {
    const token = account.accessToken;
    if (!token) return { success: false, error: "No access token available" };

    const authorUrn = `urn:li:person:${account.platformUserId}`;

    const ugcPost: Record<string, unknown> = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: post.content },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(ugcPost),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${errorText}` };
    }

    const postId = res.headers.get("x-restli-id") ?? undefined;
    return { success: true, platformPostId: postId };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// TikTok (video-only)
// ---------------------------------------------------------------------------
export async function publishToTikTok(
  post: Post,
  account: SocialAccount
): Promise<PublishResult> {
  try {
    const token = account.accessToken;
    if (!token) return { success: false, error: "No access token available" };

    const mediaUrls = post.mediaUrls ?? [];
    const videoUrl = mediaUrls.find((u) => /\.(mp4|mov)$/i.test(u));
    if (!videoUrl) {
      return {
        success: false,
        error: "TikTok requires a video attachment — text-only and image-only posts are not supported.",
      };
    }

    // Step 1: initialise the upload
    const initRes = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          post_info: {
            title: post.content.slice(0, 150),
            privacy_level: "PUBLIC_TO_EVERYONE",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: videoUrl,
          },
        }),
      }
    );

    const initData = (await initRes.json()) as {
      data?: { publish_id: string };
      error?: { message: string };
    };
    if (!initRes.ok || initData.error) {
      return {
        success: false,
        error: initData.error?.message ?? `Init failed: HTTP ${initRes.status}`,
      };
    }

    return { success: true, platformPostId: initData.data?.publish_id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Pinterest
// ---------------------------------------------------------------------------
export async function publishToPinterest(
  post: Post,
  account: SocialAccount
): Promise<PublishResult> {
  try {
    const token = account.accessToken;
    if (!token) return { success: false, error: "No access token available" };

    const mediaUrls = post.mediaUrls ?? [];
    if (mediaUrls.length === 0) {
      return { success: false, error: "Pinterest requires at least one image." };
    }

    // boardId must be supplied via platformMetadata
    const boardId = post.platformMetadata?.pinterest?.boardId;
    if (!boardId) {
      return {
        success: false,
        error: "Pinterest requires a target board — set platformMetadata.pinterest.boardId.",
      };
    }

    const pinBody: Record<string, unknown> = {
      board_id: boardId,
      title: post.content.slice(0, 100),
      description: post.content,
      media_source: {
        source_type: "image_url",
        url: mediaUrls[0],
      },
    };

    const res = await fetch("https://api.pinterest.com/v5/pins", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pinBody),
    });

    const data = (await res.json()) as { id?: string; message?: string };
    if (!res.ok) {
      return { success: false, error: data.message ?? `HTTP ${res.status}` };
    }
    return { success: true, platformPostId: data.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// YouTube (video-only, resumable upload)
// ---------------------------------------------------------------------------
export async function publishToYouTube(
  post: Post,
  account: SocialAccount
): Promise<PublishResult> {
  try {
    const token = account.accessToken;
    if (!token) return { success: false, error: "No access token available" };

    const mediaUrls = post.mediaUrls ?? [];
    const videoUrl = mediaUrls.find((u) => /\.(mp4|mov|avi)$/i.test(u));
    if (!videoUrl) {
      return {
        success: false,
        error: "YouTube requires a video attachment.",
      };
    }

    const title =
      post.platformMetadata?.youtube?.title ?? post.content.slice(0, 100);
    const description =
      post.platformMetadata?.youtube?.description ?? post.content;

    // Step 1: initiate resumable upload session
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": "video/*",
        },
        body: JSON.stringify({
          snippet: { title, description, tags: post.hashtags ?? [] },
          status: { privacyStatus: "public" },
        }),
      }
    );

    if (!initRes.ok) {
      return { success: false, error: `YouTube upload init failed: HTTP ${initRes.status}` };
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) {
      return { success: false, error: "YouTube did not return an upload URL." };
    }

    // Step 2: stream the video from the stored URL to YouTube
    const videoRes = await fetch(videoUrl);
    const videoBuffer = await videoRes.arrayBuffer();

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": videoRes.headers.get("content-type") ?? "video/mp4",
        "Content-Length": String(videoBuffer.byteLength),
      },
      body: videoBuffer,
    });

    const uploadData = (await uploadRes.json()) as { id?: string; error?: { message: string } };
    if (!uploadRes.ok || uploadData.error) {
      return {
        success: false,
        error: uploadData.error?.message ?? `Upload failed: HTTP ${uploadRes.status}`,
      };
    }

    return { success: true, platformPostId: uploadData.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------
export async function publishToThreads(
  post: Post,
  account: SocialAccount
): Promise<PublishResult> {
  try {
    const token = account.accessToken;
    if (!token) return { success: false, error: "No access token available" };

    const threadsUserId = account.platformUserId;
    const mediaUrls = post.mediaUrls ?? [];

    // Step 1: create a container
    const containerPayload: Record<string, string> = {
      text: post.content,
      access_token: token,
    };

    if (mediaUrls.length > 0) {
      const mediaUrl = mediaUrls[0];
      const isVideo = /\.(mp4|mov)$/i.test(mediaUrl);
      containerPayload.media_type = isVideo ? "VIDEO" : "IMAGE";
      if (isVideo) {
        containerPayload.video_url = mediaUrl;
      } else {
        containerPayload.image_url = mediaUrl;
      }
    } else {
      containerPayload.media_type = "TEXT";
    }

    const containerRes = await fetch(
      `https://graph.threads.net/v1.0/${threadsUserId}/threads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(containerPayload),
      }
    );

    const containerData = (await containerRes.json()) as {
      id?: string;
      error?: { message: string };
    };
    if (!containerRes.ok || containerData.error) {
      return {
        success: false,
        error: containerData.error?.message ?? `Container creation failed: HTTP ${containerRes.status}`,
      };
    }

    const containerId = containerData.id!;

    // Step 2: publish
    const publishRes = await fetch(
      `https://graph.threads.net/v1.0/${threadsUserId}/threads_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: containerId, access_token: token }),
      }
    );

    const publishData = (await publishRes.json()) as {
      id?: string;
      error?: { message: string };
    };
    if (!publishRes.ok || publishData.error) {
      return {
        success: false,
        error: publishData.error?.message ?? `Publish failed: HTTP ${publishRes.status}`,
      };
    }

    return { success: true, platformPostId: publishData.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------
export async function publishPostToPlatform(
  post: Post,
  account: SocialAccount
): Promise<PublishResult> {
  switch (account.platform) {
    case "facebook":
      return publishToFacebook(post, account);
    case "instagram":
      return publishToInstagram(post, account);
    case "twitter":
      return publishToTwitter(post, account);
    case "linkedin":
      return publishToLinkedIn(post, account);
    case "tiktok":
      return publishToTikTok(post, account);
    case "pinterest":
      return publishToPinterest(post, account);
    case "youtube":
      return publishToYouTube(post, account);
    case "threads":
      return publishToThreads(post, account);
    default:
      return { success: false, error: `Unsupported platform: ${(account as SocialAccount).platform}` };
  }
}

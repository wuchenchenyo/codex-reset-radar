import { TIBO_DISPLAY_NAME, TIBO_USERNAME, type SocialPost } from "@/types";
import { getServerEnv } from "@/lib/env/server";
import { log } from "@/lib/logging";
import { SocialSource, SourceUnavailableError } from "@/services/social/source";

const X_API = "https://api.x.com/2";

interface XUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}

interface XTweet {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
}

interface XTimelineResponse {
  data?: XTweet[];
  includes?: { users?: XUser[] };
  errors?: Array<{ title?: string; detail?: string }>;
  title?: string;
  detail?: string;
}

export class XSource implements SocialSource {
  readonly id = "x";

  constructor(
    private readonly username = TIBO_USERNAME,
    private readonly bearerToken = getServerEnv().X_BEARER_TOKEN,
  ) {}

  async getLatestPosts(): Promise<SocialPost[]> {
    if (!this.bearerToken) {
      throw new SourceUnavailableError("X_BEARER_TOKEN is not configured");
    }

    const user = await this.getUser();
    const url = new URL(`${X_API}/users/${user.id}/tweets`);
    url.searchParams.set("max_results", "10");
    url.searchParams.set("exclude", "retweets,replies");
    url.searchParams.set("tweet.fields", "created_at,author_id,text");
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "name,username,profile_image_url");

    const payload = await this.request<XTimelineResponse>(url);
    const tweets = payload.data ?? [];
    const users = new Map(
      (payload.includes?.users ?? []).map((item) => [item.id, item]),
    );

    return tweets.map((tweet) => {
      const author = (tweet.author_id && users.get(tweet.author_id)) || user;
      return {
        externalId: tweet.id,
        platform: "x",
        authorName: author.name || TIBO_DISPLAY_NAME,
        authorUsername: author.username || this.username,
        content: tweet.text,
        url: `https://x.com/${author.username || this.username}/status/${tweet.id}`,
        publishedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
        rawData: { tweet, author },
      };
    });
  }

  private async getUser(): Promise<XUser> {
    const url = new URL(`${X_API}/users/by/username/${this.username}`);
    url.searchParams.set("user.fields", "name,username,profile_image_url");
    const payload = await this.request<{ data?: XUser; errors?: unknown }>(url);
    if (!payload.data?.id) {
      throw new SourceUnavailableError(`X user @${this.username} was not found`);
    }
    return payload.data;
  }

  private async request<T>(url: URL): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
        },
        cache: "no-store",
      });
    } catch (error) {
      throw new SourceUnavailableError("X API network error", error);
    }

    if (response.status === 429) {
      log.warn("x_rate_limited", { status: 429 });
      throw new SourceUnavailableError("X API rate limited");
    }

    if (!response.ok) {
      const body = await response.text();
      log.warn("x_api_error", { status: response.status });
      throw new SourceUnavailableError(
        `X API failed with HTTP ${response.status}${body ? `: ${body.slice(0, 180)}` : ""}`,
      );
    }

    return (await response.json()) as T;
  }
}

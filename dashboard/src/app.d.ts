interface ApiService {
  fetch(input: Request): Promise<Response>;
}

declare global {
  namespace App {
    interface Platform {
      env: {
        API_BASE_URL: string;
        CONTENT_BASE_URL: string;
        API?: ApiService;
      };
      cf?: unknown;
      ctx?: ExecutionContext;
    }
    interface Locals {
      apiKey: string | null;
      apiBase: string;
      contentBase: string;
      apiService: ApiService | null;
    }
    interface PageData {
      authed?: boolean;
    }
  }
}

export {};

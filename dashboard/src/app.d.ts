interface ApiService {
  fetch(input: Request): Promise<Response>;
}

declare global {
  namespace App {
    interface Locals {
      apiKey: string | null;
      sessionId: string | null;
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
